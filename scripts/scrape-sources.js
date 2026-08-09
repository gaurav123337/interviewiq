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
import { extractItems, buildUpsertSql } from "./scrape-lib.js";

const API = "https://api.supabase.com/v1";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

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
      `select id, url, type, field_id, level, max_items, enabled, note
       from public.scraper_sources where enabled = true order by id`
    );
    if (Array.isArray(rows) && rows.length) {
      return rows.map((r) => ({
        id: r.id, url: r.url, type: r.type ?? "markdown",
        fieldId: r.field_id, level: r.level, maxItems: r.max_items ?? 20, note: r.note ?? ""
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

  const all = [];
  let errors = 0;
  for (const source of sources) {
    try {
      console.log(`  ↳ ${source.id ?? source.url} — ${source.url}`);
      const res = await fetch(source.url, { headers: { "User-Agent": "interviewiq-scraper/1.0 (+github.com/gaurav123337/interviewiq)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = source.type === "json" ? await res.json() : await res.text();
      const items = extractItems(body, source).slice(0, source.maxItems ?? 20);
      console.log(`     extracted ${items.length} item(s)`);
      all.push(...items);
    } catch (e) {
      errors++;
      console.error(red(`  ✗ ${source.id ?? source.url}: ${e.message}`));
    }
  }

  /* dedupe within the batch by question text */
  const seen = new Set();
  const rows = all.filter((r) => {
    const k = r.question.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!rows.length) {
    console.log(errors ? red(`\nNo items extracted (${errors} source error(s)).`) : green("\nNothing new — no items extracted."));
    process.exit(errors ? 1 : 0);
  }

  const sql = buildUpsertSql(rows);
  try {
    await runSql(sql);
  } catch (e) {
    console.error(red(`\nUpsert failed: ${e.message}`));
    process.exit(1);
  }

  console.log(green(`\n✓ Upserted ${rows.length} new draft question(s). Review them in Admin → Review inbox.`));
  if (errors) process.exit(1);
}

main().catch((e) => {
  console.error(red(e.message));
  process.exit(1);
});
