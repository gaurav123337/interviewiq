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

/* difficulty emoji the data-science theory list appends to questions
   (👶 ⭐️ 🚀 — including ZWJ + variation selectors) */
const TRAILING_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{200D}\u{FE0F}]+$/gu;

/** Cleans a raw markdown source into plain text lines (tags, links, emphasis stripped). */
export function cleanMarkdown(md) {
  return String(md)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") /* links keep their text */
    .replace(/\*\*|__|`/g, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

const NUMBERED_Q = /^\d+\.\s*#+\s+(.+)$/;
const BARE_Q = /^#{4,6}\s+(.+)$/;
const INLINE_Q = /^\*{1,2}Q[:.)]\s*(.+)$|^Q[:.)]\s*(.+)$/;

/** Extracts question blocks from markdown. Supports two real-world styles:
    - `N. ### Question` followed by an answer body (sudheerj question banks)
    - `#### Topic` followed by a question sentence (backend-question lists)
    Falls back to line-based `?` scanning when no marker style is found. */
export function extractFromMarkdown(md, source) {
  const lines = cleanMarkdown(md);
  /* If the document uses numbered questions, bare headings inside answers
     (e.g. sudheerj's `#### call`) are answer content — not questions. */
  const numberedMode = lines.some((l) => NUMBERED_Q.test(l));
  const items = [];
  let cur = null; /* { numbered, heading, body: [] } */

  const flush = () => {
    if (!cur) return;
    let question = cur.heading;
    let answer = "";
    const body = cur.body.join(" ")
      .replace(/\(\s*\)/g, "")
      .replace(/\b(Resources|References)\b/g, " ")
      .replace(/\s+/g, " ").trim();
    if (cur.numbered) {
      /* heading is the full question; the body is the model answer */
      answer = body;
    } else if (body) {
      /* `#### Topic` + body: the body is the actual question text */
      question = question + ": " + body;
    }
    question = question.replace(/:\s*$/, "").trim();
    if (question.length >= 12) {
      items.push(normalizeItem({ question, answer: answer || "" }, source));
    }
    cur = null;
  };

  for (const line of lines) {
    const m = numberedMode
      ? line.match(NUMBERED_Q)
      : line.match(BARE_Q) || line.match(INLINE_Q);
    if (m) {
      flush();
      cur = {
        numbered: numberedMode,
        heading: (m[1] || m[2] || "").trim(),
        body: []
      };
      continue;
    }
    /* section headers / TOC — skip entirely in bare mode; keep in numbered
       mode only as answer body (it belongs to the current question) */
    if (!numberedMode && (/^#{2,6}\s+/.test(line) || line === "Table of Contents")) continue;
    if (cur) cur.body.push(line);
  }
  flush();

  /* fallback: bullet/list-style questions (e.g. "**What is X? 👶**") */
  if (!items.length) {
    for (const line of lines) {
      const q = line.replace(/^[\d.)\-\*\u2022\s]+/, "").replace(TRAILING_EMOJI, "").trim();
      if (!q.includes("?") || q.length < 15) continue;
      items.push(normalizeItem({ question: q, answer: "" }, source));
    }
  }
  return items.filter(Boolean);
}

/** Generic entry point: picks the extractor by source.type. */
export function extractItems(body, source) {
  const type = source.type ?? "json";
  if (type === "json") return extractFromJson(body, source);
  if (type === "markdown") return extractFromMarkdown(String(body), source);
  if (type === "html") return extractFromHtml(String(body), source);
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
