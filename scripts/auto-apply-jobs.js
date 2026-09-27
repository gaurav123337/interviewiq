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

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  siteFromUrl, classifyQuestion, draftAnswer, valueMatchesList,
  newReport, recordResult, reportLine, buildReportMarkdown, buildApplyReportSql, SITE_RULES,
  isChallengePage, detectAccountProblem, looksLoggedIn, titleRelevant, looksLikeRefusal,
} from "./apply-engine-lib.js";
import { buildKit, loadAi } from "./apply-kit-node.js";

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

/* --- review queue: unattended skips get recorded for one-click finish --- */
async function queueReview(entry) {
  const db = await sitesDb();
  if (!db?.queueJobReview) return;
  await db.queueJobReview(entry).catch((e) => console.log(dim(`  (queue: ${e.message.slice(0, 60)})`)));
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

async function launchBrowser(headless) {
  /* playwright specifier computed at runtime so vite/vitest never statically
     resolve it (same trick as discovery-render-fetcher.mjs) */
  const spec = ["play", "wright"].join("");
  const { chromium } = await import(/* @vite-ignore */ spec);
  mkdirSync(PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    viewport: { width: 1380, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  return ctx;
}

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
    console.log(yellow(`⏸  ${rules.label}: please sign in in the opened window (Google OAuth / email / OTP — anything the site offers).`));
    console.log(dim("   The session persists in freebuff-apply-profile/ — this is one-time per site."));
    if (!loginOnly) {
      console.log(dim("   (Re-run with --login-only to just log in first, if you prefer.)"));
    }
    /* wait up to 10 minutes for the human to complete login */
    const t0 = Date.now();
    while (Date.now() - t0 < 10 * 60_000) {
      await page.waitForTimeout(2000);
      let st;
      try { st = await waitForStableState(page, rules, url, { settleMs: 0 }); } catch { continue; }
      if (st.kind === "loggedIn") {
        const problem = detectAccountProblem(st.bodyText);
        if (problem) { console.error(red(`✗ ${rules.label}: ${problem} — login cannot succeed until the account is restored.`)); return false; }
        console.log(green(`✓ ${rules.label}: logged in.`));
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
  const state = await waitForStableState(page, rules, url); // SPA render + challenge clear + redirect settle
  if (state.kind === "challenge") throw new Error(`${rules.label}: bot-check did not clear — re-run headed (no --headless).`);
  if (state.kind === "login") throw new Error(`${rules.label}: session expired — re-run with --login-only to sign in again.`);
  const problem = detectAccountProblem(state.bodyText);
  if (problem) throw new Error(`${rules.label}: ${problem}`);
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
      out.push({ url: `https://www.linkedin.com/jobs/view/${m[1]}`, title, company: (lines.find(l => l !== title && l.length > 1 && l.length < 60) || "").slice(0, 80) });
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

async function openJob(page, job) {
  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);
  job.pageText = (await page.evaluate(() => document.body?.innerText ?? "")).slice(0, 6000);
  const m = job.pageText.match(/(?:about|description|the role|responsibilities)[\s\S]{200,3000}/i);
  job.description = m ? m[0].slice(0, 2000) : job.pageText.slice(0, 1200);
  const t = (job.pageText.match(/(?:at|·|—|\|)\s*([A-Z][\w&.\- ]{1,40}(?:Labs|Technologies|Solutions|Systems|Inc|Pvt)?)/) || [])[1];
  if (!job.company && t) job.company = t.trim();
}

/* --------------------------- form filling --------------------------- */

async function fillApplicationForm(page, { profile, job, resumePath, dryRun }) {
  const fields = await page.evaluate(() => {
    const controls = [...document.querySelectorAll("input:not([type=hidden]):not([disabled]), textarea, select")];
    return controls.map(el => {
      const labelEl = el.closest("label") || (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
      const label = (labelEl?.innerText ?? el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? el.getAttribute("name") ?? "").trim();
      return { tag: el.tagName.toLowerCase(), type: el.getAttribute("type") ?? "", label, required: el.required || !!el.closest("[aria-required=true]"), options: el.tagName === "SELECT" ? [...el.options].map(o => o.textContent.trim()) : undefined };
    });
  });
  const controls = await page.$$("input:not([type=hidden]):not([disabled]), textarea, select");
  const unfilledRequired = [];
  let filled = 0;

  for (let i = 0; i < controls.length; i++) {
    const c = controls[i];
    const meta = fields[i] ?? { label: "", tag: "input", required: false };
    const cls = classifyQuestion(meta.label, { tag: meta.tag, required: meta.required });
    const answer = draftAnswer(cls.kind, profile, job);
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
  return { filled, unfilledRequired };
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

async function trySubmit(page, site) {
  const rules = SITE_RULES[site] ?? SITE_RULES.generic;
  /* the FINAL button is usually NOT the opener — Instahyre: "Apply now" opens
     a modal, then a plain "Submit" button inside it sends the application */
  const btn = textButtonLocator(page, rules.submitButtonText ?? rules.applyButtonText);
  if ((await btn.count()) === 0) {
    if (rules.autoSubmit) return { auto: true, note: "submit button not found (may already be applied)" };
    return { auto: false, note: "review gate — human submits" };
  }
  if (rules.autoSubmit) {
    await clickButton(page, btn, rules.submitButtonText ?? rules.applyButtonText);
    await page.waitForTimeout(4000);
    const success = rules.successText.test(await page.evaluate(() => document.body?.innerText ?? ""));
    return { auto: true, note: success ? "submitted" : "clicked submit; success text not detected" };
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
  const rules = SITE_RULES[site];
  const profile = loadApplyProfile(args.profile);
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const ai = await loadAi({ token, projectRef });
  console.log(`apply-engine → ${rules.label} · ${args.url} · max ${args.max}${ai ? ` · AI: ${ai.model}` : " · AI: OFF (templates)"}`);

  const ctx = await launchBrowser(args.headless);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const report = newReport(args.url, site);
  mkdirSync(REPORTS_DIR, { recursive: true });

  try {
    if (!await ensureLoggedIn(page, args.url, site, args["login-only"])) {
      console.error(red("Login required — aborting (nothing was submitted)."));
      return;
    }
    if (args["login-only"]) { console.log(green("Login saved. Re-run without --login-only to apply.")); return; }

    const jobs = await collectJobs(page, args.url, site, args.max);
    console.log(dim(`collected ${jobs.length} posting(s)`));
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

    for (const job of jobs) {
      console.log(`\n▶ ${job.title}${job.company ? ` — ${job.company}` : ""}`);
      if (wasApplied(job.url)) {
        recordResult(report, job, "skipped", "already applied (dedupe)");
        console.log(dim("  ⏭ skipped — already applied earlier"));
        continue;
      }
      if (!titleRelevant(job.title, profile)) {
        recordResult(report, job, "skipped", `not relevant to profile (${profile.headline || "no headline"})`);
        console.log(dim("  ⏭ skipped — not relevant to your profile"));
        continue;
      }
      try {
        await openJob(page, job);
        const kit = await buildKit(ai, profile, { title: job.title, company: job.company, skills: (job.description.match(/\b(Node\.js|React|TypeScript|Python|AWS|Kubernetes|PostgreSQL|Docker|GraphQL|Kafka|System Design|Machine Learning)\b/gi) ?? []).slice(0, 8).map(s => s[0].toUpperCase() + s.slice(1)) });
        if (looksLikeRefusal(kit.resume) || looksLikeRefusal(kit.coverLetter)) {
          throw new Error("AI refused to tailor this kit (role mismatch?) — not submitting");
        }
        job.__coverLetter = kit.coverLetter;
        console.log(dim(`  kit: resume+cover ${kit.ai ? "(AI-tailored)" : "(template)"} ${kit.notes.join("; ")}`));

        /* save the resume to a temp file for file-upload inputs */
        const resumePath = path.join(REPORTS_DIR, `resume-${Date.now()}.txt`);
        writeFileSync(resumePath, kit.resume);

        /* find and open the apply flow on the job page */
        const applyBtn = textButtonLocator(page, rules.applyButtonText);
        if ((await applyBtn.count()) > 0) {
          const how = await clickButton(page, applyBtn, rules.applyButtonText);
          console.log(dim(`  apply clicked (${how})`));
          await page.waitForTimeout(3000);
        } else if (site === "instahyre" || site === "naukri") {
          /* some boards apply in-place — no separate form page */
        } else {
          recordResult(report, job, "skipped", "no apply button found");
          continue;
        }

        const { filled, unfilledRequired } = await fillApplicationForm(page, { profile, job, resumePath, dryRun: args["dry-run"] });
        if (unfilledRequired.length) {
          recordResult(report, job, "needsReview", `cannot answer: ${unfilledRequired.slice(0, 3).join("; ")} — form left open`);
          console.log(yellow(`  ⏸ needs review (${filled} filled): ${unfilledRequired.slice(0, 3).join("; ")}`));
          if (!rules.autoSubmit && args.unattended) { await queueReview({ siteHost: site, jobUrl: job.url, title: job.title, company: job.company, formUrl: page.url(), reason: `cannot answer: ${unfilledRequired.slice(0, 3).join("; ")}` }); console.log(dim("  ⏭ unattended: queued for one-click review")); continue; }
          if (!rules.autoSubmit) await page.pause(); // review-gate sites: let the human finish here
          continue;
        }
        if (args["dry-run"]) { recordResult(report, job, "skipped", "dry-run — filled only"); console.log(dim("  dry-run: form filled, not submitted")); continue; }

        const sub = await trySubmit(page, site);
        if (sub.auto) {
          recordResult(report, job, "submitted", sub.note);
          markApplied(job.url);
          console.log(green(`  ✓ ${sub.note}`));
        } else {
          recordResult(report, job, "needsReview", sub.note);
          console.log(yellow(`  ⏸ ${sub.note} — browser is open on the form; finish and submit manually.`));
          if (args.unattended) { await queueReview({ siteHost: site, jobUrl: job.url, title: job.title, company: job.company, formUrl: page.url(), reason: sub.note }); console.log(dim("  ⏭ unattended: queued for one-click review")); continue; }
          await page.pause();
        }
        await page.waitForTimeout(rules.minIntervalMs);
      } catch (e) {
        recordResult(report, job, "error", e.message.slice(0, 160));
        console.error(red(`  ✗ ${e.message.slice(0, 160)}`));
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
    await ctx.close().catch(() => {});
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

async function runWatch(args) {
  const everyH = args.everyHours || 6;
  const cycle = async () => {
    console.log(`\n════ watch cycle ${new Date().toLocaleTimeString()} — discovery (max 4) then apply (--max ${args.max}) ════`);
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
  if (args.discover) {
    const { spawnSync } = await import("node:child_process");
    const res = spawnSync(process.execPath, [path.join(ROOT, "discover-job-sites.js"), ...process.argv.slice(3)], { stdio: "inherit", cwd: path.join(ROOT, "..") });
    process.exit(res.status ?? 1);
  }
  if (args.watch) { await runWatch(args); return; }
  if (args.all) { await runAll(args); return; }
  if (args.status) { const msg = await summarizeDayFromReports(); console.log(msg); await sendTelegramNotify(msg); return; }
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
