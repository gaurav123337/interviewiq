#!/usr/bin/env node
/* AI draft-cleaner — the "AI tutor replaces the content team" step of
 * docs/question-bank-expansion.md (P3). Reads unpublished drafts that lack an
 * answer or haven't been cleaned, sends them to an OpenAI-compatible chat
 * endpoint, and writes back AI-ORIGINAL answers + keyPoints + difficulty +
 * company tags. Strict-JSON validated; unparsable output is never written.
 *
 * Optional by design: without AI_CLEAN_KEY the script exits 0 and changes
 * nothing, so a free-tier project never breaks.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/ai-clean.js [--dry-run]
 *
 * Env:
 *   AI_CLEAN_KEY   — OpenAI-compatible key (required to actually run)
 *   AI_CLEAN_BASE  — base URL, default https://api.openai.com/v1
 *   AI_CLEAN_MODEL — model, default gpt-4o-mini
 *   AI_CLEAN_MAX   — drafts cleaned per run, default 40
 */

import { buildCleanPrompt, parseCleanJson, applyClean } from "./ai-clean-lib.js";
import { altProvider, loadAiProviderConfig } from "./ai-config.js";
import { sqlStr } from "./scrape-lib.js";

const API = "https://api.supabase.com/v1";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const maxItems = Number(process.env.AI_CLEAN_MAX ?? 40) || 40;
const dryRun = process.argv.includes("--dry-run");

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One chat completion → parsed strict JSON (or null). */
async function cleanOne(item) {
  const res = await fetch(`${aiBase}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: aiModel,
      temperature: 0.2,
      max_tokens: 700,
      messages: [{ role: "user", content: buildCleanPrompt(item) }]
    })
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const body = await res.json();
  return parseCleanJson(body?.choices?.[0]?.message?.content);
}

async function main() {
  if (!token || !projectRef) {
    console.error(red("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF."));
    process.exit(1);
  }
  /* provider config is editable from the Admin dashboard (Supabase row);
     env AI_CLEAN_* are the legacy fallback */
  const aiCfg = await loadAiProviderConfig({ token, projectRef });
  let aiKey = aiCfg.key;
  let aiBase = aiCfg.base;
  let aiModel = aiCfg.model;
  if (aiCfg.source === "supabase") console.log(green(`AI provider from Supabase (model ${aiModel}, base ${aiBase}).`));
  if (!aiKey) {
    console.log("No AI key configured — skipping AI cleaning (optional step). Set it in Admin → Secrets → AI pipeline.");
    process.exit(0);
  }

  const rows = await runSql(`select id, field_id, level, question, answer, key_points, meta
    from public.published_questions
    where published = false
      and (meta is null or meta->>'ai_cleaned' is null or meta->>'needs_ai' = 'true')
    order by created_at
    limit ${maxItems}`);

  if (!Array.isArray(rows) || !rows.length) {
    console.log(green("No drafts need cleaning."));
    process.exit(0);
  }
  console.log(`Cleaning ${rows.length} draft(s) → ${projectRef}${dryRun ? " (DRY RUN — no API calls, no writes)" : ""}`);
  if (dryRun) {
    for (const r of rows.slice(0, 10)) console.log(`  · [${r.field_id}/${r.level}] ${String(r.question).slice(0, 90)}`);
    process.exit(0);
  }

  let ok = 0;
  let failed = 0;
  let dedup = 0;
  let authFallbackUsed = false;
  for (const row of rows) {
    try {
      const clean = await cleanOne({ question: row.question, fieldId: row.field_id, level: row.level, meta: row.meta });
      const applied = applyClean({}, clean);
      if (!applied) throw new Error("unparsable or invalid clean JSON");
      const mergedMeta = { ...(row.meta ?? {}), ai_cleaned: true, ai_cleaned_at: new Date().toISOString() };
      if (applied.difficulty) mergedMeta.difficulty = applied.difficulty;
      if (applied.company) mergedMeta.company = applied.company;
      const sql = `update public.published_questions set
        question = ${sqlStr(applied.question)},
        answer = ${sqlStr(applied.answer)},
        key_points = '${JSON.stringify(applied.keyPoints).replace(/'/g, "''")}'::jsonb,
        meta = '${JSON.stringify(mergedMeta).replace(/'/g, "''")}'::jsonb
        where id = ${Number(row.id)}`;
      await runSql(sql);
      ok++;
      console.log(`  ✓ id=${row.id} — ${applied.question.slice(0, 70)}`);
    } catch (e) {
      /* self-heal: the app-saved key was rejected (401/403 — e.g. the model
         name got pasted into the key field) → retry this row once with the
         legacy env key instead of failing the whole run */
      if (/^AI HTTP (401|403)$/.test(String(e.message)) && !authFallbackUsed) {
        const alt = altProvider(aiCfg);
        if (alt) {
          aiKey = alt.key;
          aiBase = alt.base;
          aiModel = alt.model;
          authFallbackUsed = true;
          console.warn(yellow(`  ↻ id=${row.id} — app-saved key rejected (${e.message}); retrying with the env AI_CLEAN_KEY fallback`));
          continue;
        }
      }
      /* the AI's reworded question already exists in the bank (unique key) —
         that's dedup working, not a failure: drop the redundant draft */
      if (/23505|duplicate key/i.test(String(e.message))) {
        dedup++;
        try {
          await runSql(`delete from public.published_questions where id = ${Number(row.id)}`);
          console.log(yellow(`  ↺ id=${row.id} — duplicate of an existing question — removed`));
          continue;
        } catch { /* best effort — fall through to ai_failed marking */ }
      }
      failed++;
      console.warn(yellow(`  ✗ id=${row.id}: ${e.message}`));
      try {
        await runSql(`update public.published_questions set meta = meta || '{"ai_failed":true}'::jsonb where id = ${Number(row.id)}`);
      } catch { /* best effort */ }
    }
    await sleep(200); /* polite rate limit */
  }

  console.log(green(`\n✓ Cleaned ${ok} draft(s)${dedup ? `, ${dedup} were duplicates (removed)` : ""}${failed ? `, ${failed} failed (marked ai_failed — review manually)` : ""}. Review in Admin → Review inbox.`));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(red(e.message));
  process.exit(1);
});
