#!/usr/bin/env node
/* apply-doctor — preflight for the local auto-apply engine.
 *
 * Verifies the engine can actually run BEFORE you burn a real application:
 *   1. Playwright import resolves (global or local install)
 *   2. a Chromium browser binary is installed
 *   3. apply-profile.json exists and carries the required fields
 *   4. each ACTIVE registered site is network-reachable
 *   5. each site's saved session cookie is present in the engine profile
 *
 * Read-only: opens NO site, submits NOTHING. Launches at most one headless
 * throwaway-clone browser (the sign-in flow's own isolation trick) only for
 * the cookie inventory, and never touches the live engine profile.
 *
 * Usage:  node scripts/apply-doctor.mjs [--json]
 * Exit 0 when every active site is run-ready; exit 1 when any blocker is found.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_RULES, siteFromUrl } from "./apply-engine-lib.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(ROOT, "..");
const PROFILE_DIR = path.join(PROJECT, "freebuff-apply-profile");

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const OK = "ok";
const WARN = "warn";
const FAIL = "fail";

/* one check row: { name, status: ok|warn|fail, detail } */
function row(name, status, detail = "") { return { name, status, detail }; }

/* ---------- environment checks (playwright, chromium, profile) ---------- */

async function envChecks() {
  const out = [];

  /* 1. Playwright import — the computed specifier the engine uses, so this
     resolves a global OR local install exactly as the real run does. */
  let chromium = null;
  try {
    const spec = ["play", "wright"].join("");
    ({ chromium } = await import(/* @vite-ignore */ spec));
    out.push(row("playwright import", OK, "resolved (global or local install)"));
  } catch (e) {
    out.push(row("playwright import", FAIL, `cannot import playwright (${String(e?.message ?? e).slice(0, 80)}) — run: npm run apply:setup`));
  }

  /* 2. Chromium browser binary — an import without a browser still can't run. */
  if (chromium) {
    try {
      const exe = chromium.executablePath();
      out.push(existsSync(exe)
        ? row("chromium binary", OK, path.basename(path.dirname(path.dirname(exe))))
        : row("chromium binary", FAIL, `executable missing at ${exe} — run: npx playwright install chromium`));
    } catch (e) {
      out.push(row("chromium binary", FAIL, `no browser installed (${String(e?.message ?? e).slice(0, 60)}) — run: npx playwright install chromium`));
    }
  }

  /* 3. apply-profile.json — the engine exits early without name/email/phone. */
  const profilePath = path.join(PROJECT, "apply-profile.json");
  if (!existsSync(profilePath)) {
    out.push(row("apply-profile.json", FAIL, "missing — copy content/apply-profile.example.json → apply-profile.json"));
  } else {
    try {
      const p = JSON.parse(readFileSync(profilePath, "utf8"));
      const missing = ["name", "email", "phone"].filter((f) => !p[f]);
      if (missing.length) out.push(row("apply-profile.json", FAIL, `missing required field(s): ${missing.join(", ")}`));
      else {
        const nSkills = Array.isArray(p.skills) ? p.skills.length : 0;
        out.push(row("apply-profile.json", nSkills ? OK : WARN,
          nSkills ? `${p.headline || "(no headline)"} · ${nSkills} skills` : `${p.headline || "(no headline)"} · NO skills listed (skill gate falls back to title-only)`));
      }
    } catch (e) {
      out.push(row("apply-profile.json", FAIL, `invalid JSON (${String(e?.message ?? e).slice(0, 60)})`));
    }
  }

  /* 4. AI judge/tailor provider — not required, but the engine makes
     relevance mistakes without it; surface the state plainly. */
  try {
    const { loadAi } = await import("./apply-kit-node.js");
    const ai = await loadAi({ token: process.env.SUPABASE_ACCESS_TOKEN, projectRef: process.env.SUPABASE_PROJECT_REF });
    out.push(ai?.key
      ? row("AI provider", OK, `${ai.model} (JD judge + resume/cover tailoring on)`)
      : row("AI provider", WARN, "not configured — only keyword gates decide; kits fall back to templates"));
  } catch (e) {
    out.push(row("AI provider", WARN, `could not load (${String(e?.message ?? e).slice(0, 60)})`));
  }

  return out;
}

/* ---------- site checks (reachability + saved session cookie) ---------- */

/* Active registered sites, or the builtin boards when the registry is
   unreachable (same fallback the engine's --all uses). */
async function activeSites() {
  try {
    const db = await import("./job-sites-db.js");
    const rows = (await db.listJobSites()).filter((s) => s.status === "active" && s.jobs_url);
    if (rows.length) return rows.map((s) => ({ host: String(s.host).replace(/^www\./, ""), url: s.jobs_url, label: s.label ?? s.host }));
  } catch { /* no local creds / registry down — fall back to builtins */ }
  return [
    { host: "instahyre.com", url: "https://www.instahyre.com/search-jobs/?search=react", label: "Instahyre" },
    { host: "naukri.com", url: "https://www.naukri.com/mnjuser/recommendedjobs", label: "Naukri" },
    { host: "linkedin.com", url: "https://www.linkedin.com/jobs/", label: "LinkedIn" },
  ];
}

/* Does the engine profile's on-disk cookie store carry a named session
   cookie for this host? Reads the sqlite file directly (modern Chrome:
   Default/Network/Cookies) so it works without launching a browser — the
   same byte-scan the engine uses in browserHasSessionCookie. */
function profileHasSessionCookie(names, host) {
  if (!names?.length) return null; // cookieless site — can't verify from disk
  for (const rel of ["Default/Network/Cookies", "Default/Cookies"]) {
    const f = path.join(PROFILE_DIR, ...rel.split("/"));
    try {
      const buf = readFileSync(f);
      /* Chrome stores name and host_key as separate varint-prefixed columns —
         match raw name bytes AND the domain tail (the \u0001-delimited and
         name+host adjacency patterns could never match a real Cookies db). */
      const tail = host.split(".").slice(-2).join(".");
      const hit = names.find((n) => buf.includes(Buffer.from(n)) && (buf.includes(Buffer.from(tail)) || buf.includes(Buffer.from(host))));
      if (hit) return true;
    } catch { /* file absent — keep looking */ }
  }
  /* #165 fallback: a verified session whose browser died before Chromium
     flushed the cookie DB lives in the engine's sidecar file — the engine
     re-injects it at every launch, so it IS a valid saved session. */
  try {
    const sidecar = JSON.parse(readFileSync(path.join(PROFILE_DIR, `signin-session-${host}.json`), "utf8"));
    if (Array.isArray(sidecar?.cookies) && sidecar.cookies.some((c) => c?.name && names.includes(c.name) && c?.value)) return true;
  } catch { /* no sidecar */ }
  return false;
}

async function siteChecks(sites) {
  const out = [];
  for (const s of sites) {
    const rules = SITE_RULES[siteFromUrl(s.url)] ?? SITE_RULES.generic;
    /* reachability: a cheap HEAD/GET with a short timeout — names the exact
       failure (DNS, timeout, HTTP code) instead of a silent empty run. */
    let reach;
    try {
      const res = await fetch(s.url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "Mozilla/5.0" } });
      reach = row(`${s.label} · reachable`, res.status >= 500 ? WARN : OK, `HTTP ${res.status} ${res.statusText || ""}`.trim());
    } catch (e) {
      const msg = String(e?.message ?? e);
      const why = /ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED/i.test(msg) ? "DNS did not resolve (network down?)"
        : /abort|timeout/i.test(msg) ? "timed out after 12s" : msg.slice(0, 60);
      reach = row(`${s.label} · reachable`, FAIL, why);
    }
    out.push(reach);

    /* saved session: the #1 cause of empty runs — walled boards need a login. */
    const names = rules.sessionCookieNames ?? [];
    const cookie = profileHasSessionCookie(names, s.host);
    if (cookie === true) out.push(row(`${s.label} · session`, OK, `cookie present (${names.join(", ")})`));
    else if (cookie === false) out.push(row(`${s.label} · session`, FAIL, `no ${names.join("/")} cookie — run: node scripts/auto-apply-jobs.js --url "${s.url}" --login-only`));
    else out.push(row(`${s.label} · session`, WARN, "no named cookie to verify (login checked live at run time)"));
  }
  return out;
}

/* ----------------------------- report ----------------------------- */

function mark(status) { return status === OK ? green("✔") : status === WARN ? yellow("⚠") : red("✗"); }

function printReport(checks, siteRows) {
  console.log("\n🩺 apply-doctor — engine readiness\n");
  console.log("Environment:");
  for (const c of checks) console.log(`  ${mark(c.status)} ${c.name}${c.detail ? dim(" — " + c.detail) : ""}`);
  console.log("\nActive sites:");
  if (!siteRows.length) console.log(dim("  (no active sites)"));
  for (const c of siteRows) console.log(`  ${mark(c.status)} ${c.name}${c.detail ? dim(" — " + c.detail) : ""}`);
  const fails = [...checks, ...siteRows].filter((c) => c.status === FAIL).length;
  const warns = [...checks, ...siteRows].filter((c) => c.status === WARN).length;
  console.log("");
  if (fails) console.log(red(`✗ ${fails} blocker(s)${warns ? ` · ${warns} warning(s)` : ""} — fix the ✗ rows above, then re-run.`));
  else if (warns) console.log(yellow(`⚠ ready with ${warns} warning(s) — the engine will run; review the ⚠ rows.`));
  else console.log(green("✔ all checks passed — the engine is ready to run."));
}

/* ----------------------------- main ----------------------------- */

async function main() {
  const asJson = process.argv.includes("--json");
  const checks = [];
  checks.push(...await envChecks());
  const sites = await activeSites();
  const siteRows = await siteChecks(sites);

  if (asJson) {
    console.log(JSON.stringify({ checks, sites: siteRows }, null, 2));
  } else {
    printReport(checks, siteRows);
  }
  const anyFail = [...checks, ...siteRows].some((c) => c.status === FAIL);
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => { console.error(red(`apply-doctor crashed: ${e?.stack || e}`)); process.exit(1); });
