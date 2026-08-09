/* Bulk question import: parses pasted JSON or CSV into validated question
   drafts for the admin pipeline. Pure + testable. */

import type { LevelId } from "../types";
import { FIELDS, LEVELS } from "../data";

export interface ImportedQuestion {
  fieldId: string;
  level: LevelId;
  question: string;
  answer: string;
  keyPoints: string[];
}

const fieldIds = new Set<string>(FIELDS.map(f => f.id));
const levelIds = new Set<string>(LEVELS.map(l => l.id));

/** Parses a pasted batch: JSON array first, then pipe-separated CSV lines.
    Invalid rows are skipped and returned separately so nothing silently drops. */
export function parseQuestionBatch(text: string): { ok: ImportedQuestion[]; skipped: { line: number; reason: string }[] } {
  const t = text.trim();
  if (!t) return { ok: [], skipped: [] };

  if (t.startsWith("[") || t.startsWith("{")) return parseJson(t);
  return parseCsv(t);
}

function normalizeRow(raw: Record<string, unknown>): ImportedQuestion | string {
  const fieldId = String(raw.fieldId ?? raw.field ?? raw.field_id ?? "").trim();
  const level = String(raw.level ?? raw.levelId ?? raw.level_id ?? "").trim().toLowerCase();
  const question = String(raw.question ?? raw.q ?? "").trim();
  const answer = String(raw.answer ?? raw.a ?? "").trim();
  const kpRaw = raw.keyPoints ?? raw.key_points ?? raw.kp;
  const keyPoints = Array.isArray(kpRaw)
    ? kpRaw.map(k => String(k).trim()).filter(Boolean)
    : String(kpRaw ?? "").split(",").map(k => k.trim()).filter(Boolean);

  if (!question) return "missing question";
  if (!fieldIds.has(fieldId)) return `unknown field "${fieldId}"`;
  if (!levelIds.has(level)) return `unknown level "${level}"`;
  return { fieldId, level: level as LevelId, question, answer, keyPoints };
}

function parseJson(t: string): { ok: ImportedQuestion[]; skipped: { line: number; reason: string }[] } {
  let data: unknown;
  try {
    data = JSON.parse(t);
  } catch {
    /* not valid JSON — fall back to CSV interpretation */
    return parseCsv(t);
  }
  const rows = Array.isArray(data) ? data : [data];
  const ok: ImportedQuestion[] = [];
  const skipped: { line: number; reason: string }[] = [];
  rows.forEach((r, i) => {
    if (!r || typeof r !== "object") { skipped.push({ line: i + 1, reason: "not an object" }); return; }
    const res = normalizeRow(r as Record<string, unknown>);
    if (typeof res === "string") { skipped.push({ line: i + 1, reason: res }); return; }
    ok.push(res);
  });
  return { ok, skipped };
}

function parseCsv(t: string): { ok: ImportedQuestion[]; skipped: { line: number; reason: string }[] } {
  const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const ok: ImportedQuestion[] = [];
  const skipped: { line: number; reason: string }[] = [];
  /* optional header detection: only a line starting with "field" as the first column
     is treated as a header — data rows never match */
  const first = lines[0]?.toLowerCase() ?? "";
  const hasHeader = /^\s*(field|fieldid)\s*\|/i.test(first);
  lines.forEach((line, i) => {
    if (hasHeader && i === 0) return;
    const cols = line.split("|").map(c => c.trim());
    if (cols.length < 3) { skipped.push({ line: i + 1, reason: "expected field|level|question|answer|keyPoints" }); return; }
    const res = normalizeRow({
      fieldId: cols[0], level: cols[1], question: cols[2],
      answer: cols[3] ?? "", keyPoints: cols[4] ?? ""
    });
    if (typeof res === "string") { skipped.push({ line: i + 1, reason: res }); return; }
    ok.push(res);
  });
  return { ok, skipped };
}
