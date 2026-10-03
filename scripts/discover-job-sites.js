#!/usr/bin/env node
/* discover-job-sites — the self-extending half of the apply engine.
 *
 * Finds NEW job boards the owner can auto-apply on:
 *   1. AI proposes candidate sites (India-first, board/ATS style, login-able)
 *   2. DuckDuckGo HTML search cross-checks ("apply" boards + niche queries)
 *   3. Each candidate is PROBED with the engine's browser profile:
 *        - loads without a hard bot-wall?
 *        - has a jobs list with real postings?
 *        - has a login path?
 *   4. Survivors are written to job_sites with status 'pending'.
 * NOTHING is auto-activated: the owner approves sites in the UI
 * (Job Match → Auto-apply → Job sites → Approve), and only 'active'
 * sites are driven by `auto-apply-jobs.js --all`.
 *
 * Usage: node scripts/discover-job-sites.js [--limit 8] [--query "..."]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAi } from "./apply-kit-node.js";
import { upsertJobSite, listJobSites } from "./job-sites-db.js";
import { listEngineProcesses } from "./engine-lifecycle.js";

/* ---------- candidate generation ---------- */

const FALLBACK_SEEDS = [
  "cutshort.io", "hirist.tech", "iimjobs.com", "foundit.in", "timesjobs.com",
  "angel.co", "wellfound.com", "workatastartup.com",
  "niceone.work", "instahyre.com", "hirist.com", "limelight.work",
];

async function aiCandidates(ai, query) {
  if (!ai?.key) return [];
  const res = await fetch(`${ai.base.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ai.model, max_tokens: 300, temperature: 0.6,
      messages: [
        { role: "system", content: "You list job boards. Output ONLY hostnames, one per line, no commentary, no http, no paths. India-relevant boards and tech-job ATS sites only." },
        { role: "user", content: `List ${query ?? "job boards where a senior frontend engineer can apply directly with a saved login session (like instahyre.com or naukri.com). 10 candidates."}` },
      ],
    }),
  }).catch(() => null);
  if (!res || !res.ok) return [];
  const body = await res.json().catch(() => ({}));
  return String(body.choices?.[0]?.message?.content ?? "")
    .split(/\s+/).map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter((s) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s));
}

async function ddgCandidates(query) {
  const out = [];
  const q = encodeURIComponent(query ?? "best job boards india apply directly tech jobs -naukri -linkedin -instahyre");
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
    const html = await res.text();
    for (const m of html.matchAll(/uddg=([^"&]+)/g)) {
      try {
        const u = new URL(decodeURIComponent(m[1]));
        if (u.hostname.includes("duckduckgo")) continue;
        out.push(u.hostname.toLowerCase().replace(/^www\./, ""));
      } catch { /* skip */ }
    }
  } catch { /* offline — AI seeds still apply */ }
  return [...new Set(out)];
}

/* ---------- probing ---------- */

const BOT_WALL = /just a moment|attention required|verify you are (a )?human|cf-challenge|incapsula|distil/i;

async function probeSite(page, host, jobsUrl) {
  const url = jobsUrl || `https://${host}`;
  const r = { host, url, reachable: false, botWall: false, hasJobsList: false, jobCount: 0, hasLogin: false, loginUrl: null, sampleTitle: null };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(5000);
    const title = await page.title();
    const body = await page.evaluate(() => document.body?.innerText ?? "");
    r.reachable = true;
    r.botWall = BOT_WALL.test(title) || BOT_WALL.test(body.slice(0, 800));
    if (r.botWall) return r;

    /* job-list heuristics: links or cards mentioning roles + locations/salaries */
    r.jobCount = await page.evaluate(() => {
      let n = 0;
      for (const a of document.querySelectorAll("a")) {
        const h = a.getAttribute("href") || "";
        const t = (a.innerText || "").trim();
        if (/job|career|position|opening|vacancy/i.test(h) && /engineer|developer|manager|design|analyst|architect|scientist/i.test(t) && t.length > 8) n++;
      }
      for (const art of document.querySelectorAll("[data-job-id], article[class*='job'], .jobTuple, [class*='job-card'], [class*='jobCard']")) n++;
      return n;
    });
    r.hasJobsList = r.jobCount >= 3;
    if (r.hasJobsList) {
      r.sampleTitle = await page.evaluate(() => {
        for (const a of document.querySelectorAll("a")) {
          const t = (a.innerText || "").trim();
          if (/engineer|developer|manager|design|analyst|architect/i.test(t) && t.length > 8 && t.length < 120) return t.split("\n")[0];
        }
        return null;
      });
    }
    const loginHref = await page.evaluate(() => {
      for (const a of document.querySelectorAll("a")) {
        const t = (a.innerText || "").trim().toLowerCase();
        const h = a.getAttribute("href") || "";
        if (/^(log ?in|sign ?in)$/.test(t) && h) return h;
      }
      return null;
    });
    r.hasLogin = !!loginHref || /login|signin|auth/i.test(await page.url());
    r.loginUrl = loginHref ? new URL(loginHref, page.url()).toString() : null;
  } catch (e) {
    r.error = e.message.slice(0, 120);
  }
  return r;
}

/* ---------- main ---------- */

async function main() {
  const limIdx = process.argv.indexOf("--limit");
  const argLimit = Number(limIdx > -1 ? process.argv[limIdx + 1] : 8) || 8;
  const queryIdx = process.argv.indexOf("--query");
  const query = queryIdx > -1 ? process.argv[queryIdx + 1] : undefined;

  const ai = await loadAi({});
  console.log(`site-discovery → AI ${ai ? ai.model : "OFF (seed list only)"} · limit ${argLimit}`);

  const known = new Set((await listJobSites()).map((s) => s.host));
  const candidates = [...new Set([...(await aiCandidates(ai, query)), ...(await ddgCandidates(query)), ...FALLBACK_SEEDS])]
    .filter((h) => !known.has(h) && !/naukri\.com$|linkedin\.com$|instahyre\.com$/.test(h))
    .slice(0, Math.max(argLimit * 3, 12));
  console.log(`candidates: ${candidates.length} (${known.size} already registered)`);

  /* ABSOLUTE profile path (a relative one silently forks a SECOND profile
     whenever the cwd is not the repo root) + try/finally: any probe crash
     used to orphan a live browser holding the engine profile, and the next
     stage's launches then "succeeded" vacuously against it — whole cycles
     silently did nothing. */
  /* computed specifier so deno check / vite never statically resolve playwright
     (same trick as the engine's acquireApplyContext) */
  const { chromium } = await import(["play", "wright"].join(""));
  const PROFILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "freebuff-apply-profile");
  let ctx = null;
  try {
    ctx = await chromium.launchPersistentContext(PROFILE, {
      headless: false, viewport: { width: 1380, height: 900 },
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const page = ctx.pages()[0] ?? (await ctx.newPage());

    let added = 0;
    for (const host of candidates) {
      if (added >= argLimit) break;
      const r = await probeSite(page, host);
      const verdict = r.reachable && !r.botWall && r.hasJobsList && r.hasLogin ? "PROMISING"
        : r.reachable && !r.botWall ? "weak" : "skip";
      console.log(`  ${host}: ${verdict} (jobs≈${r.jobCount}${r.sampleTitle ? ` e.g. "${r.sampleTitle.slice(0, 40)}"` : ""}${r.error ? ` err=${r.error}` : ""})`);
      if (verdict === "PROMISING") {
        await upsertJobSite({ host, label: host.replace(/^www\./, ""), jobsUrl: r.url, source: "discovered", sessionOk: false });
        added++;
        console.log(`    → registered as PENDING (approve it in the UI to activate)`);
      }
      await page.waitForTimeout(1500);
    }
    console.log(added ? `done — ${added} site(s) added to the pending queue` : "done — no new promising sites this round");
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    /* the watcher spawns --all SECONDS after this process exits, and the
       apply cycle's shared-browser launch used to race this browser's async
       teardown — wait until no engine chrome holds the profile (bounded). */
    for (let i = 0; i < 30; i++) {
      const procs = await listEngineProcesses();
      if (!procs.engineChromePids.length) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
