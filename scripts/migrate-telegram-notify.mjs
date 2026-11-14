/* Targeted notification rollout; default mode performs metadata-only reads.
   Never prints SQL, credentials, binding destinations or function bodies. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TELEGRAM_MIGRATION, validateTelegramRollout, telegramMigrationTransaction, assertTelegramPreserved } from "./telegram-rollout-lib.js";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const project = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(150_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!response.ok) throw new Error(`Notification query failed (HTTP ${response.status}); no private response was printed`);
  const result = await response.json();
  if (!Array.isArray(result)) throw new Error("Notification query returned an unexpected response");
  return result;
}

async function inspect() {
  const [before] = await query(`begin read only;
select (select count(*) from public.user_notify_config)::text as notify_count,
  (select count(*) from public.apply_results)::text as result_count,
  (select mode::text from public.apply_config limit 1) as engine_mode,
  exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='user_notify_config' and column_name='delivery_tested_at') as notification_expanded;
commit;`);
  if (!before) throw new Error("Notification metadata unavailable");
  return before;
}

async function main() {
  if (args.some(arg => arg !== "--apply")) throw new Error("Only --apply is supported");
  validateTelegramRollout({ project, token, apply, confirmation: process.env.INTERVIEWIQ_TELEGRAM_CONFIRMED });
  const before = await inspect();
  console.log(JSON.stringify({ project, migration: TELEGRAM_MIGRATION, apply, ...before }));
  if (!apply) { console.log("Read-only notification inspection completed; nothing changed."); return; }
  const sql = readFileSync(fileURLToPath(new URL(`../supabase/migrations/${TELEGRAM_MIGRATION}`, import.meta.url)), "utf8");
  await query(telegramMigrationTransaction(sql));
  const after = await inspect();
  assertTelegramPreserved(before, after);
  if (!after.notification_expanded) throw new Error("Notification metadata was not installed");
  const [permissions] = await query(`begin read only;
select has_function_privilege('authenticated','public.get_my_notify_config()','EXECUTE') as own_metadata,
  has_function_privilege('anon','public.get_my_notify_config()','EXECUTE') as anonymous_metadata,
  has_function_privilege('authenticated','public.notify_binding_action(uuid,text,jsonb)','EXECUTE') as browser_binding_write,
  has_table_privilege('authenticated','public.user_notify_config','UPDATE') as browser_direct_update;
commit;`);
  if (!permissions?.own_metadata || permissions.anonymous_metadata || permissions.browser_binding_write || permissions.browser_direct_update) {
    throw new Error("Notification permissions did not meet the reviewed contract");
  }
  console.log("Notification migration applied; existing row counts and engine mode preserved. No message sent. Function deployment remains separate.");
}

main().catch(() => { console.error("Notification rollout stopped; reconcile transaction state before retry. No credential or private data printed."); process.exitCode = 1; });
