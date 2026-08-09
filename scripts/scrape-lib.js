#!/usr/bin/env node
/* Dependency-free extraction helpers for the weekly question scraper.
   Kept pure so the same functions can be unit-tested from vitest. */

/** Normalizes a raw scraped item into the question schema, or null if unusable. */
export function normalizeItem(raw, source) {
  const fieldId = String(raw.fieldId ?? raw.field ?? raw.field_id ?? source.fieldId ?? "").trim();
  const level = String(raw.level ?? raw.levelId ?? raw.level_id ?? source.level ?? "").trim().toLowerCase();
  const question = String(raw.question ?? raw.q ?? "").trim();
  const answer = String(raw.answer ?? raw.a ?? "").trim();
  if (!question || !fieldId || !level) return null;
  const kpRaw = raw.keyPoints ?? raw.key_points ?? raw.kp ?? source.keyPoints ?? [];
  const keyPoints = Array.isArray(kpRaw)
    ? kpRaw.map((k) => String(k).trim()).filter(Boolean)
    : String(kpRaw ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  return { fieldId, level, question, answer, keyPoints };
}

/** Extracts items from a parsed JSON body. Supports { questions: [...] }, { items: [...] }, or a bare array. */
export function extractFromJson(body, source) {
  const arr = Array.isArray(body)
    ? body
    : Array.isArray(body?.questions)
      ? body.questions
      : Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body?.data)
          ? body.data
          : null;
  if (!arr) return [];
  return arr.map((raw) => normalizeItem(raw, source)).filter(Boolean);
}

/** Extracts question blocks from HTML using simple regex blocks.
    Expects <li>/<p> items, or blocks containing a "?" — best-effort without a DOM parser. */
export function extractFromHtml(html, source) {
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    const q = line.replace(/^[\d.)\-\*\u2022\s]+/, "").trim();
    if (!q.includes("?") || q.length < 15) continue;
    items.push(normalizeItem({ question: q, answer: "" }, source));
  }
  return items.filter(Boolean);
}

/** Generic entry point: picks the extractor by source.type. */
export function extractItems(body, source) {
  const type = source.type ?? "json";
  if (type === "json") return extractFromJson(body, source);
  if (type === "html" || type === "markdown") return extractFromHtml(String(body), source);
  return [];
}

/** JSON → SQL-safe string literal (escapes single quotes and backslashes). */
export function sqlStr(v) {
  return "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}

/** Builds an idempotent upsert statement (new rows only — ON CONFLICT by question text). */
export function buildUpsertSql(rows) {
  if (!rows.length) return "";
  const values = rows
    .map((r) => `(${sqlStr(r.fieldId)}, ${sqlStr(r.level)}, ${sqlStr(r.question)}, ${sqlStr(r.answer)}, '${JSON.stringify(r.keyPoints).replace(/'/g, "''")}'::jsonb, false)`)
    .join(",\n  ");
  return `insert into public.published_questions (field_id, level, question, answer, key_points, published)
values
  ${values}
on conflict (question) do nothing;`;
}
