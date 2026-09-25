#!/usr/bin/env node
/* L5 re-validation (resource-safety-guard §3 L5 / §5.2) — discovery follow-up.
 * Re-checks every APPROVED discovered_resource on a schedule:
 *   • HTTP probe (HEAD, GET fallback) with the guard's UA, timeout, redirect follow
 *   • redirect away from the approved URL  → auto-quarantine (back to pending)
 *   • unreachable / 4xx / 5xx / probe error → auto-quarantine (fail-closed)
 *   • clean 200 on the same URL            → stays approved
 * Quarantined rows are instantly hidden from discovered_resources_public (the
 * credits/community surfaces) and re-queued for the admin (L4) with the probe
 * evidence in meta.decision_note. Reports into scraper_runs (Item B pipeline).
 *
 * Content fingerprinting is deliberately NOT in v1: an unauthenticated HEAD
 * can't see rendered content, so a marker check would false-positive. The
 * revalidate-lib supports storedMarker comparisons for when the guard's
 * server-side fetch (L3) lands.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> \
 *     node scripts/revalidate-resources.js [--dry-run] [--limit 200]
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { l5Verdict, buildQuarantineSql, buildL5RunSummary, markerFromText } from "./revalidate-lib.js";
import { buildRunReportSql } from "./crawl-orchestrate-lib.js";

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

/** One probe: HEAD first (cheap), GET fallback for servers that 405 it. */
async function probe(url) {
  const opts = {
    headers: { "User-Agent": "InterviewIQGuard/1.0 (security scan; revalidation)" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000)
  };
  try {
    let res = await fetch(url, { ...opts, method: "HEAD" });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { ...opts, method: "GET" });
    }
    let contentMarker = null;
    /* L5 content comparison needs the body — only fetch it when the resource
       stores a marker, so resources without one keep the cheap HEAD-only path */
    if (res.bodyMarker !== false && res.ok) {
      try {
        const g = await fetch(url, { ...opts, method: "GET" });
        if (g.ok) contentMarker = markerFromText(await g.text());
      } catch { /* marker fetch is best-effort; the reachability verdict stands */ }
    }
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, contentMarker };
  } catch {
    return { ok: false, status: null, finalUrl: null, contentMarker: null };
  }
}

export async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 200 : 200;

  if (!dryRun && (!token || !projectRef)) {
    console.error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.");
    process.exit(1);
  }

  const startedAt = Date.now();

  let rows = [];
  if (dryRun) {
    /* pure local preview — probe a couple of well-known live URLs instead of the DB */
    rows = [
      { id: -1, url: "https://example.com" },
      { id: -2, url: "https://github.com/topics/interview-questions" }
    ];
    console.log(dim("DRY RUN — probing 2 sample URLs, no DB access"));
  } else {
    rows = await runSql(
      `select id, url, meta->>'contentMarker' as stored_marker from public.discovered_resources where status = 'approved' order by id limit ${limit}`
    );
  }
  if (!rows.length) {
    console.log(green("No approved resources to re-validate — nothing to do."));
    return;
  }

  const results = {};
  const quarantined = [];
  for (const r of rows) {
    const p = await probe(r.url);
    /* Marker comparison only when BOTH sides exist: a resource approved before
       markers shipped has no stored marker yet (null ≠ quarantine — it gets
       stored on its next approval-cycle touch); a probe that couldn't fetch the
       body passes on reachability alone. This keeps the fail-open posture for
       UNCERTAINTY while failing closed on a REAL mismatch (marker present and
       different = the approved content is gone). */
    const stored = r.stored_marker ?? null;
    const marker = stored != null ? (p.contentMarker ?? null) : null;
    const v = l5Verdict({ ...p, originalUrl: r.url, storedMarker: stored, contentMarker: marker });
    results[String(r.id)] = v;
    if (v.verdict === "quarantine") quarantined.push({ id: r.id, reason: v.reason });
    console.log(dim(`  [${v.verdict}] ${r.url.slice(0, 80)}${v.reason ? ` — ${v.reason}` : ""}`));
  }

  if (quarantined.length && !dryRun) {
    await runSql(buildQuarantineSql(quarantined));
    for (const q of quarantined) console.warn(yellow(`  ⛔ quarantined #${q.id}: ${q.reason}`));
  }

  const summary = buildL5RunSummary(results, startedAt);
  if (!dryRun) {
    try {
      await runSql(buildRunReportSql(summary, "cron"));
    } catch (e) {
      console.warn(red(`  (run report not saved: ${String(e.message ?? e).slice(0, 160)})`));
    }
  }

  const passed = Object.values(results).filter(v => v.verdict === "pass").length;
  console.log(green(`\n✓ L5 re-validation: ${passed} passed, ${quarantined.length} quarantined (status ${summary.status}).`));
  if (dryRun) console.log(dim("DRY RUN — no changes written."));
  else if (summary.status === "failed") process.exit(1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error(red(e.message));
    process.exit(1);
  });
}
