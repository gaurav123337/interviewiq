/* Bounded paired task orchestration. Transport/browser are injected; the CLI
 * uses actual backend actions and Playwright. No legacy AI or memory fallback. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { adapterForJob, validateSubmissionEvidence } from './apply-adapters-lib.js';
import { buildVerifiedResume, classifyQuestion, decideVerifiedJob, isTrustedResumeField, questionBatchKey, resolveVerifiedAnswer, validateInPlaceApplication, validateVerifiedProfile } from './apply-pipeline-lib.js';

export const PIPELINE_ENGINE_VERSION = 'paired-worker/1.1.0';
const capabilities = ['leased-tasks', 'verified-answer-bank', 'job-bound-receipts', 'human-signin', 'session-check', 'verified-match-learning'];
const iso = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const terminalAuth = error => ['PIPELINE_REVOKED', 'PIPELINE_STALE'].includes(error?.code);
const sleep = (ms, signal) => new Promise(resolve => {
  if (signal?.aborted) return resolve();
  const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); };
  const timer = setTimeout(done, ms);
  signal?.addEventListener('abort', done, { once: true });
});

export function normalizePipelineProfile(row) {
  if (!row) return null;
  return { revision: row.revision, facts: row.facts, resumeText: row.resume_text, resumeApproved: row.resume_approved };
}
export function normalizePipelineAnswers(rows) {
  if (!Array.isArray(rows)) throw new Error('Malformed answer bank');
  return rows.filter(row => !row.revoked_at).map(row => ({ id: row.id, meaning: row.meaning, question: row.question_text,
    controlType: row.control_type, options: row.options, context: row.context, scope: row.scope, scopeKey: row.scope_key || undefined,
    answer: row.answer, confirmedAt: row.confirmed_at, validUntil: row.expires_at || undefined,
    profileRevision: row.profile_revision, source: row.provenance, autoReuse: row.provenance === 'user' }));
}
function leaseArgs(task) { return { taskId: task.id, leaseVersion: task.lease_version, leaseNonce: task.lease_nonce }; }
function assertTask(task, bindingId) {
  if (!task || typeof task.id !== 'string' || !Number.isSafeInteger(task.lease_version) || task.lease_version < 1
    || typeof task.lease_nonce !== 'string' || !Number.isFinite(Date.parse(task.lease_until))
    || Date.parse(task.lease_until) <= Date.now() || task.status !== 'in_progress'
    || task.target_binding_id && task.target_binding_id !== bindingId) throw new Error('Malformed or stale claimed task');
}
function safeError(error) {
  return terminalAuth(error) ? 'Authorization or task lease rejected' : error?.code === 'PIPELINE_OFFLINE'
    ? 'Backend offline; no submission attempted' : 'Application step failed; no candidate details recorded';
}

export async function createApprovedResumeArtifact(profile, runtime) {
  const resume = buildVerifiedResume(profile);
  if (!resume.ok) throw new Error('Approved resume is required');
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  let page = document.addPage([595, 842]), y = 802;
  // No translation, tailoring or JD-derived additions. Unsupported glyphs fail closed.
  for (const paragraph of resume.text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/), lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, 11) > 510 && line) { lines.push(line); line = word; }
      else line = next;
    }
    lines.push(line);
    for (const text of lines) {
      if (y < 40) { page = document.addPage([595, 842]); y = 802; }
      page.drawText(text, { x: 40, y, size: 11, font }); y -= 16;
    }
  }
  const bytes = Buffer.from(await document.save());
  const sha256 = hash(bytes), textSha256 = hash(resume.text);
  const dir = path.join(runtime.stateRoot, 'approved-artifacts');
  mkdirSync(dir, { recursive: true });
  const artifactPath = path.join(dir, `${profile.revision}-${sha256}.pdf`);
  writeFileSync(artifactPath, bytes, { mode: 0o600 });
  const metadata = { bindingId: runtime.bindingId, profileRevision: profile.revision, sha256, textSha256 };
  writeFileSync(`${artifactPath}.json`, JSON.stringify(metadata), { mode: 0o600 });
  return { path: artifactPath, ...metadata };
}
export function verifyApprovedResumeArtifact(artifact, profile, runtime) {
  if (!artifact || artifact.bindingId !== runtime.bindingId || artifact.profileRevision !== profile.revision
    || artifact.textSha256 !== hash(profile.resumeText) || profile.resumeApproved !== true
    || path.dirname(artifact.path) !== path.join(runtime.stateRoot, 'approved-artifacts')
    || hash(readFileSync(artifact.path)) !== artifact.sha256) throw new Error('Resume artifact binding/revision/hash mismatch');
  return artifact.path;
}

export function createPipelineWorker({ runtime, action, browser, signal, notify, notifySummary, discover,
  pollMs = 5000, leaseSeconds = 90, maxSteps = 30, maxTaskMs = 120000, onState = () => {} } = {}) {
  if (runtime?.mode !== 'paired' || typeof action !== 'function' || !browser) throw new Error('Paired worker dependencies required');
  if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 300) throw new Error('Invalid task lease duration');
  mkdirSync(runtime.stateRoot, { recursive: true });
  const ledgerPath = path.join(runtime.stateRoot, 'submission-ledger.json');
  let ledger = {};
  if (existsSync(ledgerPath)) {
    try { ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')); }
    catch { throw new Error('Submission ledger unreadable; manual recovery required'); }
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) throw new Error('Submission ledger malformed');
  }
  const loginController = new AbortController();
  signal?.addEventListener('abort', () => loginController.abort(), { once: true });
  let paused = false, stopped = false, state = 'offline', loginPending = null, profileMetadata, lastDiscovery = 0;
  const summaries = new Map();
  const notifiedEvents = new Set();
  const recordNotification = async event => {
    if (notifiedEvents.has(event.eventId)) return;
    notifiedEvents.add(event.eventId);
    let batch = summaries.get(event.runId);
    if (!batch) { batch = { runId: event.runId, startedAt: event.occurredAt, endedAt: event.occurredAt, results: [], reported: false }; summaries.set(event.runId, batch); }
    batch.endedAt = event.occurredAt; batch.results.push({ result: event.status === 'submitted' ? 'submitted' : event.status === 'failed' ? 'error' : 'needs_review' });
    if (notify) await notify(event).catch(() => {});
  };
  const emit = status => { state = status; onState({ status, engineVersion: PIPELINE_ENGINE_VERSION, bindingId: runtime.bindingId, at: iso() }); };
  const call = async (name, args = {}) => {
    if (stopped || signal?.aborted) throw Object.assign(new Error('Worker stopped'), { code: 'PIPELINE_STALE' });
    const data = await action(name, args);
    if (!data || typeof data !== 'object' || data.error || data.ok === false) throw Object.assign(new Error('Pipeline action denied'), { code: 'PIPELINE_STALE' });
    return data;
  };
  const saveLedger = () => {
    const temporary = `${ledgerPath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(ledger), { mode: 0o600 }); renameSync(temporary, ledgerPath);
  };
  async function heartbeat() {
    await call('agent.heartbeat', { engineVersion: PIPELINE_ENGINE_VERSION, capabilities,
      status: paused ? 'paused' : 'ready', ...(profileMetadata ? { profileMetadata } : {}) });
  }
  async function readLearning() {
    const learning = { feedback: [], grants: [] };
    for (let offset = 0; offset < 10000; offset += 200) {
      const page = await call('learning.list', offset ? { limit: 200, offset } : {});
      if (!page.learning || !Array.isArray(page.learning.feedback) || !Array.isArray(page.learning.grants)
        || page.learning.feedback.length > 200 || page.learning.grants.length > 200
        || page.hasMore !== undefined && typeof page.hasMore !== 'boolean') throw new Error('Verified match learning unavailable; no browser activity permitted');
      learning.feedback.push(...page.learning.feedback);
      learning.grants.push(...page.learning.grants);
      if (page.hasMore !== true) return learning;
    }
    // A partial ledger could hide a skip or revocation. Never proceed after a
    // bounded read fails to reach the end of the account's learning history.
    throw new Error('Verified match learning exceeds bounded complete read; no browser activity permitted');
  }
  async function snapshots() {
    const p = await call('profile.get'), s = await call('settings.get'), a = await call('answers.list', { limit: 200 });
    const learning = await readLearning();
    const profile = normalizePipelineProfile(p.profile), settings = s.settings?.data;
    if (!profile || !validateVerifiedProfile(profile, Date.now()).ok || !Number.isSafeInteger(s.settings?.revision)
      || !settings || typeof settings.enabled !== 'boolean' || typeof settings.autoSubmit !== 'boolean'
      || !Number.isFinite(settings.threshold)) throw new Error('Confirmed profile/settings unavailable');
    profileMetadata = { revision: profile.revision, resumeApproved: profile.resumeApproved };
    return { profile, settings, settingsRevision: s.settings.revision, learning,
      answersRevision: p.profile.answers_revision, answers: normalizePipelineAnswers(a.answers) };
  }
  async function recordDecision(task, snapshot) {
    const decision = decideVerifiedJob(task.job, { ...snapshot, now: Date.now() });
    const result = await call('tasks.decide', { ...leaseArgs(task), decision: { ...decision, settingsRevision: snapshot.settingsRevision } });
    const expected = decision.status === 'eligible_auto' ? 'in_progress' : decision.status === 'eligible_review' ? 'waiting_review' : decision.status;
    if (result.task?.status !== expected || result.task.match_decision?.similarityKey !== decision.similarityKey) {
      throw Object.assign(new Error('Current match decision was not recorded'), { code: 'PIPELINE_STALE' });
    }
    return decision;
  }
  async function commands() {
    const data = await call('commands.claim', { limit: 10 });
    if (!Array.isArray(data.commands)) throw new Error('Malformed agent commands');
    for (const command of data.commands) {
      if (command.binding_id !== runtime.bindingId || typeof command.claim_nonce !== 'string' || !command.claim_nonce) throw new Error('Wrong command binding or missing claim nonce');
      const commandReport = (status, reason) => call('commands.report', { commandId: command.id, claimNonce: command.claim_nonce,
        status, ...(reason ? { reason } : {}) });
      if (command.type === 'pause' || command.type === 'resume') {
        paused = command.type === 'pause';
        await commandReport('done');
      } else if (['retry_login', 'check_session', 'open_question', 'open_manual'].includes(command.type)) {
        // The claim supplies an owner/binding-derived exact job; caller args never supply navigation.
        const job = command.job, adapter = adapterForJob(job);
        const question = command.question;
        const portal = adapter.supported ? new URL(job.jobUrl).hostname : '';
        const validQuestion = command.type !== 'open_question' || (question?.id === command.args?.questionId
          && question.status === 'pending' && question.task_ids?.includes(command.task_id)
          && typeof question.question_text === 'string' && Array.isArray(question.options)
          && typeof browser.review === 'function');
        const serverPortal = typeof job?.portal === 'string' && job.portal.length <= 500 && !/[:/?#\s]/.test(job.portal) ? job.portal : null;
        const validPortal = ['open_question', 'open_manual'].includes(command.type) || [portal, adapter.id, adapter.boardIdentity, serverPortal].filter(Boolean).includes(command.args?.portal);
        const validManual = command.type !== 'open_manual' || command.args?.taskId === command.task_id && typeof browser.manual === 'function';
        if (!adapter.supported || !adapter.safeUrl || typeof command.task_id !== 'string' || !command.task_id
          || !validQuestion || !validPortal || !validManual || loginPending) {
          await commandReport('failed', 'Exact bound command context unavailable, changed, or human window already running');
          continue;
        }
        const run = async () => {
          let handle;
          try {
            if (command.type === 'open_manual') {
              const result = await browser.manual(job, { signal: loginController.signal });
              if (loginPending?.commandId === command.id) loginPending.released = true;
              if (result.before && result.after) {
                await call('sessions.report', { portal: adapter.boardIdentity, status: 'authenticated', accountLabel: result.after.accountIdentity });
                await call('learning.manual_observe', { commandId: command.id, claimNonce: command.claim_nonce, before: result.before, after: result.after });
              }
              await commandReport(result.opened ? 'done' : 'failed', result.before && result.after
                ? 'Manual receipt observation recorded independently; no worker application click'
                : 'Manual job window opened; no observed application receipt or application success claimed');
            } else if (command.type === 'open_question') {
              const result = await browser.review(job, question, { signal: loginController.signal });
              if (loginPending?.commandId === command.id) loginPending.released = true;
              await commandReport(result.opened ? 'done' : 'failed', result.opened
                ? 'Human review window opened; no answer, submission or application success claimed'
                : 'The exact live question could not be opened for review');
            } else {
              const result = command.type === 'retry_login' ? await browser.login(job, { signal: loginController.signal })
                : (handle = await browser.open(job), await handle.session());
              await handle?.close(); handle = null;
              // Release the local portal before the backend wakes its waiting-login tasks.
              if (loginPending?.commandId === command.id) loginPending.released = true;
              await call('sessions.report', { portal, status: result.ok ? 'authenticated' : 'login_required' });
              await commandReport(result.ok ? 'done' : 'failed', result.ok ? undefined : 'Positive account/session verification not observed');
            }
          } catch { await commandReport('failed', 'Sign-in/session/review failed safely').catch(() => {}); }
          finally { await handle?.close(); }
        };
        const pending = { adapterId: adapter.id, commandId: command.id, type: command.type, released: false, promise: null };
        loginPending = pending;
        pending.promise = run().finally(() => { if (loginPending === pending) loginPending = null; });
      } else await commandReport('failed', 'Unsupported command');
    }
  }
  async function report(task, status, reason, evidence) {
    const result = await call('tasks.report', { ...leaseArgs(task), status, reason: reason.slice(0, 1900), ...(evidence ? { evidence } : {}) });
    if (result.task?.status !== status) throw Object.assign(new Error('Task result was not recorded'), { code: 'PIPELINE_STALE' });
    await recordNotification({ taskId: task.id, runId: task.run_id, eventId: `${task.id}:${task.lease_version}:${status}`, status,
      title: task.job.title, company: task.job.company, jobUrl: task.job.jobUrl, occurredAt: iso() });
    return result;
  }
  async function processTask(task) {
    assertTask(task, runtime.bindingId);
    const jobKey = hash(task.job.jobUrl);
    const adapter = adapterForJob(task.job);
    const portal = task.job.portal || new URL(task.job.jobUrl).hostname;
    if (ledger[jobKey]) return report(task, 'unverified', 'Prior irreversible attempt recorded; manual reconciliation required');
    if (!adapter.supported || !adapter.safeUrl) return report(task, 'unsupported', 'Unknown or unqualified portal; no browser opened');
    if (loginPending?.adapterId === adapter.id && !loginPending.released) return report(task, loginPending.type === 'retry_login' ? 'waiting_login' : 'waiting_review', 'Human window owns this portal; retry after it closes');
    const start = Date.now();
    let steps = 0, handle, reservation, renewError, renewalRunning = false;
    const checkpoint = async () => {
      if (renewError) throw renewError;
      if (paused || stopped || signal?.aborted || Date.now() - start > maxTaskMs || ++steps > maxSteps) throw new Error('Task interrupted or bounded steps exceeded');
      const renewed = await call('tasks.renew', { ...leaseArgs(task), leaseSeconds });
      if (renewed.task?.status !== 'in_progress' || renewed.task.lease_version !== task.lease_version
        || renewed.task.lease_nonce !== task.lease_nonce || Date.parse(renewed.task.lease_until) <= Date.now()) {
        throw Object.assign(new Error('Task no longer active'), { code: 'PIPELINE_STALE' });
      }
    };
    const renewal = setInterval(async () => {
      if (renewalRunning) return; renewalRunning = true;
      try { await call('tasks.renew', { ...leaseArgs(task), leaseSeconds }); await heartbeat(); }
      catch (error) { renewError = error; }
      finally { renewalRunning = false; }
    }, Math.max(1000, Math.floor(leaseSeconds * 1000 / 3)));
    try {
      const initial = await snapshots();
      if (!initial.settings.enabled || paused) return report(task, 'waiting_review', 'Automation is disabled or paused');
      if (initial.profile.revision !== task.profile_revision || initial.settingsRevision !== task.settings_revision
        || initial.answersRevision !== task.answers_revision) return report(task, 'waiting_review', 'Profile/settings/answers changed; request a fresh task');
      const decision = await recordDecision(task, initial);
      // Review/preferences are not authority to open, fill or click a job. The
      // separate human-owned manual command only navigates and observes receipts.
      if (decision.status !== 'eligible_auto') return { status: decision.status };
      if (!initial.settings.autoSubmit) return report(task, 'waiting_review', 'Auto-submit is disabled; open the job manually without automatic filling');
      if (adapter.id === 'linkedin' || adapter.id === 'workday') return report(task, 'waiting_review', 'This portal requires manual application review; no automatic multistep promise');
      await checkpoint();
      handle = await browser.open(task.job);
      const session = await handle.session();
      await call('sessions.report', { portal, status: session.ok ? 'authenticated' : 'login_required' });
      if (!session.ok) return report(task, 'waiting_login', 'Positive application/account session not verified');
      await checkpoint();
      const fields = await handle.fields();
      if (!Array.isArray(fields) || fields.length > 200) return report(task, 'unsupported', 'No bounded application form observed');
      let inPlace;
      if (fields.length === 0) {
        inPlace = await handle.inPlaceEvidence?.();
        const gate = validateInPlaceApplication({ job: task.job, profile: initial.profile, evidence: inPlace, now: Date.now() });
        if (!gate.ok) return report(task, 'waiting_review', 'Saved portal account/profile/resume require exact user confirmation and visible readiness');
      }
      const pending = [], fills = [], files = [], leaves = [], answerIds = [];
      const queueQuestion = async (field, resolution) => {
        const classified = classifyQuestion(field, task.job);
        const scoped = classified.scope !== 'global' && !classified.scopeKey ? {
          scope: 'application', scopeKey: task.job.jobUrl,
          context: { ...classified.context, application: task.job.jobUrl } } : classified;
        const controlType = ['file', 'unknown'].includes(classified.controlType) ? 'text' : classified.controlType;
        await checkpoint();
        return call('questions.queue', { ...leaseArgs(task), question: { meaning: classified.meaning.slice(0, 200),
          questionText: classified.question || 'Required application field', controlType, options: classified.options,
          context: scoped.context, scope: scoped.scope, ...(scoped.scopeKey ? { scopeKey: scoped.scopeKey } : {}),
          questionKey: questionBatchKey(field, task.job), reason: resolution.reason || 'Confirmed user answer required',
          profileRevision: initial.profile.revision } });
      };
      for (const field of fields) {
        if (field.controlType === 'file') {
          if (isTrustedResumeField(field, task.job)) files.push(field);
          else if (field.required) pending.push({ field, resolution: { kind: 'ask', ...classifyQuestion(field, task.job), reason: 'Explicit approved artifact required' } });
          else leaves.push(field);
          continue;
        }
        const resolution = resolveVerifiedAnswer(field, { ...initial, job: task.job, now: Date.now() });
        if (resolution.kind === 'fill') { fills.push({ field, resolution }); if (resolution.answerId) answerIds.push(resolution.answerId); }
        else if (field.required && resolution.kind !== 'optionalLeave') pending.push({ field, resolution });
        else leaves.push(field);
      }
      if (pending.length) {
        for (const { field, resolution } of pending) await queueQuestion(field, resolution);
        return report(task, pending.some(p => p.resolution.kind === 'manualAttestation') ? 'waiting_review' : 'waiting_answer', 'Required questions queued; no inferred answers or submission');
      }
      for (const { field, resolution } of fills.filter(item => item.resolution.answerId)) {
        const attached = await queueQuestion(field, resolution);
        if (attached.question?.status !== 'answered' || attached.question.answer_id !== resolution.answerId) {
          return report(task, 'waiting_answer', 'Saved answer requires a current exact live-question association');
        }
      }
      if (!buildVerifiedResume(initial.profile).ok) return report(task, 'waiting_review', 'User-approved resume required');
      for (const field of leaves) {
        await checkpoint();
        if (!handle.clear || !await handle.clear(field)) return report(task, 'waiting_review', 'Optional unconfirmed value cannot be safely cleared');
      }
      for (const { field, resolution } of fills) { await checkpoint(); await handle.fill(field, resolution.value); }
      let artifact;
      if (files.length) {
        artifact = await createApprovedResumeArtifact(initial.profile, runtime);
        for (const field of files) { await checkpoint(); await handle.upload(field, verifyApprovedResumeArtifact(artifact, initial.profile, runtime)); }
      }
      if (!adapter.autoSubmit || !initial.settings.autoSubmit) return report(task, 'waiting_review', 'Completed verified form awaits explicit submission policy');
      await checkpoint();
      const current = await snapshots();
      if (!current.settings.enabled || !current.settings.autoSubmit || current.profile.revision !== initial.profile.revision
        || current.settingsRevision !== initial.settingsRevision || current.answersRevision !== initial.answersRevision) return report(task, 'waiting_review', 'Submission settings/profile/answers changed during form fill');
      const currentDecision = await recordDecision(task, current);
      if (currentDecision.status !== 'eligible_auto' || currentDecision.grantId !== decision.grantId) return { status: currentDecision.status };
      const finalSession = await handle.session();
      const expected = [...fills.map(item => ({ field: item.field, value: item.resolution.value })),
        ...files.map(field => ({ field, artifact: artifact?.path })), ...leaves.map(field => ({ field, empty: true }))];
      if (!handle.verifyFilled || !await handle.verifyFilled(expected)) {
        return report(task, 'waiting_review', 'Live form metadata or verified answers changed before submission');
      }
      const finalFields = await handle.fields();
      if (JSON.stringify(finalFields) !== JSON.stringify(fields)) return report(task, 'waiting_review', 'New or changed fields require another verified review');
      for (const field of finalFields.filter(field => field.required && field.controlType !== 'file')) {
        const resolution = resolveVerifiedAnswer(field, { ...current, job: task.job, now: Date.now() });
        if (resolution.kind !== 'fill' || !fills.some(item => item.field.id === field.id && item.resolution.value === resolution.value)) {
          return report(task, 'waiting_review', 'Required field lacks current verified answer provenance');
        }
      }
      if (['naukri', 'instahyre'].includes(adapter.id)) {
        const identity = (await handle.inPlaceEvidence?.())?.accountIdentity;
        if (identity) await call('sessions.report', { portal, status: finalSession.ok ? 'authenticated' : 'login_required', accountLabel: identity });
      }
      if (inPlace && !validateInPlaceApplication({ job: task.job, profile: current.profile,
        evidence: await handle.inPlaceEvidence?.(), now: Date.now() }).ok) return report(task, 'waiting_review', 'Saved portal account/profile changed before submission');
      if (!finalSession.ok || !await handle.complete()) return report(task, 'waiting_review', 'Final account/required-control verification failed');
      if (!handle.verifyFilled || !await handle.verifyFilled(expected)) return report(task, 'waiting_review', 'Live verified or cleared optional values changed at submission boundary');
      const before = await handle.snapshot();
      if (before.receipt) return report(task, 'unverified', 'Application receipt existed before worker click; reconcile manually');
      await checkpoint();
      const reserved = await call('submission.reserve', { ...leaseArgs(task), profileRevision: current.profile.revision,
        settingsRevision: current.settingsRevision, answersRevision: current.answersRevision,
        grantId: currentDecision.grantId, similarityKey: currentDecision.similarityKey,
        siteAllowed: adapter.autoSubmit === true, accountVerified: finalSession.ok === true, requiredComplete: true,
        answerIds: [...new Set(answerIds)], idempotencyKey: `${runtime.bindingId}:${task.id}:${task.lease_version}` });
      reservation = reserved.reservation;
      if (!reservation?.id || !reservation.nonce || reservation.status !== 'reserved') throw new Error('Submission reservation was not approved');
      // Persist uncertainty BEFORE the click. A killed worker must never retry this job.
      ledger[jobKey] = { taskId: task.id, reservationId: reservation.id, status: 'uncertain', at: iso() }; saveLedger();
      if (renewError || stopped || signal?.aborted || paused) throw new Error('Submission interrupted before click');
      const clickedAt = iso();
      const after = await handle.submit(reservation);
      const verified = validateSubmissionEvidence(task.job, { before, after, clickedAt, now: Date.now() });
      if (process.env.INTERVIEWIQ_APPLY_SYNTHETIC === '1' && !verified.verified) console.error('Synthetic receipt diagnostic', verified.reason);
      const evidence = verified.verified ? { kind: 'confirmation_page', text: after.receipt.text, url: after.url } : undefined;
      const finished = await call('submission.finish', { ...leaseArgs(task), reservationId: reservation.id, reservationNonce: reservation.nonce,
        outcome: verified.status, ...(evidence ? { evidence } : {}) });
      if (finished.reservation?.status !== verified.status) throw new Error('Submission result not acknowledged');
      ledger[jobKey].status = verified.status; saveLedger();
      await recordNotification({ taskId: task.id, runId: task.run_id, eventId: `${task.id}:${task.lease_version}:${verified.status}`, status: verified.status,
        title: task.job.title, company: task.job.company, jobUrl: task.job.jobUrl, occurredAt: iso() });
      return { status: verified.status };
    } catch (error) {
      if (process.env.INTERVIEWIQ_APPLY_SYNTHETIC === '1') console.error('Synthetic task diagnostic', steps, error.stack);
      if (reservation) {
        await call('submission.finish', { ...leaseArgs(task), reservationId: reservation.id, reservationNonce: reservation.nonce,
          outcome: 'unverified' }).catch(() => {});
        return { status: 'unverified' };
      }
      if (error?.code === 'PIPELINE_REVOKED') { stopped = true; emit('revoked'); }
      if (terminalAuth(error)) return { status: 'lease_rejected' };
      await report(task, 'failed', safeError(error)).catch(() => {});
      return { status: 'failed' };
    } finally { clearInterval(renewal); await handle?.close(); }
  }
  async function run({ maxCycles = Infinity } = {}) {
    let cycles = 0, backoff = pollMs;
    try {
      while (!stopped && !signal?.aborted && cycles++ < maxCycles) {
        try {
          await heartbeat(); await commands(); emit(paused ? 'paused' : 'ready');
          if (!paused) {
            if (discover && Date.now() - lastDiscovery > 900000) { await discover({ action: call, signal }); lastDiscovery = Date.now(); }
            const data = await call('tasks.claim', { limit: 1, leaseSeconds });
            if (!Array.isArray(data.tasks)) throw new Error('Malformed claimed tasks');
            for (const task of data.tasks) { if (stopped || signal?.aborted || paused) break; await processTask(task); }
            if (data.tasks.length === 0 && notifySummary) {
              for (const batch of summaries.values()) if (!batch.reported) {
                batch.reported = true;
                await notifySummary({ ...batch, site: `Recorded task batch ${batch.runId} (queue idle; not a completed-run claim)` }).catch(() => {});
              }
            }
          }
          backoff = pollMs;
        } catch (error) {
          if (error?.code === 'PIPELINE_REVOKED') { stopped = true; emit('revoked'); break; }
          emit('offline'); backoff = Math.min(60000, Math.max(pollMs, backoff * 2));
        }
        if (cycles < maxCycles) await sleep(backoff, signal);
      }
    } finally {
      stopped = true;
      loginController.abort();
      await loginPending?.promise.catch(() => {});
      await browser.close();
      // A final heartbeat is best-effort only, never a reason to keep a revoked worker alive.
      await action('agent.heartbeat', { engineVersion: PIPELINE_ENGINE_VERSION, capabilities, status: 'offline',
        ...(profileMetadata ? { profileMetadata } : {}) }).catch(() => {});
      emit('offline');
    }
    return { cycles: Math.min(cycles, maxCycles), status: state };
  }
  return { run, processTask, stop: () => { stopped = true; loginController.abort(); }, getState: () => ({ status: state, paused, engineVersion: PIPELINE_ENGINE_VERSION }) };
}
