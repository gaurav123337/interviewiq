#!/usr/bin/env node
/* One-command activation of every dormant InterviewIQ server-side feature:
   1. Schema — security.sql, resources.sql, trends.sql
   2. Function secrets — generated (rotated on re-run) unless you pass overrides
   3. pg_cron schedules — the five cron SQL files, placeholders substituted

   Usage:
     SUPABASE_ACCESS_TOKEN=sbp_... \
     SUPABASE_PROJECT_REF=<ref> \
     [optional overrides] \
     node scripts/setup-live.js

   Overrides (set these if you already have values; everything else is generated):
     RESEND_API_KEY=re_...           → digest emails actually send
     SAFE_BROWSING_API_KEY=...       → reputation lookups (else verdicts = pending)
     GITHUB_TOKEN=ghp_...            → GitHub release recency (works keyless too)

   Get a personal access token: supabase.com/dashboard/account/tokens → Generate
   Project ref: the ID in supabase.com/dashboard/project/<REF>/...
   Idempotent — safe to re-run; re-running rotates the generated secrets. */

const API = "https://api.supabase.com/v1";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[90m${s}\x1b[0m`;

const gen = () => globalThis.crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");

const SCHEMA_FILES = ["security.sql", "resources.sql", "trends.sql"];

/* function slug → { secretName, value }  (value resolved below) */
const FUNCTION_SECRETS = [
  { slug: "send-recommendations-digest", name: "RECS_DIGEST_SECRET", placeholder: "<YOUR_RECS_DIGEST_SECRET>" },
  { slug: "send-apply-digest",           name: "APPLY_DIGEST_SECRET", placeholder: "<YOUR_APPLY_DIGEST_SECRET>" },
  { slug: "send-security-digest",        name: "SECURITY_DIGEST_SECRET", placeholder: "<YOUR_SECURITY_SECRET>" },
  { slug: "revalidate-resources",        name: "REVALIDATE_RESOURCES_SECRET", placeholder: "<YOUR_REVALIDATE_SECRET>" },
  { slug: "trends-refresh",              name: "TRENDS_REFRESH_SECRET", placeholder: "<YOUR_TRENDS_SECRET>" },
];

/* optional secrets: only set when provided via env */
const OPTIONAL = [
  { slug: "submit-resource",           name: "SAFE_BROWSING_API_KEY", env: "SAFE_BROWSING_API_KEY" },
  { slug: "trends-refresh",            name: "GITHUB_TOKEN",          env: "GITHUB_TOKEN" },
  { slug: "send-recommendations-digest", name: "RESEND_API_KEY",      env: "RESEND_API_KEY" },
  { slug: "send-apply-digest",         name: "RESEND_API_KEY",        env: "RESEND_API_KEY" },
  { slug: "send-security-digest",      name: "RESEND_API_KEY",        env: "RESEND_API_KEY" },
  { slug: "send-rag-digest",           name: "RESEND_API_KEY",        env: "RESEND_API_KEY" },
];

const CRON_FILES = [
  "send-recommendations-digest-cron.sql",
  "send-apply-digest-cron.sql",
  "send-security-digest-cron.sql",
  "revalidate-resources-cron.sql",
  "trends-refresh-cron.sql",
];

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} → ${res.status}: ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  if (!token || !ref) {
    console.error(red("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF."));
    console.error("  SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/setup-live.js");
    process.exit(1);
  }
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const sqlPath = (f) => fileURLToPath(new URL(`../supabase/${f}`, import.meta.url));

  /* 0 — anon key (needed for the cron HTTP calls) */
  console.log(dim(`→ fetching anon key for ${ref}…`));
  const keys = dry ? [{ name: "anon", api_key: "<anon-key>" }] : await api(`/projects/${ref}/api-keys`);
  const anon = (keys.find((k) => k.name === "anon") || {}).api_key;
  if (!anon) throw new Error("Could not find the anon key for this project.");

  /* 1 — schema */
  for (const f of SCHEMA_FILES) {
    console.log(dim(`→ applying supabase/${f}…`));
    if (!dry) await api(`/projects/${ref}/database/query`, {
      method: "POST",
      body: JSON.stringify({ query: readFileSync(sqlPath(f), "utf8") }),
    });
    console.log(green(`✓ ${f}`));
  }

  /* 2 — secrets */
  const set = new Map();
  for (const s of FUNCTION_SECRETS) {
    const value = gen();
    set.set(s.name, value);
    if (!dry) await api(`/projects/${ref}/functions/${s.slug}/secrets`, {
      method: "POST",
      body: JSON.stringify({ secrets: [{ name: s.name, value }] }),
    });
    console.log(green(`✓ ${s.slug} → ${s.name} ${dry ? "(dry-run)" : "(generated)"}`));
  }
  for (const s of OPTIONAL) {
    const value = process.env[s.env];
    if (!value) continue;
    if (!dry) await api(`/projects/${ref}/functions/${s.slug}/secrets`, {
      method: "POST",
      body: JSON.stringify({ secrets: [{ name: s.name, value }] }),
    });
    console.log(green(`✓ ${s.slug} → ${s.name} ${dry ? "(dry-run)" : "(from env)"}`));
  }
  if (!process.env.SAFE_BROWSING_API_KEY)
    console.log(dim("  (SAFE_BROWSING_API_KEY not set — reputation checks return pending; set it or approve links manually)"));
  if (!process.env.RESEND_API_KEY)
    console.log(dim("  (RESEND_API_KEY not set — digests will answer sent:false until you add it)"));

  /* 3 — cron schedules */
  for (const f of CRON_FILES) {
    let sql = readFileSync(sqlPath(f), "utf8");
    for (const s of FUNCTION_SECRETS) {
      if (sql.includes(s.placeholder)) sql = sql.replaceAll(s.placeholder, set.get(s.name));
    }
    sql = sql.replaceAll("<YOUR_ANON_KEY>", anon);
    if (sql.includes("<YOUR_")) {
      const left = [...sql.matchAll(/<YOUR_[A-Z_]+>/g)].map((m) => m[0]);
      throw new Error(`${f}: unresolved placeholders ${left.join(", ")}`);
    }
    if (!dry) await api(`/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query: sql }) });
    console.log(green(`✓ cron scheduled: ${f.replace("-cron.sql", "")} ${dry ? "(dry-run)" : ""}`));
  }

  console.log("\n" + green("All done — every dormant feature is now live."));
  console.log(dim("  Remaining manual steps:"));
  console.log(dim("  1. Enroll TOTP in Settings → 🔐 Security (authenticator app), then flip"));
  console.log(dim("     Admin → Security → MFA enforcement on for the admin gate."));
  console.log(dim("  2. If you want a branded sender, verify a domain in Resend and set the"));
  console.log(dim("     email 'from' in supabase/functions/_shared/email.ts before the first digest."));
  console.log(dim("  3. Verify crons: select jobname, schedule, active from cron.job;"));
}

main().catch((e) => { console.error(red(String(e))); process.exit(1); });
