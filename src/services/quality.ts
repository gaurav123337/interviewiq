/* Admin Content Quality Center — scoreboard, calibration, staleness.
   The RPCs aggregate per-question performance + feedback server-side; the
   composite quality score is computed here as a pure function so it's
   unit-testable. Staleness is merged from published_questions.updated_at. */

import type { LevelId } from "../types";
import { getSupabaseClient } from "./cloud";

export interface QualityRow {
  question: string;
  fieldId: string;
  level: string;
  attempts: number;
  avgScore: number;
  missRate: number;
  passRate: number;
  ups: number;
  downs: number;
  flags: number;
  lastSeen: string | null;
}

export interface FeedbackFeedRow {
  question: string;
  fieldId: string | null;
  level: string | null;
  kind: "up" | "down" | "flag";
  reason: string | null;
  createdAt: string;
}

export type QualityBand = "healthy" | "watch" | "fix";

/** 0-100 composite. Freshness uses days since last edit/review (null = unknown → fresh). */
export function qualityScore(r: QualityRow, staleDays: number | null): number {
  let s = 0;
  /* performance: 0-40 — avg score on the 0-5 scale */
  s += 8 * r.avgScore;
  /* difficulty: 0-20 — pass rate inside 30-90% is ideal; too easy or too hard costs */
  const p = r.passRate;
  if (p >= 30 && p <= 90) s += 20;
  else if (p < 30) s += 20 * (p / 30);
  else s += Math.max(0, 20 * ((100 - p) / 10));
  /* feedback: 0-20 — ups help, downs hurt 2x, flags hurt 4x */
  s += Math.max(0, Math.min(20, 20 + r.ups - 2 * r.downs - 4 * r.flags));
  /* freshness: 0-20 — under 90 days is fresh; decays ~1pt per month after */
  if (staleDays == null || staleDays <= 90) s += 20;
  else s += Math.max(0, 20 - (staleDays - 90) / 30);
  return Math.round(Math.max(0, Math.min(100, s)));
}

export function qualityBand(score: number): QualityBand {
  return score >= 80 ? "healthy" : score >= 60 ? "watch" : "fix";
}

/** Days since the question was last edited/reviewed. Null when unknown. */
export function stalenessDays(updatedAt: string | null): number | null {
  if (!updatedAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000));
}

/** Merge performance rows with the published bank (for updated_at) and sort worst-first. */
export function mergeQuality(
  rows: QualityRow[],
  bank: { question: string; updatedAt: string | null }[]
): (QualityRow & { staleDays: number | null; score: number; band: QualityBand })[] {
  const updatedByQ = new Map(bank.map(b => [b.question, b.updatedAt]));
  return rows
    .map(r => {
      const staleDays = stalenessDays(updatedByQ.get(r.question) ?? null);
      const score = qualityScore(r, staleDays);
      return { ...r, staleDays, score, band: qualityBand(score) };
    })
    .sort((a, b) => a.score - b.score || b.attempts - a.attempts);
}

export async function adminQuestionQuality(): Promise<QualityRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_question_quality");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    question: r.question as string,
    fieldId: r.field_id as string,
    level: r.level as LevelId,
    attempts: Number(r.attempts ?? 0),
    avgScore: Number(r.avg_score ?? 0),
    missRate: Number(r.miss_rate ?? 0),
    passRate: Number(r.pass_rate ?? 0),
    ups: Number(r.ups ?? 0),
    downs: Number(r.downs ?? 0),
    flags: Number(r.flags ?? 0),
    lastSeen: (r.last_seen as string | null) ?? null
  }));
}

export async function adminFeedbackFeed(limit = 50): Promise<FeedbackFeedRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_feedback_feed", { max_rows: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    question: r.question as string,
    fieldId: (r.field_id as string | null) ?? null,
    level: (r.level as string | null) ?? null,
    kind: r.kind as FeedbackFeedRow["kind"],
    reason: (r.reason as string | null) ?? null,
    createdAt: r.created_at as string
  }));
}

/** Mark a question reviewed — restarts the staleness clock, logs a refresh entry. */
export async function touchQuestion(id: number): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.rpc("touch_question", { p_id: id });
  if (error) throw new Error(error.message);
}

/* ---------- Coding scoreboard (playground problems) ---------- */

export interface CodingQualityRow {
  problemId: string;
  attempts: number;
  passes: number;
  passRate: number;
  lastSeen: string | null;
}

export async function adminCodingQuality(): Promise<CodingQualityRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_coding_quality");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    problemId: r.problem_id as string,
    attempts: Number(r.attempts ?? 0),
    passes: Number(r.passes ?? 0),
    passRate: Number(r.pass_rate ?? 0),
    lastSeen: (r.last_seen as string | null) ?? null
  }));
}
