/* Synthetic ONLY integration target: real Node child + real ephemeral
 * Playwright browser, loopback backend contract service, no account secrets. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolveApplyAgentDataRoot, deriveBindingStateRoot } from '../../scripts/apply-agent-context.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bindingId = '65dfaf34-9194-4bc9-a717-ea3f9aa56fc2';
const fakeToken = `aiq1_${bindingId}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stamped = value => ({ value, source: 'user', confirmedAt: new Date(Date.now() - 1000).toISOString() });
const job = (id, company = 'Fixture Co') => ({ jobUrl: `https://boards.greenhouse.io/fixture/jobs/${id}`, title: 'Software Engineer', company,
  description: 'Synthetic software engineer position', skills: ['JavaScript'], location: 'Remote', country: 'US', postedAt: new Date().toISOString() });
const task = snapshot => ({ id: randomUUID(), run_id: randomUUID(), target_binding_id: bindingId, job: snapshot, status: 'queued',
  lease_version: 0, lease_nonce: null, lease_until: null, profile_revision: 1, settings_revision: 1, answers_revision: 0 });

export async function runWorkerFixture({ mode = 'reuse', nodePath = process.execPath, sqlBackend } = {}) {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'interviewiq-pipeline-fixture-'));
  const stateHome = path.join(sandbox, 'state-home'); mkdirSync(stateHome, { recursive: true });
  const browserCache = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local'), 'ms-playwright')
    : process.platform === 'darwin' ? path.join(homedir(), 'Library', 'Caches', 'ms-playwright')
      : path.join(process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache'), 'ms-playwright'));
  const fixtureEnv = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserCache, LOCALAPPDATA: stateHome,
    XDG_STATE_HOME: stateHome, HOME: stateHome };
  const bindingState = deriveBindingStateRoot(resolveApplyAgentDataRoot({ env: fixtureEnv, home: stateHome }), bindingId);
  assert(bindingState.startsWith(stateHome + path.sep), 'Fixture state must remain in its own sandbox');
  const events = [], questions = new Map(), posts = [], commands = [], claimedCommands = new Map();
  const warnings = [];
  const profile = { revision: 1, answers_revision: 0, facts: { name: stamped('Fixture Person'), firstName: stamped('Fixture'), lastName: stamped('Person'),
    email: stamped('fixture@example.invalid'), skills: stamped(['JavaScript']), role: stamped('Software Engineer'), locations: stamped(['Remote']) },
    resume_text: 'Fixture Person\nVerified JavaScript engineer\nUser-approved synthetic resume.', resume_approved: true };
  const settings = { revision: 1, data: { enabled: true, autoSubmit: true, threshold: 60, dailyCap: 10, weeklyCap: 50, employerDailyCap: 5,
    roles: ['Software Engineer'], locations: ['Remote'], excludeCompanies: [], countries: [], maxAgeDays: 14,
    requireWorkAuthorization: false, allowSponsorship: true, aiConsent: false, timeZone: 'UTC' } };
  let answers = [], resumeUploaded = false, answered = false, reserved = false, worker, output = '', crashKilled = false;
  const ownedPids = new Set();
  const captureOwnedPids = async () => {
    if (process.platform !== 'win32') return;
    const script = `$rows=Get-CimInstance Win32_Process; $ids=@(${worker.pid}); for($i=0;$i -lt 8;$i++){ $next=@($rows | Where-Object { $ids -contains [int]$_.ParentProcessId } | ForEach-Object { [int]$_.ProcessId }); $ids=@($ids+$next | Select-Object -Unique) }; $ids | ForEach-Object { Write-Output $_ }`;
    const probe = spawn('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let text = ''; probe.stdout.on('data', chunk => { text += chunk; }); await once(probe, 'exit');
    for (const value of text.split(/\s+/)) if (/^\d+$/.test(value)) ownedPids.add(Number(value));
  };
  let stopping = false, stopPromise;
  const stopOwnedTree = () => {
    if (stopping || !worker?.pid) return; stopping = true;
    stopPromise = (async () => {
      if (process.platform === 'win32') {
        // Capture descendants while the known spawned root is alive; never sweep unrelated browsers.
        const script = `$rows=Get-CimInstance Win32_Process; $ids=@(${[worker.pid, ...ownedPids].join(',')}); for($i=0;$i -lt 8;$i++){ $next=@($rows | Where-Object { $ids -contains [int]$_.ParentProcessId } | ForEach-Object { [int]$_.ProcessId }); $ids=@($ids+$next | Select-Object -Unique) }; foreach($id in ($ids | Sort-Object -Descending)){ Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }`;
        const killer = spawn('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore', windowsHide: true });
        await once(killer, 'exit');
      } else {
        const exited = once(worker, 'exit');
        try { process.kill(-worker.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
        let timer;
        await Promise.race([exited, new Promise(resolve => { timer = setTimeout(resolve, 5000); })]);
        clearTimeout(timer);
        // A stuck fixture must not hold CI forever; only our detached process group is targeted.
        try { process.kill(-worker.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    })();
  };
  const tasks = mode === 'reuse' ? [task(job(1)), task(job(2)), task(job(3, 'Different Co')), task(job(4))]
    : mode === 'login' ? [task(job(1)), task(job(4))] : [task(job(1))];
  let loginRound = 0, loginPosts = 0, wrongAccountBlocked = false, headedVerified = false, reviewOpened = false;
  if (['inplace', 'login'].includes(mode)) {
    tasks[0].job.jobUrl = 'https://www.naukri.com/job-listings-software-engineer-fixture-123456789012';
    tasks[0].job.portal = 'www.naukri.com';
    const scope = { portal: 'naukri:www.naukri.com/candidate' }, validUntil = new Date(Date.now() + 86400000).toISOString();
    profile.facts['portalProfileApproved:naukri'] = { ...stamped(true), scope, validUntil };
    profile.facts['portalAccountIdentity:naukri'] = { ...stamped('fixture@example.invalid'), scope, validUntil };
    profile.facts['portalResumeText:naukri'] = { ...stamped(profile.resume_text), scope, validUntil };
  }
  if (mode === 'forbidden') tasks[0].job.jobUrl = 'https://www.linkedin.com/jobs/view/12345';
  if (mode === 'unknown') tasks[0].job.jobUrl = 'https://unknown.example/jobs/123';
  const hasUnknown = id => (mode === 'reuse' && id !== '4') || mode === 'sql-reuse';
  const json = (response, data, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(data)); };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/functions/v1/apply-agent') {
        assert.equal(request.headers.authorization, `Bearer ${fakeToken}`);
        let text = ''; for await (const chunk of request) text += chunk;
        const body = JSON.parse(text); assert.equal(body.operation, 'pipeline.action');
        const { action, args } = body;
        // Only lease/safe metadata is retained as evidence, never profile facts/token.
        events.push({ action, taskId: args.taskId, status: args.status || args.outcome, at: new Date().toISOString() });
        const data = value => json(response, { ok: true, action, data: value });
        if (sqlBackend) {
          try {
            const value = await sqlBackend.action(action, args);
            if (action === 'submission.reserve') reserved = true;
            return data(value);
          } catch { return json(response, { ok: false, action }, 409); }
        }
        if (action === 'agent.heartbeat') return data({ heartbeatAt: new Date().toISOString() });
        if (action === 'commands.claim') {
          if (mode === 'login' && tasks[0].status === 'waiting_login' && loginRound === 0) {
            assert.equal(posts.filter(p => p.jobId === 'inplace').length, 0);
            loginRound = 1; commands.push({ id: randomUUID(), binding_id: bindingId, claim_nonce: randomUUID(), task_id: tasks[0].id, job: tasks[0].job, type: 'retry_login', args: { portal: 'www.naukri.com' } });
          }
          if (mode === 'login' && tasks[0].status === 'waiting_review' && loginRound === 1) {
            wrongAccountBlocked = true; assert.equal(posts.filter(p => p.jobId === 'inplace').length, 0);
            loginRound = 2; commands.push({ id: randomUUID(), binding_id: bindingId, claim_nonce: randomUUID(), task_id: tasks[0].id, job: tasks[0].job, type: 'retry_login', args: { portal: 'www.naukri.com' } });
          }
          if (mode === 'review' && tasks[0].status === 'waiting_review' && loginRound === 0) {
            const q = [...questions.values()][0]; assert(q); loginRound = 1;
            commands.push({ id: randomUUID(), binding_id: bindingId, claim_nonce: randomUUID(), task_id: tasks[0].id,
              job: tasks[0].job, type: 'open_question', args: { questionId: q.id }, question: { id: q.id,
                question_text: q.questionText, control_type: q.controlType, options: q.options, context: q.context,
                status: 'pending', task_ids: [tasks[0].id] } });
          }
          for (const command of commands) claimedCommands.set(command.id, command);
          return data({ commands: commands.splice(0) });
        }
        if (action === 'commands.report') {
          assert.equal(args.claimNonce, claimedCommands.get(args.commandId)?.claim_nonce);
          if (mode === 'review') { assert.equal(args.status, 'done'); assert.equal(posts.length, 0); reviewOpened = true; }
          if (mode === 'login' && args.status === 'done') {
            assert.equal(posts.filter(p => p.jobId === 'inplace').length, 0, 'Login-only command must not submit');
            headedVerified = true;
          }
          return data({ reported: true });
        }
        if (action === 'sessions.report') {
          if (mode === 'login' && args.portal === 'www.naukri.com' && args.status === 'authenticated'
            && ['waiting_login', 'waiting_review'].includes(tasks[0].status)) tasks[0].status = 'queued';
          return data({ reported: true });
        }
        if (action === 'profile.get') return data({ profile: mode === 'missing-profile' ? null : profile });
        if (action === 'settings.get') return data({ settings });
        if (action === 'answers.list') return data({ answers, revision: profile.answers_revision });
        if (action === 'tasks.claim') {
          if (mode === 'reuse' && tasks[0].status === 'waiting_answer' && tasks[1].status === 'waiting_answer' && !answered) {
            // Explicit synthetic USER confirmation after both jobs shared one inbox question.
            const q = [...questions.values()].find(q => q.meaning === 'noticePeriod'); assert(q);
            answers = [{ id: randomUUID(), meaning: q.meaning, question_text: q.questionText, control_type: q.controlType,
              options: q.options, context: q.context, answer: '30 days', scope: q.scope, scope_key: q.scopeKey || '',
              profile_revision: 1, confirmed_at: new Date().toISOString(), expires_at: null, provenance: 'user', revoked_at: null }];
            profile.answers_revision++; answered = true;
            for (const t of tasks.slice(0, 2)) { t.status = 'queued'; t.answers_revision = profile.answers_revision; }
            // Different country/employer context cannot use the global entry with an explicit question context.
            tasks[2].answers_revision = profile.answers_revision; tasks[3].answers_revision = profile.answers_revision;
          }
          const next = tasks.find(t => t.status === 'queued');
          if (next) { next.status = 'in_progress'; next.lease_version++; next.lease_nonce = randomUUID(); next.lease_until = new Date(Date.now() + args.leaseSeconds * 1000).toISOString(); }
          return data({ tasks: next ? [next] : [] });
        }
        const t = tasks.find(t => t.id === args.taskId);
        if (!t || t.lease_version !== args.leaseVersion || t.lease_nonce !== args.leaseNonce) return json(response, { ok: false }, 409);
        if (action === 'tasks.renew') {
          if (mode === 'cancel' && events.filter(e => e.action === 'tasks.renew').length >= 2) { t.status = 'cancelled'; return json(response, { ok: false }, 409); }
          t.lease_until = new Date(Date.now() + 90000).toISOString(); return data({ task: { ...t } });
        }
        if (action === 'questions.queue') {
          const q = args.question;
          const key = JSON.stringify([q.meaning, q.controlType, q.options, q.context, q.scope, q.scopeKey]);
          if (!questions.has(key)) questions.set(key, { ...q, id: randomUUID() });
          const matching = answers.find(answer => answer.meaning === q.meaning && answer.control_type === q.controlType
            && JSON.stringify(answer.options) === JSON.stringify(q.options) && JSON.stringify(answer.context) === JSON.stringify(q.context)
            && answer.scope === q.scope && (answer.scope_key || '') === (q.scopeKey || '') && answer.profile_revision === q.profileRevision);
          return data({ question: { id: randomUUID(), status: matching ? 'answered' : 'pending', answer_id: matching?.id ?? null } });
        }
        if (action === 'tasks.report') { t.status = args.status; return data({ task: { ...t } }); }
        if (action === 'submission.reserve') {
          assert.equal(args.siteAllowed, true); assert.equal(args.accountVerified, true); assert.equal(args.requiredComplete, true);
          assert.equal(args.profileRevision, profile.revision); assert.equal(args.settingsRevision, settings.revision);
          assert.equal(args.answersRevision, profile.answers_revision);
          assert(!reserved || ['reuse', 'login'].includes(mode)); reserved = true;
          t.reservation = { id: randomUUID(), nonce: randomUUID(), status: 'reserved' }; t.status = 'submitting';
          return data({ reservation: { ...t.reservation } });
        }
        if (action === 'submission.finish') {
          assert.equal(args.reservationId, t.reservation.id); assert.equal(args.reservationNonce, t.reservation.nonce);
          if (args.outcome === 'submitted') { assert.equal(args.evidence.kind, 'confirmation_page'); assert.match(args.evidence.text, /Application submitted/); }
          t.status = args.outcome; return data({ reservation: { ...t.reservation, status: args.outcome } });
        }
        throw new Error(`Unexpected synthetic action ${action}`);
      }
      if (url.pathname === '/fixture-login') {
        assert.equal(mode, 'login'); assert.equal(request.method, 'POST');
        let text = ''; for await (const chunk of request) text += chunk;
        const email = new URLSearchParams(text).get('email');
        assert(['fixture@example.invalid', 'wrong@example.invalid'].includes(email)); loginPosts++;
        response.writeHead(302, { 'Set-Cookie': `fixture_account=${encodeURIComponent(email)}; Path=/; HttpOnly`,
          Location: '/job-listings-software-engineer-fixture-123456789012' }); response.end(); return;
      }
      if (url.pathname.startsWith('/job-listings-') || url.pathname === '/inplace-submit') {
        const account = request.headers.cookie?.match(/fixture_account=([^;]+)/)?.[1];
        if (mode === 'login' && (!account || loginRound === 2 && decodeURIComponent(account) === 'wrong@example.invalid')) {
          response.writeHead(200, { 'Content-Type': 'text/html' });
          return response.end('<html><body><h1>Synthetic candidate sign-in</h1><form method="post" action="/fixture-login"><label for="username">Email</label><input id="username" name="email" type="email" required><label for="password">Fixture password</label><input id="password" type="password" name="password"><button type="submit">Sign in</button></form></body></html>');
        }
        if (request.method === 'POST') {
          assert(reserved, 'In-place apply clicked before reserve');
          posts.push({ jobId: 'inplace', reserved: true, occurredAt: new Date().toISOString() });
          response.writeHead(200, { 'Content-Type': 'text/html' });
          return response.end('<html><body><div role="status" data-receipt-id="inplace-fixture-receipt">Application submitted.</div></body></html>');
        }
        response.writeHead(200, { 'Content-Type': 'text/html' });
        return response.end(`<html><body><a href="/mnjuser/myapply">My applications</a><a href="mailto:${account ? escape(decodeURIComponent(account)) : 'fixture@example.invalid'}">Account email</a><p>Profile complete. Resume uploaded.</p><form method="post"><button type="submit">Apply</button></form></body></html>`);
      }
      if (request.method === 'POST' && /\/submit\/\d+/.test(url.pathname)) {
        const id = url.pathname.split('/').at(-1);
        let text = ''; for await (const chunk of request) text += chunk;
        assert(reserved, 'Browser submitted before backend reservation');
        resumeUploaded ||= /filename="[^"]+\.pdf"/.test(text);
        assert.match(text, /Fixture/);
        posts.push({ jobId: id, reserved: true, occurredAt: new Date().toISOString(), ...(mode === 'login' ? { humanLoginPending: loginPosts === 0 } : {}) });
        if (mode === 'optional-defaults') {
          assert(!text.includes('Unconfirmed default'));
          assert(!text.includes('name="gender"\r\n\r\nMale'));
          assert(!text.includes('name="consent"'));
        }
        if (mode === 'crash') {
          if (!crashKilled) { crashKilled = true; await captureOwnedPids(); stopOwnedTree(); }
          await stopPromise; return;
        }
        response.writeHead(302, { Location: `/fixture/jobs/${id}/thanks` }); response.end(); return;
      }
      if (/\/fixture\/jobs\/\d+\/thanks/.test(url.pathname)) {
        const id = url.pathname.split('/').at(-2);
        response.writeHead(200, { 'Content-Type': 'text/html' });
        return response.end(`<html><body><div id="application_confirmation" data-receipt-id="fixture-receipt-${id}">Application submitted.</div></body></html>`);
      }
      if (/\/fixture\/jobs\/\d+$/.test(url.pathname)) {
        const id = url.pathname.split('/').at(-1);
        response.writeHead(200, { 'Content-Type': 'text/html' });
        const unknown = hasUnknown(id) ? '<label for="notice">Notice period</label><input id="notice" name="notice" required>' : '';
        return response.end(`<html><body><form method="post" action="/submit/${id}" enctype="multipart/form-data">
          <label for="first_name">First name</label><input id="first_name" name="first_name" required>
          <label for="last_name">Last name</label><input id="last_name" name="last_name" required>
          <label for="email">Email address</label><input id="email" type="email" name="email" required>
          <label for="resume">${mode === 'resume-labels' ? 'Resume / CV *' : mode === 'optional-defaults' ? 'Upload CV' : 'Resume'}</label><input id="resume" type="file" name="resume" required>
          ${mode === 'optional-defaults' ? '<label for="gender">Gender</label><select id="gender" name="gender"><option value="">Choose</option><option selected>Male</option><option>Female</option></select><label for="extra_note">Unknown optional response</label><input id="extra_note" name="extra_note" value="Unconfirmed default"><label><input id="consent" type="checkbox" name="consent" checked>I agree to data processing</label>' : ''}
          ${mode === 'optional-radio' ? '<fieldset><legend>Gender</legend><label><input type="radio" name="gender" value="Male" checked>Male</label><label><input type="radio" name="gender" value="Female">Female</label></fieldset>' : ''}
          ${unknown}${id === '3' && mode !== 'sql-reuse' ? '<fieldset><legend>Are you willing to relocate</legend><label><input type="radio" name="relocation" value="Yes" required>Yes</label><label><input type="radio" name="relocation" value="No">No</label></fieldset>' : ''}
          ${mode === 'review' ? '<label><input id="legal" type="checkbox" name="legal" required>I agree to these exact terms</label>' : ''}
          <button id="submit_app" type="submit">Submit application</button></form>
          ${mode === 'dynamic' ? '<script>document.getElementById("email").addEventListener("input",()=>{if(document.getElementById("extra"))return;const label=document.createElement("label");label.htmlFor="extra";label.textContent="Unknown mandatory claim";const input=document.createElement("input");input.id="extra";input.setAttribute("aria-required","true");input.value="Unverified default";document.querySelector("form").append(label,input);});</script>' : ''}
          </body></html>`);
      }
      response.writeHead(404); response.end();
    } catch (error) { events.push({ failure: String(error.message) }); json(response, { ok: false }, 500); }
  });
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const config = path.join(sandbox, 'binding.json');
    writeFileSync(config, JSON.stringify({ version: 1, endpoint: `${origin}/functions/v1/apply-agent`, token: fakeToken }));
    const entry = ['login', 'review'].includes(mode) ? 'tests/apply-worker/login-worker-entry.mjs' : 'scripts/apply-pipeline-worker.js';
    worker = spawn(nodePath, [path.join(root, entry), '--agent-config', config], { cwd: root, detached: process.platform !== 'win32',
      env: { ...fixtureEnv, INTERVIEWIQ_APPLY_AGENT_CONFIG: config,
        INTERVIEWIQ_APPLY_SYNTHETIC: '1', INTERVIEWIQ_APPLY_FIXTURE_ORIGIN: origin, INTERVIEWIQ_APPLY_FIXTURE_MODE: mode, INTERVIEWIQ_APPLY_FIXTURE_CYCLES: ['login', 'review'].includes(mode) ? '1500' : '180' },
      stdio: ['ignore', 'pipe', 'pipe'] });
    worker.stdout.on('data', chunk => { output += chunk; }); worker.stderr.on('data', chunk => { output += chunk; });
    const exited = once(worker, 'exit');
    const deadline = Date.now() + (['login', 'review'].includes(mode) || sqlBackend ? 120000 : 45000);
    while (Date.now() < deadline && worker.exitCode === null && !crashKilled) {
      const done = sqlBackend ? await sqlBackend.progress()
        : mode === 'login' ? tasks.every(t => t.status === 'submitted') && headedVerified && wrongAccountBlocked
        : mode === 'reuse' ? tasks[0].status === 'submitted' && tasks[1].status === 'submitted' && tasks[2].status === 'waiting_answer' && tasks[3].status === 'submitted'
        : mode === 'review' ? reviewOpened && tasks[0].status === 'waiting_review'
        : ['dynamic', 'optional-radio'].includes(mode) ? tasks[0].status === 'waiting_review'
        : mode === 'cancel' ? tasks[0].status === 'cancelled' : mode === 'missing-profile' ? tasks[0].status === 'failed'
          : mode === 'forbidden' ? tasks[0].status === 'waiting_review' : mode === 'unknown' ? tasks[0].status === 'unsupported' : tasks[0].status === 'submitted';
      if (done) { await captureOwnedPids(); stopOwnedTree(); break; }
      await sleep(100);
    }
    if (!crashKilled && worker.exitCode === null) { await captureOwnedPids(); stopOwnedTree(); }
    await captureOwnedPids();
    const [code, signal] = await exited;
    assert(!output.includes(fakeToken)); assert(!output.includes('fixture@example.invalid'));
    assert(!events.some(e => e.failure), JSON.stringify(events.filter(e => e.failure)));
    if (sqlBackend) { assert.equal(posts.length, 3, output); assert(resumeUploaded); await sqlBackend.assert(); }
    else if (mode === 'login') {
      assert.equal(loginPosts, 2, output); assert(wrongAccountBlocked); assert(headedVerified);
      assert.equal(posts.length, 2, output); assert(tasks.every(t => t.status === 'submitted'));
      assert(posts.some(post => post.humanLoginPending), 'Independent Greenhouse submit must finish during pending Naukri human action');
      assert.equal((output.match(/"syntheticActor":"headed_signin"/g) || []).length, 2);
      assert.equal((output.match(/"headedLaunches":1/g) || []).length, 2, 'Same headed profile must remain stable across sign-in commands');
    } else if (mode === 'reuse') {
      assert.equal(posts.length, 3, JSON.stringify(tasks.map(t => ({ status: t.status, url: t.job.jobUrl }))) + output);
      assert(resumeUploaded); assert.equal([...questions.values()].filter(q => q.meaning === 'noticePeriod').length, 1);
      assert.equal(tasks[2].status, 'waiting_answer');
    } else if (mode === 'review') { assert(reviewOpened, JSON.stringify({ tasks: tasks.map(t => t.status), commands: events.filter(e => e.action?.startsWith('commands.')).slice(-10) }) + output); assert.equal(posts.length, 0); assert(output.includes('"syntheticActor":"headed_review"')); }
    else if (['dynamic', 'optional-radio', 'cancel', 'forbidden', 'unknown', 'missing-profile'].includes(mode)) assert.equal(posts.length, 0);
    else if (['optional-defaults', 'resume-labels'].includes(mode)) { assert.equal(posts.length, 1, output); assert(resumeUploaded); }
    else if (mode === 'inplace') { assert.equal(posts.length, 1, output); assert.equal(tasks[0].status, 'submitted', output); }
    else if (mode === 'crash') {
      assert.equal(posts.length, 1); assert.equal(tasks[0].status, 'submitting');
      const ledgerFile = path.join(bindingState, 'submission-ledger.json');
      const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8')); assert(Object.values(ledger).some(row => row.status === 'uncertain'));
    }
    return { mode, code, signal, posts, questions: [...questions.values()].map(q => ({ meaning: q.meaning, scope: q.scope })),
      tasks: tasks.map(t => ({ id: t.id, status: t.status })), events, resumeUploaded, warnings, processOutput: output };
  } finally {
    if (worker?.pid && worker.exitCode === null && worker.signalCode === null) stopOwnedTree();
    await stopPromise;
    await sleep(500);
    server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve));
    for (let attempt = 0; attempt < 40; attempt++) {
      try { rmSync(sandbox, { recursive: true, force: true }); break; }
      catch (error) {
        if (attempt === 39) {
          warnings.push({ cleanup: 'Ephemeral synthetic sandbox retained after bounded file-lock retries', sandbox, code: error.code });
          console.error('Synthetic cleanup warning; sandbox retained', sandbox, error.code);
          break;
        }
        await sleep(500);
      }
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const modeArg = process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : process.argv[2];
  const mode = modeArg || 'reuse';
  const modes = mode === 'all' ? ['reuse', 'inplace', 'login', 'review', 'optional-defaults', 'optional-radio', 'resume-labels', 'dynamic', 'cancel', 'forbidden', 'unknown', 'missing-profile', 'crash'] : [mode];
  (async () => { for (const selected of modes) {
    const result = await runWorkerFixture({ mode: selected });
    const evidenceDir = path.join(root, 'tests', 'apply-worker', 'evidence'); mkdirSync(evidenceDir, { recursive: true });
    const destination = path.join(evidenceDir, `${selected}-${Date.now()}.json`); writeFileSync(destination, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ mode: selected, passed: true, posts: result.posts.length, taskStates: result.tasks.map(t => t.status), evidence: destination }));
  } })().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
