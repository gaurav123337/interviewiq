#!/usr/bin/env node
/* Apply the InterviewIQ security schema (supabase/security.sql) to the
   Supabase project via the management API.

   Usage:
     SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/setup-security.js

   Get a personal access token: supabase.com/dashboard/account/tokens → Generate new token
   Your project ref:            the ID in supabase.com/dashboard/project/<REF>/...
   Idempotent — safe to re-run. */

const API = "https://api.supabase.com/v1";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

async function main() {
  if (!token || !projectRef) {
    console.error(red("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF."));
    console.error("  SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/setup-security.js");
    process.exit(1);
  }

  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const files = ["security.sql", "resources.sql", "trends.sql"];

  for (const f of files) {
    const schemaPath = fileURLToPath(new URL(`../supabase/${f}`, import.meta.url));
    const sql = readFileSync(schemaPath, "utf8");
    console.log(`Applying supabase/${f} to project ${projectRef}…`);
    const res = await fetch(`${API}/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql })
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(red(`Failed (${res.status}) on ${f}:`));
      console.error(text.slice(0, 1500));
      process.exit(1);
    }
    console.log(green(`Done. ${f} applied (idempotent).`));
  }

  console.log("Next: set up TOTP in Settings → 🔐 Security, then flip");
  console.log("app_config admin_security.mfa = true from the Admin dashboard.");
  console.log("Then deploy the new functions: supabase functions deploy submit-resource revalidate-resources");
}

main().catch(e => { console.error(red(String(e))); process.exit(1); });
