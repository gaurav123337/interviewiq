/* Disposable SQL proof only. Never connects to a Supabase project or uses a PAT.
   Supply a task-owned PostgreSQL Docker container; failed databases remain for inspection. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { TELEGRAM_MIGRATION } from "./telegram-rollout-lib.js";

const container = process.env.TELEGRAM_SQL_TEST_CONTAINER;
if (!/^[A-Za-z0-9][A-Za-z0-9_.-]+$/.test(container ?? "")) throw new Error("TELEGRAM_SQL_TEST_CONTAINER must name a disposable local PostgreSQL container");
const database = `telegram_notify_test_${Date.now()}`;
const read = name => readFileSync(fileURLToPath(new URL(`../supabase/${name}`, import.meta.url)), "utf8");
function execute(db, sql) {
  const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"], {
    input: sql, encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    console.error(result.stderr ?? "Disposable SQL execution failed");
    throw new Error(`SQL test failed; inspect disposable database ${database}`);
  }
}

execute("postgres", `create database ${database};`);
let bootstrap = read("tests/auto-apply-bootstrap.sql");
// PostgreSQL roles are cluster-wide; preserve any roles used by sibling fixtures.
bootstrap = bootstrap.replace(/create role (anon|authenticated|service_role) ([^;]+);/g,
  (_, role, options) => `do $$ begin if not exists(select 1 from pg_roles where rolname='${role}') then create role ${role} ${options}; end if; end $$;`);
execute(database, bootstrap);
execute(database, `begin;
select set_config('app.apply_legacy_user_id','11111111-1111-4111-8111-111111111111',true);
select set_config('app.apply_legacy_email','owner@example.test',true);
${read("migrations/20261113_complimentary_grants.sql")}
${read("migrations/20261113_admin_rpc_hardening.sql")}
${read("migrations/20261113_apply_tenant_expand.sql")}
${read("migrations/20261113_apply_agent_bindings.sql")}
commit;`);
const migration = read(`migrations/${TELEGRAM_MIGRATION}`);
execute(database, `begin;
insert into public.user_notify_config(user_id,chat_id,bot_token,updated_at)
values ('11111111-1111-4111-8111-111111111111','123456789','123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd','2026-10-01T00:00:00Z');
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select public.apply_agent_action('11111111-1111-4111-8111-111111111111','notify.get','{}');
reset role;
${migration}
set local role service_role;
do $$ declare cfg jsonb; begin
  cfg := public.apply_agent_action('11111111-1111-4111-8111-111111111111','notify.get','{}');
  if cfg->>'time_zone' <> 'UTC' or cfg->>'bot_token' <> '123456:ABCDEFGHIJKLMNOPQRSTUVWX_abcd' then
    raise exception 'warm dispatcher did not preserve old binding';
  end if;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from public.user_notify_config where user_id='11111111-1111-4111-8111-111111111111'
    and revision=0 and delivery_tested_at is null and updated_at='2026-10-01T00:00:00Z') then
    raise exception 'migration altered legacy binding test history';
  end if;
end $$;
commit;`);
execute(database, `begin; ${migration} commit;`);
execute(database, read("tests/auto-apply-isolation.sql"));
execute(database, read("tests/auto-apply-gifts-and-pairing.sql"));
execute(database, read("tests/telegram-notify.sql"));
console.log(`Telegram SQL migration replay, isolation and binding assertions passed in ${database}. Database retained for inspection.`);
