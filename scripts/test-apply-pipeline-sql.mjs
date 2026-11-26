/* Explicitly disposable SQL proof; never reads Supabase credentials or modifies a live project. */
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const container = process.env.APPLY_PIPELINE_SQL_CONTAINER;
if (!/^[A-Za-z0-9][A-Za-z0-9_.-]+$/.test(container ?? "")) throw new Error("Name a task-owned disposable PostgreSQL container with APPLY_PIPELINE_SQL_CONTAINER");
const database = `apply_pipeline_test_${Date.now()}`;
const read = file => readFileSync(fileURLToPath(new URL(`../supabase/${file}`, import.meta.url)), "utf8");
function execute(db, sql) {
  const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"], {
    input: sql, encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    console.error(result.stderr || "Disposable pipeline SQL failed");
    throw new Error(`Inspect retained disposable test database ${database}`);
  }
}
execute("postgres", `create database ${database};`);
const bootstrap = read("tests/auto-apply-bootstrap.sql").replace(/create role (anon|authenticated|service_role) ([^;]+);/g,
  (_, role, options) => `do $$ begin if not exists(select 1 from pg_roles where rolname='${role}') then create role ${role} ${options}; end if; end $$;`);
execute(database, bootstrap);
execute(database, `begin;
select set_config('app.apply_legacy_user_id','11111111-1111-4111-8111-111111111111',true);
select set_config('app.apply_legacy_email','owner@example.test',true);
${read("migrations/20261113_complimentary_grants.sql")}
${read("migrations/20261113_admin_rpc_hardening.sql")}
${read("migrations/20261113_apply_tenant_expand.sql")}
${read("migrations/20261113_apply_agent_bindings.sql")}
${read("migrations/20261113183000_telegram_notify.sql")}
commit;`);
execute(database, read("tests/apply-pipeline-bootstrap.sql"));
const migration = read("migrations/20261114040000_apply_pipeline.sql");
execute(database, `begin; ${migration} commit;`);
execute(database, `begin; ${migration} commit;`);
for (const suite of ["contract", "leases", "safety", "matching", "reviewer", "answer-revisions"]) execute(database, read(`tests/apply-pipeline-${suite}.sql`));
execute(database, read("tests/apply-pipeline-concurrency-setup.sql"));
function raceLane(lane) {
  return new Promise(resolve => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] });
    let error = "";
    const timer = setTimeout(() => child.kill(), 30_000);
    child.stdout.resume(); child.stderr.on("data", chunk => { error += chunk.toString(); });
    child.once("error", () => { clearTimeout(timer); resolve({ code: -1, error: "Unable to start disposable SQL lane" }); });
    child.once("exit", code => { clearTimeout(timer); resolve({ code, error }); });
    child.stdin.end(`begin; select set_config('request.jwt.claim.role','service_role',true); select public.test_apply_pipeline_reserve_lane(${lane}); select pg_sleep(0.3); commit;`);
  });
}
const races = await Promise.all([raceLane(1), raceLane(2)]);
if (races.filter(row => row.code === 0).length !== 1 || races.filter(row => row.code !== 0 && /submission cap reached/.test(row.error)).length !== 1) {
  throw new Error(`Concurrent cap proof failed; inspect retained disposable database ${database}`);
}
execute(database, read("tests/apply-pipeline-concurrency-assert.sql"));
console.log(`Historical pipeline replay, ownership, answers, leases, submission safety and concurrent caps passed in ${database}.`);
// Install learning only AFTER the original suites and exact one-success cap race.
// Record catalog identities, not source-text assertions, to prove replay keeps
// the installed base dispatcher/validator instead of wrapping its own wrapper.
execute(database, `create table public.test_verified_learning_baseline as select
  'public.apply_pipeline_action(uuid,uuid,text,jsonb)'::regprocedure::oid dispatcher,
  'public.apply_pipeline_validate_job(jsonb)'::regprocedure::oid validator;`);
const learning = read("migrations/20261121000000_verified_match_learning.sql");
execute(database, learning);
execute(database, learning);
execute(database, read("tests/verified-match-learning.sql"));
console.log(`Verified match learning replay and current wrapper contracts passed in ${database}; retained for inspection.`);
