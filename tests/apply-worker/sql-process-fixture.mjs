/* Real SQL -> paired Node CLI -> Chromium -> confirmed user answer -> SQL.
 * Requires an explicitly named disposable Docker PostgreSQL container only.
 * Autonomy grants below are explicit synthetic owner-confirmed fixture data,
 * not production authorization or coverage of learning.grant graduation. */
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { runWorkerFixture } from './process-fixture.mjs';
import { adapterForJob } from '../../scripts/apply-adapters-lib.js';
import { verifiedSimilarityKey } from '../../scripts/apply-pipeline-lib.js';
// Independently hand-known scope: the current description/skills mention only
// JavaScript (not mandatory), Software Engineer, US, Remote, remote=false.
const fixtureSimilarityKey = '["verified-match-v1","software","unspecified",["javascript"],"US","remote",false]';
const fixturePortal = 'greenhouse:boards.greenhouse.io/fixture';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const container = process.env.APPLY_PIPELINE_SQL_CONTAINER;
if (!/^[A-Za-z0-9][A-Za-z0-9_.-]+$/.test(container || '')) throw new Error('Specify a task-owned disposable PostgreSQL container');
const database = `apply_worker_sql_${Date.now()}`;
const binding = '65dfaf34-9194-4bc9-a717-ea3f9aa56fc2', user = '22222222-2222-4222-8222-222222222222';
const token = `aiq1_${binding}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
const digest = createHash('sha256').update(token.split('.')[1]).digest('hex');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
function query(sql, db = database) {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Disposable SQL query failed in ${database}: ${result.stderr?.slice(0, 1500)}`);
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  const json = lines.reverse().find(line => line.startsWith('{') || line.startsWith('['));
  return json ? JSON.parse(json) : null;
}
const read = file => readFileSync(path.join(root, 'supabase', file), 'utf8');
query(`create database ${database};`, 'postgres');
query(read('tests/auto-apply-bootstrap.sql').replace(/create role (anon|authenticated|service_role) ([^;]+);/g,
  (_, role, options) => `do $$ begin if not exists(select 1 from pg_roles where rolname='${role}') then create role ${role} ${options}; end if; end $$;`));
query(`begin; select set_config('app.apply_legacy_user_id','11111111-1111-4111-8111-111111111111',true); select set_config('app.apply_legacy_email','owner@example.test',true);
  ${['20261113_complimentary_grants.sql', '20261113_admin_rpc_hardening.sql', '20261113_apply_tenant_expand.sql', '20261113_apply_agent_bindings.sql', '20261113183000_telegram_notify.sql'].map(file => read(`migrations/${file}`)).join('\n')} commit;`);
query(read('tests/apply-pipeline-bootstrap.sql'));
query(`begin; ${read('migrations/20261114040000_apply_pipeline.sql')} commit;`);
// Replay only the additive feature migration: the historical dispatcher must
// remain its base, never a captured copy of the learning wrapper itself.
for (let replay = 0; replay < 2; replay++) query(read('migrations/20261121000000_verified_match_learning.sql'));
const schema = query(`select jsonb_build_object('grants',to_regclass('public.apply_match_grants') is not null,
  'decision',exists(select 1 from information_schema.columns where table_schema='public' and table_name='apply_tasks' and column_name='match_decision'),
  'base',to_regprocedure('public.apply_pipeline_action_pre_learning(uuid,uuid,text,jsonb)') is not null,
  'basePrivate',not has_function_privilege('service_role','public.apply_pipeline_action_pre_learning(uuid,uuid,text,jsonb)','EXECUTE'));`);
assert.deepEqual(schema, { grants: true, decision: true, base: true, basePrivate: true }, 'Learning schema and private historical dispatcher must be installed');
query(`delete from public.jobs; insert into public.apply_agent_bindings(id,user_id,token_hash,label) values('${binding}','${user}','${digest}','Synthetic worker SQL');
insert into public.jobs(source,external_id,title,company,location,description,url,skills,posted_at,meta)
select 'greenhouse','worker-'||id,'Software Engineer','Fixture Co','Remote','Synthetic JavaScript role','https://boards.greenhouse.io/fixture/jobs/'||id,'["JavaScript"]',now()-interval '1 minute','{"country":"US"}'::jsonb from generate_series(1,3) id;`);
function actor(action, args = {}) {
  return query(`begin; select set_config('request.jwt.claim.sub','${user}',true); select set_config('request.jwt.claim.role','authenticated',true); set local role authenticated;
    select public.my_apply_pipeline_action(${quote(action)},${quote(JSON.stringify(args))}::jsonb); commit;`);
}
function agent(action, args = {}) {
  return query(`begin; select set_config('request.jwt.claim.role','service_role',true); set local role service_role;
    select public.service_apply_pipeline_dispatch('${binding}','${digest}',${quote(action)},${quote(JSON.stringify(args))}::jsonb); commit;`);
}
const profile = actor('profile.confirm', { expectedRevision: null, facts: { name: { value: 'Fixture Person', source: 'user' },
  firstName: { value: 'Fixture', source: 'user' }, lastName: { value: 'Person', source: 'user' }, email: { value: 'fixture@example.invalid', source: 'user' },
  skills: { value: ['JavaScript'], source: 'user' }, role: { value: 'Software Engineer', source: 'user' }, locations: { value: ['Remote'], source: 'user' } },
  resumeText: 'Fixture Person\nUser-approved SQL-backed synthetic resume.', resumeApproved: true });
const initial = actor('settings.get').settings;
const settings = actor('settings.put', { expectedRevision: initial.revision, settings: { ...initial.data, enabled: true, autoSubmit: true, threshold: 60,
  roles: ['Software Engineer'], locations: ['Remote'], requireWorkAuthorization: false, dailyCap: 10, weeklyCap: 50, employerDailyCap: 5 } }).settings;
const run = actor('run.request', { bindingId: binding, mode: 'auto', limit: 3 }).run;
const requestedTasks = actor('tasks.list', { runId: run.id }).tasks;
assert.equal(requestedTasks.length, 3);
for (const task of requestedTasks) {
  assert.equal(task.status, 'queued'); assert.equal(task.target_binding_id, binding);
  assert.equal(task.profile_revision, profile.profile.revision); assert.equal(task.settings_revision, settings.revision);
  assert.equal(verifiedSimilarityKey(task.job), fixtureSimilarityKey, 'Posting requirements must match the hand-known fixture fingerprint');
  assert.equal(adapterForJob(task.job).boardIdentity, fixturePortal, 'Grant portal must be the exact verified board identity');
}
const taskIds = requestedTasks.map(task => quote(task.id)).join(',');
const serverScope = query(`select jsonb_build_object('valid',bool_and(
  public.apply_pipeline_learning_compact(public.apply_pipeline_learning_similarity(job,public.apply_pipeline_learning_requirements(job)))=${quote(fixtureSimilarityKey)}
  and public.apply_pipeline_job_context(job)->>'portal'=${quote(fixturePortal)})) from public.apply_tasks where id in (${taskIds});`);
assert.equal(serverScope.valid, true, 'SQL must independently agree with the pinned scope');
assert.deepEqual(agent('learning.list').learning.grants, [], 'No autonomy is inferred from profile/settings or run.request');
// An old worker with a genuine current lease and all historical reserve flags
// must still fail without a stored safe decision/grant. Roll back the claim so
// this negative probe cannot alter the original three-job question progression.
query(`begin; select set_config('request.jwt.claim.role','service_role',true); set local role service_role;
  do $$ declare v_task jsonb; v_args jsonb; begin
    v_task:=public.service_apply_pipeline_dispatch('${binding}','${digest}','tasks.claim','{"limit":1,"leaseSeconds":90}'::jsonb)->'tasks'->0;
    if v_task is null then raise exception 'Ungranted worker probe requires a current task lease'; end if;
    v_args:=jsonb_build_object('taskId',v_task->'id','leaseVersion',v_task->'lease_version','leaseNonce',v_task->'lease_nonce',
      'profileRevision',v_task->'profile_revision','settingsRevision',v_task->'settings_revision','answersRevision',v_task->'answers_revision',
      'siteAllowed',true,'accountVerified',true,'requiredComplete',true,'answerIds','[]'::jsonb,'idempotencyKey','synthetic-ungranted-probe');
    begin
      perform public.service_apply_pipeline_dispatch('${binding}','${digest}','submission.reserve',v_args);
      raise exception 'Ungranted old worker reservation was accepted';
    exception when insufficient_privilege then
      if sqlerrm<>'stored safe auto decision required' then raise; end if;
    end;
  end $$; rollback;`);
assert.deepEqual(actor('tasks.list', { runId: run.id }).tasks, requestedTasks, 'Negative probe must leave task leases/revisions unchanged');
// Explicit synthetic owner-confirmed authority, inserted ONLY into the new
// disposable database. Use pinned literals, not worker output or SQL-derived
// scope; do not fake graduation receipts or call the private base dispatcher.
query(`insert into public.apply_match_grants(user_id,task_id,similarity_key,portal,profile_revision,settings_revision,source,granted_at,expires_at,revoked_at)
  select '${user}',id,${quote(fixtureSimilarityKey)},${quote(fixturePortal)},${profile.profile.revision},${settings.revision},
    'user',now()-interval '1 second',now()+interval '1 day',null from public.apply_tasks where user_id='${user}' and id in (${taskIds});`);
const grants = agent('learning.list').learning.grants;
assert.equal(grants.length, 3); assert.deepEqual(grants.map(grant => grant.taskId).sort(), requestedTasks.map(task => task.id).sort());
for (const grant of grants) {
  assert.equal(grant.similarityKey, fixtureSimilarityKey); assert.equal(grant.portal, fixturePortal);
  assert.equal(grant.profileRevision, profile.profile.revision); assert.equal(grant.settingsRevision, settings.revision);
  assert.equal(grant.source, 'user'); assert.equal(grant.revokedAt, null);
  assert(Date.parse(grant.grantedAt) <= Date.now()); assert(Date.parse(grant.expiresAt) > Date.now());
  assert(Date.parse(grant.expiresAt) - Date.parse(grant.grantedAt) <= 30 * 86400000);
}
let answered = false, sharedInbox = false;
const backend = {
  action: async (action, args) => agent(action, args),
  progress: async () => {
    const tasks = actor('tasks.list').tasks;
    if (!answered && tasks.filter(t => t.status === 'waiting_answer').length >= 2) {
      const questions = actor('questions.list', { status: 'pending' }).questions;
      assert.equal(questions.length, 1); sharedInbox = true;
      actor('questions.answer', { questionId: questions[0].id, answer: '30 days', scope: 'global', confirm: true }); answered = true;
    }
    return tasks.length === 3 && tasks.every(t => t.status === 'submitted');
  },
  assert: async () => {
    assert(answered && sharedInbox);
    const tasks = actor('tasks.list').tasks;
    assert.equal(tasks.length, 3); assert(tasks.every(t => t.status === 'submitted'));
    for (const task of tasks) {
      assert.equal(task.match_decision.status, 'eligible_auto'); assert.equal(task.match_decision.similarityKey, fixtureSimilarityKey);
      assert.equal(task.match_decision.portal, fixturePortal); assert(grants.some(grant => grant.id === task.match_decision.grantId));
      assert.equal(task.match_decision.profileRevision, profile.profile.revision); assert.equal(task.match_decision.settingsRevision, settings.revision);
    }
    assert.deepEqual(agent('learning.list').learning.grants, grants, 'Answer confirmation must not change scoped autonomy provenance');
    const bank = actor('answers.list').answers; assert.equal(bank.length, 1); assert.equal(bank[0].provenance, 'user');
    assert.equal(bank[0].profile_revision, profile.profile.revision);
    const rows = query(`select jsonb_build_object('reservations',count(*),'submitted',count(*) filter(where r.status='submitted'),
      'fences',bool_and(r.binding_id='${binding}' and r.lease_version=t.lease_version and r.lease_nonce=t.lease_nonce
        and r.profile_revision=t.profile_revision and r.settings_revision=t.settings_revision and r.answers_revision=t.answers_revision))
      from public.apply_submission_reservations r join public.apply_tasks t on t.id=r.task_id;`);
    assert.equal(rows.reservations, 3); assert.equal(rows.submitted, 3); assert.equal(rows.fences, true);
  }
};
const result = await runWorkerFixture({ mode: 'sql-reuse', sqlBackend: backend });
const dir = path.join(root, 'tests/apply-worker/evidence'); mkdirSync(dir, { recursive: true });
const evidence = path.join(dir, `sql-reuse-${Date.now()}.json`);
writeFileSync(evidence, JSON.stringify({ ...result, database, sharedInbox, answered, submitted: 3, answers: 1 }, null, 2));
console.log(JSON.stringify({ mode: 'sql-reuse', passed: true, database, submitted: 3, sharedQuestions: 1, userConfirmedAnswers: 1, evidence }));
