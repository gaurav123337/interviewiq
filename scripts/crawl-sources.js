#!/usr/bin/env node
/* Discovery crawler orchestrator (Phase 4 Item D2) — turns the D1 pure
 * engines into a pipeline: APPROVED discovery seeds (nothing crawls unless a
 * human approved it) → discover-lib plan → crawl-lib BFS within budget →
 * scrape-lib extraction → route:
 *   • Q&A            → buildUpsertSql → published_questions drafts
 *                      (suppression-aware, oversize-guarded — D3)
 *   • problem titles → recorded in the run report for ai-problems.yml
 *   • resource links → discovered_resources (pending; D4 surfaces them)
 * Attribution is captured for free from the seed; no-license content is
 * flagged (needs_license_review) and never auto-rotated.
 * Reports into scraper_runs (Item B) — trigger 'cron'.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> \
 *     node scripts/crawl-sources.js [--seed <url>] [--max-total 100] [--dry-run]
 */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifySeed, planDiscovery, githubSearchUrl, parseRepoSearchHit } from "./discover-lib.js";
import { Budget, extractLinks, detectType, robotsAllowed, createFetcher } from "./crawl-lib.js";
import { resolveDiscoveryFetcher, playwrightAvailable } from "./discovery-render-fetcher.mjs";
import { extractItems, buildUpsertSql, partitionOversizeQuestions } from "./scrape-lib.js";
import { slugify } from "./ai-draft-lib.js";
import {
  classifyLink, routeItems,
  buildResourcesInsertSql,
  buildRunSummary, buildRunReportSql, attributionFor,
} from "./crawl-orchestrate-lib.js";

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
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SQL ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

/* ------------------------------------------------------------------ */
/* storage                                                             */
/* ------------------------------------------------------------------ */

/** APPROVED seeds only — the approval gate IS the crawl trigger. Falls back
 *  to content/discovery-seeds.json (pending→approved by hand) when the
 *  dashboard table is missing (pre-migration → graceful degradation). */
async function loadSeeds() {
  try {
    const rows = await runSql(
      `select id, url, kind, origin, origin_detail, skill
       from public.discovery_seeds where status = 'approved' order by id`
    );
    if (Array.isArray(rows) && rows.length) return rows;
  } catch (e) {
    console.warn(red(`  (seeds read failed: ${e.message.slice(0, 160)})`));
  }
  try {
    const path = fileURLToPath(new URL("../content/discovery-seeds.json", import.meta.url));
    const config = JSON.parse(readFileSync(path, "utf8"));
    const rows = (config.seeds ?? []).map((s) => ({ ...s, status: s.status ?? "approved" }));
    console.warn(dim("  (no dashboard seeds — using content/discovery-seeds.json)"));
    return rows.filter((s) => s.status === "approved");
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* crawl                                                               */
/* ------------------------------------------------------------------ */

/** Q&A extraction reuses the question scraper's source contract — items must
 *  carry fieldId/level for the drafts; discovery seeds default to backend. */
function extractionSource(seed, url) {
  return {
    id: `discovery:${seed.id ?? seed.url}`,
    url,
    type: "html",
    fieldId: seed.fieldId || seed.skill || "backend",
    level: seed.level || "mid",
    maxItems: 20,
  };
}

/** Executes a `github-search` seed against the keyless REST API (the search-UI
 *  page is JS-rendered — the crawler would only see nav chrome). Returns the
 *  discovered repos as child github-repo seeds (license carried from the hit;
 *  no-license repos keep the needs-license-review flag) plus a perSeed entry.
 *  Keyless = the same 10 req/min budget the D5 prober lives with; optional
 *  GITHUB_TOKEN raises it via headers. 403/429 → render-fallback notice. */
export async function runGithubSearch(seed, opts = {}) {
  const { fetcher, maxRepos = 10 } = opts;
  const cls = classifySeed(seed.url);
  const key = String(seed.id ?? seed.url);
  const empty = { perSeed: { [key]: { url: seed.url, kind: "github-search", repos: 0 } }, childSeeds: [] };
  if (!cls || cls.kind !== "github-search" || !cls.query) return empty;

  const api = githubSearchUrl(cls.query, { perPage: Math.min(maxRepos, 50) });
  let body;
  try {
    const headers = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(api, { headers });
    if (!res.ok) {
      empty.perSeed[key].apiStatus = res.status;
      empty.perSeed[key].note = res.status === 403 || res.status === 429
        ? "rate-limited — render-fallback would be JS-rendered chrome; treat as zero-yield"
        : `search API HTTP ${res.status}`;
      return empty;
    }
    body = await res.json();
  } catch (e) {
    empty.perSeed[key].error = `search API failed: ${String(e.message ?? e).slice(0, 120)}`;
    return empty;
  }

  const childSeeds = [];
  for (const hit of Array.isArray(body?.items) ? body.items.slice(0, maxRepos) : []) {
    const repo = parseRepoSearchHit(hit);
    if (!repo) continue;
    childSeeds.push({
      id: null,
      url: repo.url,
      kind: "github-repo",
      originDetail: `github-search:${cls.query}`,
      skill: seed.skill ?? null,
      license: repo.license,
      origin: "search-child",
    });
  }
  empty.perSeed[key].repos = childSeeds.length;
  empty.perSeed[key].totalResults = typeof body?.total_count === "number" ? body.total_count : undefined;
  return { perSeed: empty.perSeed, childSeeds };
}

/** Crawls ONE seed: BFS from the seed URL within budget, robots+politeness via
 *  the crawl-lib fetcher, extract at every page, classify every link. Returns
 *  { perSeed, qa, problems, resources } for the run report + routing. */
export async function crawlSeed(seed, opts = {}) {
  const { maxTotal = 100, maxPagesPerSeed = 25, maxDepth = 2, fetcher, dryRun = false, robotsCache = new Map() } = opts;
  const cls = classifySeed(seed.url);
  if (!cls) {
    return { perSeed: { [String(seed.id ?? seed.url)]: { url: seed.url, error: "unclassifiable seed" } }, qa: [], problems: [], resources: [] };
  }

  const budget = new Budget({ maxDepth, maxPagesPerSeed, maxTotal });
  const perSeed = {
    [String(seed.id ?? seed.url)]: { url: seed.url, kind: cls.kind, crawled: 0, extracted: 0, inserted: 0, problems: 0, resources: 0 },
  };
  const key = String(seed.id ?? seed.url);
  const attribution = attributionFor(cls);
  const qa = [];
  const problems = [];
  const resources = [];

  budget.addSeed(key);
  const queue = [{ url: cls.url, depth: 0 }];
  const seen = new Set([cls.url]);
  const seenResources = new Set();
  const seenProblems = new Set();

  while (queue.length) {
    if (!budget.canFetch(key)) break;
    const { url, depth } = queue.shift();

    /* robots.txt per host, cached — disallowed URLs are skipped politely */
    try {
      const u = new URL(url);
      if (!robotsCache.has(u.host)) {
        const r = await fetcher.fetchText(`${u.origin}/robots.txt`);
        robotsCache.set(u.host, r.ok ? r.text : null);
      }
      if (!robotsAllowed(robotsCache.get(u.host), url, "interviewiq-crawler")) {
        perSeed[key].skippedRobots = (perSeed[key].skippedRobots ?? 0) + 1;
        continue;
      }
    } catch {
      /* robots fetch failed — permissive, continue */
    }

    /* dead links are ubiquitous on the open web — a per-page fetch failure is
       a counted notice, never a fatal; the seed only errors when NOTHING loads */
    let page;
    try {
      page = await fetcher.fetchText(url);
    } catch (e) {
      perSeed[key].fetchErrors = (perSeed[key].fetchErrors ?? 0) + 1;
      perSeed[key].lastFetchError = e.message.slice(0, 120);
      continue;
    }
    if (!page.ok) {
      perSeed[key].fetchErrors = (perSeed[key].fetchErrors ?? 0) + 1;
      perSeed[key].lastFetchStatus = page.status;
      continue;
    }
    budget.consume(key);
    perSeed[key].crawled++;

    const type = detectType(url, page.text);
    const source = extractionSource(seed, url);
    let items = [];
    try {
      items = extractItems(page.text, source).slice(0, 20);
    } catch {
      /* extraction is best-effort per page */
    }
    if (items.length) {
      const routed = routeItems(items, cls, seed.license);
      qa.push(...routed.qa);
      problems.push(...routed.problems);
      perSeed[key].extracted += routed.qa.length;
      perSeed[key].problems += routed.problems.length;
      if (routed.noise.length) {
        perSeed[key].noiseDropped = (perSeed[key].noiseDropped ?? 0) + routed.noise.length;
        perSeed[key].lastNoiseReason = routed.noise[routed.noise.length - 1].reason;
      }
    }

    /* depth 0 pages always expand; deeper pages only when HTML */
    if (depth < maxDepth && (depth === 0 || type === "html")) {
      for (const link of extractLinks(page.text, url)) {
        const c = classifyLink(link, url);
        if (!c) continue;
        if (c.kind === "resource") {
          if (seenResources.has(c.url)) continue;
          seenResources.add(c.url);
          resources.push({
            url: c.url,
            title: c.title,
            kind: "resource",
            attribution,
            license: seed.license ?? "unknown",
            seedId: seed.id ?? null,
            meta: { needs_license_review: !seed.license || seed.license === "no-license" },
          });
          perSeed[key].resources++;
        } else if (c.kind === "problem") {
          /* problem TITLES are the ai-draft-problems.js contract — record the
             candidate without burning budget fetching each problem page */
          const id = slugify(c.title);
          if (id && !seenProblems.has(id)) {
            seenProblems.add(id);
            problems.push({ id, title: c.title, pattern: c.pattern ?? "mixed" });
            perSeed[key].problems++;
          }
        } else if (!seen.has(c.url) && !seen.has(c.url.replace(/\/$/, ""))) {
          seen.add(c.url);
          queue.push({ url: c.url, depth: depth + 1 });
          if (queue.length > 200) break;
        }
      }
      perSeed[key].pages = perSeed[key].pages ?? 0;
      perSeed[key].pages++;
    }
  }

  if (perSeed[key].crawled === 0 && (perSeed[key].fetchErrors ?? 0) > 0) {
    perSeed[key].error = `all ${perSeed[key].fetchErrors} fetch(es) failed (last: HTTP ${perSeed[key].lastFetchStatus ?? perSeed[key].lastFetchError ?? "?"})`;
  }

  return { perSeed, qa, problems, resources };
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  if (!token || !projectRef) {
    console.error(red("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF."));
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const seedArgIdx = args.indexOf("--seed");
  const oneSeedUrl = seedArgIdx >= 0 ? args[seedArgIdx + 1] : null;
  const maxTotalIdx = args.indexOf("--max-total");
  const maxTotal = maxTotalIdx >= 0 ? Number(args[maxTotalIdx + 1]) || 100 : 100;

  const startedAt = Date.now();
  /* DISCOVERY_RENDER=1 opts into per-page Chromium rendering (JS-heavy pages —
     GitHub search pages, SPA docs) via the D1 fetcher seam. Plain fetch stays
     the default: browser loads cost seconds each and the budget absorbs that
     deliberately. Falls back with a note when playwright isn't installed. */
  const { fetcher, mode, close: closeFetcher } = await resolveDiscoveryFetcher(createFetcher, {
    userAgent: "interviewiq-crawler/1.0 (+https://github.com/gaurav123337/interviewiq)",
    delayMs: 300,
  });
  if (process.env.DISCOVERY_RENDER === "1") {
    console.log(mode === "playwright" ? green("  render mode: Playwright Chromium (DISCOVERY_RENDER=1)") : yellow("  DISCOVERY_RENDER=1 but playwright not installed — using plain fetch"));
  }

  let seeds = [];
  if (oneSeedUrl) {
    seeds = [{ id: null, url: oneSeedUrl, kind: "html", originDetail: "cli --seed" }];
  } else {
    seeds = await loadSeeds();
    if (!seeds.length) {
      console.log(green("No approved discovery seeds — nothing to crawl (approve seeds in Admin → Discovery)."));
      process.exit(0);
    }
  }

  console.log(`Discovery crawl → ${projectRef}: ${seeds.length} approved seed(s), budget ${maxTotal} page(s)${dryRun ? dim(" (DRY RUN — no writes)") : ""}`);
  const perSeed = {};
  let allQa = [];
  let allProblems = [];
  let allResources = [];
  let errors = 0;
  const robotsCache = new Map();

  for (const seed of seeds) {
    /* github-search seeds never crawl HTML (JS-rendered chrome) — they fan out
       into license-stamped github-repo child seeds via the keyless REST API */
    const cls = classifySeed(seed.url);
    if (cls?.kind === "github-search") {
      const search = await runGithubSearch(seed, { fetcher });
      Object.assign(perSeed, search.perSeed);
      for (const child of search.childSeeds) {
        const r = await crawlSeed(child, { maxTotal, fetcher, dryRun, robotsCache });
        Object.assign(perSeed, r.perSeed);
        allQa = allQa.concat(r.qa);
        allProblems = allProblems.concat(r.problems);
        allResources = allResources.concat(r.resources);
      }
      continue;
    }
    const res = await crawlSeed(seed, { maxTotal, fetcher, dryRun, robotsCache });
    Object.assign(perSeed, res.perSeed);
    allQa = allQa.concat(res.qa);
    allProblems = allProblems.concat(res.problems);
    allResources = allResources.concat(res.resources);
  }

  /* ------- write Q&A drafts (suppression-aware, oversize-guarded) ------- */
  let inserted = 0;
  const [keptQa] = partitionOversizeQuestions(allQa);
  if (keptQa.length < allQa.length) {
    console.warn(yellow(`  dropped ${allQa.length - keptQa.length} oversize question(s) (> 2000 chars) — index limit`));
  }
  if (keptQa.length && !dryRun) {
    let suppressions;
    try {
      suppressions = await runSql(`select question_text from public.takedown_suppressions where question_text is not null`);
    } catch {
      suppressions = undefined;
    }
    try {
      await runSql(buildUpsertSql(keptQa, suppressions));
      inserted = keptQa.length;
    } catch (e) {
      console.error(red(`  Q&A upsert failed: ${e.message.slice(0, 200)}`));
      errors++;
    }
  }

  /* ------------------ write discovered resources ------------------ */
  if (allResources.length && !dryRun) {
    try {
      await runSql(buildResourcesInsertSql(allResources));
      console.log(green(`  queued ${allResources.length} discovered resource(s) (pending — approve in Admin → Discovery).`));
    } catch (e) {
      console.error(red(`  resource insert failed: ${e.message.slice(0, 200)}`));
      errors++;
    }
  }

  /* problem candidates are recorded in the run report (perSeed.problems);
     drafting them is ai-problems.yml's job — same contract as the scraper. */
  if (allProblems.length) {
    console.log(dim(`  ${allProblems.length} problem-title candidate(s) recorded — draft via ai-problems.yml.`));
  }

  /* ------------------ run report (Item B) ------------------ */
  for (const p of Object.values(perSeed)) {
    if (p.error) errors++;
  }
  const summary = buildRunSummary(perSeed, startedAt, inserted, errors);
  if (!dryRun) {
    try {
      await runSql(buildRunReportSql(summary, "cron"));
    } catch (e) {
      console.warn(red(`  (run report not saved: ${e.message.slice(0, 160)})`));
    }
  }

  const vals = Object.values(perSeed);
  console.log(green(`\n✓ Discovery crawl: ${vals.reduce((n, p) => n + (p.crawled ?? 0), 0)} page(s), ${inserted} Q&A draft(s), ${allProblems.length} problem candidate(s), ${allResources.length} resource(s), ${errors} error(s).`));
  await closeFetcher();
  if (errors) process.exit(1);
}

/* run only when executed directly — importing the module (tests) must not
   kick off a crawl or process.exit() */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error(red(e.message));
    process.exit(1);
  });
}
