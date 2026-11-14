/* Real SQL -> paired Node CLI -> Chromium -> confirmed user answer -> SQL.
 * Requires an explicitly named disposable Docker PostgreSQL container only. */
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { runWorkerFixture } from './process-fixture.mjs';
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
actor('settings.put', { expectedRevision: initial.revision, settings: { ...initial.data, enabled: true, autoSubmit: true, threshold: 60,
  roles: ['Software Engineer'], locations: ['Remote'], requireWorkAuthorization: false, dailyCap: 10, weeklyCap: 50, employerDailyCap: 5 } });
actor('run.request', { bindingId: binding, mode: 'auto', limit: 3 });
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
    const bank = actor('answers.list').answers; assert.equal(bank.length, 1); assert.equal(bank[0].provenance, 'user');
    assert.equal(bank[0].profile_revision, profile.profile.revision);
    const rows = query(`select jsonb_build_object('reservations',count(*),'submitted',count(*) filter(where status='submitted')) from public.apply_submission_reservations;`);
    assert.equal(rows.reservations, 3); assert.equal(rows.submitted, 3);
  }
};
const result = await runWorkerFixture({ mode: 'sql-reuse', sqlBackend: backend });
const dir = path.join(root, 'tests/apply-worker/evidence'); mkdirSync(dir, { recursive: true });
const evidence = path.join(dir, `sql-reuse-${Date.now()}.json`);
writeFileSync(evidence, JSON.stringify({ ...result, database, sharedInbox, answered, submitted: 3, answers: 1 }, null, 2));
console.log(JSON.stringify({ mode: 'sql-reuse', passed: true, database, submitted: 3, sharedQuestions: 1, userConfirmedAnswers: 1, evidence }));
