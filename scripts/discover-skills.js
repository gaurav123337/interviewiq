#!/usr/bin/env node
/* Skill-gap auto-discovery (Phase 4 Item D5) — the last leg of the discovery
 * engine. Reads the skill catalog (skillCatalog.ts), finds skills with fewer
 * than GAP_MIN approved discovery resources attributed to them, proposes
 * keyless search seeds for those gaps (GitHub repo-search + HN Algolia), and
 * writes them as discovery_seeds rows with origin='skill-auto',
 * status='pending'.
 *
 * NOTHING CRAWLS UNTIL A HUMAN APPROVES — the D2/D4 approval gate is the
 * crawl trigger; this script only ever proposes. Deterministic + idempotent:
 * already-known URLs (any status) are never re-proposed, and the run is
 * budget-capped so the admin queue stays reviewable.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> \
 *     node scripts/discover-skills.js [--dry-run] [--max-total 20] [--list-gaps]
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  budgetCap, dedupeProposals, findSkillGaps, parseCatalogSkillNames, proposeSkillSeeds
} from "./discover-skills-lib.js";

const API = "https://api.supabase.com/v1";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

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
/* catalog loading (build-time TS → runtime import; degrades to none)  */
/* ------------------------------------------------------------------ */

async function loadCatalogNames() {
  const path = fileURLToPath(new URL("../src/data/skillCatalog.ts", import.meta.url));
  try {
    const src = await readFile(path, "utf8");
    /* The catalog is a static literal in a TS file. Rather than evaluate
       TypeScript at runtime (eval is fragile and unnecessary), the pure lib
       extracts the `name: "..."` literals from the source text — zero eval,
       zero deps, immune to catalog type churn. */
    const names = parseCatalogSkillNames(src);
    return names.length ? names : null;
  } catch (e) {
    console.warn(red(`  (catalog load failed: ${String(e.message ?? e).slice(0, 120)})`));
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* approved-sources map (for the gap rule)                             */
/* ------------------------------------------------------------------ */

/** skill name (lowercased) → count of APPROVED discovery resources whose
    seed targets that skill. Seeds carry the skill; approved resources join
    through seed_id, so the count reflects what the crawler actually found
    and a human approved. */
async function approvedCountsBySkill() {
  const rows = await runSql(
    `select lower(trim(s.skill)) as skill, count(r.id)::int as n
     from public.discovery_seeds s
     join public.discovered_resources r on r.seed_id = s.id and r.status = 'approved'
     where s.skill is not null
     group by 1`
  );
  const out = {};
  for (const r of rows ?? []) out[String(r.skill)] = Number(r.n);
  return out;
}

/** All seed URLs ever seen (any status) — rejected/broken URLs must not be
    re-proposed every week (dedupe contract). */
async function existingSeedUrls() {
  const rows = await runSql(`select url from public.discovery_seeds`);
  return (rows ?? []).map(r => r.url);
}

/* ------------------------------------------------------------------ */
/* GitHub / HN probes (cheap, keyless; only used to sanity-check        */
/* proposals before writing them — an empty search result is a signal   */
/* the query is useless, so it gets dropped rather than queued)          */
/* ------------------------------------------------------------------ */

async function hasResults(proposal) {
  try {
    if (String(proposal.url).startsWith("https://hn.algolia.com/")) {
      const res = await fetch(proposal.url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return true; // fail-open: HN hiccup shouldn't drop the proposal
      const data = await res.json();
      return Number(data?.nbHits ?? 0) > 0;
    }
    /* GitHub search UI page — probe the REST endpoint instead (same rate
       limits, machine-readable): results exist unless total_count is 0. */
    const q = decodeURIComponent((new URL(proposal.url)).searchParams.get("q") ?? "");
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=1`,
      { headers: { Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }, signal: AbortSignal.timeout(10000) }
    );
    if (res.status === 403 || res.status === 429) return true; // rate-limited → fail-open
    if (!res.ok) return true; // unknown API trouble → fail-open (never drop on error)
    const data = await res.json();
    return Number(data?.total_count ?? 0) > 0;
  } catch {
    return true; // probe errors never drop a proposal (fail-closed on human review, not on probes)
  }
}

/* ------------------------------------------------------------------ */
/* fallback file (pre-migration DBs: pending seeds land in a JSON file  */
/* the admin can review and promote into discovery-seeds.json by hand)  */
/* ------------------------------------------------------------------ */

const FALLBACK_PATH = new URL("../content/discovery-seeds.auto.json", import.meta.url);

async function writeFallback(rows) {
  let prior = [];
  try {
    const parsed = JSON.parse(await readFile(fileURLToPath(FALLBACK_PATH), "utf8"));
    prior = parsed.seeds ?? [];
  } catch { /* first run — no file yet */ }
  const merged = [...prior];
  for (const r of rows) {
    if (!merged.some(p => p.url === r.url)) merged.push(r);
  }
  await writeFile(fileURLToPath(FALLBACK_PATH), JSON.stringify({ seeds: merged }, null, 2) + "\n", "utf8");
}

/* ------------------------------------------------------------------ */
/* main                                                                 */
/* ------------------------------------------------------------------ */

export async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const listGaps = args.includes("--list-gaps");
  const maxTotalIdx = args.indexOf("--max-total");
  const maxTotal = maxTotalIdx >= 0 ? Number(args[maxTotalIdx + 1]) || 20 : 20;

  if (!dryRun && (!token || !projectRef)) {
    console.error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.");
    process.exit(1);
  }

  const catalogNames = await loadCatalogNames();
  if (!catalogNames) {
    console.error(red("No catalog — nothing to do."));
    process.exit(1);
  }
  console.log(`Skill-gap discovery: ${catalogNames.length} catalog skills`);

  /* --dry-run is a pure local preview: no DB reads, no probes, no writes —
     it pretends every skill is a gap so the admin can see the exact
     proposals a live run would queue. */
  const approved = dryRun ? {} : await approvedCountsBySkill();
  const gaps = findSkillGaps(catalogNames, approved);
  console.log(`Gap skills (< 2 approved resources): ${gaps.length ? gaps.join(", ") : "(none — catalog fully covered)"}`);
  if (listGaps) process.exit(0);

  if (!gaps.length) {
    console.log(green("Nothing to propose — every skill has coverage."));
    return;
  }

  let proposals = proposeSkillSeeds(gaps, { maxPerSkill: 2 });
  const known = dryRun ? [] : await existingSeedUrls();
  proposals = budgetCap(dedupeProposals(proposals, known), maxTotal);
  if (!proposals.length) {
    console.log(green("All gap proposals already known — nothing new to queue."));
    return;
  }

  /* Sanity probes: drop proposals whose keyless search has provably zero
     results (fail-open on probe errors — never drop on uncertainty).
     --dry-run skips probes entirely (pure local preview). */
  const kept = [];
  for (const p of proposals) {
    if (dryRun || (await hasResults(p))) kept.push(p);
    else console.warn(yellow(`  dropped (no search results): ${p.url.slice(0, 90)}`));
  }
  if (!kept.length) {
    console.log(green("No viable proposals this round."));
    return;
  }

  if (dryRun) {
    console.log(dim(`DRY RUN — would queue ${kept.length} pending seed(s):`));
    for (const p of kept) console.log(dim(`  [${p.kind}] ${p.url} → skill "${p.skill}"`));
    return;
  }

  const values = kept.map(p =>
    `('${p.url.replace(/'/g, "''")}', '${p.kind}', '${p.origin}', '${p.origin_detail.replace(/'/g, "''")}', '${p.skill.replace(/'/g, "''")}')`
  ).join(", ");
  try {
    await runSql(
      `insert into public.discovery_seeds (url, kind, origin, origin_detail, skill, status)
       values ${values}
       on conflict (url) do nothing`
    );
    console.log(green(`✓ Queued ${kept.length} pending seed(s) — review in Admin → Discovery.`));
  } catch (e) {
    console.warn(red(`  insert failed (${String(e.message ?? e).slice(0, 140)}) — writing the fallback file instead.`));
    await writeFallback(kept.map(p => ({ url: p.url, kind: p.kind, skill: p.skill, note: p.origin_detail, status: "pending" })));
    console.log(green("✓ content/discovery-seeds.auto.json written (review + promote by hand)."));
  }
}

/* run only when executed directly — importing the module (tests) must not
   kick off a main() or process.exit() */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error(red(e.message));
    process.exit(1);
  });
}
