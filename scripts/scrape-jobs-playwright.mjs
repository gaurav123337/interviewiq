#!/usr/bin/env node
/* Playwright jobs scraper (Phase 4 Item C) — drives a headless Chromium over
 * curated JS-heavy PUBLIC job boards (targets are data in
 * content/job-playwright-targets.json), extracts postings, and upserts them
 * into public.jobs with source "playwright" (host kept in external_id + meta).
 * Writes a jobs_fetch_reports row so the Cron job log (Item B card) covers
 * this pipeline. Optional AI-normalize when an AI key is configured.
 *
 * Why Playwright: these boards render listings client-side or paginate inside
 * a SPA, so plain fetch + regex extraction (the ATS-API pipeline in
 * supabase/functions/jobs-fetch) can't see them.
 *
 * Usage (workflow or local):
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> \
 *   node scripts/scrape-jobs-playwright.mjs
 *   # optional: AI_CLEAN_KEY=... (or the Supabase-saved provider) for normalize
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  loadTargets, extractJob, jobIdentity, dedupeJobs,
  buildJobsUpsertSql, buildReport, buildReportSql
} from "./jobs-playwright-lib.js";
import { loadAiProviderConfig } from "./ai-config.js";

const API = "https://api.supabase.com/v1";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function runSql(sql) {
  const res = await fetch(`${API}/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SQL ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

/* ----------------------------- AI normalize ----------------------------- */

/** Optional: asks the configured provider to fill gaps (location from body,
    short description, naive skill tags). Skips silently without a key. */
async function aiNormalize(jobs, ai) {
  if (!ai?.key || !jobs.length) return jobs;
  const base = ai.base;
  const out = [];
  let done = 0;
  for (const j of jobs.slice(0, 30)) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30_000);
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({
          model: ai.model,
          messages: [
            { role: "system", content: "You normalize job postings. Reply with ONLY minified JSON: {\"location\":string|null,\"description\":string,\"skills\":string[]}. location comes from the posting text (or null); description is <=1200 chars of the original; skills is 0-8 lowercase skill tags." },
            { role: "user", content: JSON.stringify({ title: j.title, company: j.company, location: j.location, description: j.description, pageText: (j.pageText ?? "").slice(0, 3000) }) }
          ],
          temperature: 0
        })
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
      const body = await res.json();
      const raw = String(body?.choices?.[0]?.message?.content ?? "");
      const m = raw.match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : {};
      out.push({
        ...j,
        location: typeof parsed.location === "string" ? parsed.location.slice(0, 160) : j.location,
        description: typeof parsed.description === "string" ? parsed.description.slice(0, 1200) : j.description,
        skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 8).map(s => String(s).toLowerCase()) : (j.skills ?? [])
      });
    } catch (e) {
      if (done++ > 3) { out.push(j); continue; } /* stop hammering after repeated failures */
      console.warn(yellow(`  ↻ AI normalize failed for "${j.title}" — keeping raw extraction (${e.message})`));
      out.push(j);
    }
  }
  out.push(...jobs.slice(30));
  return out;
}

/* ------------------------------ extraction ------------------------------ */

/** Renders one target in the shared browser and extracts postings. */
async function scrapeTarget(browser, target) {
  const { chromium } = await import("playwright");
  const ctx = await browser.newContext({
    userAgent: target.ua ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 900 },
    locale: "en-US"
  });
  const page = await ctx.newPage();
  const report = { targetId: target.id, host: target.host, found: 0, added: 0, error: undefined };
  const jobs = [];
  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    /* client-rendered listings need a beat to hydrate */
    await page.waitForSelector(target.selectors.item, { timeout: 20_000 });
    /* scroll once to trigger lazy lists */
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(800);
    const nodes = await page.$$(target.selectors.item);
    const q = (node, css) => node.$(css);
    for (const node of nodes.slice(0, target.maxItems)) {
      const job = extractJob(node, target, q);
      if (job) jobs.push({ ...job, pageText: "" });
    }
    report.found = jobs.length;
    if (!jobs.length) report.error = "0 postings matched the selectors";
  } catch (e) {
    report.error = String(e.message || e).slice(0, 200);
  } finally {
    await ctx.close();
  }
  return { jobs, report };
}

/* --------------------------------- main --------------------------------- */

async function main() {
  if (!token || !projectRef) {
    console.error(red("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF."));
    process.exit(1);
  }

  const targetsPath = fileURLToPath(new URL("../content/job-playwright-targets.json", import.meta.url));
  const { targets, skipped } = loadTargets(JSON.parse(readFileSync(targetsPath, "utf8")));
  for (const s of skipped) console.warn(yellow(`  (skipped target ${s.id}: ${s.errors.join("; ")})`));
  if (!targets.length) {
    console.error(red("No valid enabled targets — nothing to do."));
    process.exit(1);
  }
  console.log(`Playwright jobs scraper → ${projectRef}: ${targets.length} target(s)`);

  const startedAt = Date.now();
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(red("Playwright not installed — run: npm i -D playwright && npx playwright install chromium"));
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true });

  const perTarget = [];
  const allJobs = [];
  for (const target of targets) {
    console.log(`  ↳ ${target.id} — ${target.url}`);
    const { jobs, report } = await scrapeTarget(browser, target);
    console.log(report.error
      ? `    ${yellow("✗ " + report.error)}`
      : `    ${green("✓ " + jobs.length + " posting(s)")}`);
    perTarget.push(report);
    allJobs.push(...jobs.map(j => ({ ...j, targetId: target.id, host: target.host, extractedAt: new Date().toISOString() })));
    if (target.delayMs > 0) await new Promise(r => setTimeout(r, target.delayMs));
  }
  await browser.close();

  /* identity + dedupe, then persist (jobIdentity normalizes the host) */
  const identified = allJobs.map(j => ({ ...j, ...jobIdentity(j.host, j.targetId, j) }));
  const capped = dedupeJobs(identified, 25, 80);
  console.log(dim(`  ${identified.length} extracted → ${capped.length} after dedupe/caps`));

  let finalJobs = capped;
  if (process.env.JOBS_AI_NORMALIZE !== "0") {
    const ai = await loadAiProviderConfig();
    if (ai?.key) finalJobs = await aiNormalize(capped, ai);
  }

  let sqlError = false;
  if (finalJobs.length) {
    try {
      await runSql(buildJobsUpsertSql(finalJobs));
      for (const p of perTarget) p.added = finalJobs.filter(j => j.targetId === p.targetId).length;
    } catch (e) {
      console.error(red(`  ✗ upsert failed: ${e.message}`));
      sqlError = true;
    }
  }

  const report = buildReport(perTarget, startedAt);
  try {
    await runSql(buildReportSql(report, startedAt));
  } catch (e) {
    console.warn(yellow(`  (report not saved: ${e.message.slice(0, 160)})`));
  }
  console.log(green(`\n✓ ${report.total} playwright job(s) upserted. They enter the feed round-robin via FEED_SOURCES.`));
  if (sqlError) process.exit(1);
}

main().catch((e) => {
  console.error(red(e.message));
  process.exit(1);
});
