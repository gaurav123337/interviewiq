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
 *       (form filled, browser paused for a human click).
 *   - any required question it cannot answer confidently blocks submission
 *     (fail-closed) and marks the job needs-review in the report.
 *
 * Usage:
 *   node scripts/auto-apply-jobs.mjs --url "https://www.instahyre.com/candidate/opportunities/?matching=true" \
 *     [--max 8] [--profile apply-profile.json] [--dry-run] [--headless] [--login-only]
 *
 * Files: freebuff-apply-profile/ (browser session, gitignored) and
 * freebuff-apply-reports/ (JSON + md run reports, gitignored).
 * No credentials are stored or typed by this script — logins are manual once.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  siteFromUrl, classifyQuestion, draftAnswer, valueMatchesList,
  newReport, recordResult, reportLine, buildReportMarkdown, buildApplyReportSql, SITE_RULES
} from "./apply-engine-lib.js";
import { buildKit, loadAi } from "./apply-kit-node.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(ROOT, "..", "freebuff-apply-profile");
const REPORTS_DIR = path.join(ROOT, "..", "freebuff-apply-reports");

/* ----------------------------- CLI args ----------------------------- */

function parseArgs(argv) {
  const args = { max: 8, profile: "apply-profile.json", "dry-run": false, headless: false, "login-only": false, url: "", confirm: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i] ?? "";
    else if (a === "--max") args.max = Math.max(1, parseInt(argv[++i], 10) || 8);
    else if (a === "--profile") args.profile = argv[++i];
    else if (a === "--dry-run") args["dry-run"] = true;
    else if (a === "--headless") args.headless = true;
    else if (a === "--login-only") args["login-only"] = true;
    else if (a === "--yes") args.confirm = true;
  }
  return args;
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
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

async function ensureLoggedIn(page, url, site, loginOnly) {
  const rules = SITE_RULES[site] ?? SITE_RULES.generic;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const host = new URL(url).hostname;
  const onLogin = () => rules.loginPathHints.some(h => page.url().toLowerCase().includes(h.toLowerCase()));
  if (rules.loggedInHint && page.url().includes(rules.loggedInHint) && !onLogin()) {
    console.log(green(`✓ ${rules.label}: session active`));
    return true;
  }
  if (onLogin() || loginOnly) {
    console.log(yellow(`⏸  ${rules.label}: please sign in in the opened window (Google OAuth / email / OTP — anything the site offers).`));
    console.log(dim("   The session persists in freebuff-apply-profile/ — this is one-time per site."));
    if (!loginOnly) {
      console.log(dim("   (Re-run with --login-only to just log in first, if you prefer.)"));
    }
    /* wait up to 5 minutes for the human to complete login */
    const t0 = Date.now();
    while (Date.now() - t0 < 5 * 60_000) {
      await page.waitForTimeout(2000);
      if (!onLogin() && (!rules.loggedInHint || page.url().includes(rules.loggedInHint))) {
        console.log(green(`✓ ${rules.label}: logged in.`));
        return true;
      }
    }
    console.error(red(`✗ ${rules.label}: login not completed within 5 minutes.`));
    return false;
  }
  return true;
}

/* ------------------------- job list collection ------------------------- */

async function collectJobs(page, url, site, max) {
  const rules = SITE_RULES[site] ?? SITE_RULES.generic;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3000); // SPA render
  /* auto-scroll to load lazy lists (LinkedIn/Instahyre paginate inside SPA) */
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 2400);
    await page.waitForTimeout(900);
  }
  const jobs = await page.evaluate((hints) => {
    const seen = new Set();
    const out = [];
    for (const sel of hints) {
      for (const a of document.querySelectorAll(sel)) {
        const href = a.href || a.getAttribute("href") || "";
        if (!href) continue;
        const abs = new URL(href, location.origin).toString();
        if (seen.has(abs)) continue;
        const text = (a.innerText || a.textContent || "").trim();
        if (!text || text.length < 8) continue;
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

async function trySubmit(page, site) {
  const rules = SITE_RULES[site] ?? SITE_RULES.generic;
  const btn = page.locator(`button:has-text("${rules.applyButtonText.source}"), input[type=submit]`).last();
  if (rules.autoSubmit && !btn) return { auto: true, note: "submit button not found (may already be applied)" };
  if (rules.autoSubmit) {
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(4000);
    const success = rules.successText.test(await page.evaluate(() => document.body?.innerText ?? ""));
    return { auto: true, note: success ? "submitted" : "clicked submit; success text not detected" };
  }
  return { auto: false, note: "review gate — human submits" };
}

/* ------------------------------- main ------------------------------- */

async function main() {
  const args = parseArgs(process.argv);
  if (!args.url) {
    console.error(`Usage: node scripts/auto-apply-jobs.mjs --url "<jobs list URL>" [--max N] [--dry-run] [--login-only] [--headless] [--profile file]`);
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
    if (!jobs.length) { console.log(reportLine(report)); return; }

    for (const job of jobs) {
      console.log(`\n▶ ${job.title}${job.company ? ` — ${job.company}` : ""}`);
      try {
        await openJob(page, job);
        const kit = await buildKit(ai, profile, { title: job.title, company: job.company, skills: (job.description.match(/\b(Node\.js|React|TypeScript|Python|AWS|Kubernetes|PostgreSQL|Docker|GraphQL|Kafka|System Design|Machine Learning)\b/gi) ?? []).slice(0, 8).map(s => s[0].toUpperCase() + s.slice(1)) });
        job.__coverLetter = kit.coverLetter;
        console.log(dim(`  kit: resume+cover ${kit.ai ? "(AI-tailored)" : "(template)"} ${kit.notes.join("; ")}`));

        /* save the resume to a temp file for file-upload inputs */
        const resumePath = path.join(REPORTS_DIR, `resume-${Date.now()}.txt`);
        writeFileSync(resumePath, kit.resume);

        /* find and open the apply flow on the job page */
        const applyBtn = page.locator(`button:has-text("${rules.applyButtonText.source}"), a:has-text("${rules.applyButtonText.source}")`).last();
        if (await applyBtn.count()) {
          await applyBtn.click({ timeout: 5000 });
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
          if (!rules.autoSubmit) await page.pause(); // review-gate sites: let the human finish here
          continue;
        }
        if (args["dry-run"]) { recordResult(report, job, "skipped", "dry-run — filled only"); console.log(dim("  dry-run: form filled, not submitted")); continue; }

        const sub = await trySubmit(page, site);
        if (sub.auto) {
          recordResult(report, job, "submitted", sub.note);
          console.log(green(`  ✓ ${sub.note}`));
        } else {
          recordResult(report, job, "needsReview", sub.note);
          console.log(yellow(`  ⏸ ${sub.note} — browser is open on the form; finish and submit manually.`));
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
    await ctx.close().catch(() => {});
  }
}

main().catch(e => { console.error(red(e.stack ?? e.message)); process.exit(1); });
