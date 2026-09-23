#!/usr/bin/env node
/* Question-bank scraper. Sources + schedule are configured in the Admin
 * dashboard (Supabase scraper_sources / scraper_config); the repo's
 * content/sources.json is only the fallback when the dashboard has none.
 *
 * The workflow runs daily (cron "0 3 * * *") and this script skips days that
 * aren't in the configured schedule — so admins change cadence without
 * touching the workflow file.
 *
 * Usage (local):
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/scrape-sources.js
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extractItems, buildUpsertSql, partitionOversizeQuestions, MAX_QUESTION_CHARS } from "./scrape-lib.js";

const API = "https://api.supabase.com/v1";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

/** JSON-encodes into a SQL-safe string literal (mirrors scrape-lib.sqlStr). */
function sqlStr(v) {
  return "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}

/** Writes one scraper_runs row (Phase 4 Item B) so the Admin dashboard shows
 * what the cron did. Values are counts + error strings — never secrets.
 * Best-effort: a missing table (pre-migration) logs a warning, never fails
 * the run. perSource: { [sourceId]: { url, extracted, inserted, error? } }. */
async function recordRunReport(perSource, inserted, errors, startedAt) {
  try {
    const status = errors > 0
      ? (Object.values(perSource).every((p) => p.error) ? "failed" : "partial")
      : "ok";
    const sql =
      `insert into public.scraper_runs (ran_at, trigger, status, per_source, inserted, errors)\n` +
      `values (${sqlStr(new Date(startedAt).toISOString())}, 'cron', ${sqlStr(status)}, ` +
      `${sqlStr(JSON.stringify(perSource))}::jsonb, ${Number(inserted) || 0}, ${Number(errors) || 0});`;
    await runSql(sql);
  } catch (e) {
    console.warn(red(`  (run report not saved: ${e.message.slice(0, 160)})`));
  }
}

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

/* ---------- configuration: dashboard first, repo file as fallback ---------- */

async function loadSources() {
  try {
    const rows = await runSql(
      `select id, url, type, field_id, level, max_items, enabled, note, config
       from public.scraper_sources where enabled = true order by id`
    );
    if (Array.isArray(rows) && rows.length) {
      return rows.map((r) => ({
        id: r.id, url: r.url, type: r.type ?? "markdown",
        fieldId: r.field_id, level: r.level, maxItems: r.max_items ?? 20, note: r.note ?? "",
        ...(r.config && typeof r.config === "object" ? r.config : {})
      }));
    }
  } catch (e) {
    console.warn(red(`  (config read failed: ${e.message})`));
  }
  const configPath = fileURLToPath(new URL("../content/sources.json", import.meta.url));
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  console.warn("  (no dashboard sources — falling back to content/sources.json)");
  return (config.sources ?? []).filter((s) => s.enabled);
}

/* ISO weekday numbers: 1=Mon … 7=Sun (JS getUTCDay: 0=Sun … 6=Sat) */
function todayIso() {
  const d = new Date().getUTCDay();
  return ((d + 6) % 7) + 1;
}

async function isScheduledDay() {
  try {
    const rows = await runSql(`select value from public.scraper_config where key = 'schedule'`);
    const value = Array.isArray(rows) && rows[0]?.value;
    const days = Array.isArray(value?.days) ? value.days.map(Number).filter(Boolean) : [];
    if (!days.length) return true; /* no schedule configured → always run */
    return days.includes(todayIso());
  } catch {
    return true; /* never let a config hiccup block a scheduled run */
  }
}

async function main() {
  if (!token || !projectRef) {
    console.error(red("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF."));
    process.exit(1);
  }

  if (!(await isScheduledDay())) {
    console.log(`Today (ISO day ${todayIso()}) isn't in the configured schedule — skipping.`);
    process.exit(0);
  }

  const sources = await loadSources();
  console.log(`Scraping ${sources.length} enabled source(s) → ${projectRef} (drafts)...`);
  const startedAt = Date.now();

  const all = [];
  let errors = 0;
  const perSource = {};
  for (const source of sources) {
    const key = String(source.id ?? source.url);
    try {
      console.log(`  ↳ ${key} — ${source.url}`);
      /* polite fetching: single 429 backoff, then a small inter-source delay */
      let res = await fetch(source.url, { headers: { "User-Agent": "interviewiq-scraper/1.0 (+github.com/gaurav123337/interviewiq)" } });
      if (res.status === 429) {
        const wait = Math.max(1000, Number(res.headers.get("retry-after") ?? 2) * 1000 || 2000);
        console.warn(`     429 — backing off ${Math.round(wait / 1000)}s`);
        await new Promise((r) => setTimeout(r, wait));
        res = await fetch(source.url, { headers: { "User-Agent": "interviewiq-scraper/1.0 (+github.com/gaurav123337/interviewiq)" } });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const isJson = source.type === "json" || source.type === "hackernews";
      const body = isJson ? await res.json() : await res.text();
      const items = extractItems(body, source).slice(0, source.maxItems ?? 20);
      console.log(`     extracted ${items.length} item(s)`);
      all.push(...items);
      perSource[key] = { url: source.url, extracted: items.length, inserted: 0 };
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      errors++;
      perSource[key] = { url: source.url, error: e.message };
      console.error(red(`  ✗ ${key}: ${e.message}`));
    }
  }

  /* dedupe within the batch by question text */
  const seen = new Set();
  let rows = all.filter((r) => {
    const k = r.question.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  /* one oversized question poisoned the 2026-09-23 run (index row > 8191 bytes
     rejected the entire multi-row insert) — drop them up front, mark the
     source, and let the report show it */
  const [kept, oversize] = partitionOversizeQuestions(rows);
  rows = kept;
  for (const r of oversize) {
    const k = r.sourceId || r.sourceUrl || "unknown";
    perSource[k] = perSource[k] ?? { url: r.sourceUrl ?? "" };
    perSource[k].error = `question too long (${String(r.question).length} chars) — skipped`;
    errors++;
  }
  if (oversize.length) {
    console.warn(yellow(`  dropped ${oversize.length} oversize question(s) (> ${MAX_QUESTION_CHARS} chars) — index limit`));
  }

  if (!rows.length) {
    console.log(errors ? red(`\nNo items extracted (${errors} source error(s)).`) : green("\nNothing new — no items extracted."));
    await recordRunReport(perSource, 0, errors, startedAt);
    process.exit(errors ? 1 : 0);
  }

  /* taken-down questions (Phase 4 Item D3) must never re-enter the bank.
     Best-effort read: pre-migration DBs lack the table → undefined → the
     upsert is byte-identical to pre-D3 (graceful degradation). */
  let suppressions;
  try {
    suppressions = await runSql(
      `select question_text from public.takedown_suppressions where question_text is not null`
    );
  } catch {
    suppressions = undefined;
  }
  if (Array.isArray(suppressions) && suppressions.length) {
    console.log(`  applying ${suppressions.length} takedown suppression(s)`);
  }

  const sql = buildUpsertSql(rows, suppressions);
  try {
    await runSql(sql);
  } catch (e) {
    console.error(red(`\nUpsert failed: ${e.message}`));
    await recordRunReport(perSource, 0, errors + 1, startedAt);
    process.exit(1);
  }

  /* distribute the upserted count across sources proportionally to what each
     extracted — per-source `inserted` is what the run-log card shows. The last
     successful source absorbs the rounding remainder (buildUpsertSql dedupes
     across sources, so exact attribution is approximate). */
  const okIds = Object.keys(perSource).filter((k) => !perSource[k].error);
  const extractionTotal = okIds.reduce((n, k) => n + (perSource[k].extracted ?? 0), 0);
  let insertedLeft = rows.length;
  okIds.forEach((k, i) => {
    const p = perSource[k];
    if (i === okIds.length - 1) {
      p.inserted = insertedLeft;
    } else {
      const share = extractionTotal > 0 ? (p.extracted ?? 0) / extractionTotal : 1 / okIds.length;
      const n = Math.min(insertedLeft, Math.floor(rows.length * share));
      p.inserted = n;
      insertedLeft -= n;
    }
  });

  await recordRunReport(perSource, rows.length, errors, startedAt);
  console.log(green(`\n✓ Upserted ${rows.length} new draft question(s). Review them in Admin → Review inbox.`));
  if (errors) process.exit(1);
}

main().catch((e) => {
  console.error(red(e.message));
  process.exit(1);
});
