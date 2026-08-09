#!/usr/bin/env node
/* Bootstrap the Supabase project for InterviewIQ cloud sync.
 *
 * Usage (new project):
 *   SUPABASE_ACCESS_TOKEN=sb_secret_... SUPABASE_ORG_ID=<org-id> node scripts/setup-supabase.js
 *
 * Usage (existing project):
 *   SUPABASE_ACCESS_TOKEN=sb_secret_... SUPABASE_PROJECT_REF=<ref> node scripts/setup-supabase.js
 *
 * Get a personal access token:  supabase.com/dashboard/account/tokens  →  Generate new token
 * Get your org id:              supabase.com/dashboard/org/<ORG_ID>/...  (the URL segment)
 * Your project ref:             the ID in supabase.com/dashboard/project/<REF>/...
 *
 * What this does:
 *   1. (New project only) Creates a free project named "interviewiq" and waits for health
 *   2. Fetches the project URL + anon key
 *   3. Runs supabase/schema.sql (user_sync table + RLS)
 *   4. Adds the app's URLs to the auth redirect allow-list
 *   5. Prints the config.ts block and the exact callback URL you need for
 *      the GitHub and Google OAuth apps (those two must be created in your
 *      GitHub / Google Cloud consoles — there is no API for them).
 */

const API = "https://api.supabase.com/v1";
const APP_URL = "https://gaurav123337.github.io/interviewiq";
const REGION = process.env.SUPABASE_REGION || "us-east-1";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const orgId = process.env.SUPABASE_ORG_ID;
const projectRef = process.env.SUPABASE_PROJECT_REF;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function req(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${opts.method || "GET"} ${path} → ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!token) {
    console.error(red("Missing SUPABASE_ACCESS_TOKEN."));
    console.error("Create one at supabase.com/dashboard/account/tokens, then:\n");
    console.error("  SUPABASE_ACCESS_TOKEN=sb_secret_... SUPABASE_ORG_ID=<org> node scripts/setup-supabase.js");
    process.exit(1);
  }

  let ref = projectRef;
  if (ref) {
    console.log(`\n${green("✓")} Authenticated. Using existing project ${ref}.`);
  } else {
    /* resolve the org id when omitted and the account has exactly one */
    let org = orgId;
    if (!org) {
      const orgs = await req("/organizations");
      if (orgs.length === 1) org = orgs[0].id;
      else {
        console.error(red("SUPABASE_ORG_ID is required (found multiple organizations):"));
        for (const o of orgs) console.error(`  ${o.id}  ${o.name}`);
        process.exit(1);
      }
    }

    console.log(`\n${green("✓")} Authenticated. Creating project "interviewiq" in org ${org} (${REGION})…`);
    const dbPass = process.env.SUPABASE_DB_PASS ||
      (Array.from({ length: 18 }, () => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 57)]).join("") + "aA1");

    const project = await req("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "interviewiq", organization_id: org, db_pass: dbPass, region: REGION, plan: "free" })
    });
    ref = project.id;
    if (!ref) throw new Error("Project creation returned no id: " + JSON.stringify(project).slice(0, 300));
    console.log(`${green("✓")} Project created: ${project.name} (${project.region}) — ref ${ref}`);

    console.log(dim("   Waiting for the project to come up (can take a minute)…"));
    let status = project.status;
    while (status && !["ACTIVE_HEALTHY", "ACTIVE", "INACTIVE"].includes(status)) {
      await sleep(10_000);
      status = (await req(`/projects/${ref}`)).status;
    }
    console.log(`${green("✓")} Project is ${status}.`);
  }

  const keys = await req(`/projects/${ref}/api-keys`);
  const anon = keys.find((k) => k.name === "anon");
  if (!anon) throw new Error("anon key not found");
  const url = `https://${ref}.supabase.co`;
  console.log(`${green("✓")} URL + anon key fetched.`);
  console.log(dim(`   Project: ${url}`));

  /* run the schema (reads supabase/schema.sql from the repo root) */
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const schemaPath = fileURLToPath(new URL("../supabase/schema.sql", import.meta.url));
  const sql = readFileSync(schemaPath, "utf8");
  await req(`/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query: sql }) });
  console.log(`${green("✓")} Ran supabase/schema.sql (user_sync + RLS).`);

  /* allow the app's URLs as auth redirect targets (PATCH + comma-separated string per the API) */
  try {
    await req(`/projects/${ref}/config/auth`, {
      method: "PATCH",
      body: JSON.stringify({ uri_allow_list: `${APP_URL}/**,http://127.0.0.1:8137/**` })
    });
    console.log(`${green("✓")} Auth redirect allow-list set (${APP_URL}/**).`);
  } catch (e) {
    console.warn(yellow(`⚠ Could not set redirect allow-list via API (${e.message.slice(0, 120)}).`));
    console.warn(yellow(`   Set it manually: Dashboard → Authentication → URL Configuration → add ${APP_URL}/**`));
  }

  console.log(`\n${green("Done!")} Paste this into src/config.ts:\n`);
  console.log(`  supabase: {\n    url: "${url}",\n    anonKey: "${anon.api_key}"\n  }`);
  console.log(`\n${yellow("Remaining manual steps (no API exists for these):")}`);
  console.log(`  1. GitHub: github.com/settings/developers → New OAuth App →\n     Homepage URL: ${APP_URL}\n     Authorization callback URL: ${url}/auth/v1/callback\n     Copy the Client ID + Client Secret into Dashboard → Authentication → Providers → GitHub.`);
  console.log(`  2. Google: console.cloud.google.com → Credentials → OAuth client (Web) →\n     Authorized redirect URIs: ${url}/auth/v1/callback\n     Copy the Client ID + Client Secret into Dashboard → Authentication → Providers → Google.`);
  console.log(`  3. (Optional) Dashboard → Authentication → Providers: set both providers to Enabled.`);
  console.log(`\n${dim("The anon key is public by design (it ships in the PWA). The service_role key and db_pass are secrets — the script did not print them.")}`);
  console.log(`${dim("Your database password is set; find it in Dashboard → Settings → Database if you need to connect. Consider changing it after setup.")}\n`);
}

main().catch((e) => {
  console.error(red("Setup failed: " + e.message));
  process.exit(1);
});
