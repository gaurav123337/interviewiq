/* Executable, synthetic PostgreSQL regression suite. No network, real users,
 * Supabase credentials, browser or installed/live RLS is exercised. Set
 * VERIFIED_LEARNING_PGLITE_MODULE to an isolated @electric-sql/pglite ESM entry
 * to run the behavioral suite; static checks alone are not database proof. */
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { extractVerifiedRequirements, verifiedSimilarityKey } from '../../scripts/apply-pipeline-lib.js';

const sqlFiles = import.meta.glob<string>('../../supabase/migrations/*apply_pipeline.sql', { query: '?raw', eager: true, import: 'default' });
const learningFiles = import.meta.glob<string>('../../supabase/migrations/*verified_match_learning.sql', { query: '?raw', eager: true, import: 'default' });
const installationFiles = import.meta.glob<string>(['../../scripts/test-apply-pipeline-sql.mjs', '../../tests/apply-worker/sql-process-fixture.mjs', '../../.github/workflows/deploy.yml'], { query: '?raw', eager: true, import: 'default' });
const baseSql = sqlFiles['../../supabase/migrations/20261114040000_apply_pipeline.sql'];
const migration = learningFiles['../../supabase/migrations/20261121000000_verified_match_learning.sql'] || '';
const sqlRunner = installationFiles['../../scripts/test-apply-pipeline-sql.mjs'] || '';
const workerSqlFixture = installationFiles['../../tests/apply-worker/sql-process-fixture.mjs'] || '';
const deployWorkflow = installationFiles['../../.github/workflows/deploy.yml'] || '';
const modulePath = process.env.VERIFIED_LEARNING_PGLITE_MODULE;
interface Db { exec(sql: string): Promise<unknown>; query<T>(sql: string, args?: unknown[]): Promise<{ rows: T[] }>; close(): Promise<void> }
const U = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222';
const B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const R = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const job = (n: number) => ({ jobUrl: `https://boards.greenhouse.io/acme/jobs/${n}`, title: 'Software Engineer', company: `Employer ${n}`, description: 'TypeScript required.', skills: ['typescript'], location: 'Remote', remote: true, country: 'US', postedAt: new Date(Date.now() - 3600000).toISOString() });
const key = JSON.stringify(['verified-match-v1', 'software', 'unspecified', ['core:typescript'], 'US', 'remote', true]);
const decision = (status = 'eligible_review') => ({ status, similarityKey: key, portal: 'greenhouse:boards.greenhouse.io/acme', codes: [], reason: 'Factual gates passed', missingCore: [], requirements: [{ anyOf: ['typescript'], core: true, evidence: 'TypeScript required.' }] });

describe('verified learning migration installation', () => {
  it('keeps helper creation and privilege revocation in the migration-owned transaction', () => {
    const begin = migration.indexOf('\nbegin;\n');
    const firstAlter = migration.indexOf('\nalter table public.apply_tasks');
    const finalRevoke = migration.lastIndexOf('revoke all on function');
    const commit = migration.lastIndexOf('\ncommit;');
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(begin).toBeLessThan(firstAlter);
    expect(commit).toBeGreaterThan(finalRevoke);
    expect(migration.slice(commit + '\ncommit;'.length).trim()).toBe('');
    expect(sqlRunner).toContain('execute(database, learning);');
    expect(workerSqlFixture).toContain("query(read('migrations/20261121000000_verified_match_learning.sql'));");
    expect(sqlRunner).not.toContain('`begin; ${learning} commit;`');
    expect(workerSqlFixture).not.toContain("query(`begin; ${read('migrations/20261121000000_verified_match_learning.sql')} commit;`)");
  });
  it('pins the reviewed PostgreSQL image for both production release gates', () => {
    const images = [...deployWorkflow.matchAll(/docker run --name pipeline(?:-worker)?-sql .* -d (postgres\S+)/g)].map(match => match[1]);
    expect(images).toHaveLength(2);
    expect(new Set(images)).toHaveLength(1);
    expect(images[0]).toMatch(/^postgres@sha256:[a-f0-9]{64}$/);
  });
});

describe.skipIf(!modulePath)('verified learning PostgreSQL behavior (isolated PGlite)', () => {
  let db: Db;
  let historicalDispatcherBody: string, historicalValidatorBody: string;
  const query = async <T = Record<string, unknown>>(sql: string, args?: unknown[]) => (await db.query<T>(sql, args)).rows;
  const expectLearningAck = (action: string, result: Record<string, any>, args: Record<string, any>) => {
    const field = ({ 'learning.feedback': 'feedback', 'learning.grant': 'grant', 'learning.question': 'question', 'learning.manual_report': 'receipt', 'learning.manual_observe': 'receipt', 'learning.revoke': args.feedbackId ? 'feedback' : 'grant' } as Record<string, string>)[action];
    if (field) expect(result).toEqual({ ok: true, [field]: expect.any(Object) });
    return result;
  };
  const user = async (action: string, args: object = {}, owner = U) => {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: 'authenticated', sub: owner })]);
    return expectLearningAck(action, (await query<{ result: Record<string, any> }>('select public.my_apply_pipeline_action($1,$2::jsonb) result', [action, JSON.stringify(args)]))[0].result, args);
  };
  const worker = async (action: string, args: object = {}, binding = B) => {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: 'service_role' })]);
    return expectLearningAck(action, (await query<{ result: Record<string, any> }>('select public.service_apply_pipeline_dispatch($1,$2,$3,$4::jsonb) result', [binding, binding === B ? 'a'.repeat(64) : 'b'.repeat(64), action, JSON.stringify(args)]))[0].result, args);
  };
  const task = async (n = 1) => (await query<Record<string, any>>('select * from public.apply_tasks where id=$1', [id(n)]))[0];
  const groundedDecision = (j: ReturnType<typeof job>, status = 'eligible_review') => ({ ...decision(status), requirements: extractVerifiedRequirements(j), similarityKey: verifiedSimilarityKey(j) });
  const setJob = async (j: ReturnType<typeof job>, n = 1) => {
    await db.query("update public.apply_tasks set job=$1::jsonb,job_key=public.apply_pipeline_job_key($1::jsonb->>'jobUrl') where id=$2", [JSON.stringify(j), id(n)]);
    await db.query("update public.apply_pipeline_settings set data=jsonb_set(data,'{roles}',$1::jsonb)", [JSON.stringify([j.title])]);
  };
  const lease = async (n = 1) => { const t = await task(n); return { taskId: id(n), leaseVersion: t.lease_version, leaseNonce: t.lease_nonce }; };
  const claimDecide = async (n = 1, status = 'eligible_review') => {
    await db.query("update public.apply_tasks set status='queued' where id=$1", [id(n)]);
    await worker('tasks.claim', { limit: 10 });
    return worker('tasks.decide', { ...await lease(n), decision: decision(status) });
  };
  const reserve = async (grantId?: string, n = 4) => worker('submission.reserve', { ...await lease(n), grantId, similarityKey: key, profileRevision: 1, settingsRevision: 1, answersRevision: 1, siteAllowed: true, accountVerified: true, requiredComplete: true, answerIds: [], idempotencyKey: `synthetic-${n}` });
  const confirm = (n: number) => ({ taskId: id(n), profileRevision: 1, settingsRevision: 1, confirm: true });
  const feedback = (n: number, verdict = 'apply', scope = 'similar') => user('learning.feedback', { ...confirm(n), verdict, scope });
  const manual = async (n: number, preexisting = false) => {
    await db.query("update public.apply_tasks set status='manual_actionable' where id=$1", [id(n)]);
    const requested = await user('commands.request', { bindingId: B, type: 'open_manual', args: { taskId: id(n) } });
    const claimed = await worker('commands.claim', { limit: 20 });
    const c = claimed.commands.find((row: Record<string, any>) => row.id === requested.command.id);
    await worker('sessions.report', { portal: decision().portal, status: 'authenticated', accountLabel: 'synthetic@example.com' });
    const beforeAt = (await query<{ stamp: string }>("select clock_timestamp()::text stamp"))[0].stamp;
    await db.query('select pg_sleep(0.01)');
    const afterAt = (await query<{ stamp: string }>("select clock_timestamp()::text stamp"))[0].stamp;
    const receipt = { selector: '#application_confirmation', text: 'Your application has been received.', url: job(n).jobUrl };
    const snapshot = (checkedAt: string, observedReceipt: object | null) => ({ jobUrl: job(n).jobUrl, checkedAt, accountIdentity: 'synthetic@example.com', session: { ok: true, jobUrl: job(n).jobUrl, checkedAt }, receipt: observedReceipt });
    return { commandId: c.id, claimNonce: c.claim_nonce, before: snapshot(beforeAt, preexisting ? receipt : null), after: snapshot(afterAt, receipt) };
  };
  const graduate = async () => {
    for (let n = 1; n <= 4; n++) await claimDecide(n);
    for (let n = 1; n <= 3; n++) await feedback(n);
    for (const n of [1, 2]) await worker('learning.manual_observe', await manual(n));
    return user('learning.grant', { ...confirm(4), expiresAt: new Date(Date.now() + 86400000).toISOString() });
  };
  const autoClaim = async (grantId: string) => {
    await worker('tasks.claim', { limit: 10 });
    return worker('tasks.decide', { ...await lease(4), decision: { ...decision('eligible_auto'), grantId } });
  };
  beforeAll(async () => {
    const loaded = await import(/* @vite-ignore */ modulePath!) as { PGlite: new () => Db };
    db = new loaded.PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key, email text);
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      create table public.apply_agent_bindings(id uuid primary key,user_id uuid references auth.users(id),token_hash text,label text,revoked_at timestamptz,last_used_at timestamptz,created_at timestamptz default now());
      create function public.service_apply_agent_has_access(p_user uuid) returns boolean language sql stable as $$ select not coalesce(current_setting('test.expired',true)='true',false) $$;
      insert into auth.users values('${U}','synthetic@example.com'),('${OTHER}','other@example.com');
      insert into public.apply_agent_bindings(id,user_id,token_hash,label) values('${B}','${U}',repeat('a',64),'Synthetic'),('${OB}','${OTHER}',repeat('b',64),'Other');`);
    await db.exec(baseSql);
    historicalDispatcherBody = (await query<{ body: string }>("select prosrc body from pg_proc where oid='public.apply_pipeline_action(uuid,uuid,text,jsonb)'::regprocedure"))[0].body;
    historicalValidatorBody = (await query<{ body: string }>("select prosrc body from pg_proc where oid='public.apply_pipeline_validate_job(jsonb)'::regprocedure"))[0].body;
    if (migration) { await db.exec(migration); await db.exec(migration); }
  }, 120000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(`truncate public.apply_verified_profiles,public.apply_pipeline_settings,public.apply_tasks,public.apply_runs,public.apply_binding_commands,public.apply_binding_sessions,public.apply_binding_state cascade;
      select set_config('test.expired','false',false);
      insert into public.apply_verified_profiles(user_id,revision,answers_revision,facts,resume_text,resume_approved) values('${U}',1,1,jsonb_build_object(
        'skills',jsonb_build_object('value',jsonb_build_array('typescript'),'source','user','confirmedAt',now()-interval '1 hour'),
        'role',jsonb_build_object('value','Software Engineer','source','user','confirmedAt',now()-interval '1 hour'),
        'locations',jsonb_build_object('value',jsonb_build_array('Remote'),'source','user','confirmedAt',now()-interval '1 hour')),'Exact user-approved resume',true);
      insert into public.apply_pipeline_settings(user_id,data) values('${U}','{"enabled":true,"autoSubmit":true,"threshold":60,"dailyCap":10,"weeklyCap":50,"employerDailyCap":2,"timeZone":"UTC","roles":[],"locations":[],"countries":[],"excludeCompanies":[],"requireWorkAuthorization":false,"allowSponsorship":true,"maxAgeDays":14,"aiConsent":false}');
      insert into public.apply_runs(id,user_id,binding_id,mode,profile_revision,settings_revision,answers_revision) values('${R}','${U}','${B}','auto',1,1,1);`);
    for (let n = 1; n <= 4; n++) await db.query(`insert into public.apply_tasks(id,user_id,run_id,target_binding_id,job_key,job,score,profile_revision,settings_revision,answers_revision) values($1,$2,$3,$4,public.apply_pipeline_job_key($5::jsonb->>'jobUrl'),$5::jsonb,100,1,1,1)`, [id(n), U, R, B, JSON.stringify(job(n))]);
  });
  it('replays additively while preserving installed historical dispatcher and validator bodies', async () => {
    expect((await query<{ body: string }>("select prosrc body from pg_proc where oid='public.apply_pipeline_action_pre_learning(uuid,uuid,text,jsonb)'::regprocedure"))[0].body).toBe(historicalDispatcherBody);
    expect((await query<{ body: string }>("select prosrc body from pg_proc where oid='public.apply_pipeline_validate_job_pre_learning(jsonb)'::regprocedure"))[0].body).toBe(historicalValidatorBody);
    expect((await worker('settings.get')).settings.revision).toBe(1);
  });
  it('normalizes learning lists, isolates owners, and denies worker preference writes', async () => {
    expect((await user('learning.list')).learning).toMatchObject({ feedback: [], grants: [], receipts: [], questions: [] });
    expect((await worker('learning.list')).learning.feedback).toEqual([]);
    await claimDecide(); const f = await feedback(1);
    expect(f.feedback).toMatchObject({ taskId: id(1), jobUrl: job(1).jobUrl, portal: decision().portal, similarityKey: key, source: 'user', profileRevision: 1, settingsRevision: 1 });
    expect(f.feedback).not.toHaveProperty('user_id');
    expect((await user('learning.list', {}, OTHER)).learning.feedback).toEqual([]);
    await expect(worker('learning.feedback', { ...confirm(1), scope: 'similar', verdict: 'apply' })).rejects.toThrow();
    await expect(user('learning.feedback', { ...confirm(1), scope: 'similar', verdict: 'apply', similarityKey: 'spoof' })).rejects.toThrow();
    await expect(user('learning.revoke', { feedbackId: f.feedback.id }, OTHER)).rejects.toThrow();
  });
  it('pages every learning collection stably and completely without hiding an older active veto or grant', async () => {
    const rows = Array.from({ length: 205 }, (_, i) => ({ id: id(1001 + i), job: job(1001 + i) }));
    const snapshot = { ...decision(), eligible: true, score: 100, profileRevision: 1, settingsRevision: 1, answersRevision: 1 };
    await db.query(`insert into public.apply_tasks(id,user_id,run_id,target_binding_id,job_key,job,score,profile_revision,settings_revision,answers_revision,status,match_decision,created_at)
      select (j->>'id')::uuid,$2::uuid,$3::uuid,$4::uuid,public.apply_pipeline_job_key(j->'job'->>'jobUrl'),j->'job',100,1,1,1,'waiting_review',$5::jsonb||jsonb_build_object('jobUrl',j->'job'->>'jobUrl'),now()-interval '1 hour'
      from jsonb_array_elements($1::jsonb) j`, [JSON.stringify(rows), U, R, B, JSON.stringify(snapshot)]);
    await db.exec(`insert into public.apply_match_feedback(id,user_id,task_id,job_url,job_key,similarity_key,portal,scope,verdict,profile_revision,settings_revision,confirmed_at,revoked_at)
      select id,user_id,id,job->>'jobUrl',job_key,match_decision->>'similarityKey',match_decision->>'portal','similar',case when id='${id(1205)}' then 'skip' else 'apply' end,1,1,now()-interval '1 hour',case when id='${id(1205)}' then null else now() end
      from public.apply_tasks where match_decision is not null;
      insert into public.apply_match_grants(id,user_id,task_id,similarity_key,portal,profile_revision,settings_revision,granted_at,expires_at,revoked_at)
      select id,user_id,id,match_decision->>'similarityKey',match_decision->>'portal',1,1,now()-interval '1 hour',now()+interval '1 day',case when id='${id(1205)}' then null else now() end from public.apply_tasks where match_decision is not null;
      insert into public.apply_match_manual_receipts(id,user_id,task_id,job_url,job_key,similarity_key,portal,profile_revision,settings_revision,source,reported_at)
      select id,user_id,id,job->>'jobUrl',job_key,match_decision->>'similarityKey',match_decision->>'portal',1,1,'user',now()-interval '1 hour' from public.apply_tasks where match_decision is not null;
      insert into public.apply_match_questions(id,user_id,task_id,job_url,similarity_key,portal,profile_revision,settings_revision,question,answer,suggestion,answered_at)
      select id,user_id,id,job->>'jobUrl',match_decision->>'similarityKey',match_decision->>'portal',1,1,'{"kind":"skill_gap","skills":["python"],"text":"Confirm Python."}','unsure','none',now()-interval '1 hour' from public.apply_tasks where match_decision is not null;`);
    const collections = ['feedback', 'grants', 'receipts', 'questions', 'eligibility'];
    const first = await user('learning.list');
    expect(Object.keys(first).sort()).toEqual(['hasMore', 'learning']);
    expect(first.hasMore).toBe(true);
    expect(await worker('learning.list', { limit: 200, offset: 0 })).toEqual(first);
    const last = await user('learning.list', { limit: 200, offset: 200 });
    expect(last.hasMore).toBe(false);
    for (const collection of collections) {
      expect(first.learning[collection]).toHaveLength(200);
      expect(last.learning[collection]).toHaveLength(5);
      const combined = [...first.learning[collection], ...last.learning[collection]];
      expect(combined.map(row => row.taskId)).toEqual(rows.map(row => row.id));
      expect(new Set(combined.map(row => row.taskId)).size).toBe(205);
    }
    expect(first.learning.feedback.every((row: Record<string, any>) => row.revokedAt !== null)).toBe(true);
    expect(last.learning.feedback.at(-1)).toMatchObject({ id: id(1205), verdict: 'skip', revokedAt: null });
    expect(last.learning.grants.at(-1)).toMatchObject({ id: id(1205), revokedAt: null });
    const small = await worker('learning.list', { limit: 7, offset: 198 });
    expect(small.hasMore).toBe(false);
    for (const collection of collections) expect(small.learning[collection]).toHaveLength(7);
    const empty = await user('learning.list', { limit: 200, offset: 205 });
    expect(empty.hasMore).toBe(false);
    for (const collection of collections) expect(empty.learning[collection]).toEqual([]);
    expect((await user('learning.list', {}, OTHER)).learning.feedback).toEqual([]);
    // The paged UI/worker result is never the source for server-side vetoes.
    await worker('tasks.claim', { limit: 10 });
    await expect(worker('tasks.decide', { ...await lease(), decision: decision() })).rejects.toThrow('factual match gates failed');
    await expect(user('learning.grant', { ...confirm(1001), expiresAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toThrow();
    // Once the older skip is explicitly revoked, the current older grant is
    // also found independently of the first page's 200 revoked grant rows.
    await db.query('update public.apply_match_feedback set revoked_at=now() where id=$1', [id(1205)]);
    expect((await worker('tasks.decide', { ...await lease(), decision: { ...decision('eligible_auto'), grantId: id(1205) } })).task.status).toBe('in_progress');
    expect((await reserve(id(1205), 1)).reservation.task_id).toBe(id(1));
    // hasMore is an OR across collections, not a requirement that every table
    // has an extra row. Continuation still works when only feedback is large.
    await db.exec('delete from public.apply_match_grants; delete from public.apply_match_manual_receipts; delete from public.apply_match_questions; update public.apply_tasks set match_decision=null');
    const feedbackOnly = await user('learning.list');
    expect(feedbackOnly.hasMore).toBe(true);
    expect(feedbackOnly.learning.feedback).toHaveLength(200);
    for (const collection of collections.slice(1)) expect(feedbackOnly.learning[collection]).toEqual([]);
  }, 120000);
  it.each([{ limit: 0 }, { limit: 201 }, { limit: 1.5 }, { limit: '10' }, { limit: null }, { offset: -1 }, { offset: 0.5 }, { offset: '0' }, { offset: null }, { offset: 2147483648 }, { unexpected: true }])('rejects malformed or unbounded learning pagination %j', async args => {
    await expect(user('learning.list', args)).rejects.toThrow('invalid');
    await expect(worker('learning.list', args)).rejects.toThrow('invalid');
  });
  it('requires exact worker leases, persists revision-bound decisions, and clears manual leases', async () => {
    await worker('tasks.claim', { limit: 10 }); const l = await lease();
    await expect(user('tasks.decide', { ...l, decision: decision() })).rejects.toThrow();
    await expect(worker('tasks.decide', { ...l, leaseVersion: 999, decision: decision() })).rejects.toThrow();
    const result = await worker('tasks.decide', { ...l, decision: decision() });
    expect(result.task.status).toBe('waiting_review'); expect(result.task.match_decision).toMatchObject({ eligible: true, score: 100, profileRevision: 1 });
    expect((await task()).lease_nonce).toBeNull();
    await expect(worker('tasks.decide', { ...l, decision: decision('eligible_auto') })).rejects.toThrow();
  });
  it('blocks old ungranted workers and fabricated core/scope snapshots', async () => {
    await worker('tasks.claim', { limit: 10 });
    await expect(reserve()).rejects.toThrow();
    await db.query("update public.apply_tasks set job=jsonb_set(job,'{description}','\"Python required.\"') where id=$1", [id(4)]);
    await expect(worker('tasks.decide', { ...await lease(4), decision: decision('eligible_auto') })).rejects.toThrow();
    await expect(worker('tasks.decide', { ...await lease(1), decision: { ...decision(), portal: 'greenhouse:boards.greenhouse.io/other' } })).rejects.toThrow();
  });
  it('self reports never count; preexisting or cross-job receipt evidence is rejected', async () => {
    await claimDecide(1); await feedback(1);
    await user('learning.manual_report', confirm(1));
    expect((await user('learning.list')).learning.receipts[0]).toMatchObject({ source: 'user', observedAt: null });
    await expect(worker('learning.manual_observe', await manual(2, true))).rejects.toThrow();
    const evidence = await manual(3); evidence.after.jobUrl = job(4).jobUrl;
    await expect(worker('learning.manual_observe', evidence)).rejects.toThrow();
    await expect(user('learning.grant', { ...confirm(4), expiresAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toThrow();
  });
  it('graduates only after three distinct decisions and two new independently observed receipts', async () => {
    for (let n = 1; n <= 4; n++) await claimDecide(n);
    for (let n = 1; n <= 3; n++) await feedback(n);
    await expect(user('learning.grant', { ...confirm(4), expiresAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toThrow();
    for (const n of [1, 2]) {
      const observation = await manual(n);
      const result = await worker('learning.manual_observe', observation);
      expect(result.receipt).toMatchObject({ taskId: id(n), source: 'worker', accountIdentity: 'synthetic@example.com' });
      await expect(worker('learning.manual_observe', observation)).rejects.toThrow();
    }
    const eligibility = (await user('learning.list')).learning.eligibility.find((e: Record<string, any>) => e.taskId === id(4));
    expect(eligibility).toMatchObject({ eligible: true, applySimilarCount: 3, observedManualReceiptCount: 2 });
    await expect(user('learning.grant', { ...confirm(4), expiresAt: new Date(Date.now() + 31 * 86400000).toISOString() })).rejects.toThrow();
    const g = await user('learning.grant', { ...confirm(4), expiresAt: new Date(Date.now() + 86400000).toISOString() });
    await worker('tasks.claim', { limit: 10 });
    const decided = await worker('tasks.decide', { ...await lease(4), decision: { ...decision('eligible_auto'), grantId: g.grant.id } });
    expect(decided.task.status).toBe('in_progress');
    const reserved = await reserve(g.grant.id);
    expect(reserved.reservation.task_id).toBe(id(4));
    await user('learning.feedback', { ...confirm(4), scope: 'exact', verdict: 'skip' });
    expect((await task(4)).status).toBe('submitting'); // Never invalidate an irreversible reservation/finish lease.
  });
  it('replaces feedback, fences skip applicability, and never revives a revoked grant', async () => {
    await claimDecide(1); const f = await feedback(1); const skip = await feedback(1, 'skip');
    expect((await task()).status).toBe('user_skipped');
    expect((await user('learning.list')).learning.feedback.find((r: Record<string, any>) => r.id === f.feedback.id).revokedAt).not.toBeNull();
    await user('learning.revoke', { feedbackId: skip.feedback.id });
    expect((await task()).status).not.toBe('queued');
    await expect(user('learning.revoke', { feedbackId: f.feedback.id, grantId: id(10) })).rejects.toThrow();
  });
  it('preserves base caps, quiet hours, site flags and receipt/finish guards after graduation', async () => {
    const g = await graduate(); await autoClaim(g.grant.id);
    await db.exec("update public.apply_pipeline_settings set data=jsonb_set(data,'{dailyCap}','0')");
    await expect(reserve(g.grant.id)).rejects.toThrow('submission cap reached');
    await db.exec("update public.apply_pipeline_settings set data=jsonb_set(data,'{dailyCap}','10')||'{\"quietFrom\":\"00:00\",\"quietTo\":\"00:00\"}'::jsonb");
    await expect(reserve(g.grant.id)).rejects.toThrow('quiet hours');
    await db.exec("update public.apply_pipeline_settings set data=data-'quietFrom'-'quietTo'");
    const args = { ...await lease(4), grantId: g.grant.id, similarityKey: key, profileRevision: 1, settingsRevision: 1, answersRevision: 1, siteAllowed: false, accountVerified: true, requiredComplete: true, answerIds: [], idempotencyKey: 'guard-test' };
    await expect(worker('submission.reserve', args)).rejects.toThrow('submit guards required');
    const reservation = (await reserve(g.grant.id)).reservation;
    const finish = { ...await lease(4), reservationId: reservation.id, reservationNonce: reservation.nonce, outcome: 'submitted', evidence: { kind: 'receipt', text: 'Your application has been received.', url: job(4).jobUrl } };
    await expect(worker('submission.finish', { ...finish, reservationNonce: id(900) })).rejects.toThrow();
    await expect(worker('submission.finish', { ...finish, evidence: { ...finish.evidence, url: job(1).jobUrl } })).rejects.toThrow();
    await user('learning.revoke', { grantId: g.grant.id });
    expect((await task(4)).status).toBe('submitting');
    expect((await worker('submission.finish', finish)).reservation.status).toBe('submitted');
    expect((await worker('submission.finish', finish)).reservation.status).toBe('submitted');
    await expect(reserve(g.grant.id)).rejects.toThrow();
  });
  it('grant revoke, expiry, replacement feedback and changed revisions fence pending auto leases', async () => {
    const g = await graduate(); await autoClaim(g.grant.id);
    await user('learning.revoke', { grantId: g.grant.id });
    expect((await task(4)).lease_nonce).toBeNull();
    await expect(reserve(g.grant.id)).rejects.toThrow();
    const second = await user('learning.grant', { ...confirm(4), expiresAt: new Date(Date.now() + 86400000).toISOString() });
    await autoClaim(second.grant.id);
    await db.query("update public.apply_match_grants set granted_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1", [second.grant.id]);
    await expect(reserve(second.grant.id)).rejects.toThrow('current scoped autonomy grant required');
    await feedback(3, 'skip');
    expect((await task(4)).lease_nonce).toBeNull();
    await expect(user('learning.grant', { ...confirm(4), expiresAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toThrow();
    const settings = (await user('settings.get')).settings;
    await user('settings.put', { expectedRevision: 1, settings: settings.data });
    expect((await user('learning.list')).learning.grants.every((row: Record<string, any>) => row.revokedAt !== null)).toBe(true);
    expect((await user('learning.list')).learning.feedback.every((row: Record<string, any>) => row.revokedAt !== null)).toBe(true);
  });
  it('rejects missing/replayed manual probes, changed identity, wrong selectors and user-credit spoofing', async () => {
    for (const n of [1, 2, 3]) await claimDecide(n);
    const good = await manual(1);
    await expect(user('learning.manual_observe', good)).rejects.toThrow();
    await expect(worker('learning.manual_observe', { ...good, before: { ...good.before, session: { ...good.before.session, ok: false } } })).rejects.toThrow();
    await expect(worker('learning.manual_observe', { ...good, after: { ...good.after, accountIdentity: 'other@example.com' } })).rejects.toThrow();
    await expect(worker('learning.manual_observe', { ...good, after: { ...good.after, receipt: { ...good.after.receipt, selector: 'body' } } })).rejects.toThrow();
    await expect(worker('learning.manual_observe', { ...good, after: { ...good.after, receipt: { ...good.after.receipt, text: 'Already applied' } } })).rejects.toThrow();
    const old = await manual(2);
    await db.query("update public.apply_binding_commands set claimed_at=now()-interval '6 minutes' where id=$1", [old.commandId]);
    await worker('commands.claim');
    expect((await query<{ status: string }>('select status from public.apply_binding_commands where id=$1', [old.commandId]))[0].status).toBe('failed');
    await expect(worker('learning.manual_observe', old)).rejects.toThrow();
  });
  it('stores question suggestions without promoting profile facts and invalidates changed revisions', async () => {
    await worker('tasks.claim', { limit: 10 });
    const d = { ...decision('waiting_match_answer'), question: { kind: 'skill_gap', skills: ['python'], text: 'Confirm Python in your profile.' } };
    await worker('tasks.decide', { ...await lease(), decision: d });
    const q = await user('learning.question', { ...confirm(1), answer: 'yes' });
    expect(q.question.suggestion).toBe('profile_update');
    expect((await query<{ facts: Record<string, unknown> }>('select facts from public.apply_verified_profiles'))[0].facts).not.toHaveProperty('python');
    const settings = (await user('settings.get')).settings;
    await user('settings.put', { expectedRevision: 1, settings: settings.data });
    await expect(feedback(1)).rejects.toThrow();
    expect((await task()).lease_nonce).toBeNull();
  });
  it('retains factually safe review-only portals without promoting them to auto eligibility', async () => {
    const g = await graduate();
    const j = { ...job(4), jobUrl: 'https://jobs.lever.co/acme/123e4567-e89b-42d3-a456-426614174000' };
    await setJob(j, 4);
    await worker('tasks.claim', { limit: 10 });
    await expect(worker('tasks.decide', { ...await lease(4), decision: { ...groundedDecision(j, 'eligible_auto'), portal: 'lever:jobs.lever.co/acme', grantId: g.grant.id } })).rejects.toThrow('explicit supported auto target required');
    const result = await worker('tasks.decide', { ...await lease(4), decision: { ...groundedDecision(j), portal: 'lever:jobs.lever.co/acme' } });
    expect(result.task.status).toBe('waiting_review');
    // Synthetic old counts for the review-only portal must not unlock a grant.
    await db.query("update public.apply_match_feedback set portal=$1;", ['lever:jobs.lever.co/acme']);
    await db.query("update public.apply_match_manual_receipts set portal=$1;", ['lever:jobs.lever.co/acme']);
    expect((await user('learning.list')).learning.eligibility.find((row: Record<string, any>) => row.taskId === id(4))).toMatchObject({ eligible: false, applySimilarCount: 3, observedManualReceiptCount: 2 });
    await expect(user('learning.grant', { ...confirm(4), expiresAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toThrow();
  });
  it('retains filtered jobs as grounded manually actionable snapshots with feedback and safe commands', async () => {
    await db.query("update public.apply_tasks set status='filtered',reason='below_threshold' where id=$1", [id(1)]);
    const result = await user('tasks.list');
    const t = result.tasks.find((row: Record<string, any>) => row.id === id(1));
    expect(t.status).toBe('manual_actionable');
    expect(t.match_decision).toMatchObject({ status: 'manual_actionable', eligible: false, score: 100, similarityKey: key, profileRevision: 1, settingsRevision: 1 });
    await feedback(1);
    await expect(user('commands.request', { bindingId: OB, type: 'open_manual', args: { taskId: id(1) } })).rejects.toThrow();
    await expect(user('commands.request', { bindingId: B, type: 'open_manual', args: { taskId: id(1), jobUrl: job(4).jobUrl } })).rejects.toThrow();
    const command = await user('commands.request', { bindingId: B, type: 'open_manual', args: { taskId: id(1) } });
    expect(command.command.job.jobUrl).toBe(job(1).jobUrl);
  });
  it('independently reconstructs required OR groups and fingerprints without granting factual overrides', async () => {
    const cases = [
      { ...job(1), title: 'Senior Backend Engineer', skills: ['python', 'node.js', 'react'], description: 'Python or Node.js required. React optional.' },
      { ...job(1), title: 'Full-stack Engineer', skills: ['typescript', 'react'], description: 'Must know React and TypeScript.' },
      { ...job(1), skills: ['typescript', 'python'], description: 'TypeScript required; Python not required.' },
      { ...job(1), title: 'C++ Developer', skills: ['c++', 'c#'], description: 'C++ or C# required.' },
      { ...job(1), skills: ['nodejs', 'sql'], description: 'Node.js required. SQL preferred.' },
      { ...job(1), skills: ['html', 'css'], description: 'Proficiency in HTML and CSS.' },
      { ...job(1), skills: ['html', 'css'], description: 'Must be proficient in HTML or CSS.' },
      { ...job(1), skills: ['typescript', 'python'], description: 'TypeScript or Python optional. Python required.' },
      { ...job(1), skills: ['typescript', 'python'], description: 'TypeScript or Python optional, but Python mandatory.' },
      { ...job(1), skills: ['typescript', 'python'], description: 'TypeScript or Python required. TypeScript mandatory.' },
      { ...job(1), skills: ['typescript', 'python'], description: 'TypeScript or Python required, Python essential.' },
      { ...job(1), skills: ['typescript', 'python', 'java'], description: 'Must know TypeScript and Python or Java.' },
      { ...job(1), skills: ['typescript', 'python'], description: 'TypeScript and/or Python required.' },
      { ...job(1), skills: ['typescript', 'react.js'], description: 'React.js / TypeScript required.' },
      { ...job(1), skills: ['typescript', 'python'], description: 'TypeScript or Python preferred; TypeScript essential.' },
    ];
    for (const j of cases) {
      const sql = (await query<{ requirements: object[]; similarity: unknown }>('select public.apply_pipeline_learning_requirements($1::jsonb) requirements,public.apply_pipeline_learning_similarity($1::jsonb,public.apply_pipeline_learning_requirements($1::jsonb)) similarity', [JSON.stringify(j)]))[0];
      const expected = extractVerifiedRequirements(j);
      const shapes = (groups: object[]) => groups.map(g => { const row = g as { anyOf: string[]; core: boolean }; return { anyOf: row.anyOf, core: row.core }; });
      expect(shapes(sql.requirements)).toEqual(shapes(expected));
      expect(sql.similarity).toEqual(JSON.parse(verifiedSimilarityKey(j)));
    }
  });
  it.each([
    'TypeScript required.', 'Strong knowledge of TypeScript.', 'Expertise in React.js and TypeScript.',
    'Must be proficient in HTML or CSS.', 'Proficiency in Node.js / Python.', 'Python not required.',
    'Must have technical programming skills in TypeScript.', 'Backend development with Node.js required.',
  ])('accepts only understood mandatory structural vocabulary: %s', async description => {
    const j = { ...job(1), description };
    expect((await query<{ valid: boolean }>('select public.apply_pipeline_learning_requirements_readable($1::jsonb) valid', [JSON.stringify(j)]))[0].valid).toBe(true);
  });
  it.each([
    { name: 'mandatory HTML and CSS', description: 'TypeScript required. HTML and CSS mandatory.', skills: ['typescript'] },
    { name: 'mandatory proficiency', description: 'TypeScript required. Proficiency in Python.', skills: ['typescript'] },
    { name: 'optional OR before a mandatory clause', description: 'TypeScript or Python optional. Python required.', skills: ['typescript'] },
    { name: 'optional OR before comma-but', description: 'TypeScript or Python optional, but Python required.', skills: ['typescript'] },
    { name: 'unknown mandatory requirement', description: 'TypeScript required. Must have XYZ certification.', skills: ['typescript'] },
    { name: 'unknown credential hidden beside a recognized skill', description: 'Must know TypeScript and have XYZ certification.', skills: ['typescript'] },
    { name: 'unknown skill hidden beside a recognized skill', description: 'Must know TypeScript and COBOL.', skills: ['typescript'] },
    { name: 'mandatory degree', description: 'TypeScript and a degree required.', skills: ['typescript'] },
    { name: 'mandatory licence', description: 'TypeScript and a licence required.', skills: ['typescript'] },
    { name: 'mandatory numeric years', description: 'Must have 5 years of TypeScript experience.', skills: ['typescript'] },
    { name: 'mixed AND/OR precedence', description: 'Must know TypeScript and Python or Java.', skills: ['typescript', 'python', 'java'] },
    { name: 'optional vocabulary masking mandatory requirements', description: 'TypeScript required and Python preferred.', skills: ['typescript', 'python'] },
    { name: 'frontend role core', title: 'Frontend Engineer', description: 'Python required.', skills: ['python'] },
    { name: 'backend role core', title: 'Backend Engineer', description: 'TypeScript required.', skills: ['typescript'] },
    { name: 'fullstack backend core', title: 'Full-stack Engineer', description: 'TypeScript required.', skills: ['typescript'] },
    { name: 'board LOW', boardMatch: 'LOW', description: 'TypeScript required.', skills: ['typescript'] },
    { name: 'invalid board match', boardMatch: 'perfect', description: 'TypeScript required.', skills: ['typescript'] },
    { name: 'future posting', postedAt: new Date(Date.now() + 3600000).toISOString(), description: 'TypeScript required.', skills: ['typescript'] },
  ])('independently vetoes $name even with a fabricated eligible snapshot', async spec => {
    const j = { ...job(1), ...spec }; delete (j as Record<string, unknown>).name;
    // Keep the historical overlap/threshold check passing so this exercises the
    // additive requirements gate, not an incidental old score rejection.
    await db.query("update public.apply_verified_profiles set facts=jsonb_set(facts,'{skills,value}',$1::jsonb)", [JSON.stringify(spec.skills)]);
    await setJob(j); await worker('tasks.claim', { limit: 10 });
    await expect(worker('tasks.decide', { ...await lease(), decision: groundedDecision(j) })).rejects.toThrow('factual match gates failed');
    expect((await task()).status).toBe('in_progress');
  });
  it('validates bounded additive board metadata without loosening historical job shape', async () => {
    for (const boardMatch of ['low', 'LOW', 'medium', 'high', 'unknown']) {
      const j = { ...job(1), boardMatch };
      expect((await query<{ valid: boolean }>('select public.apply_pipeline_validate_job($1::jsonb) valid', [JSON.stringify(j)]))[0].valid).toBe(true);
    }
    for (const extra of [{ boardMatch: 'perfect' }, { boardMatch: null }, { boardMatch: [] }, { boardMatch: 'high', unexpected: true }]) {
      expect((await query<{ valid: boolean }>('select public.apply_pipeline_validate_job($1::jsonb) valid', [JSON.stringify({ ...job(1), ...extra })]))[0].valid).toBe(false);
    }
  });
  it('tests whole skill fact scope and current timestamps independently of historical scoped-skill veto', async () => {
    const context = { country: 'US', employer: 'Employer 1', portal: decision().portal, application: job(1).jobUrl };
    const scopeCases = [
      { scope: context, expected: true },
      { scope: { country: 'United States', employer: ' employer 1 ', portal: decision().portal, application: job(1).jobUrl }, expected: true },
      { scope: { ...context, country: 'CA' }, expected: false },
      { scope: { ...context, employer: 'Employer 2' }, expected: false },
      { scope: { ...context, portal: 'greenhouse:boards.greenhouse.io/other' }, expected: false },
      { scope: { ...context, application: job(2).jobUrl }, expected: false },
      { scope: { currency: 'USD' }, expected: false },
      { scope: { ...context, unknown: 'value' }, expected: false },
      { scope: { country: '' }, expected: false },
      { scope: null, expected: false },
      { scope: [], expected: false },
    ];
    const currentFact = { value: ['typescript'], source: 'user', confirmedAt: new Date(Date.now() - 3600000).toISOString() };
    for (const { scope, expected } of scopeCases) {
      const rows = await query<{ valid: boolean }>('select public.apply_pipeline_learning_scoped_fact($1::jsonb,$2::jsonb,clock_timestamp()) valid', [JSON.stringify({ ...currentFact, scope }), JSON.stringify(job(1))]);
      expect(rows[0].valid, JSON.stringify(scope)).toBe(expected);
    }
    for (const changed of [{ source: 'ai' }, { confirmedAt: null }, { confirmedAt: new Date(Date.now() + 3600000).toISOString() }, { validUntil: new Date(Date.now() - 1000).toISOString() }, { validUntil: null }]) {
      expect((await query<{ valid: boolean }>('select public.apply_pipeline_learning_scoped_fact($1::jsonb,$2::jsonb,clock_timestamp()) valid', [JSON.stringify({ ...currentFact, ...changed }), JSON.stringify(job(1))]))[0].valid).toBe(false);
    }
    // Even a matching scope cannot waive the historical matcher/reserve guard.
    await db.query("update public.apply_verified_profiles set facts=jsonb_set(facts,'{skills,scope}',$1::jsonb)", [JSON.stringify(context)]);
    await worker('tasks.claim', { limit: 10 });
    await expect(worker('tasks.decide', { ...await lease(), decision: decision() })).rejects.toThrow('factual match gates failed');
  });
  it('keeps factually safe review-mode decisions while automation consent is off', async () => {
    await db.exec("update public.apply_runs set mode='review'; update public.apply_pipeline_settings set data=jsonb_set(data,'{autoSubmit}','false')");
    await worker('tasks.claim', { limit: 10 });
    expect((await worker('tasks.decide', { ...await lease(), decision: decision() })).task.status).toBe('waiting_review');
    expect((await user('learning.list')).learning.eligibility.find((row: Record<string, any>) => row.taskId === id(1)).eligible).toBe(false);
  });
  it('accepts readable proficiency and AND/OR groups without weakening the historical OR score', async () => {
    const j = { ...job(1), skills: ['typescript', 'python'], description: 'Proficiency in TypeScript and/or Python.' };
    await setJob(j); await worker('tasks.claim', { limit: 10 });
    // One alternative meets the new group, but the historical flat overlap is
    // 50 below threshold 60. Learning cannot override this conservative veto.
    await expect(worker('tasks.decide', { ...await lease(), decision: groundedDecision(j) })).rejects.toThrow('factual match gates failed');
    await db.exec("update public.apply_pipeline_settings set data=jsonb_set(data,'{threshold}','50')");
    expect((await worker('tasks.decide', { ...await lease(), decision: groundedDecision(j) })).task.status).toBe('waiting_review');
  });
  it('never graduates review-mode runs and fences auto decisions/reservation when mode changes', async () => {
    const g = await graduate();
    await db.exec("update public.apply_runs set mode='review'");
    expect((await user('learning.list')).learning.eligibility.find((row: Record<string, any>) => row.taskId === id(4)).eligible).toBe(false);
    await expect(user('learning.grant', { ...confirm(4), expiresAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toThrow();
    await worker('tasks.claim', { limit: 10 });
    await expect(worker('tasks.decide', { ...await lease(4), decision: { ...decision('eligible_auto'), grantId: g.grant.id } })).rejects.toThrow();
    await db.exec("update public.apply_runs set mode='auto'");
    await autoClaim(g.grant.id);
    await db.exec("update public.apply_runs set mode='review'");
    await expect(reserve(g.grant.id)).rejects.toThrow();
    expect((await query('select * from public.apply_submission_reservations'))).toEqual([]);
  });
  it('revokes direct helper/base RPC access and keeps reads/revocation after entitlement expiry', async () => {
    const acls = await query<{ allowed: boolean }>(`select has_function_privilege(r,'public.apply_pipeline_action_pre_learning(uuid,uuid,text,jsonb)','execute') allowed from (values('anon'),('authenticated'),('service_role')) roles(r)`);
    expect(acls.every(r => !r.allowed)).toBe(true);
    const helpers = await query<{ allowed: boolean }>(`select has_function_privilege(r,p.oid,'execute') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join (values('anon'),('authenticated'),('service_role')) roles(r) where n.nspname='public' and p.proname like 'apply_pipeline_%'`);
    expect(helpers.length).toBeGreaterThan(30);
    expect(helpers.every(r => !r.allowed)).toBe(true);
    await db.exec('set role service_role');
    try {
      await expect(db.exec('select * from public.apply_match_feedback')).rejects.toThrow('permission denied');
      await expect(db.exec('insert into public.apply_match_grants default values')).rejects.toThrow('permission denied');
      await expect(db.exec('select public.apply_pipeline_validate_job_pre_learning(\'{}\'::jsonb)')).rejects.toThrow('permission denied');
    } finally { await db.exec('reset role'); }
    await db.exec("select set_config('test.expired','true',false)");
    expect((await user('learning.list')).learning.grants).toEqual([]);
    await expect(worker('learning.list')).rejects.toThrow();
    await expect(feedback(1)).rejects.toThrow();
  });
});
