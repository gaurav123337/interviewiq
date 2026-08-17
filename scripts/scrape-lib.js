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
  /* provenance + enrichment metadata — titles/topics/urls only, never verbatim bodies */
  const company = raw.company ?? source.company ?? null;
  const difficulty = raw.difficulty ?? source.difficulty ?? null;
  const meta = {
    ...(raw.meta && typeof raw.meta === "object" ? raw.meta : {}),
    ...(source.meta && typeof source.meta === "object" ? source.meta : {})
  };
  if (company) meta.company = company;
  if (difficulty) meta.difficulty = difficulty;
  if (raw.url) meta.url = String(raw.url);
  return {
    fieldId, level, question, answer, keyPoints,
    meta, sourceId: String(source.id ?? ""), sourceUrl: String(source.url ?? "")
  };
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

/* ---------- company/pattern lists (LeetCode-style mirrors, titles only) ---------- */

const PROBLEM_BULLET = /^-\s*\[(?:\d+\.\s*)?([^\]]+)\]\((https?:\/\/[^)]+)\)\s*(Easy|Medium|Hard)?\s*$/i;
/* markdown table row: `| occ | [Title](url) | Difficulty | ...` */
const PROBLEM_TABLE = /^\|\s*\d*\s*\|\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\|\s*(Easy|Medium|Hard)?\s*\|/i;
const GROUP_HEADING = /^#{1,6}\s+(.+)$/;
const DIFFICULTY_MAP = { easy: 1, medium: 2, hard: 3 };
/* generic instruction headings that are not questions (System Design Primer) */
const NON_QUESTION_HEADING = /^(step \d+|learn|prep|coding resource|motivation|table of contents|references?|further reading|contributing|acknowledgements|notes)\b/i;

/** Extracts company/pattern-grouped problem titles from a markdown list.
    Only titles, URLs and difficulty are kept (facts — never problem statements),
    so the output is attribution-safe metadata for the AI cleaner to build on. */
export function extractCompanyList(md, source) {
  /* normalize like cleanMarkdown but KEEP `[text](url)` links — the problem
     rows carry their URLs and must not have them stripped */
  const lines = String(md)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items = [];
  let group = "";
  for (const line of lines) {
    const h = line.match(GROUP_HEADING);
    if (h) {
      group = h[1].replace(/^\d+\.\s*/, "").trim();
      continue;
    }
    const m = line.match(PROBLEM_BULLET) || line.match(PROBLEM_TABLE);
    if (!m) continue;
    const title = m[1].replace(/^\d+\.\s*/, "").trim();
    if (title.length < 3) continue;
    const difficulty = DIFFICULTY_MAP[(m[3] ?? "").toLowerCase()] ?? null;
    const meta = { group, groupType: source.groupAs ?? "company", url: m[2] };
    const item = normalizeItem({ question: title, answer: "", difficulty, meta }, source);
    /* company lists repeat titles heavily — keep the first occurrence per group */
    if (item && !items.some((x) => x.question === item.question && x.meta?.group === group)) items.push(item);
  }
  return items;
}

/* ---------- Hacker News (official Algolia API — keyless, public) ---------- */

/** Filters HN story hits down to interview-relevant threads. */
function isInterviewRelevant(title) {
  return /interview|system design|behavioral|salary|offer|resume|coding (round|test|challenge)/i.test(title);
}

/** Extracts questions from an Algolia HN search response (`{ hits: [...] }`).
    Keeps the thread URL + engagement as metadata so drafts have provenance. */
export function extractFromHn(body, source) {
  const hits = Array.isArray(body?.hits) ? body.hits : [];
  const items = [];
  for (const hit of hits) {
    const title = String(hit.title ?? "").trim();
    if (!title || !isInterviewRelevant(title)) continue;
    const meta = {
      hnId: String(hit.objectID ?? ""),
      url: String(hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`),
      points: Number(hit.points ?? 0),
      comments: Number(hit.num_comments ?? 0),
      author: String(hit.author ?? ""),
      source: "hackernews"
    };
    const item = normalizeItem({ question: title, answer: "", meta }, source);
    if (item) items.push(item);
  }
  return items;
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
const BARE_Q = (depth) => new RegExp("^#{" + depth + ",6}\\s+(.+)$");
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
  /* heading depth: `#### Topic` by default; sources like the System Design
     Primer use `### Design X` — set headingDepth 3 + questionFromHeading + a
     headingPrefix ("Design ") so only actual design topics become questions
     (answers stay AI-original, never copied). */
  const bareQ = BARE_Q(Math.min(6, Math.max(3, Number(source.headingDepth ?? 4))));
  const questionFromHeading = !!source.questionFromHeading;
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
    } else if (body && !questionFromHeading) {
      /* `#### Topic` + body: the body is the actual question text.
         questionFromHeading sources keep the topic title only — the body
         is never copied, so AI-original answers stay clean legally. */
      question = question + ": " + body;
    }
    question = question.replace(/:\s*$/, "").trim();
    if (question.length >= 12) {
      items.push(normalizeItem(
        { question, answer: answer || "", meta: questionFromHeading ? { topicOnly: true } : undefined },
        source
      ));
    }
    cur = null;
  };

  for (const line of lines) {
    const m = numberedMode
      ? line.match(NUMBERED_Q)
      : line.match(bareQ) || line.match(INLINE_Q);
    if (m) {
      /* in topic-only mode, only real topics become questions: sources can pin
         a headingPrefix (e.g. "Design ") — otherwise generic instruction
         headings (Step 1, Learn…) are skipped */
      const headingText = (m[1] || m[2] || "").trim();
      const prefix = source.headingPrefix ? String(source.headingPrefix) : null;
      const skipHeading = questionFromHeading && (prefix
        ? !headingText.startsWith(prefix)
        : NON_QUESTION_HEADING.test(headingText));
      if (skipHeading) {
        flush();
        cur = null;
        continue;
      }
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
  if (type === "company-list") return extractCompanyList(String(body), source);
  if (type === "hackernews") return extractFromHn(body, source);
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
    .map((r) => `(${sqlStr(r.fieldId)}, ${sqlStr(r.level)}, ${sqlStr(r.question)}, ${sqlStr(r.answer)}, '${JSON.stringify(r.keyPoints).replace(/'/g, "''")}'::jsonb, ${sqlStr(r.sourceId ?? "")}, ${sqlStr(r.sourceUrl ?? "")}, '${JSON.stringify(r.meta ?? {}).replace(/'/g, "''")}'::jsonb, false)`)
    .join(",\n  ");
  return `insert into public.published_questions (field_id, level, question, answer, key_points, source_id, source_url, meta, published)
values
  ${values}
on conflict (question) do nothing;`;
}
