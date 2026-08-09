#!/usr/bin/env node
/* Apply the InterviewIQ admin/product-ops schema to an existing Supabase project.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/setup-admin.js
 *
 * Then add yourself as an admin (paste into the SQL editor or the dashboard):
 *   insert into public.app_admins (email) values ('you@example.com');
 *
 * Get a personal access token: supabase.com/dashboard/account/tokens → Generate new token
 * Your project ref:            the ID in supabase.com/dashboard/project/<REF>/...
 */

const API = "https://api.supabase.com/v1";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

async function main() {
  if (!token || !projectRef) {
    console.error(red("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF."));
    console.error("  SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/setup-admin.js");
    process.exit(1);
  }

  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const schemaPath = fileURLToPath(new URL("../supabase/admin.sql", import.meta.url));
  const sql = readFileSync(schemaPath, "utf8");

  const res = await fetch(`${API}/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(red(`POST /projects/${projectRef}/database/query → ${res.status}: ${JSON.stringify(body).slice(0, 400)}`));
    process.exit(1);
  }

  console.log(`${green("✓")} Ran supabase/admin.sql on project ${projectRef}.`);
  console.log(`\nNext: grant yourself admin access — run in the SQL editor:\n`);
  console.log(`  insert into public.app_admins (email) values ('you@example.com');\n`);
  console.log(`Then sign in to the app with that account → the 🛡️ Admin tab appears in the ☰ menu.`);
}

main().catch((e) => {
  console.error(red("Setup failed: " + e.message));
  process.exit(1);
});
