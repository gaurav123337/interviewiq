#!/usr/bin/env node
/* Weekly question-bank scraper.
 *
 * Reads content/sources.json, fetches each enabled source, extracts question
 * items, and upserts them as DRAFTS into published_questions (deduped by
 * question text). Runs on a schedule via .github/workflows/scrape-weekly.yml
 * and can be triggered manually with workflow_dispatch.
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

async function main() {
  if (!token || !projectRef) {
    console.error(red("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF."));
    process.exit(1);
  }

  const configPath = fileURLToPath(new URL("../content/sources.json", import.meta.url));
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const sources = (config.sources ?? []).filter((s) => s.enabled);

  console.log(`Scraping ${sources.length} enabled source(s) → ${projectRef} (drafts)...`);

  const all = [];
  let errors = 0;
  for (const source of sources) {
    try {
      console.log(`  ↳ ${source.id} — ${source.url}`);
      const res = await fetch(source.url, { headers: { "User-Agent": "interviewiq-scraper/1.0 (+github.com/gaurav123337/interviewiq)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = source.type === "json" ? await res.json() : await res.text();
      const items = extractItems(body, source).slice(0, source.maxItems ?? 20);
      console.log(`     extracted ${items.length} item(s)`);
      all.push(...items);
    } catch (e) {
      errors++;
      console.error(red(`  ✗ ${source.id}: ${e.message}`));
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

  console.log(green(`\n✓ Upserted ${rows.length} new draft question(s). Review them in Admin → Question bank.`));
  if (errors) process.exit(1);
}

main().catch((e) => {
  console.error(red(e.message));
  process.exit(1);
});
