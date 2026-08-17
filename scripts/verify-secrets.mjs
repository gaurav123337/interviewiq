#!/usr/bin/env node
/* verify-secrets — live check of which Edge Function secrets are set on the
   project, via the read-only Management API (list names — values are masked
   and never returned). CLI twin of the Admin → 🔑 Secrets dashboard tab;
   run it BEFORE deploying secret-status if you want a zero-deploy answer.

   Usage:
     SUPABASE_ACCESS_TOKEN=sbp_... \
     SUPABASE_PROJECT_REF=ndrusywvceojsoirhkhl \
     node scripts/verify-secrets.mjs

   Exit code 0 = no required secrets missing; 1 = at least one required
   secret is missing. Nothing is written or changed — read-only. */

const API = "https://api.supabase.com/v1";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF ?? "ndrusywvceojsoirhkhl";

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[90m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

/* Keep in sync with supabase/functions/secret-status/index.ts. builtin =
   auto-injected by Supabase (not settable, always present). */
const EXPECTED = [
  { name: "RESEND_API_KEY", required: true, builtin: false },
  { name: "RECS_DIGEST_SECRET", required: true, builtin: false },
  { name: "APPLY_DIGEST_SECRET", required: true, builtin: false },
  { name: "SECURITY_DIGEST_SECRET", required: true, builtin: false },
  { name: "REVALIDATE_RESOURCES_SECRET", required: true, builtin: false },
  { name: "TRENDS_REFRESH_SECRET", required: true, builtin: false },
  { name: "JOBS_FETCH_SECRET", required: true, builtin: false },
  { name: "GITHUB_TOKEN", required: false, builtin: false },
  { name: "SAFE_BROWSING_API_KEY", required: false, builtin: false },
  { name: "ADZUNA_APP_ID", required: false, builtin: false },
  { name: "ADZUNA_APP_KEY", required: false, builtin: false }
];

if (!token) {
  console.error(red("Missing SUPABASE_ACCESS_TOKEN."));
  console.error("  Get one: supabase.com/dashboard/account/tokens → Generate new token");
  console.error("  Then:    SUPABASE_ACCESS_TOKEN=sbp_... node scripts/verify-secrets.mjs");
  process.exit(2);
}

const list = await fetch(`${API}/projects/${ref}/secrets`, {
  headers: { Authorization: `Bearer ${token}` }
});
if (!list.ok) {
  console.error(red(`GET /projects/${ref}/secrets → ${list.status}: ${(await list.text()).slice(0, 400)}`));
  console.error(dim("  Check the token's project scope and that the ref is right."));
  process.exit(2);
}
const rows = (await list.json()) ?? [];
const live = new Set(rows.map((r) => r.name));

console.log(`Project ${dim(ref)} — live secrets: ${live.size}\n`);
const missing = [];
for (const s of EXPECTED) {
  const ok = live.has(s.name);
  if (!ok && s.required) missing.push(s.name);
  const mark = ok ? green("✓ set") : s.required ? red("✗ MISSING") : yellow("✗ missing (optional)");
  console.log(`  ${mark.padEnd(22)} ${s.name}${s.required ? "" : dim("  (optional — degraded, not broken)")}`);
}
console.log("");

const required = EXPECTED.filter((s) => s.required);
const missingRequired = required.filter((s) => !live.has(s.name));
const missingOptional = EXPECTED.filter((s) => !s.required && !live.has(s.name));

if (missingRequired.length === 0) {
  console.log(green(`✓ All ${required.length} required secrets are set — setup is complete.`));
} else {
  console.log(red(`✗ ${missingRequired.length} required secret(s) missing: ${missingRequired.map((s) => s.name).join(", ")}`));
}
if (missingOptional.length > 0) {
  console.log(yellow(`  Optional missing (features degraded): ${missingOptional.map((s) => s.name).join(", ")}`));
}
console.log(dim("  Add them: Supabase dashboard → Edge Functions → Secrets, or node scripts/setup-live.js"));
process.exit(missingRequired.length === 0 ? 0 : 1);
