/// <reference types="node" />
/* Injected unit gates accompany the real Node/Chromium loopback fixtures in
 * tests/apply-worker/process-fixture.mjs. Never opens user browser profiles. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { adapterForJob } from '../../scripts/apply-adapters-lib.js';
import { createApprovedResumeArtifact, createPipelineWorker, normalizePipelineAnswers, verifyApprovedResumeArtifact } from '../../scripts/apply-pipeline-worker-lib.js';
import type { WorkerTask } from '../../scripts/apply-pipeline-worker-lib.js';
import type { PortalBrowser, PortalHandle } from '../../scripts/apply-portal-adapters.js';
import type { VerifiedProfile } from '../../scripts/apply-pipeline-lib.js';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true }); });
const now = () => new Date().toISOString();
const fact = (value: any) => ({ value, source: 'user' as const, confirmedAt: now() });
function fixture({ missing = false, autoSubmit = true, reserveDenied = false, unknown = false } = {}) {
  const stateRoot = mkdtempSync(path.join(tmpdir(), 'pipeline-unit-')); roots.push(stateRoot);
  const runtime = { mode: 'paired' as const, endpoint: 'https://example.supabase.co/functions/v1/apply-agent', token: 'not-read',
    bindingId: '65dfaf34-9194-4bc9-a717-ea3f9aa56fc2', configPath: '/external-binding', profilePath: '/unused-profile', stateRoot };
  const profile: VerifiedProfile = { revision: 1, facts: { name: fact('Fixture Person'), email: fact('fixture@example.invalid'),
    skills: fact(['JavaScript']), role: fact('Software Engineer'), locations: fact(['Remote']) }, resumeText: 'Exact approved resume', resumeApproved: true };
  const task: WorkerTask = { id: '884e2e0e-65a1-4f04-a9a5-f805cf687c33', run_id: 'e3dc182d-b5e0-4340-8609-e3974fe05e5b',
    job: { jobUrl: 'https://boards.greenhouse.io/fixture/jobs/1', title: 'Software Engineer', company: 'Fixture Co',
      description: 'Synthetic job', skills: ['JavaScript'], location: 'Remote', postedAt: now() }, status: 'in_progress',
    lease_version: 1, lease_nonce: 'df63a559-587c-4b11-b581-97a079180e3b', lease_until: new Date(Date.now() + 90000).toISOString(),
    profile_revision: 1, settings_revision: 1, answers_revision: 0 };
  const adapter = adapterForJob(task.job);
  const fields = unknown ? [{ id: '0', question: 'Unknown mandatory question', controlType: 'text' as const, required: true, options: [] }]
    : [{ id: '0', question: 'Full name', controlType: 'text' as const, required: true, options: [] }];
  const handle = { adapter, session: vi.fn(async () => ({ ok: true, jobUrl: task.job.jobUrl, checkedAt: now(), reason: 'fixture positive' })),
    fields: vi.fn(async () => fields), fill: vi.fn(async () => {}), clear: vi.fn(async () => true), upload: vi.fn(async () => {}), complete: vi.fn(async () => true), verifyFilled: vi.fn(async () => true),
    snapshot: vi.fn(async () => ({ url: task.job.jobUrl, observedAt: now(), jobIdentity: adapter.jobIdentity! })),
    submit: vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 2)); return { url: `${task.job.jobUrl}/thanks`, observedAt: now(),
      jobIdentity: adapter.jobIdentity!, receipt: { selector: adapter.receiptSelector!, text: 'Application submitted.', jobIdentity: adapter.jobIdentity!, receiptId: 'receipt-fixture-1' } }; }),
    close: vi.fn(async () => {}), waitForLogin: vi.fn(async () => ({ ok: true })) } satisfies PortalHandle;
  const browser = { open: vi.fn(async () => handle), login: vi.fn(async (_job: any, _options?: { signal?: AbortSignal }) => ({ ok: true })), review: vi.fn(async () => ({ opened: true })), close: vi.fn(async () => {}) } satisfies PortalBrowser;
  const calls: { action: string; args: any }[] = [];
  const action = vi.fn(async (name: string, args: any = {}) => {
    calls.push({ action: name, args });
    if (name === 'profile.get') return { profile: missing ? null : { ...profile, resume_text: profile.resumeText, resume_approved: true, answers_revision: 0 } };
    if (name === 'settings.get') return { settings: { revision: 1, data: { enabled: true, autoSubmit, threshold: 60,
      roles: ['Software Engineer'], locations: ['Remote'], requireWorkAuthorization: false, maxAgeDays: 14 } } };
    if (name === 'answers.list') return { answers: [] };
    if (name === 'tasks.renew') return { task: { ...task } };
    if (name === 'submission.reserve') {
      if (reserveDenied) throw Object.assign(new Error('cancelled'), { code: 'PIPELINE_STALE' });
      return { reservation: { id: 'dd9f4e36-808d-42b5-a7bd-d51c71c62dbe', nonce: 'c1c8b90f-abf6-4e8e-ad52-8da6a06a7e3e', status: 'reserved' } };
    }
    if (name === 'tasks.report') return { task: { ...task, status: args.status } };
    if (name === 'submission.finish') return { reservation: { status: args.outcome } };
    return { task: { ...task }, reported: true };
  });
  const notify = vi.fn(async () => {});
  const worker = createPipelineWorker({ runtime, action, browser, notify });
  return { runtime, profile, task, handle, browser, action, calls, worker, notify };
}
describe('paired worker gates', () => {
  it('reserves before the single click and reports only new receipt evidence', async () => {
    const f = fixture(); await f.worker.processTask(f.task);
    expect(f.handle.submit).toHaveBeenCalledTimes(1);
    const reserve = f.calls.findIndex(c => c.action === 'submission.reserve');
    const finish = f.calls.findIndex(c => c.action === 'submission.finish');
    expect(reserve).toBeGreaterThan(-1); expect(finish).toBeGreaterThan(reserve);
    expect(f.calls[finish].args.outcome).toBe('submitted'); expect(f.calls[finish].args.evidence.text).toBe('Application submitted.');
    expect(f.notify).toHaveBeenCalledTimes(1);
    await f.worker.processTask(f.task);
    expect(f.handle.submit).toHaveBeenCalledTimes(1);
  });
  it('missing confirmed profile opens no browser', async () => {
    const f = fixture({ missing: true }); await f.worker.processTask(f.task);
    expect(f.browser.open).not.toHaveBeenCalled(); expect(f.handle.submit).not.toHaveBeenCalled();
  });
  it('required unknown field queues once and blocks fill/submit', async () => {
    const f = fixture({ unknown: true }); await f.worker.processTask(f.task);
    expect(f.calls.filter(c => c.action === 'questions.queue')).toHaveLength(1);
    expect(f.calls.some(c => c.action === 'tasks.report' && c.args.status === 'waiting_answer')).toBe(true);
    expect(f.handle.fill).not.toHaveBeenCalled(); expect(f.handle.submit).not.toHaveBeenCalled();
  });
  it('rejects revoked/stale reservation without clicking', async () => {
    const f = fixture({ reserveDenied: true }); await f.worker.processTask(f.task);
    expect(f.handle.submit).not.toHaveBeenCalled(); expect(f.notify).not.toHaveBeenCalled();
  });
  it('disabled auto-submit still fills verified fields but waits for review', async () => {
    const f = fixture({ autoSubmit: false }); await f.worker.processTask(f.task);
    expect(f.handle.fill).toHaveBeenCalledTimes(1); expect(f.handle.submit).not.toHaveBeenCalled();
    expect(f.calls.some(c => c.action === 'tasks.report' && c.args.status === 'waiting_review')).toBe(true);
  });
  it('a lost receipt never becomes submitted', async () => {
    const f = fixture(); f.handle.submit.mockImplementationOnce(async () => { throw new Error('browser lost'); });
    await f.worker.processTask(f.task);
    expect(f.calls.find(c => c.action === 'submission.finish')?.args.outcome).toBe('unverified');
    expect(f.notify).not.toHaveBeenCalled();
  });
  it('blocks changed live metadata even when all required values have defaults', async () => {
    const f = fixture(); f.handle.verifyFilled.mockResolvedValueOnce(false);
    await f.worker.processTask(f.task);
    expect(f.handle.submit).not.toHaveBeenCalled();
    expect(f.calls.some(c => c.action === 'submission.reserve')).toBe(false);
    expect(f.calls.some(c => c.action === 'tasks.report' && c.args.status === 'waiting_review')).toBe(true);
  });
  it('preserves native email question types when no confirmed email exists', async () => {
    const f = fixture(); delete f.profile.facts.email;
    f.handle.fields.mockResolvedValue([{ id: '0', question: 'Email address', controlType: 'email', required: true, options: [] }] as any);
    await f.worker.processTask(f.task);
    expect(f.calls.find(c => c.action === 'questions.queue')?.args.question.controlType).toBe('email');
    expect(f.handle.submit).not.toHaveBeenCalled();
  });
  it('does not upload a resume to a negated supporting-document question', async () => {
    const f = fixture();
    f.handle.fields.mockResolvedValue([{ id: '0', question: 'Supporting documents other than resume', controlType: 'file', required: true, options: [] }] as any);
    await f.worker.processTask(f.task);
    expect(f.handle.upload).not.toHaveBeenCalled(); expect(f.handle.submit).not.toHaveBeenCalled();
  });
  it.each(['Upload CV', 'Resume / CV *'])('uploads approved artifact for trusted %s label', async question => {
    const f = fixture();
    f.handle.fields.mockResolvedValue([{ id: '0', question, controlType: 'file', required: true, options: [] }] as any);
    await f.worker.processTask(f.task);
    expect(f.handle.upload).toHaveBeenCalledTimes(1); expect(f.handle.submit).toHaveBeenCalledTimes(1);
  });
  it('clears every optional unanswered/default value and verifies empty consent/demographic states', async () => {
    const f = fixture();
    const fields = [
      { id: '0', question: 'Gender', controlType: 'select', required: false, options: ['Female', 'Male'] },
      { id: '1', question: 'I agree to data processing', controlType: 'checkbox', required: false, options: [] },
      { id: '2', question: 'Notice period', controlType: 'text', required: false, options: [] },
    ];
    f.handle.fields.mockResolvedValue(fields as any);
    await f.worker.processTask(f.task);
    expect(f.handle.clear).toHaveBeenCalledTimes(3);
    expect(f.handle.fill).not.toHaveBeenCalled();
    expect(f.handle.verifyFilled).toHaveBeenCalledWith(fields.map(field => ({ field, empty: true })));
    expect(f.handle.submit).toHaveBeenCalledTimes(1);
  });
  it('cannot submit if an unconfirmed optional default is not safely clearable', async () => {
    const f = fixture();
    f.handle.fields.mockResolvedValue([{ id: '0', question: 'Gender', controlType: 'radio', required: false, options: ['Male', 'Female'] }] as any);
    f.handle.clear.mockResolvedValue(false);
    await f.worker.processTask(f.task);
    expect(f.handle.submit).not.toHaveBeenCalled();
    expect(f.calls.some(c => c.action === 'tasks.report' && c.args.status === 'waiting_review')).toBe(true);
  });
  it('rechecks empty optional values at the submission boundary', async () => {
    const f = fixture();
    f.handle.fields.mockResolvedValue([{ id: '0', question: 'I consent', controlType: 'checkbox', required: false, options: [] }] as any);
    f.handle.verifyFilled.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await f.worker.processTask(f.task);
    expect(f.handle.submit).not.toHaveBeenCalled();
    expect(f.calls.some(c => c.action === 'submission.reserve')).toBe(false);
  });
  it.each([true, false])('saved answer must be attached to the exact current question (attached=%s)', async attached => {
    const f = fixture();
    const answerId = '657ca14e-4e03-4bd1-aaf6-f45e13510538';
    f.profile.facts.noticePeriod = { ...fact('60 days'), validUntil: new Date(Date.now() - 100).toISOString(), confirmedAt: new Date(Date.now() - 1000).toISOString() };
    f.handle.fields.mockResolvedValue([{ id: '0', question: 'Notice period', controlType: 'text', required: true, options: [] }] as any);
    const original = f.action.getMockImplementation()!;
    f.action.mockImplementation(async (name, args) => {
      if (name === 'answers.list') return { answers: [{ id: answerId, meaning: 'noticePeriod', question_text: 'Notice period', control_type: 'text', options: [], context: {}, scope: 'global', answer: '30 days', confirmed_at: now(), profile_revision: 1, provenance: 'user' }] } as any;
      const result = await original(name, args);
      if (name === 'questions.queue') return { question: { status: attached ? 'answered' : 'pending', answer_id: attached ? answerId : null } } as any;
      return result;
    });
    await f.worker.processTask(f.task);
    expect(f.calls.filter(c => c.action === 'questions.queue')).toHaveLength(1);
    expect(f.handle.submit).toHaveBeenCalledTimes(attached ? 1 : 0);
  });
  it('approved artifacts bind text, bytes, profile revision and agent binding', async () => {
    const f = fixture(); const artifact = await createApprovedResumeArtifact(f.profile, f.runtime);
    expect(verifyApprovedResumeArtifact(artifact, f.profile, f.runtime)).toBe(artifact.path);
    expect(() => verifyApprovedResumeArtifact(artifact, { ...f.profile, revision: 2 }, f.runtime)).toThrow(/mismatch/);
    writeFileSync(artifact.path, 'modified');
    expect(() => verifyApprovedResumeArtifact(artifact, f.profile, f.runtime)).toThrow(/mismatch/);
  });
  it('filters revoked bank entries and normalizes trusted provenance only', () => {
    const rows = normalizePipelineAnswers([{ id: 'revoked', revoked_at: now() }, { id: 'safe', provenance: 'user', revoked_at: null, confirmed_at: now() }]);
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ id: 'safe', source: 'user', autoReuse: true });
  });
});

function commandWorker(f: ReturnType<typeof fixture>, commands: any[], tasks: WorkerTask[] = []) {
  let claimed = false, taskClaimed = false;
  const original = f.action.getMockImplementation()!;
  f.action.mockImplementation(async (name, args = {}) => {
    if (name === 'commands.claim') return { commands: claimed ? [] : (claimed = true, commands) } as any;
    if (name === 'tasks.claim') return { tasks: taskClaimed ? [] : (taskClaimed = true, tasks) } as any;
    return original(name, args);
  });
  return createPipelineWorker({ runtime: f.runtime, action: f.action, browser: f.browser, pollMs: 1 });
}
const claimedCommand = (f: ReturnType<typeof fixture>, type: string) => ({ id: '637cbe78-6e1a-45c3-85ee-e8a2f1f765c2',
  binding_id: f.runtime.bindingId, claim_nonce: '7016d301-a803-4e38-b2a8-59afcd1e8a1d', type, task_id: f.task.id, job: f.task.job,
  args: { portal: 'greenhouse', jobUrl: 'https://evil.example/ignored' } });
describe('persisted claimed command recovery', () => {
  it.each(['retry_login', 'check_session'])('recovers %s from exact claim job before any task is processed', async type => {
    const f = fixture(), command = claimedCommand(f, type);
    await commandWorker(f, [command]).run({ maxCycles: 2 });
    expect(type === 'retry_login' ? f.browser.login : f.browser.open).toHaveBeenCalledWith(f.task.job, ...(type === 'retry_login' ? [expect.objectContaining({ signal: expect.any(AbortSignal) })] : []));
    expect(f.calls.find(c => c.action === 'commands.report')?.args).toMatchObject({ commandId: command.id, claimNonce: command.claim_nonce, status: 'done' });
    expect(f.handle.submit).not.toHaveBeenCalled();
  });
  it.each(['missing', 'unsafe', 'wrongPortal'])('rejects %s command target without caller URL or portal memory fallback', async bad => {
    const f = fixture(), command = claimedCommand(f, 'retry_login');
    if (bad === 'missing') delete (command as any).job;
    if (bad === 'unsafe') command.job = { ...command.job, jobUrl: 'https://127.0.0.1/private' };
    if (bad === 'wrongPortal') command.args.portal = 'naukri';
    await commandWorker(f, [command]).run({ maxCycles: 2 });
    expect(f.browser.login).not.toHaveBeenCalled(); expect(f.browser.open).not.toHaveBeenCalled();
    expect(f.calls.find(c => c.action === 'commands.report')?.args.status).toBe('failed');
  });
  it.each([true, false])('only opens an exact pending server-scoped question for human review (matched=%s)', async matched => {
    const f = fixture();
    const command = { ...claimedCommand(f, 'open_question'), args: { questionId: 'question-fixture' }, question: {
      id: matched ? 'question-fixture' : 'other-question', question_text: 'I agree to terms', control_type: 'checkbox', options: [],
      context: { application: f.task.job.jobUrl }, status: 'pending', task_ids: [f.task.id] } };
    await commandWorker(f, [command]).run({ maxCycles: 2 });
    expect(f.browser.review).toHaveBeenCalledTimes(matched ? 1 : 0);
    expect(f.handle.fill).not.toHaveBeenCalled(); expect(f.handle.submit).not.toHaveBeenCalled();
    expect(f.calls.find(c => c.action === 'commands.report')?.args.status).toBe(matched ? 'done' : 'failed');
    expect(f.calls.some(c => c.action === 'sessions.report')).toBe(false);
  });
  it('releases the human-owned portal before authenticated-session reporting wakes its task', async () => {
    const f = fixture();
    const original = f.action.getMockImplementation()!;
    let claimed = false, awakened = false, resumeProcessed = false;
    let worker: ReturnType<typeof createPipelineWorker>;
    f.action.mockImplementation(async (name, args = {}) => {
      if (name === 'commands.claim') return { commands: claimed ? [] : (claimed = true, [claimedCommand(f, 'retry_login')]) } as any;
      if (name === 'tasks.claim') return { tasks: [] } as any;
      const result = await original(name, args);
      if (name === 'sessions.report' && args.status === 'authenticated' && !awakened) {
        awakened = true;
        await worker.processTask(f.task);
        resumeProcessed = f.handle.submit.mock.calls.length === 1;
      }
      return result;
    });
    worker = createPipelineWorker({ runtime: f.runtime, action: f.action, browser: f.browser, pollMs: 1 });
    await worker.run({ maxCycles: 5 });
    expect(resumeProcessed).toBe(true);
    expect(f.calls.some(call => call.action === 'tasks.report' && call.args.status === 'waiting_login')).toBe(false);
  });
  it('continues an independent Greenhouse task while Naukri human sign-in remains pending', async () => {
    const f = fixture(); let pending = false, submittedWhilePending = false;
    f.browser.login.mockImplementation(async (_job: any, { signal }: any) => {
      pending = true;
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
      pending = false; return { ok: false };
    });
    const submit = f.handle.submit.getMockImplementation()!;
    f.handle.submit.mockImplementation(async () => { submittedWhilePending = pending; return submit(); });
    const command = { ...claimedCommand(f, 'retry_login'), job: { ...f.task.job, jobUrl: 'https://www.naukri.com/job-listings-engineer-fixture-123456789012' }, args: { portal: 'naukri' } };
    await commandWorker(f, [command], [f.task]).run({ maxCycles: 1 });
    expect(submittedWhilePending).toBe(true); expect(f.handle.submit).toHaveBeenCalledTimes(1);
    expect(f.browser.close).toHaveBeenCalledTimes(1);
  });
});
