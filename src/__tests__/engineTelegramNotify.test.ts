/// <reference types="node" />
/* Local Playwright driver is intentionally not launched. Test pure decisions and injected runtime seams. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aggregateCycleReports, createResultDeliveryQueue, createTelegramSender, cycleLockReclaimable, formatJobNotification, formatRunNotification, notificationTime, notifyReason, resultCounts, resultEvent, safeNotifyText, safeNotifyUrl } from '../../scripts/telegram-notify-lib.js';
import type { DeliveryOutcome, PendingResult, ResultEvent, ResultRow } from '../../scripts/telegram-notify-lib.js';

const id = 'ddddd111-1111-4111-8111-111111111111';
const occurrence = '2026-11-13T10:00:00.000Z';
const row = (result = 'submitted', eventId = id): ResultRow => ({ eventId, at: occurrence, result, url: 'https://board.test/jobs/12?access_token=hidden', title: 'Engineer', company: 'Example' });
const event = (result = 'submitted'): ResultEvent => resultEvent(row(result), 'board.test', id);
const token = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk';
const config = { chat_id: '123', bot_token: token, time_zone: 'Asia/Kolkata' };
const ok = () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }) as Response;
afterEach(() => vi.useRealTimers());

describe('engine notification facts and sanitation', () => {
  it.each(['submitted', 'needs_review', 'error'])('reports %s facts with separate original and sent times', result => {
    const text = formatJobNotification(event(result), { timeZone: 'Asia/Kolkata', sentAt: '2026-11-13T11:00:00Z' })!;
    expect(text).toContain('13/11/2026, 15:30:00 [Asia/Kolkata]');
    expect(text).toContain('Occurred at:'); expect(text).toContain(occurrence);
    expect(text).toContain('Notification sent at:'); expect(text).toContain('2026-11-13T11:00:00.000Z');
    expect(text).not.toContain('employer received');
    if (result === 'submitted') expect(text).toContain('engine detected confirmation');
    if (result === 'needs_review') expect(text).toContain('not auto-submitted');
    if (result === 'error') expect(text).toContain('submission not confirmed');
  });
  it.each(['skipped', 'filtered', 'budget_capped'])('keeps %s summary only', result => expect(formatJobNotification(event(result))).toBeNull());
  it('counts all six states and aggregates only this cycle', () => {
    const results = ['submitted', 'needsReview', 'error', 'skipped', 'filtered', 'budget_capped'].map(result => ({ result }));
    expect(resultCounts(results)).toEqual({ submitted: 1, needs_review: 1, error: 1, skipped: 1, filtered: 1, budget_capped: 1 });
    const summary = aggregateCycleReports([{ cycleId: id, results, syncPending: 2 }, { cycleId: 'old', results }], id, { startedAt: occurrence, endedAt: occurrence, expectedReports: 2, siteErrors: 1 });
    expect(summary.counts).toEqual(resultCounts(results)); expect(summary.missingReports).toBe(1); expect(summary.syncPending).toBe(2);
    const text = formatRunNotification(summary);
    expect(text).toContain('Alerts: sent 0 | failed 0');
  });
  it('uses UTC for invalid zones and rejects invalid time', () => {
    expect(notificationTime(occurrence, 'Not/AZone')).toContain('[UTC]');
    expect(notificationTime('bad')).toBe('time unavailable');
    expect(notificationTime('2026-11-01T06:30:00Z', 'America/New_York')).toContain('01:30:00');
  });
  it('bounds and redacts title/url/reason without candidate answers or raw model errors', () => {
    expect(safeNotifyText(`\u202e title\n${token} Bearer abc sk-abcdefgh password=hunter2`)).not.toMatch(/hunter2|abcdefgh|ABCDEFGHIJKLMNOPQRSTUVWXYZ|Bearer abc|\u202e/);
    expect(safeNotifyText('x'.repeat(5000))).toHaveLength(180);
    expect(safeNotifyUrl('javascript:alert(1)')).toBe('');
    expect(safeNotifyUrl('https://user:secret@board.test/job')).toBe('');
    expect(safeNotifyUrl('https://board.test/job?token=secret&currentJobId=123#password')).toBe('https://board.test/job?currentJobId=123');
    expect(safeNotifyUrl('https://board.test/' + 'x'.repeat(600))).toBe('');
    const evil = { ...event('needs_review'), title: token, detail: 'cannot answer: candidate earns 99999 secret=xyz', formFields: [{ answer: 'CANDIDATE_PRIVATE' }], bot_token: token };
    const text = formatJobNotification(evil)!;
    expect(text).not.toMatch(/99999|xyz|CANDIDATE_PRIVATE|ABCDEFGHIJKLMNOPQRSTUVWXYZ/);
    expect(notifyReason('error', `HTTP 502 provider ${token}`)).toBe('Engine step failed; submission not confirmed.');
    expect(formatJobNotification({ ...event('needs_review'), reviewQueue: 'failed' })).toContain('save failed');
  });
});

describe('direct Telegram bounded transport', () => {
  it('uses fixed endpoint/body and JSON ok acknowledgement; redacts legacy text', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1234 } }) });
    const before = vi.fn();
    const sender = createTelegramSender({ getConfig: async () => config, fetchFn, sleep: async () => {}, now: () => Date.parse(occurrence) });
    expect(await sender.send(`secret=${token}\nmessage`, before)).toMatchObject({ status: 'sent', sentAt: occurrence, messageId: 1234 });
    expect(before).toHaveBeenCalledOnce();
    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${token}/sendMessage`);
    expect(options.redirect).toBe('error'); expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body)).toMatchObject({ chat_id: '123', disable_web_page_preview: true });
    expect(JSON.parse(options.body).text).not.toContain(token);
  });
  it.each([
    [400, { ok: false, description: token }, 'failed'],
    [200, { ok: false }, 'failed'],
    [200, {}, 'unknown'],
    [503, { ok: false }, 'unknown'],
  ])('honestly classifies HTTP %s %j as %s without secrets', async (status, body, expected) => {
    const sender = createTelegramSender({ getConfig: async () => config, fetchFn: vi.fn().mockResolvedValue({ status, ok: status === 200, json: async () => body }), sleep: async () => {} });
    const outcome = await sender.send('Message'); expect(outcome.status).toBe(expected); expect(JSON.stringify(outcome)).not.toContain(token);
  });
  it('distinguishes missing config from a failed config read', async () => {
    const fetchFn = vi.fn();
    expect(await createTelegramSender({ getConfig: async () => null, fetchFn }).send('x')).toMatchObject({ status: 'not_configured' });
    expect(await createTelegramSender({ getConfig: async () => { throw new Error(token); }, fetchFn }).send('x')).toMatchObject({ status: 'failed', reason: 'configuration_unavailable' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('bounds timeout even for a fetch that ignores abort and treats redirects/network as unknown', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockImplementation(() => new Promise(() => {}));
    const sender = createTelegramSender({ getConfig: async () => config, fetchFn, timeoutMs: 50, sleep: async () => {} });
    const promise = sender.send('x'); await vi.advanceTimersByTimeAsync(60);
    expect(await promise).toEqual({ status: 'unknown', reason: 'timeout' }); expect(fetchFn.mock.calls[0][1].signal.aborted).toBe(true);
    const rejecting = createTelegramSender({ getConfig: async () => config, fetchFn: vi.fn().mockRejectedValue(new Error(token)), sleep: async () => {} });
    expect(await rejecting.send('x')).toEqual({ status: 'unknown', reason: 'network_or_redirect' });
  });
  it('resets run budgets without bypassing cooldown or inter-message spacing', async () => {
    let clock = 100;
    const sleep = vi.fn(async ms => { clock += ms; });
    const fetchFn = vi.fn().mockResolvedValue(ok());
    const sender = createTelegramSender({ getConfig: async () => config, fetchFn, now: () => clock, sleep, maxMessages: 1 });
    await sender.send('a'); expect((await sender.send('b')).status).toBe('failed');
    await sender.resetBudget(); expect((await sender.send('c')).status).toBe('sent');
    expect(sleep).toHaveBeenLastCalledWith(1500);
    fetchFn.mockResolvedValue({ ok: false, status: 429, json: async () => ({ ok: false, parameters: { retry_after: 60 } }) });
    await sender.resetBudget(); await sender.send('d'); await sender.resetBudget();
    expect(await sender.send('e')).toMatchObject({ status: 'failed', reason: 'rate_limited' });
  });
  it('serializes, spaces and caps attempts, then honors bounded 429 cooldown without retry', async () => {
    let clock = 100;
    const sleep = vi.fn(async ms => { clock += ms; });
    const fetchFn = vi.fn().mockResolvedValue(ok());
    const sender = createTelegramSender({ getConfig: async () => config, fetchFn, now: () => clock, sleep, maxMessages: 2 });
    const results = await Promise.all([sender.send('a'), sender.send('b'), sender.send('c')]);
    expect(results.map(r => r.status)).toEqual(['sent', 'sent', 'failed']);
    expect(fetchFn).toHaveBeenCalledTimes(2); expect(sleep).toHaveBeenLastCalledWith(1500);
    const limitedFetch = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ ok: false, parameters: { retry_after: 99999999 } }) });
    const limited = createTelegramSender({ getConfig: async () => config, fetchFn: limitedFetch, now: () => clock, sleep });
    expect(await limited.send('a')).toMatchObject({ status: 'failed', reason: 'rate_limited' });
    expect(await limited.send('b')).toMatchObject({ status: 'failed', reason: 'rate_limited' }); expect(limitedFetch).toHaveBeenCalledOnce();
  });
});

function queueFixture(options: { record?: (event: ResultEvent) => Promise<unknown>; outcome?: DeliveryOutcome; maxPending?: number } = {}) {
  let stored: PendingResult[] = [];
  const save = vi.fn((entries: PendingResult[]) => { stored = structuredClone(entries); });
  const record = vi.fn(options.record || (async () => {}));
  const send = vi.fn(async (_event: ResultEvent, before: () => void) => {
    before(); expect(stored.find(e => e.event.eventId === _event.eventId)?.notification.status).toBe('unknown');
    return options.outcome || { status: 'sent' as const };
  });
  const build = () => createResultDeliveryQueue({ runId: id, load: () => stored, save, record, send, maxPending: options.maxPending });
  return { build, save, record, send, stored: () => stored };
}
describe('result record/retry drain (never an application executor)', () => {
  it('waits for serial recorded results before exactly one notify and marks unknown before dispatch', async () => {
    const sequence: string[] = [];
    const qf = queueFixture({ record: async e => { sequence.push(e.eventId); } });
    const queue = qf.build(); await queue.startup();
    const r1 = row(), r2 = row('error', 'ddddd222-2222-4222-8222-222222222222');
    await Promise.all([queue.enqueue(resultEvent(r1, 'board.test', id), r1), queue.enqueue(resultEvent(r2, 'board.test', id), r2)]);
    await queue.drain(); await queue.retry();
    expect(sequence).toEqual([r1.eventId, r2.eventId]); expect(qf.send).toHaveBeenCalledTimes(2);
    expect(r1.sync).toBe('recorded'); expect(r1.notification?.status).toBe('sent'); expect(qf.stored()).toEqual([]);
  });
  it('retains stable ID/original time through failure/end retry; no notify before record succeeds', async () => {
    let fail = true;
    const qf = queueFixture({ record: async () => { if (fail) throw new Error(token); } });
    const queue = qf.build(); await queue.startup();
    const r = row(); const e = resultEvent(r, 'board.test', id);
    await queue.enqueue(e, r); expect(queue.pending).toBe(1); expect(qf.send).not.toHaveBeenCalled();
    expect(JSON.stringify(qf.stored())).not.toContain(token); fail = false;
    await queue.retry(); await queue.retry();
    expect(qf.record.mock.calls.map(([entry]) => [entry.eventId, entry.occurredAt])).toEqual([[id, occurrence], [id, occurrence]]);
    expect(qf.send).toHaveBeenCalledOnce(); expect(queue.pending).toBe(0);
  });
  it.each(['sent', 'unknown', 'failed', 'not_configured'] as const)('does not re-emit %s alerts on retry/restart', async status => {
    const qf = queueFixture({ outcome: { status } }); const queue = qf.build(); await queue.startup();
    const r = row(); await queue.enqueue(event(), r); await queue.retry(); await qf.build().startup();
    expect(qf.send).toHaveBeenCalledOnce(); expect(r.notification?.status).toBe(status);
  });
  it('startup retries DB sync but never broadcasts old unattempted/ambiguous events', async () => {
    const qf = queueFixture({ record: async () => { throw new Error('offline'); } });
    const queue = qf.build(); await queue.startup(); const r = row(); await queue.enqueue(event(), r);
    qf.record.mockResolvedValue(undefined);
    await qf.build().startup();
    expect(qf.record).toHaveBeenCalledTimes(2); expect(qf.send).not.toHaveBeenCalled(); expect(qf.stored()).toEqual([]);
  });
  it('waits for review queue outcome; suppresses pending reviews and budget/dry-run alerts', async () => {
    const qf = queueFixture(); const queue = qf.build(); await queue.startup();
    const r = row('needsReview'); await queue.enqueue(event('needsReview'), r, { ready: false });
    expect(qf.send).not.toHaveBeenCalled();
    await queue.finishReview(id, { status: 'queued', suppress: true }); expect(qf.send).not.toHaveBeenCalled();
    for (const state of ['budget_capped', 'error']) {
      const r2 = row(state); await queue.enqueue(resultEvent(r2, 'board.test', id), r2, { notify: false });
    }
    expect(qf.send).not.toHaveBeenCalled(); expect(qf.stored()).toEqual([]);
  });
  it('new review queue failures can still send one factual unconfirmed alert', async () => {
    const qf = queueFixture(); const queue = qf.build(); await queue.startup(); const r = row('needsReview');
    await queue.enqueue(event('needsReview'), r, { ready: false });
    await queue.finishReview(id, { status: 'failed', suppress: false });
    expect(qf.send).toHaveBeenCalledOnce(); expect(qf.send.mock.calls[0][0].reviewQueue).toBe('failed');
  });
  it('propagates post-record durable-save failure before dispatch and does not discard invalid retry metadata', async () => {
    const record = vi.fn(async () => {}), send = vi.fn(async () => ({ status: 'sent' as const }));
    let saving = 0;
    const queue = createResultDeliveryQueue({ runId: id, record, send, save: () => { if (++saving === 3) throw new Error('disk full'); } });
    await queue.startup();
    await expect(queue.enqueue(event(), row())).rejects.toThrow('disk full');
    expect(record).toHaveBeenCalledOnce(); expect(send).not.toHaveBeenCalled();
    const save = vi.fn();
    const invalid = createResultDeliveryQueue({ runId: id, record, send, save, load: () => [{ event: { ...event(), eventId: 'invalid' } } as PendingResult] });
    await expect(invalid.startup()).rejects.toThrow(/invalid event/); expect(save).not.toHaveBeenCalled();
  });
  it('bounds the queue and retry work and throws before another job is authorized', async () => {
    const qf = queueFixture({ record: async () => { throw new Error('offline'); }, maxPending: 1 });
    const queue = qf.build(); await queue.startup(); await queue.enqueue(event(), row());
    expect(() => queue.enqueue(event(), row())).toThrow(/queue full/); expect(qf.send).not.toHaveBeenCalled();
  });
});

describe('locks and local driver integration pins', () => {
  it('never steals a live PID even when expired; reclaims dead PID and only old corrupt locks', () => {
    expect(cycleLockReclaimable({ pid: 12 }, { activePid: () => true, now: 1e9, modifiedAt: 0 })).toBe(false);
    expect(cycleLockReclaimable({ pid: 12 }, { activePid: () => false })).toBe(true);
    expect(cycleLockReclaimable(null, { activePid: () => false, now: 100, modifiedAt: 0 })).toBe(false);
    expect(cycleLockReclaimable(null, { activePid: () => false, now: 40_000, modifiedAt: 0 })).toBe(true);
  });
  it('routes child cycle IDs; drains before next job/final artifacts and keeps review sends centralized', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts');
    const driver = readFileSync(path.join(root, 'auto-apply-jobs.js'), 'utf8');
    const review = driver.slice(driver.indexOf('async function queueReview('), driver.indexOf('/* --- owner mode'));
    expect(review).not.toContain('sendTelegramNotify'); expect(review).toContain('finishReview');
    expect(driver).toContain('env.INTERVIEWIQ_APPLY_CYCLE_ID = cycleId');
    expect(driver).toContain('!report.cycleId'); expect(driver).toContain('await drainResultDelivery({ retry: true })');
    expect(driver).toContain('acquireCycleLock(RESULT_LOCK)');
    expect(driver).toContain('legacy sign-in handoff never kills paired runs');
    expect(driver).toMatch(/write reports even on abort[^\n]*\*\/\s*let closedInFinally = false;\s*try/);
    expect(driver).toContain('await telegramSender.resetBudget()');
    const submitOutcome = driver.slice(driver.indexOf('if (sub.auto) {'), driver.indexOf('/* the queue must reflect reality'));
    expect(submitOutcome.indexOf('markApplied(job.url)')).toBeLessThan(submitOutcome.indexOf('recordResultBoth'));
    expect(driver).toContain('e.code === "RESULT_METADATA_FAILED"');
    const lock = driver.slice(driver.indexOf('function acquireCycleLock('), driver.indexOf('function releaseCycleLock'));
    expect(lock).toContain('const guardFile = `${lockFile}.guard`');
    expect(lock.indexOf('writeFileSync(guardFile')).toBeLessThan(lock.indexOf('readFileSync(lockFile'));
    expect(lock).toMatch(/finally \{ try \{ unlinkSync\(guardFile\)/);
    expect(driver).toMatch(/for \(const job of jobs\) \{\s*await drainResultDelivery\(\);\s*if \(RESULT_DELIVERY.pending\) throw/);
    expect(driver).not.toContain('recordResultDb(runHostKey');
    for (const file of ['digest-task.cmd', 'listen-task.cmd', 'sessions-task.cmd']) {
      const source = readFileSync(path.join(root, file), 'utf8'); expect(source).toContain('cd /d "%~dp0.."');
      for (const line of source.split('\n').filter(l => l.startsWith('node '))) expect(line).toContain('--legacy-owner');
    }
    for (const file of ['ensure-apply-watcher.js', 'listen-watchdog.js']) {
      const source = readFileSync(path.join(root, file), 'utf8');
      expect(source).toContain('process.argv.push("--legacy-owner")');
      expect(source).toMatch(/\[ENGINE, "--(?:listen|watch)", "--legacy-owner"/);
      expect(source.indexOf('process.argv.push')).toBeLessThan(source.indexOf('await import("./engine-lifecycle.js")'));
    }
  });
});
