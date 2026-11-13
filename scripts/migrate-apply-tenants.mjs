/* Guarded management-API rollout. Default is read-only inspection; --apply is
   explicit and the operator must separately approve live writes. SQL bodies
   are never printed because they may contain private backfill parameters. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const value = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const phase = value("--phase") || "expand";
const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const owner = value("--owner-id");
const email = value("--owner-email");
const apply = args.includes("--apply");
const files = phase === "expand" ? [
  "20261113_complimentary_grants.sql", "20261113_admin_rpc_hardening.sql",
  "20261113_apply_tenant_expand.sql", "20261113_apply_agent_bindings.sql",
] : phase === "contract" ? ["20261113_apply_tenant_contract.sql"] : null;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const quote = text => "'" + String(text).replaceAll("'", "''") + "'";

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }), redirect: "error", signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Supabase query failed (HTTP ${response.status}); inspect the dashboard without sharing credentials`);
  return response.json();
}

async function main() {
  if (!files) throw new Error("--phase must be expand or contract");
  if (!/^[a-z]{20}$/.test(ref ?? "")) throw new Error("Valid SUPABASE_PROJECT_REF required");
  if (!/^sbp_[A-Za-z0-9]+$/.test(token ?? "")) throw new Error("SUPABASE_ACCESS_TOKEN must be a management personal access token (sbp_), never a project key");
  if (!owner || !uuid.test(owner) || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Explicit --owner-id UUID and --owner-email required for inspection and rollout");
  }
  const rows = await query(`select id, lower(email) = ${quote(email.toLowerCase())} as email_matches from auth.users where id = ${quote(owner)}::uuid`);
  if (rows?.length !== 1 || rows[0].email_matches !== true) throw new Error("Legacy owner UUID/email verification failed");
  const tables = ["apply_results", "job_apply_reviews", "apply_resume_variants", "form_answers", "apply_skill_strikes", "judge_exemplars", "apply_outcomes"];
  const readiness = await query(`select name, to_regclass('public.' || name) is not null as installed from unnest(array[${tables.map(quote).join(",")}]) as name`);
  const missing = readiness.filter(r => !r.installed).map(r => r.name);
  if (missing.length) throw new Error(`Feature prerequisites missing: ${missing.join(", ")}; do not auto-apply historical setup SQL to production`);
  const counts = await query(tables.map(t => `select '${t}' as table_name, count(*) as row_count from public.${t}`).join(" union all "));
  console.log(JSON.stringify({ project: ref, phase, verifiedOwner: owner, counts, apply }, null, 2));
  if (!apply) { console.log("Inspection only. No schema/data changes made."); return; }
  if (process.env.INTERVIEWIQ_ROLLOUT_CONFIRMED !== `${ref}:${phase}`) {
    throw new Error("Final live confirmation required: INTERVIEWIQ_ROLLOUT_CONFIRMED must match <project>:<phase>");
  }
  if (phase === "contract" && process.env.INTERVIEWIQ_SCOPED_SMOKE_VERIFIED !== ref) {
    throw new Error("Complete owner scoped read/write and two-user isolation smoke tests first; INTERVIEWIQ_SCOPED_SMOKE_VERIFIED must match the project");
  }
  const sql = files.map(file => readFileSync(fileURLToPath(new URL(`../supabase/migrations/${file}`, import.meta.url)), "utf8"));
  const transaction = `begin; set local lock_timeout = '10s'; set local statement_timeout = '120s';
select set_config('app.apply_legacy_user_id', ${quote(owner)}, true);
select set_config('app.apply_legacy_email', ${quote(email.toLowerCase())}, true);
${phase === "contract" ? "select set_config('app.apply_scoped_smoke_verified', 'true', true);" : ""}
${sql.join("\n")}
commit;`;
  await query(transaction);
  console.log(`${phase} migration transaction applied. Function deployment and scoped smoke tests are separate steps.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
