#!/usr/bin/env node
/* auto-apply-jobs — LOCAL Playwright apply engine (owner-run, never CI).
 *
 * Drives a real, headed Chromium with a PERSISTENT profile:
 *   - first run per site: a login window opens; you sign in manually
 *     (Google OAuth / email / OTP / captcha — anything the site offers);
 *     the session persists in freebuff-apply-profile/ and is reused for weeks.
 *   - apply runs: visits a jobs-list URL (LinkedIn /jobs, Naukri recommended,
 *     Instahyre opportunities, or any ATS board), opens each posting, generates
 *     a JD-tailored resume + cover letter (admin-configured AI provider, same
 *     one the app uses), fills the application form with honest answers from
 *     your profile, and submits — per-site rules:
 *       Instahyre + Naukri → auto-submit; LinkedIn + unknown → REVIEW GATE
 *       (form filled, browser paused for a human click; with --unattended
 *       those sites are skipped instead of pausing, so scheduled runs never hang).
 *   - postings must pass BOTH a title gate and a JD-skill gate (the job's
 *     required skills are checked against the resume's skills — no more
 *     backend applications from a frontend profile).
 *   - any required question it cannot answer confidently blocks submission
 *     (fail-closed) and marks the job needs-review in the report.
 *
 * Usage:
 *   node scripts/auto-apply-jobs.js --url "https://www.instahyre.com/candidate/opportunities/?matching=true" \
 *     [--max 8] [--profile apply-profile.json] [--dry-run] [--headless] [--login-only]
 *
 * Files: freebuff-apply-profile/ (browser session, gitignored) and
 * freebuff-apply-reports/ (JSON + md run reports, gitignored).
 * No credentials are stored or typed by this script — logins are manual once.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, createWriteStream } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  siteFromUrl, classifyQuestion, draftAnswer, valueMatchesList,
  newReport, recordResult, reportLine, buildReportMarkdown, buildApplyReportSql, SITE_RULES, ATS_PACKS, detectAts,
  isChallengePage, detectAccountProblem, looksLoggedIn, titleRelevant, looksLikeRefusal, postingRelevant, fitScore, isExternalApplyButton,
  normalizeFieldKey, canStoreAnswer, planFormAnswers, formFieldsPreview, ownerExemplarFor,
} from "./apply-engine-lib.js";
import { buildKit, loadAi, judgeFit } from "./apply-kit-node.js";
import { acquireApplyContext, isRemoteEndpoint } from "./apply-browser.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(ROOT, "..", "freebuff-apply-profile");
const REPORTS_DIR = path.join(ROOT, "..", "freebuff-apply-reports");

/* ----------------------------- CLI args ----------------------------- */

function parseArgs(argv) {
  const args = { max: 8, profile: "apply-profile.json", "dry-run": false, headless: false, "login-only": false, url: "", confirm: false, all: false, watch: false, discover: false, everyHours: 0, unattended: false, status: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i] ?? "";
    else if (a === "--max") args.max = Math.max(1, parseInt(argv[++i], 10) || 8);
    else if (a === "--profile") args.profile = argv[++i];
    else if (a === "--dry-run") args["dry-run"] = true;
    else if (a === "--headless") args.headless = true;
    else if (a === "--login-only") args["login-only"] = true;
    else if (a === "--yes") args.confirm = true;
    else if (a === "--all") args.all = true;
    else if (a === "--watch") { args.all = true; args.watch = true; }
    else if (a === "--discover") args.discover = true;
    else if (a === "--every") args.everyHours = Math.max(1, parseFloat(argv[++i]) || 0);
    else if (a === "--unattended") args.unattended = true; // scheduled runs: never page.pause() — skip review-gate sites instead
    else if (a === "--status") args.status = true; // send a Telegram summary of today's runs
    else if (a === "--digest") args.digest = true; // weekly per-board digest (engine + owner decisions), also sent to Telegram
  }
  return args;
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`;

/* ------------------- applied-dedupe + site registry ------------------- */

const DEDUPE_FILE = path.join(ROOT, "..", "freebuff-apply-state.json");
let __applied = null;
function appliedSet() {
  if (!__applied) {
    try { __applied = new Set(JSON.parse(readFileSync(DEDUPE_FILE, "utf8"))); }
    catch { __applied = new Set(); }
  }
  return __applied;
}
function markApplied(jobUrl) {
  const s = appliedSet();
  s.add(jobUrl.split("?")[0]);
  try { writeFileSync(DEDUPE_FILE, JSON.stringify([...s].slice(-5000))); } catch { /* best effort */ }
}
function wasApplied(jobUrl) { return appliedSet().has(jobUrl.split("?")[0]); }

let __sitesDb = undefined;
async function sitesDb() {
  if (__sitesDb === undefined) {
    try { __sitesDb = await import("./job-sites-db.js"); }
    catch { __sitesDb = null; } // no local creds (e.g. borrowed machine) — degrade to CLI-only
  }
  return __sitesDb;
}

async function syncRunToDb(host, report) {
  const db = await sitesDb();
  if (!db) return;
  try {
    await db.recordRun({
      host, ok: report.results.some((r) => r.result === "submitted"),
      collected: report.results.length,
      submitted: report.results.filter((r) => r.result === "submitted").length,
      skipped: report.results.filter((r) => r.result === "skipped").length,
      errors: report.results.filter((r) => r.result === "error").length,
      notes: reportLine(report).slice(0, 200),
    });
  } catch (e) { console.log(dim(`  (run not synced: ${e.message.slice(0, 80)})`)); }
}

/* --- review queue: needs-review outcomes recorded for one-click finish.
     Returns true when the row was NEW — Telegram pings fire once per
     posting, not on every rerun of a still-pending one. */
async function queueReview(entry) {
  const db = await sitesDb();
  if (!db?.queueJobReview) return false;
  const wasPending = await db.hasPendingReview?.(entry.jobUrl).catch(() => false);
  /* LinkedIn rewrites page.url() mid-modal to ITS canonical selection, so
     pageUrl cannot be trusted for the Open-form link — derive the signed-in
     Easy Apply URL from the posting id instead. */
  const jid = String(entry.jobUrl || "").match(/linkedin\.com\/jobs\/view\/(\d+)/i)?.[1];
  if (jid) entry.formUrl = `https://www.linkedin.com/jobs/search/?currentJobId=${jid}`;
  await db.queueJobReview(entry).catch((e) => console.log(dim(`  (queue: ${e.message.slice(0, 60)})`)));
  if (wasPending) return false;
  const when = entry.fit != null ? ` · fit ${entry.fit}` : "";
  const ok = await sendTelegramNotify(`⏸ Freebuff apply · needs you: ${entry.title || "posting"}${entry.company ? ` — ${entry.company}` : ""}${when}\n${entry.reason || ""}\nFinish in the review queue: …/#/jobs`);
  if (ok) console.log(dim("  📣 telegram: needs-you ping sent"));
  return true;
}

/* --- owner mode switch: off (kill switch) / local / cloud ---
   Read at every cycle start AND before every per-site run in --all, so
   flipping Off in the UI stops even a live watcher within one site. No DB
   (or no row) fails OPEN for single runs (the owner runs them on purpose)
   but the --all/watch cycle fails CLOSED — scheduled automation must stop
   when the owner said stop. Cloud mode is honored only as a NO-GO marker
   for now: local Playwright cannot use a CDP endpoint, so a cloud-mode
   cycle skips honestly until the remote-acquisition PR ships. */
/* Learned criticals: skills the owner 👎-ed >=2 times (via the report's
   feedback buttons) hard-reject any JD that requires them. Empty until the
   owner teaches — the loop is: engine applies → owner reacts → gate learns. */
/* Owner review verdicts (done/dismissed/closed in the review queue): the
   engine must never re-open a posting the owner already handled — includes
   "no longer accepting applications" (closed) and "not interested". */
async function reviewedUrls() {
  const db = await sitesDb();
  if (!db?.listReviewedUrls) return new Map();
  try { return new Map(((await db.listReviewedUrls()) ?? []).map((r) => [String(r.job_url || "").split("?")[0], r.review_status])); }
  catch { return new Map(); }
}
async function judgeExemplars() {
  const db = await sitesDb();
  if (!db?.getJudgeExemplars) return null;
  try {
    const rows = (await db.getJudgeExemplars()) ?? [];
    return {
      positive: rows.filter((r) => r.kind === "positive").map((r) => r.summary),
      negative: rows.filter((r) => r.kind === "negative").map((r) => r.summary),
    };
  } catch { return null; }
}

async function learnedCriticalSkills() {
  const db = await sitesDb();
  if (!db?.getSkillStrikes) return [];
  try { return ((await db.getSkillStrikes(2)) ?? []).map((r) => r.skill); }
  catch { return []; }
}

async function readApplyMode() {
  const db = await sitesDb();
  if (!db?.getApplyConfig) return { mode: "unknown", reason: "no db" };
  try {
    const rows = await db.getApplyConfig();
    const row = (rows ?? [])[0];
    if (!row) return { mode: "unknown", reason: "no config row" };
    return { mode: row.mode, provider: row.cloud_provider ?? null, endpoint: row.cloud_endpoint ?? null };
  } catch (e) { return { mode: "unknown", reason: e.message.slice(0, 60) }; }
}

async function applyModeBlocked(cycle) {
  const cfg = await readApplyMode();
  if (cfg.mode === "off") return "owner switch is OFF (kill switch)";
  if (cfg.mode === "cloud") {
    if (!isRemoteEndpoint(cfg.endpoint)) return "cloud mode set without a valid CDP endpoint (wss://…)";
    return null; // cloud + valid endpoint = runnable via the apply-browser seam
  }
  if (cycle && cfg.mode === "unknown") return `config unavailable (${cfg.reason}) — scheduled runs fail closed`;
  return null;
}

/* local report row + cloud report row, always together */
function recordResultBoth(report, job, result, detail) {
  recordResult(report, job, result, detail);
  recordResultDb(new URL(report.sourceUrl).hostname.replace(/^www\./, ""), job, result === "needsReview" ? "needs_review" : result, detail).catch(() => {});
}

/* --- report every per-job decision to apply_results (UI report) --- */
async function recordResultDb(host, job, result, detail) {
  const db = await sitesDb();
  if (!db?.recordApplyResult) return;
  try {
    await db.recordApplyResult({
      siteHost: host, jobUrl: job?.url ?? "", title: job?.title ?? null,
      company: job?.company ?? null, result, detail: String(detail ?? "").slice(0, 400),
      fit: job?.__fit ?? null,
    });
  } catch { /* report push is best-effort — never breaks a run */ }
}

/* --- form-answer memory: every filled field is stored for future reuse ---
   DB (form_answers, keyed site_host+field_key) is the durable copy; a local
   JSON cache mirrors it so forms fill even when Supabase is unreachable.
   Reads are merged (DB wins on conflict) — both are just (label → answer). */
const ANSWERS_FILE = path.join(ROOT, "..", "freebuff-apply-answers.json");
function localAnswerCache() {
  try { return JSON.parse(readFileSync(ANSWERS_FILE, "utf8")) ?? {}; }
  catch { return {}; }
}
function rememberLocalAnswer(host, key, answer) {
  if (!key || !answer) return;
  try {
    const all = localAnswerCache();
    (all[host] ??= {});
    all[host][key] = answer;
    writeFileSync(ANSWERS_FILE, JSON.stringify(all, null, 2));
  } catch { /* best effort — the DB copy is authoritative */ }
}
async function storeFormAnswers(host, plan, fields) {
  const db = await sitesDb();
  for (let i = 0; i < (fields?.length ?? 0); i++) {
    const p = plan[i];
    if (!p?.answer || !p.key || !canStoreAnswer(p.cls.kind)) continue;
    rememberLocalAnswer(host, p.key, p.answer);
    await db?.putFormAnswer?.({ siteHost: host, fieldKey: p.key, answer: p.answer, kind: p.cls.kind, label: fields[i].label }).catch(() => {});
  }
}
async function loadAnswerMemory(host) {
  const db = await sitesDb();
  let dbMap = {};
  try { dbMap = (await db?.getFormAnswers?.(host)) ?? {}; } catch { /* degrade to local cache */ }
  const local = (localAnswerCache()[host] ?? {});
  return { ...local, ...dbMap }; // DB wins on conflict (fresher, owner-visible)
}

/* --- Telegram notify: post-batch summary (opt-in via notify_config) --- */
async function sendTelegramNotify(text) {
  const db = await sitesDb();
  const cfg = await db?.getNotifyConfig?.().catch(() => null);
  if (!cfg?.chat_id || !cfg?.bot_token) return false;
  const res = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: cfg.chat_id, text, disable_web_page_preview: true }),
  }).catch(() => null);
  if (!res?.ok) { console.log(dim("  (telegram notify failed)")); return false; }
  return true;
}

/* Summarize today's run-*.json reports (used by --status and by the watcher). */
async function summarizeDayFromReports() {
  let files = [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    files = readdirSync(REPORTS_DIR).filter((f) => /^run-.*\.json$/.test(f) && f.includes(today)).sort();
  } catch { /* no reports dir yet */ }
  const totals = { submitted: 0, needsReview: 0, skipped: 0, error: 0 };
  for (const f of files.slice(-12)) {
    try {
      const r = JSON.parse(readFileSync(path.join(REPORTS_DIR, f), "utf8"));
      for (const x of r.results ?? []) totals[x.result] = (totals[x.result] ?? 0) + 1;
    } catch { /* skip unreadable report */ }
  }
  return `Freebuff apply · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC — ✅ ${totals.submitted} submitted · ⏸ ${totals.needsReview} review · ⏭ ${totals.skipped} skipped · ✗ ${totals.error} errors (${files.length} run${files.length === 1 ? "" : "s"} today)`;
}

/* --- selector auto-learning: deduce what worked on this site and persist it ---
   Learned rules ride in the registry (`rules` jsonb) and win over builtin
   hints on the next run, so markup changes self-heal without code edits. */
function learnedRulesFromReport(report, host) {
  const learned = {};
  const okJobs = report.results.filter((r) => r.result === "submitted" || (r.detail || "").includes("filled"));
  if (okJobs.length) {
    const u = okJobs[0].url || "";
    /* derive a durable link shape: /job-listings-<id> → a[href*='job-listings-'] */
    const path = u.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    const seg = path.split("-")[0]?.replace(/^\//, "");
    if (seg && seg.length > 2 && !/^(view|search|jobs?|opportunit)/i.test(seg)) {
      learned.listLinkPattern = seg;
    }
    learned.cardAttr = path.includes("/job-listings-") ? "data-job-id" : (learned.cardAttr ?? null);
  }
  const submitted = report.results.filter((r) => r.result === "submitted");
  if (submitted.length) learned.lastSuccessAt = new Date().toISOString();
  return learned;
}

async function learnRules(host, report) {
  const learned = learnedRulesFromReport(report, host);
  const useful = Object.fromEntries(Object.entries(learned).filter(([, v]) => v != null));
  if (!Object.keys(useful).length) return;
  const db = await sitesDb();
  if (!db) return;
  try {
    await db.setSiteRules(host, useful);
    console.log(dim(`  learned rules stored: ${JSON.stringify(useful).slice(0, 100)}`));
  } catch (e) { console.log(dim(`  (rules not learned: ${e.message.slice(0, 80)})`)); }
}
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

function loadApplyProfile(file) {
  const p = path.resolve(process.cwd(), file);
  if (!existsSync(p)) {
    console.error(red(`✗ Apply profile not found: ${p}`));
    console.error(`  Copy content/apply-profile.example.json → apply-profile.json and fill it in.`);
    process.exit(1);
  }
  const profile = JSON.parse(readFileSync(p, "utf8"));
  for (const f of ["name", "email", "phone"]) {
    if (!profile[f]) { console.error(red(`✗ apply profile missing "${f}" — required for every application.`)); process.exit(1); }
  }
  return profile;
}

/* --------------------------- browser setup --------------------------- */

/* Acquisition goes through scripts/apply-browser.js: local persistent
   profile by default, or a remote CDP session when the owner's apply_config
   says cloud. runSingle carries the cleanup fn — remote connections must
   DISCONNECT (browser.close on CDP), never kill the hosted session. */
let __browserCleanup = null;
async function launchBrowser(headless) {
  let endpoint = "";
  if (args_isCloudMode) endpoint = (await readApplyMode()).endpoint ?? "";
  const { ctx, cleanup, remote } = await acquireApplyContext({ headless, endpoint });
  __browserCleanup = cleanup;
  if (remote) console.log(dim("  ☁️ connected to remote persistent browser session"));
  return ctx;
}
/* set once in main() from the apply_config read — avoids re-reading per run */
let args_isCloudMode = false;
/* set in main(): true for --unattended runs — login waits fail fast (no human) */
let args_unattended = false;

/** Poll the CURRENT page until its state is trustworthy: challenge cleared
    AND no in-flight login redirect (SPAs bounce to /login/ — or straight to
    the OAuth provider — seconds after a challenge clears). Returns
    { kind: "loggedIn"|"login"|"challenge", title, bodyText }. */
const normHost = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
async function waitForStableState(page, rules, url, { settleMs = 9_000 } = {}) {
  const target = normHost(url);
  const t0 = Date.now();
  let stableSince = 0;
  let last = { kind: "challenge", title: "", bodyText: "" };
  for (;;) {
    /* a login/redirect can destroy the execution context mid-poll — tolerate and retry */
    let title = "", bodyText = "";
    try {
      title = await page.title();
      bodyText = await page.evaluate(() => document.body?.innerText ?? "");
    } catch {
      await page.waitForTimeout(1500);
      continue;
    }
    const onLogin = rules.loginPathHints.some(h => page.url().toLowerCase().includes(h.toLowerCase()));
    const challenge = isChallengePage(title, bodyText);
    let kind = challenge ? "challenge" : onLogin ? "login" : "loggedIn";
    /* bounced off-site (e.g. accounts.google.com OAuth) = login needed */
    if (kind === "loggedIn" && target && normHost(page.url()) !== target) kind = "login";
    if (kind !== last.kind) { stableSince = Date.now(); last = { kind, title, bodyText }; }
    /* state must hold for 3s (two consecutive SPA redirects can chain) */
    if (kind !== "challenge" && Date.now() - stableSince >= 3000) return { ...last, kind };
    if (Date.now() - t0 > settleMs) return { ...last, kind };
    await page.waitForTimeout(1500);
  }
}

async function ensureLoggedIn(page, url, site, loginOnly) {
  const rules = SITE_RULES[site] ?? SITE_RULES.generic;
  /* unattended runs have no human at the wheel: a login page means WAIT
     (the session may be restoring — bounded), not "hold the run for 10 min
     for a sign-in that will never come". This was the real scheduled-cloud
     wedge: remote relay runs hit a challenge/login and sat out the clock. */
  const humanAvailable = !args_unattended;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const state = await waitForStableState(page, rules, url);
  const onLogin = () => rules.loginPathHints.some(h => page.url().toLowerCase().includes(h.toLowerCase()));
  if (!loginOnly && state.kind === "loggedIn") {
    const problem = detectAccountProblem(state.bodyText);
    if (problem) { console.error(red(`✗ ${rules.label}: ${problem} — nothing to apply to.`)); return false; }
    console.log(green(`✓ ${rules.label}: session active`));
    return true;
  }
  if (state.kind === "login" && !loginOnly) {
    console.log(yellow(`⏸  ${rules.label}: session expired (redirected to login) — please sign in again.`));
  }
  if (onLogin() || loginOnly) {
    if (!humanAvailable) {
      /* unattended (scheduled/cloud): nobody can sign in — the site wants a
         re-auth the automation must not fake. Fail THIS site fast and let
         the watchdog move the batch on; a human signs in later from the UI
         or a manual --login-only run. */
      console.log(yellow(`⏸  ${rules.label}: needs sign-in — unattended run skips after a bounded re-auth wait.`));
      const t0 = Date.now();
      while (Date.now() - t0 < 45_000) {
        await page.waitForTimeout(3000);
        let st;
        try { st = await waitForStableState(page, rules, url, { settleMs: 0 }); } catch { continue; }
        if (st.kind === "loggedIn") break; // session restored itself
      }
      let st2;
      try { st2 = await waitForStableState(page, rules, url, { settleMs: 0 }); } catch { st2 = { kind: "login" }; }
      if (st2.kind === "loggedIn") { console.log(green(`✓ ${rules.label}: session restored.`)); return true; }
      console.error(red(`✗ ${rules.label}: no session and no human — skipping site (unattended).`));
      return false;
    }
    console.log(yellow(`⏸  ${rules.label}: please sign in in the opened window (Google OAuth / email / OTP — anything the site offers).`));
    console.log(dim("   The session persists in freebuff-apply-profile/ — this is one-time per site."));
    if (!loginOnly) {
      console.log(dim("   (Re-run with --login-only to just log in first, if you prefer.)"));
    }
    /* wait up to 10 minutes for the human to complete login. VERIFIED by
       cookies where the site names its session cookie: page-based checks
       false-positive on LinkedIn (guests see signed-out variants of the
       home/feed pages that pass every URL/title probe — three "Login
       saved" runs in a row stored NO session cookie at all). */
    const verifySession = async () => {
      const names = rules.sessionCookieNames ?? [];
      if (!names.length) return waitForStableState(page, rules, url, { settleMs: 0 });
      for (let i = 0; i < 3; i++) {
        const cookies = await page.context().cookies(url).catch(() => []);
        const hit = names.map((n) => cookies.find((c) => c.name === n)).find(Boolean);
        if (hit?.value) {
          /* diagnostic: a session-scoped cookie (no expiry) dies with the
             browser — the owner must tick the site's keep-signed-in box */
          const exp = hit.expires > 0 ? new Date(hit.expires * 1000).toISOString().slice(0, 10) : "SESSION-ONLY (dies at browser close)";
          console.log(dim(`  session cookie ${hit.name}: expires ${exp}`));
          return { kind: "loggedIn", title: "", bodyText: "" };
        }
        await page.waitForTimeout(4000);
      }
      return { kind: "login", title: "", bodyText: "" };
    };
    const t0 = Date.now();
    while (Date.now() - t0 < 10 * 60_000) {
      await page.waitForTimeout(2000);
      let st;
      try { st = await waitForStableState(page, rules, url, { settleMs: 0 }); } catch { continue; }
      if (st.kind === "loggedIn") {
        st = await verifySession(); // guest-on-homepage false-positive guard
        if (st.kind !== "loggedIn") continue; // still signed out — keep waiting
        const problem = detectAccountProblem(st.bodyText);
        if (problem) { console.error(red(`✗ ${rules.label}: ${problem} — login cannot succeed until the account is restored.`)); return false; }
        console.log(green(`✓ ${rules.label}: logged in.`));
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {}); // back where the run expects
        return true;
      }
    }
    console.error(red(`✗ ${rules.label}: login not completed within 10 minutes.`));
    return false;
  }
  return true;
}

/* ------------------------- job list collection ------------------------- */

async function collectJobs(page, url, site, max) {
  const rules = SITE_RULES[site] ?? SITE_RULES.generic;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  /* LinkedIn authwall: /jobs/view/<id>/ intermittently bounces to the
     signup wall (stale/guest sessions). Guest access DOES pass sometimes —
     retry fresh navigations (bounded) until document.title stops being a
     wall title; only then give up for this collection. */
  const wallTitle = () => page.evaluate(() => /sign (up|in)|join linkedin|authwall/i.test(document.title || ""))
    .catch(() => true); // destroyed context mid-redirect = UNKNOWN → keep retrying (false-negatives here were the thin-capture bug)
  if (site === "linkedin") {
    for (let attempt = 0; attempt < 4 && (await wallTitle()); attempt++) {
      await page.waitForTimeout(2500 + attempt * 1500);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }
  const state = await waitForStableState(page, rules, url); // SPA render + challenge clear + redirect settle
  if (state.kind === "challenge") throw new Error(`${rules.label}: bot-check did not clear — re-run headed (no --headless).`);
  if (state.kind === "login") throw new Error(`${rules.label}: session expired — re-run with --login-only to sign in again.`);
  const problem = detectAccountProblem(state.bodyText);
  if (problem) throw new Error(`${rules.label}: ${problem}`);
  /* A direct /jobs/view/<id>/ URL IS the job: the page's main posting is
     the target, NOT the similar-jobs links the generic collector would
     scrape from the sidebar. Pin it first so dedupe keeps it. */
  const direct = url.match(/linkedin\.com\/jobs\/view\/(\d+)/i);
  if (direct) {
    const head = await page.evaluate(() => {
      /* document.title is the reliable source, but its SHAPE varies by wall
         state: signed-in = "<Company> hiring <Title> in <Place> | LinkedIn";
         walled = "<Title> - <Company> | LinkedIn" or just "<Title> | LinkedIn".
         Reject wall/chrome titles explicitly, then parse what remains. */
      const t = document.title || "";
      const wall = /sign (up|in)|join linkedin|authwall|login/i.test(t);
      const og = document.querySelector('meta[property="og:title"]')?.content ?? "";
      const raw = wall && og ? og : t;
      const m = raw.match(/^(.*?)\s+hiring\s+(.*?)\s+in\s+[^|]*\|/);
      if (m) return { title: m[2].trim().slice(0, 140), company: m[1].trim().slice(0, 80) };
      const bar = raw.split("|")[0].replace(/\s*[-–—]\s*LinkedIn\s*$/i, "").trim();
      const dash = bar.match(/^(.*?)\s+[-–—]\s+(.*)$/); // "<Title> - <Company>"
      if (dash) return { title: dash[2].trim().slice(0, 140), company: dash[1].trim().slice(0, 80) };
      const h1 = (document.querySelector("h1")?.innerText ?? "").trim().split("\n")[0];
      return { title: (h1 || bar).slice(0, 140), company: "" };
    });
    return [{ url: `https://www.linkedin.com/jobs/view/${direct[1]}/`, title: head.title || "LinkedIn posting " + direct[1], company: head.company }];
  }
  /* auto-scroll to load lazy lists (LinkedIn/Instahyre paginate inside SPA) */
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 2400);
    await page.waitForTimeout(900);
  }
  const jobs = await page.evaluate((hints) => {
    const seen = new Set();
    const out = [];
    /* nav junk that looks like a link but is chrome, not a posting */
    const junk = /^(opportunities|jobs?|search jobs?|home|activity|inbox|profile|settings|logout|feed|my network|messaging|notifications|all jobs?|jobs? at .*|view all|see more|more)$/i;
    /* Naukri-style cards: job id in an attribute, no anchor at all */
    for (const art of document.querySelectorAll("[data-job-id]")) {
      const id = art.getAttribute("data-job-id");
      if (!id || seen.has(id)) continue;
      const t = art.querySelector("p[class*='title'], [class*='designation']");
      const c = art.querySelector("[class*='company']");
      const title = ((t?.textContent || art.innerText || "").trim().split("\n")[0] || "").slice(0, 140);
      if (!title || title.length < 8 || junk.test(title)) continue;
      seen.add(id);
      const company = (c?.textContent || "").trim().split("\n")[0].replace(/\s*[\d.]+\s*(Reviews?|stars?)\s*$/i, "").replace(/\s+\d+(\.\d+)?$/, "").slice(0, 80);
      out.push({ url: `https://www.naukri.com/job-listings-${id}`, title, company });
    }
    /* LinkedIn landing/search cards: currentJobId=<id> inside search-results hrefs */
    for (const a of document.querySelectorAll("a[href*='currentJobId=']")) {
      const m = (a.getAttribute("href") || "").match(/currentJobId=(\d+)/);
      if (!m || seen.has(m[1])) continue;
      const text = (a.innerText || "").trim();
      const title = (text.split("\n")[0] || "").replace(/\s*\(Verified job\)\s*$/i, "").slice(0, 140);
      if (!title || title.length < 8 || junk.test(title)) continue;
      seen.add(m[1]);
      const lines = text.split("\n").map(s => s.trim()).filter(Boolean);
      /* company = first line that is not the title (or its "(Verified job)"
         echo) — recruiter-posted cards repeat the title, which used to be
         picked as the "company" ("Frontend Developer (Verified job)") */
      const company = (lines.find(l => l !== title && l.replace(/\s*\(Verified job\)\s*$/i, "") !== title && l.length > 1 && l.length < 60) || "")
        .replace(/\s*\(Verified job\)\s*$/i, "").slice(0, 80);
      out.push({ url: `https://www.linkedin.com/jobs/view/${m[1]}`, title, company });
    }
    for (const sel of hints) {
      for (const a of document.querySelectorAll(sel)) {
        const href = a.href || a.getAttribute("href") || "";
        if (!href) continue;
        const abs = new URL(href, location.origin).toString();
        if (seen.has(abs)) continue;
        const text = (a.innerText || a.textContent || "").trim();
        if (!text || text.length < 8 || junk.test(text.split("\n")[0].trim())) continue;
        seen.add(abs);
        out.push({ url: abs, title: text.split("\n")[0].slice(0, 140), company: "" });
      }
    }
    return out;
  }, rules.listSelectorHints);
  const deduped = [];
  const seen = new Set();
  for (const j of jobs) {
    const key = j.url.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(j);
  }
  return deduped.slice(0, max);
}

/* ------------------------ job page + JD text ------------------------ */

/* Cut page-text fallbacks at sidebar starts: promoted/similar-job rails
   sit after the JD in the DOM, so naive page-text slices drag
   "Technical Lead (Angular) at <other company>" ads into the judged text.
   One such blob rejected a React role for a skill the posting never
   mentioned. Conservative marker set — only obvious jobs-rail headers. */
const trimSidebar = (t) => {
  const m = t.search(/\n\s*(?:Promoted|Similar jobs|More jobs for you|People also viewed|Recommended jobs)\b/i);
  return m >= 0 ? t.slice(0, m).trim() : t;
};
/* Template-B guest pages put the header FIRST, then the promoted-ad rail,
   then the JD inside ONE main section — the JD is not always before the
   first sidebar marker. Ads are chopped from each other by their own
   "Promoted" lines; the JD body is one unbroken block — so split at every
   marker and keep the LARGEST fragment (≥300 chars = real content). */
const largestFragment = (t) => String(t || "")
  .split(/\n\s*(?:Promoted|Similar jobs|More jobs for you|People also viewed|Recommended jobs)\b[^\n]*/i)
  .map((s) => s.trim())
  .filter((s) => s.length >= 300)
  .sort((a, b) => b.length - a.length)[0] ?? "";

/* LinkedIn shows a banner when a posting stopped accepting applications;
   applying to closed postings wastes the owner's apply and teaches the
   judge nothing — detect it right after the JD capture and skip. */
const CLOSED_POSTING_RE = /no longer accepting applications|not accepting applications|no longer accepting job applications/i;

async function openJob(page, job) {
  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);
  /* same wall retry as collection: openJob's OWN navigation hits the wall
     again even when collection just got through (guest access is flaky) */
  if (/linkedin\.com/i.test(job.url || "")) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const wall = await page.evaluate(() => /sign (up|in)|join linkedin|authwall/i.test(document.title || ""))
        .catch(() => true); // destroyed context = UNKNOWN → retry (was false → skipped retries)
      if (!wall) break;
      await page.waitForTimeout(2500 + attempt * 1500);
      await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }
  /* remember the settled URL — if the JD captures thin we re-navigate once
     (guest hydration is flaky per-load; a fresh load usually fixes it) */
  const settledUrl = page.url();
  /* LEARNING WINDOW: explore the WHOLE page before judging it. Boards clamp
     the JD behind "see more" expanders, lazy-render sections on scroll, and
     reveal text only after interaction. So: click EVERY hidden/expander
     button on the page (bounded), scroll the full height, and keep polling
     until the captured JD text stops growing for 2 consecutive rounds or
     the budget is spent — a snapshot of a half-open page is why real
     frontend matches used to die as "JD mentions no specific skills". */
  const expandAll = async () => {
    let clicked = 0;
    const startUrl = page.url();
    try {
      /* ONLY expanders inside/near the description region — clicking page-wide
         buttons once navigated to the COMPANY page ("Ferguson India: Home")
         and destroyed the very JD we were opening */
      const handles = await page.$$(
        ".jobs-description button:visible, .jobs-description [role=button]:visible, .show-more-less-html__button:visible, [class*='jobs-description'] button:visible, [class*='jobs-box__list-item'] button:visible, button:visible.show-more-less-html__button"
      );
      for (const h of handles) {
        if (clicked >= 12) break; // bounded: never site-wrecking
        const label = ((await h.innerText({ timeout: 800 }).catch(() => "")) || "").trim();
        if (!/^(see more|show more|view more|read more|more\.\.\.|\.\.\.|…|expand|show all|full description)\b/i.test(label)) continue;
        if (/^(apply|save|follow|dismiss|skip|share|message)/i.test(label)) continue;
        await h.click({ timeout: 1500 }).catch(() => {});
        clicked++;
        await page.waitForTimeout(350);
        if (page.url() !== startUrl) { // a click navigated — undo immediately
          await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
          await page.waitForTimeout(1500);
          break;
        }
      }
    } catch { /* exploration is best-effort */ }
    return clicked;
  };
  const scrollWholePage = async () => {
    try {
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
    } catch { /* best-effort */ }
  };
  let container = "";
  const grabDesc = () => page.evaluate(() => {
    /* signed-in LinkedIn renders the JD in .jobs-box__html-content (no
       'description' in the class name); guest/other variants use
       .show-more-less-html__markup, .description__text--rich or a
       core-section-container description. Some variants hydrate LATE:
       innerText of the clamped markup returns "" — fall back to
       textContent so a not-yet-laid-out JD still counts as captured. */
    const sels = [".jobs-box__html-content", ".jobs-description__content", ".jobs-description", ".show-more-less-html__markup", ".description__text--rich", "section[class*='show-more-less-html']", ".core-section-container.description", "[class*='job-description']", "[class*='jobs-description']", "[class*='jobs-box__html']"];
    const txt = (el) => {
      const t = (el.innerText || "").trim();
      return t || (el.textContent || "").replace(/\s+/g, " ").trim();
    };
    let best = "";
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        const t = txt(el);
        if (t.length > best.length && t.length >= 120) best = t;
      }
    }
    /* most-specific rendered section: the main rail IS the JD page on
       guest /jobs/view/<id> (right rail = promoted/similar ads we must
       never judge on) */
    let mainSection = "";
    for (const el of document.querySelectorAll("main section")) {
      if (!el.offsetParent) continue;
      const t = txt(el);
      if (t.length > mainSection.length && t.length <= 9000) mainSection = t;
    }
    return { container: best.slice(0, 6000), mainSection: mainSection.slice(0, 6000), pageText: (document.body?.innerText ?? "").slice(0, 12000) };
  });
  let mainSection = "";
  let stable = 0;
  for (let i = 0; i < 10; i++) {
    const clicks = await expandAll();
    await scrollWholePage();
    const g = await grabDesc();
    if (g.container.length > container.length + 80) { container = g.container; stable = 0; }
    else if (g.container.length === container.length) stable++;
    if (g.mainSection.length > mainSection.length) mainSection = g.mainSection; // learned across rounds
    job.pageText = g.pageText;
    if ((container.length >= 400 && stable >= 2) || i === 9) break; // text settled or budget gone
    await page.waitForTimeout(1400);
  }
  if (container.length >= 120) {
    job.description = container;
    console.log(dim(`  📖 JD captured: ${container.length} chars (learning window)`));
  } else {
    /* thin capture — LinkedIn serves a second guest template with obfuscated
       class names (no .show-more-less-html__markup at all) whose JD main
       section hydrates only on a FRESH load (first-load interaction seems
       to cancel the lazy JD fetch). Re-navigate once, re-grab BOTH the
       semantic containers and the main-rail section, keep the bigger. */
    let ms2 = "";
    if (/^https?:/i.test(settledUrl || "")) {
      await page.goto(settledUrl, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const g2 = await grabDesc();
      if (g2.container.length >= 120) {
        job.description = g2.container;
        console.log(dim(`  📖 JD captured on reload: ${g2.container.length} chars`));
      }
      ms2 = g2.mainSection;
    }
    const ms = mainSection.length > ms2.length ? mainSection : ms2;
    if (!job.description && ms.length >= 500) {
      /* the JD may sit before OR after the ad rail inside one section —
         largest marker-split fragment wins (see largestFragment above) */
      const frag = largestFragment(ms);
      if (frag) {
        job.description = frag.slice(0, 6000);
        console.log(dim(`  📖 fallback: main-rail section ${ms.length} chars → JD fragment ${frag.length} chars`));
      }
    }
    if (!job.description) {
      const raw = await page.evaluate(() => {
        const sec = document.querySelector("section[class*='show-more-less-html'] section, .show-more-less-html__markup, section.jobs-description__content section, main section:has([class*='show-more-less'])");
        if (!sec) return "";
        const t = (sec.innerText || "").trim();
        return t || (sec.textContent || "").replace(/\s+/g, " ").trim();
      }).catch(() => "");
      const jdSection = raw.length >= 300 ? trimSidebar(raw.slice(0, 4000)) : "";
      if (jdSection) {
        job.description = jdSection;
        console.log(dim(`  📖 fallback: DOM section ${jdSection.length} chars`));
      }
    }
    if (!job.description) {
      const anchor = job.pageText.match(/about (?:the )?(?:job|this role|opportunity)[\s\S]{400,4000}/i)
        || job.pageText.match(/(?:description|the role|responsibilities)[\s\S]{300,3500}/i);
      const key = (job.title || "").toLowerCase().slice(0, 25).trim();
      const at = key.length > 8 ? job.pageText.toLowerCase().indexOf(key) : -1;
      if (anchor) {
        job.description = trimSidebar(anchor[0].slice(0, 4000));
      } else if (at >= 0) {
        job.description = trimSidebar(job.pageText.slice(at, at + 3500));
      } else {
        job.description = job.pageText.slice(0, 1500); // bare bones: title block only
      }
      console.log(dim(`  📖 fallback description: ${job.description.length} chars (anchors)`));
    }
  }
  const t = (job.pageText.match(/(?:at|·|—|\|)\s*([A-Z][\w&.\- ]{1,40}(?:Labs|Technologies|Solutions|Systems|Inc|Pvt)?)/) || [])[1];
  if (!job.company && t) job.company = t.trim();
}

/* --------------------------- form filling --------------------------- */

async function fillApplicationForm(page, { profile, job, resumePath, dryRun, siteHost, storedAnswers }) {
  /* per-ATS selector pack: known boards (Greenhouse/Lever/Workable) scope the
     field query to their form so nav/search inputs never become "fields" */
  const pack = detectAts(page.url());
  const scopedSelector = pack === ATS_PACKS.generic
    ? "input:not([type=hidden]):not([disabled]), textarea, select"
    : pack.fieldSelectorHints.join(", ");
  const fields = await page.evaluate((sel) => {
    const controls = [...document.querySelectorAll(sel)];
    return controls.map(el => {
      const labelEl = el.closest("label") || (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
      const label = (labelEl?.innerText ?? el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? el.getAttribute("name") ?? "").trim();
      return { tag: el.tagName.toLowerCase(), type: el.getAttribute("type") ?? "", label, required: el.required || !!el.closest("[aria-required=true]"), options: el.tagName === "SELECT" ? [...el.options].map(o => o.textContent.trim()) : undefined };
    });
  }, scopedSelector);
  const controls = await page.$$(scopedSelector);
  /* one plan per form: draft from the profile, then fall back to the
     remembered answer for the same field label (form-answer memory) */
  const plan = planFormAnswers(fields, profile, job, storedAnswers ?? {});
  const unfilledRequired = [];
  let filled = 0;

  for (let i = 0; i < controls.length; i++) {
    const c = controls[i];
    const meta = fields[i] ?? { label: "", tag: "input", required: false };
    let p = plan[i];
    if (!p) { const c2 = classifyQuestion(meta.label, { tag: meta.tag, required: meta.required }); p = { cls: c2, key: normalizeFieldKey(meta.label), answer: draftAnswer(c2.kind, profile, job) }; }
    const { cls, answer } = p;
    try {
      if (meta.tag === "select") {
        if (!answer) { if (meta.required) unfilledRequired.push(meta.label || cls.kind); continue; }
        const pick = (meta.options ?? []).find(o => valueMatchesList(answer, o));
        if (!pick) { if (meta.required) unfilledRequired.push(meta.label || cls.kind); continue; }
        if (!dryRun) await c.selectOption({ label: pick });
        filled++;
      } else if (meta.type === "file") {
        if (resumePath && existsSync(resumePath)) { if (!dryRun) await c.setInputFiles(resumePath); filled++; }
        else unfilledRequired.push("resume file");
      } else if (meta.type === "checkbox" || meta.type === "radio") {
        continue; // consent/ees — leave for the human review step unless simple yes/no below
      } else {
        if (!answer) { if (meta.required) unfilledRequired.push(meta.label || cls.kind); continue; }
        if (!dryRun) { await c.click({ clickCount: 3 }); await c.fill(answer); }
        filled++;
      }
    } catch { /* field-specific failure — count as unfilled if required */ if (meta.required) unfilledRequired.push(meta.label || cls.kind); }
  }
  if (!dryRun) await storeFormAnswers(siteHost ?? "", plan, fields);
  return { filled, unfilledRequired, fields, plan };
}

/* ------------------------------ submit ------------------------------ */

/* Playwright's :has-text() takes a STRING, not a regex — build a JS-side
   regex-matching locator instead so /apply|interested/i etc. work. Only
   VISIBLE+ENABLED buttons count, and the FIRST match wins: boards render
   disabled basket widgets ("Apply to 0 jobs") AFTER the real button. */
function textButtonLocator(page, re) {
  return page
    .locator("button:visible:not([disabled]), a[role=button]:visible, input[type=submit]:visible:not([disabled]), input[type=button]:visible:not([disabled])")
    .filter({ hasText: re })
    .first();
}

async function clickButton(page, locator, textRe) {
  /* scroll to it first — lazy pages keep buttons out of the viewport where
     Playwright refuses to click */
  await locator.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
  try {
    await locator.click({ timeout: 6000 });
    return "pointer";
  } catch (e) {
    /* Angular/Vue boards can fail Playwright's actionability checks forever
       even though the button is visibly clickable — fall back to a DOM click
       through the framework's own handler (proven on Instahyre ng-click). */
    if (!textRe) throw e;
    const ok = await page.evaluate((src) => {
      const re = new RegExp(src, "i");
      const els = [...document.querySelectorAll("button, a[role=button], input[type=submit], input[type=button]")];
      const t = els.find((b) => !b.disabled && (b.offsetWidth || b.offsetHeight) && re.test(((b.innerText || b.value || "").trim())));
      if (!t) return false;
      t.click();
      return true;
    }, textRe.source);
    if (!ok) throw e;
    return "js";
  }
}

async function trySubmit(page, site, rulesOverride) {
  const rules = rulesOverride ?? SITE_RULES[site] ?? SITE_RULES.generic;
  /* the FINAL button is usually NOT the opener — Instahyre: "Apply now" opens
     a modal, then a plain "Submit" button inside it sends the application */
  let btn = textButtonLocator(page, rules.submitButtonText ?? rules.applyButtonText);
  if ((await btn.count()) === 0 && site === "linkedin") {
    /* LinkedIn Easy Apply is a MULTI-STEP flow (Contact → Resume → Questions
       → Review) that renders INLINE in the sidebar in current LinkedIn (no
       dialog container — the old modal selectors find nothing). Drive the
       Next/Review buttons via JS clicks (pointer clicks get swallowed by
       the re-rendering flow), bounded — and stop the instant the real
       "Submit application" button appears. */
    for (let step = 0; step < 8; step++) {
      if ((await btn.count()) > 0) break;
      const advanced = await page.evaluate(() => {
        const find = (re) => [...document.querySelectorAll("button, a[role=button]")]
          .find((b) => b.offsetParent && !b.disabled && re.test((b.innerText || b.getAttribute("aria-label") || "").trim()));
        const b = find(/^review$/i) || find(/^next$/i);
        if (!b) return false;
        b.click();
        return true;
      }).catch(() => false);
      if (!advanced) break;
      await page.waitForTimeout(2000);
      btn = textButtonLocator(page, rules.submitButtonText ?? rules.applyButtonText);
    }
  }
  if ((await btn.count()) === 0) {
    if (site === "linkedin") return { auto: false, note: "Easy Apply modal mid-flow — form filled, finish the submit (2 clicks)" };
    if (rules.autoSubmit) return { auto: true, note: "submit button not found (may already be applied)" };
    return { auto: false, note: "review gate — human submits" };
  }
  if (rules.autoSubmit) {
    /* SAFETY PRE-CHECK before the one-way click: every required field in
       the form must hold a value — one empty required field = the ATS
       would bounce it anyway; fail CLOSED to the review queue instead. */
    const emptyRequired = await page.evaluate(() =>
      [...document.querySelectorAll("input:not([type=hidden]), textarea, select")]
        .filter((el) => el.required || el.closest("[aria-required=true]"))
        .filter((el) => el.offsetParent) // visible only — hidden steps don't count
        .filter((el) => (el.tagName === "SELECT" ? !el.value : !String(el.value ?? "").trim()))
        .map((el) => el.getAttribute("name") || el.getAttribute("aria-label") || el.id || "(unlabeled)")
        .slice(0, 5)
    ).catch(() => ["(check failed)"]);
    if (emptyRequired.length) return { auto: false, note: `cannot auto-submit — required fields empty: ${emptyRequired.join(", ")}` };
    await clickButton(page, btn, rules.submitButtonText ?? rules.applyButtonText);
    await page.waitForTimeout(4000);
    const success = rules.successText.test(await page.evaluate(() => document.body?.innerText ?? ""));
    return { auto: true, note: success ? "submitted (auto)" : "clicked submit; success text not detected" };
  }
  return { auto: false, note: "review gate — human submits" };
}

/* ------------------------------- main ------------------------------- */

async function runSingle(args) {
  if (!args.url) {
    console.error(`Usage: node scripts/auto-apply-jobs.js --url "<jobs list URL>" [--max N] [--dry-run] [--login-only] [--headless] [--profile file]`);
    process.exit(1);
  }
  const site = siteFromUrl(args.url);
  let rules = { ...SITE_RULES[site] };
  /* registry rules win over builtin hints: learned selectors AND the owner's
     autoSubmit decision (e.g. LinkedIn flipped on in the sites registry) */
  try {
    const db = await sitesDb();
    const row = (await db?.listJobSites?.())?.find((s) => s.host === args.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || s.host === (new URL(args.url).hostname.replace(/^www\./, "")));
    if (row?.rules && typeof row.rules === "object") rules = { ...rules, ...row.rules };
  } catch { /* registry unavailable — builtin rules stand */ }
  const profile = loadApplyProfile(args.profile);
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const ai = await loadAi({ token, projectRef });
  console.log(`apply-engine → ${rules.label} · ${args.url} · max ${args.max}${ai ? ` · AI: ${ai.model}` : " · AI: OFF (templates)"}`);
  /* owner kill switch: a manual single run fails open when the config is
     unreadable (the owner is running it on purpose), but honors off/cloud */
  if (!args["login-only"]) {
    const blocked = await applyModeBlocked(false);
    if (blocked) { console.error(red(`✗ apply engine disabled: ${blocked}.`)); return; }
  }

  const ctx = await launchBrowser(args.headless);
  let page = ctx.pages()[0] ?? (await ctx.newPage());
  const report = newReport(args.url, site);
  mkdirSync(REPORTS_DIR, { recursive: true });

  try {
    if (!await ensureLoggedIn(page, args.url, site, args["login-only"])) {
      console.error(red("Login required — aborting (nothing was submitted)."));
      return;
    }
    if (args["login-only"]) { console.log(green("Login saved. Re-run without --login-only to apply.")); return; }

    let jobs = await collectJobs(page, args.url, site, args.max);
    console.log(dim(`collected ${jobs.length} posting(s)`));
    if (!jobs.length) {
      /* LinkedIn wall flakiness: guest access alternates wall/pass between
         navigations — one more collect attempt before declaring defeat */
      await page.waitForTimeout(3000);
      jobs = await collectJobs(page, args.url, site, args.max);
      console.log(dim(`collected (retry) ${jobs.length} posting(s)`));
    }
    if (!jobs.length) {
      /* honest diagnostics: dump exactly what the engine saw */
      const dbg = [
        `finalUrl: ${page.url()}`,
        `title: ${await page.title()}`,
        "--- anchor href shapes ---",
        await page.evaluate(() => {
          const shapes = {};
          for (const a of document.querySelectorAll("a")) {
            const h = a.getAttribute("href") || "";
            if (!h) continue;
            const shape = h.replace(/\d+/g, "#").split("?")[0];
            shapes[shape] = (shapes[shape] || 0) + 1;
          }
          return Object.entries(shapes).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([s, n]) => `${n}x ${s}`).join("\n");
        }),
        "--- body text (first 4000 chars) ---",
        (await page.evaluate(() => document.body?.innerText ?? "")).slice(0, 4000),
      ].join("\n");
      const dbgPath = path.join(REPORTS_DIR, `debug-empty-${Date.now()}.txt`);
      writeFileSync(dbgPath, dbg);
      console.log(yellow("No postings found — page state dumped to " + dbgPath));
      console.log(reportLine(report));
      return;
    }

    const reviewed = await reviewedUrls(); // owner verdicts from the review queue
    const exemplars = await judgeExemplars();
    for (const job of jobs) {
      console.log(`\n▶ ${job.title}${job.company ? ` — ${job.company}` : ""}`);        if (wasApplied(job.url)) {
          recordResultBoth(report, job, "skipped", "already applied (dedupe)");
        console.log(dim("  ⏭ skipped — already applied earlier"));
        continue;
      }
      const reviewedState = reviewed.get(job.url.split("?")[0]);
      if (reviewedState) {
        const why = reviewedState === "done" ? "you already applied (review queue: Done)"
          : reviewedState === "closed" ? "posting closed — no longer accepting applications (you marked it)"
          : "you dismissed this posting (not interested)";
        recordResultBoth(report, job, "skipped", why);
        console.log(dim(`  ⏭ skipped — ${why}`));
        continue;
      }
      /* an OWNER-CONFIRMED posting (positive exemplar, by id or strong title
         match) bypasses the cheap title gate: template-B titles mangle the
         company into the title string ("Banking — Senior Frontend…") and
         the owner already said this exact posting is relevant */
      const ownerHit = ownerExemplarFor(job, exemplars);
      if (!ownerHit && !titleRelevant(job.title, profile)) {
        recordResultBoth(report, job, "skipped", `not relevant to profile (${profile.headline || "no headline"})`);
        console.log(dim("  ⏭ skipped — not relevant to your profile"));
        continue;
      }
      /* skill gate: the JD must ask for what the resume actually has — no
         backend/ML/data postings just because the title says "engineer".
         Pure/sync checks first (dedupe, title, pre-gate) stay OUTSIDE the
         watchdog: they cannot wedge, and arming the timer before them would
         leak it on every early skip (the process would linger 4 min). */
      const pre = postingRelevant({ title: job.title, description: job.description ?? "" }, profile, { learnedCritical: await learnedCriticalSkills(), ownerConfirmed: Boolean(ownerHit) });
      if (!pre.ok && pre.reason !== "JD mentions no specific skills" && /not on the resume|barely overlap|not relevant/.test(pre.reason)) {
        recordResultBoth(report, job, "skipped", pre.reason);
        console.log(dim(`  ⏭ skipped — ${pre.reason}`));
        continue;
      }
      /* per-job watchdog: a wedged form must cost ONE job, not the site leg.
         Attended runs get a human budget — page.pause() review gates and
         Easy Apply modals wait for HANDS (a human needs >4 min); unattended
         stays tight: nobody is coming to click. */
      const JOB_BUDGET_MS = args.unattended ? 4 * 60_000 : 15 * 60_000;
      const jw = setTimeout(() => { console.log(yellow(`  ⏱ job timed out after ${JOB_BUDGET_MS / 60_000} min — skipping`)); try { page.close().catch(() => {}); } catch { /* already closed */ } }, JOB_BUDGET_MS);
      if (page.isClosed?.()) page = await ctx.newPage(); // watchdog closed it last job — fresh page
      try {
        await openJob(page, job);
        /* closed posting: LinkedIn banners "No longer accepting applications"
           — captured in the learning window's pageText. Skip BEFORE any AI
           spend, and remember locally so future runs never re-open it. */
        if (CLOSED_POSTING_RE.test(job.pageText || "")) {
          recordResultBoth(report, job, "skipped", "posting closed — no longer accepting applications");
          markApplied(job.url); // dedupe: never reopen a closed posting
          console.log(dim("  ⏭ skipped — posting closed (no longer accepting applications)"));
          continue;
        }
      /* skill gate on the REAL JD text now that the page is open (cheap,
         deterministic: title-critical skills, coverage ratio). An owner-
         confirmed posting (positive exemplar) bypasses the title leg —
         the owner's verdict outranks board title mangling. */
      const gate = postingRelevant({ title: job.title, description: job.description }, profile, { learnedCritical: await learnedCriticalSkills(), ownerConfirmed: Boolean(ownerHit) });
        if (!gate.ok) {
          recordResultBoth(report, job, "skipped", gate.reason);
          console.log(dim(`  ⏭ skipped — ${gate.reason}`));
          continue;
        }
        /* AI JUDGE: reads the actual JD and renders apply/skip with a reason
           — catches what regexes cannot ("Testing on the resume ≠ SDET job",
           backend-core-under-frontend-words JDs). Fail-open to unknown:
           judge trouble never blocks the deterministic path. Runs BEFORE
           kit generation — a skip here saves two AI calls + form filling. */
        if (ai) {
          job.__judge = await judgeFit(ai, job, profile, await judgeExemplars());
          if (job.__judge.verdict === "skip") {
            const why = `AI judge: ${job.__judge.reason || "not a realistic match"}`;
            recordResultBoth(report, job, "skipped", why);
            console.log(dim(`  ⏭ skipped — ${why}`));
            continue;
          }
          if (job.__judge.verdict === "apply") console.log(dim(`  🧠 judge: apply (${job.__judge.reason || "match"})`));
          else console.log(dim(`  🧠 judge: unsure (${job.__judge.reason || "no verdict"}) — proceeding on gates`));
        }
        const kit = await buildKit(ai, profile, { title: job.title, company: job.company, skills: (job.description.match(/\b(Node\.js|React|TypeScript|Python|AWS|Kubernetes|PostgreSQL|Docker|GraphQL|Kafka|System Design|Machine Learning)\b/gi) ?? []).slice(0, 8).map(s => s[0].toUpperCase() + s.slice(1)) });
        if (looksLikeRefusal(kit.resume) || looksLikeRefusal(kit.coverLetter)) {
          throw new Error("AI refused to tailor this kit (role mismatch?) — not submitting");
        }
        if (gate.matched?.length) { job.__fit = fitScore(gate.matched, gate.missing); console.log(dim(`  skills: ${gate.matched.slice(0, 6).join(", ")}${gate.missing?.length ? ` (missing: ${gate.missing.slice(0, 3).join(", ")})` : ""} · fit ${job.__fit}`)); }
        job.__coverLetter = kit.coverLetter;
        console.log(dim(`  kit: resume+cover ${kit.ai ? "(AI-tailored)" : "(template)"} ${kit.notes.join("; ")}`));

        /* save the resume to a temp file for file-upload inputs */
        const resumePath = path.join(REPORTS_DIR, `resume-${Date.now()}.txt`);
        writeFileSync(resumePath, kit.resume);

        /* find and open the apply flow on the job page. SPA boards hydrate
           the button late — retry bounded (3×2s) instead of one-shot detection. */
        const applyBtn = textButtonLocator(page, rules.applyButtonText);
        let applyCount = 0;
        for (let attempt = 0; attempt < 3; attempt++) {
          applyCount = await applyBtn.count();
          if (applyCount > 0) break;
          await page.waitForTimeout(2000);
        }
        if (applyCount === 0) {
          /* guest preview CTAs expire after ~1 min — the AI judge/kit calls
             burn exactly that budget, then the button is gone even though
             the URL/title are unchanged. A fresh load always re-renders it. */
          await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
          await page.waitForTimeout(2500);
          applyCount = await applyBtn.count();
        }
        if (applyCount === 0 && site === "linkedin") {
          /* LinkedIn serves the CTA-less public shell for /jobs/view/<id>/
             deep links EVEN when signed in — the real UI (Easy Apply +
             .jobs-box__html-content) lives at /jobs/search/?currentJobId=<id>.
             Re-anchor there before giving up; guests just fall through to
             the needsReview queue below. */
          const jid = (job.url || "").match(/jobs\/view\/(\d+)/i)?.[1];
          if (jid) {
            await page.goto(`https://www.linkedin.com/jobs/search/?currentJobId=${jid}`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
            await page.waitForTimeout(3500);
            applyCount = await applyBtn.count();
            if (applyCount > 0) console.log(dim("  re-anchored to the signed-in jobs UI (currentJobId)"));
          }
        }
        if (applyCount > 0) {
          /* mode selector: "Easy Apply" (in-product) vs "Apply on company
             website" (external ATS, usually a NEW tab). External ATS forms
             are filled and QUEUED — never auto-submitted (fail-closed). */
          const btnText = ((await applyBtn.innerText({ timeout: 2000 }).catch(() => "")) || "") + " " + ((await applyBtn.getAttribute("aria-label").catch(() => null)) ?? "");
          const external = isExternalApplyButton(btnText);
          const how = await clickButton(page, applyBtn, rules.applyButtonText);
          console.log(dim(`  apply clicked (${how}${external ? " · external ATS" : ""})`));
          await page.waitForTimeout(3000);
          /* guest (not signed-in) LinkedIn: Apply opens the contextual
             sign-in modal — there is NO guest application flow. Queue for
             the owner instead of "filling" the modal's email field. */
          const guestModal = await page.$(".contextual-sign-in-modal").catch(() => null);
          if (guestModal) {
            recordResultBoth(report, job, "needsReview", "LinkedIn sign-in required to apply — finish manually (browser left on the posting)");
            console.log(yellow("  ⏸ LinkedIn guest apply needs sign-in — queued for manual finish"));
            await queueReview({ siteHost: site, jobUrl: job.url, title: job.title, company: job.company, formUrl: page.url(), reason: "LinkedIn sign-in required to apply", fit: job.__fit ?? null });
            await page.waitForTimeout(rules.minIntervalMs);
            continue;
          }
          if (external) {
            let atsPage = null;
            for (const p of ctx.pages()) {
              if (p !== page && !/linkedin\.com/i.test(p.url())) { atsPage = p; break; }
            }
            const sameTab = !atsPage && !/linkedin\.com/i.test(page.url()); // redirected in-place
            const target = atsPage ?? (sameTab ? page : null);
            if (!target) {
              recordResultBoth(report, job, "skipped", "external apply clicked but no ATS page opened");
              console.log(dim("  ⏭ skipped — external ATS did not open"));
            } else if (args["dry-run"]) {
              recordResultBoth(report, job, "skipped", "external ATS form detected — dry-run (not filled)");
              console.log(dim("  dry-run: external ATS form present, not filled"));
            } else {
              try { await target.waitForLoadState("domcontentloaded", { timeout: 20_000 }); } catch { /* ATS load rules vary */ }
              if (atsPage) { await target.bringToFront().catch(() => {}); await target.waitForTimeout(2500); }
              const resumePath2 = path.join(REPORTS_DIR, `resume-${Date.now()}.txt`);
              writeFileSync(resumePath2, kit.resume);
              const mem2 = await loadAnswerMemory(site);
              const res2 = await fillApplicationForm(target, { profile, job, resumePath: resumePath2, dryRun: false, siteHost: site, storedAnswers: mem2 });
              const preview = formFieldsPreview(res2.fields, res2.plan);
              recordResultBoth(report, job, "needsReview", `external ATS form filled (${res2.filled} fields) — submit manually from the review queue`);
              console.log(yellow(`  ⏸ external ATS: filled ${res2.filled} fields — queued; you submit (never auto on unknown ATS)`));
              await queueReview({ siteHost: site, jobUrl: job.url, title: job.title, company: job.company, formUrl: target.url(), reason: "external ATS — form filled, submit manually", fit: job.__fit ?? null, formFields: preview });
              if (atsPage) await atsPage.close().catch(() => {}); // don't leak tabs
            }
            await page.waitForTimeout(rules.minIntervalMs);
            continue;
          }
        } else if (site === "instahyre" || site === "naukri") {
          /* some boards apply in-place — no separate form page */
        } else if (site === "linkedin" && /linkedin\.com\/jobs\/view\/\d+/i.test(job.url || "")) {
          /* LinkedIn also serves a sign-in-gated guest variant of /jobs/view
             with NO apply CTA at all (nav buttons only). An owner-curated
             direct URL means "this one matters" — queue it with the kit
             rather than dead-ending; the owner applies signed-in. */
          recordResultBoth(report, job, "needsReview", "guest view has no apply button — open signed-in and submit (kit in reports)");
          await queueReview({ siteHost: site, jobUrl: job.url, title: job.title, company: job.company, formUrl: page.url(), reason: "no apply button on guest view — apply manually", fit: job.__fit ?? null });
          console.log(yellow("  ⏸ no apply button on the guest view — queued for manual apply"));
          continue;
        } else {
          recordResultBoth(report, job, "skipped", "no apply button found");
          console.log(dim("  ⏭ skipped — no apply button on the posting"));
          continue;
        }

        const mem = await loadAnswerMemory(site); // form-answer memory: stored labels reuse their last answer
        const { filled, unfilledRequired, fields: ffFields, plan: ffPlan } = await fillApplicationForm(page, { profile, job, resumePath, dryRun: args["dry-run"], siteHost: site, storedAnswers: mem });
        const ffPreview = formFieldsPreview(ffFields, ffPlan); // the queue must show WHAT was filled
        if (unfilledRequired.length) {
          recordResultBoth(report, job, "needsReview", `cannot answer: ${unfilledRequired.slice(0, 3).join("; ")} — form left open`);
          console.log(yellow(`  ⏸ needs review (${filled} filled): ${unfilledRequired.slice(0, 3).join("; ")}`));
          /* ALWAYS queue (deduped per job URL) — the report's "needs you" row
             must have a review-queue counterpart with one-click Open/Done */
          await queueReview({ siteHost: site, jobUrl: job.url, title: job.title, company: job.company, formUrl: page.url(), reason: `cannot answer: ${unfilledRequired.slice(0, 3).join("; ")}`, fit: job.__fit ?? null, formFields: ffPreview });
          if (!rules.autoSubmit && args.unattended) { console.log(dim("  ⏭ unattended: queued for one-click review")); continue; }
          if (!rules.autoSubmit) await page.pause(); // review-gate sites: let the human finish here
          continue;
        }
        if (args["dry-run"]) { recordResultBoth(report, job, "skipped", "dry-run — filled only"); console.log(dim("  dry-run: form filled, not submitted")); continue; }

        const sub = await trySubmit(page, site, rules); // merged registry rules — the owner's autoSubmit decision
        if (sub.auto) {
          recordResultBoth(report, job, "submitted", sub.note);
          markApplied(job.url);
          /* the queue must reflect reality: a pending row for a now-submitted
             posting resolves itself (done) — no stale asks piling up */
          const db2 = await sitesDb();
          await db2?.resolveReviewByUrl?.(job.url, "done").catch(() => {});
          console.log(green(`  ✓ ${sub.note}`));
        } else {
          recordResultBoth(report, job, "needsReview", sub.note);
          console.log(yellow(`  ⏸ ${sub.note} — browser is open on the form; finish and submit manually.`));
          /* ALWAYS queue: the Applications report's "needs you" rows must have
             a review-queue counterpart with one-click Open/Done (the RPC
             dedupes per job URL — repeated runs never pile up). Attended
             runs ALSO pause here so the human can finish immediately. */
          await queueReview({ siteHost: site, jobUrl: job.url, title: job.title, company: job.company, formUrl: page.url(), reason: sub.note, fit: job.__fit ?? null, formFields: ffPreview });
          if (args.unattended) { console.log(dim("  ⏭ unattended: queued for one-click review")); continue; }
          await page.pause();
        }
        await page.waitForTimeout(rules.minIntervalMs);
      } catch (e) {
        recordResultBoth(report, job, "error", e.message.slice(0, 160));
        console.error(red(`  ✗ ${e.message.slice(0, 160)}`));
      } finally {
        clearTimeout(jw);
      }
    }
  } finally {
    /* write reports even on abort */
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(path.join(REPORTS_DIR, `run-${stamp}.json`), JSON.stringify(report, null, 2));
    writeFileSync(path.join(REPORTS_DIR, `run-${stamp}.md`), buildReportMarkdown(report));
    console.log(`\n${reportLine(report)}`);
    console.log(dim(`reports → freebuff-apply-reports/run-${stamp}.json|.md`));
    await syncRunToDb(args.url ? new URL(args.url).hostname.replace(/^www\./, "") : site, report).catch(() => {});
    await learnRules(args.url ? new URL(args.url).hostname.replace(/^www\./, "") : site, report).catch(() => {});
    if (!args["dry-run"]) {
      const n = report.results.filter((r) => r.result === "submitted").length;
      const q = report.results.filter((r) => r.result === "needsReview").length;
      const er = report.results.filter((r) => r.result === "error").length;
      await sendTelegramNotify(`Freebuff apply · ${site}: ✅ ${n} submitted · ⏸ ${q} review · ✗ ${er} errors`).catch(() => {});
    }
    /* remote sessions: DISCONNECT ONLY — browser.close() over CDP keeps the
       hosted session (and its logins) alive for the next run */
    if (__browserCleanup) await __browserCleanup().catch(() => {});
    else await ctx.close().catch(() => {});
  }
}

/* ------------------- --all: iterate ACTIVE registered sites ------------------- */

async function runAll(args) {
  const db = await sitesDb();
  let sites = [];
  if (db) {
    try {
      sites = (await db.listJobSites())
        .filter((s) => s.status === "active" && s.jobs_url)
        .map((s) => ({ host: s.host, url: s.jobs_url, label: s.label }));
    } catch (e) { console.log(dim(`(registry read failed: ${e.message.slice(0, 80)})`)); }
  }
  if (!sites.length) {
    /* registry unavailable — fall back to the three builtin boards */
    sites = [
      { host: "instahyre.com", url: "https://www.instahyre.com/search-jobs/?search=react", label: "Instahyre" },
      { host: "naukri.com", url: "https://www.naukri.com/mnjuser/recommendedjobs", label: "Naukri" },
    ];
  }
  console.log(`apply-engine --all → ${sites.length} active site(s): ${sites.map((s) => s.host).join(", ")}`);
  /* owner kill switch: the SCHEDULED path fails closed — off/cloud/unknown
     all stop the cycle (unknown = config unreadable → stop too) */
  const blocked = await applyModeBlocked(true);
  if (blocked) { console.log(yellow(`⏸ apply engine disabled: ${blocked} — skipping this cycle.`)); return; }
  const totals = { submitted: 0, skipped: 0, errors: 0 };
  for (const s of sites) {
    console.log(`\n━━━ ${s.label} (${s.host}) ━━━`);
    try {
      /* re-invoke this script per site so every run gets its own report + sync.
         Hard watchdog: a site that wedges (hung page/network) must never stall
         a scheduled cycle — kill it after 12 min and move on to the next site. */
      const { spawn } = await import("node:child_process");
      const SITE_TIMEOUT_MS = 12 * 60_000;
      const child = spawn(process.execPath, [
        path.join(ROOT, "auto-apply-jobs.js"), "--url", s.url, "--max", String(args.max),
        ...(args["dry-run"] ? ["--dry-run"] : []),
        ...(args.unattended ? ["--unattended"] : []),
      ], { stdio: "inherit", cwd: path.join(ROOT, "..") });
      const code = await new Promise((resolve) => {
        const t = setTimeout(() => { console.log(yellow(`  ⏱ site timed out after 12 min — killed, moving on`)); child.kill(); resolve(-1); }, SITE_TIMEOUT_MS);
        child.on("exit", (c) => { clearTimeout(t); resolve(c ?? -1); });
        child.on("error", () => { clearTimeout(t); resolve(-1); });
      });
      if (code !== 0) totals.errors++;
    } catch (e) {
      console.error(red(`site ${s.host} failed: ${e.message.slice(0, 120)}`));
      totals.errors++;
    }
  }
  console.log(`\n--all complete (${sites.length} sites).`);
}

/* ----------------------- --watch: keep applying ----------------------- */

/* Watch-mode log tee: when started by the supervisor (no shell redirect —
   shell appends on Windows open the log WITHOUT write-sharing and a stale
   handle from any previous watcher blocks every new start with "file in
   use"), the watcher appends to the log itself via a node stream, which
   opens with share-read/write and coexists with any other appender. */
function teeWatchLog() {
  const p = process.env.FREEBUFF_WATCH_LOG;
  if (!p) return;
  try {
    const stream = createWriteStream(p, { flags: "a" });
    const line = (s) => stream.write(s.replace(/\x1b\[[0-9;]*m/g, "") + "\n"); // strip ANSI for the file
    const log = console.log.bind(console), err = console.error.bind(console);
    console.log = (...a) => { log(...a); line(a.map(String).join(" ")); };
    console.error = (...a) => { err(...a); line(a.map(String).join(" ")); };
  } catch { /* logging must never kill the watcher */ }
}

async function runWatch(args) {
  const everyH = args.everyHours || 6;
  /* boot-time network guard: after a REBOOT the logon task can start this
     watcher before Windows networking is up — every site then fails with
     ERR_NAME_NOT_RESOLVED and the cycle burns 6h sleeping on a dead run.
     Wait for real connectivity (bounded) before the first cycle. */
  for (let i = 0; i < 20; i++) {
    try { await fetch("https://www.linkedin.com/robots.txt", { signal: AbortSignal.timeout(8000) }); break; }
    catch {
      console.log(`network not up yet (attempt ${i + 1}/20) — retrying in 15s`);
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }
  const cycle = async () => {
    console.log(`\n════ watch cycle ${new Date().toLocaleTimeString()} — discovery (max 4) then apply (--max ${args.max}) ════`);
    /* kill switch checked per cycle: flipping Off in the UI stops the
       watcher's next cycle within one poll (no process restart needed) */
    const cycleBlocked = await applyModeBlocked(true);
    if (cycleBlocked) { console.log(yellow(`⏸ ${cycleBlocked} — cycle skipped (switch back on in the UI)`)); return; }
    /* discovery first so newly-approved sites join the rotation quickly */
    try {
      const { spawnSync } = await import("node:child_process");
      spawnSync(process.execPath, [path.join(ROOT, "discover-job-sites.js"), "--limit", "4"], { stdio: "inherit", cwd: path.join(ROOT, "..") });
    } catch { /* discovery failing must never stop applying */ }
    await runAll(args);
  };
  for (;;) {
    await cycle();
    console.log(dim(`\nsleeping ${everyH}h until the next cycle (Ctrl+C to stop)…`));
    await new Promise((r) => setTimeout(r, everyH * 3600_000));
  }
}

async function main() {
  const args = parseArgs(process.argv);
  /* cloud/local is decided once per process (the switch rarely changes
     mid-run; per-cycle guards still re-read it) */
  args_isCloudMode = (await readApplyMode()).mode === "cloud";
  args_unattended = args.unattended;
  if (args.discover) {
    const { spawnSync } = await import("node:child_process");
    const res = spawnSync(process.execPath, [path.join(ROOT, "discover-job-sites.js"), ...process.argv.slice(3)], { stdio: "inherit", cwd: path.join(ROOT, "..") });
    process.exit(res.status ?? 1);
  }
  if (args.watch) { teeWatchLog(); await runWatch(args); return; }
  if (args.all) { await runAll(args); return; }
  if (args.status) { const msg = await summarizeDayFromReports(); console.log(msg); await sendTelegramNotify(msg); return; }
  if (args.digest) {
    /* weekly per-board digest: what the engine did + what the owner did with it */
    const db = await sitesDb();
    const rows = (await db?.applyWeeklyDigest?.().catch(() => null)) ?? null;
    if (!rows?.length) { console.log("No apply activity in the last 7 days."); return; }
    const lines = rows.map((r) => `${r.site_host}: ✓${r.submitted} ⏸${r.needs_review} ⏭${r.skipped} ✗${r.errors} | you: ✓${r.owner_applied} ✕${r.owner_dismissed} 🚫${r.owner_closed}`);
    const msg = `📊 Freebuff weekly digest (7d)\n${lines.join("\n")}`;
    console.log(msg);
    await sendTelegramNotify(msg);
    return;
  }
  if (!args.url) {
    console.error(`Usage:
  node scripts/auto-apply-jobs.js --url "<jobs list URL>" [--max N] [--dry-run] [--login-only]
  node scripts/auto-apply-jobs.js --all [--max N] [--dry-run]        # run every ACTIVE registered site
  node scripts/auto-apply-jobs.js --watch [--every 6] [--max N]      # discover + apply forever
  node scripts/auto-apply-jobs.js --discover [--limit 8] [--query "…"] # find new candidate sites (→ pending)`);
    process.exit(1);
  }
  await runSingle(args);
}

main().catch(e => { console.error(red(e.stack ?? e.message)); process.exit(1); });
