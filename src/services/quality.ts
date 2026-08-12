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

export interface CoachGapRow {
  topic: string;
  discussions: number;
  users: number;
  lastSeen: string | null;
}

export async function adminCoachGaps(maxRows = 50): Promise<CoachGapRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_coach_gaps", { max_rows: maxRows });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    topic: r.topic as string,
    discussions: Number(r.discussions ?? 0),
    users: Number(r.users ?? 0),
    lastSeen: (r.last_seen as string | null) ?? null
  }));
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

/* ---------- RAG health (knowledge-base retrieval) ---------- */

export interface RagCand {
  /** Raw vector similarity of one candidate chunk. */
  s: number;
  /** Gate state at recording time: 0 below min-sim, 1 grounded, 2 gate-rejected. */
  st: 0 | 1 | 2;
  /** Lexical overlap score (0-1) — recorded so the tuning playground can
      re-derive the grounding decision exactly for any (minSim, hardFloor). */
  lx?: number;
}

export interface RagHealthRow {
  query: string;
  hits: number;
  topSim: number;
  grounded: boolean;
  /** Candidates the concept gate dropped (high sim, no shared concepts). */
  gateRejects?: number;
  /** Candidates below the similarity cutoff entirely. */
  belowMin?: number;
  /** The field/level the question was asked in (null for general sessions). */
  field?: string | null;
  level?: string | null;
  /** Per-candidate similarity + gate state — feeds the histogram + playground. */
  cands?: RagCand[];
  at: string;
}

/** Recent knowledge-base retrievals (queued as rag_event by the tutor/coach). */
export async function adminRagHealth(maxRows = 40): Promise<RagHealthRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_rag_health", { max_rows: maxRows });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    query: (r.query as string) ?? "",
    hits: Number(r.hits ?? 0),
    topSim: Number(r.top_sim ?? 0),
    grounded: Boolean(r.grounded),
    gateRejects: Number(r.gate_rejects ?? 0),
    belowMin: Number(r.below_min ?? 0),
    field: (r.field as string | null) ?? null,
    level: (r.level as string | null) ?? null,
    cands: ((r.cands as unknown[] | null) ?? []).map(c => {
      const o = c as Record<string, unknown>;
      return { s: Number(o.s ?? 0), st: (o.st ?? 0) as 0 | 1 | 2, lx: o.lx == null ? undefined : Number(o.lx) };
    }),
    at: r.at as string
  }));
}

export interface RagDocRow {
  documentId: number;
  retrievals: number;
  avgSim: number;
  lastSeen: string | null;
}

/** Per-document retrieval stats — which uploaded PDF actually answers queries. */
export async function adminRagDocuments(): Promise<RagDocRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_rag_documents");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    documentId: Number(r.document_id ?? 0),
    retrievals: Number(r.retrievals ?? 0),
    avgSim: Number(r.avg_sim ?? 0),
    lastSeen: (r.last_seen as string | null) ?? null
  }));
}

/** Aggregate the recent retrieval log into the health signals shown to admins.
    With a `threshold`, grounded rows are reclassified by top similarity against
    that cutoff (the RAG-health explorer); without one, the stored flag is used. */
export function ragHealthSummary(
  rows: RagHealthRow[],
  threshold: number | null = null
): { total: number; groundedRate: number; emptyRate: number; avgTopSim: number } {
  const total = rows.length;
  if (!total) return { total: 0, groundedRate: 0, emptyRate: 0, avgTopSim: 0 };
  const grounded = rows.filter(r => (threshold == null ? r.grounded : r.topSim >= threshold)).length;
  const empty = rows.filter(r => r.hits === 0).length;
  const avgTopSim = rows.reduce((n, r) => n + r.topSim, 0) / total;
  return {
    total,
    groundedRate: Math.round((grounded / total) * 100),
    emptyRate: Math.round((empty / total) * 100),
    avgTopSim: Math.round(avgTopSim * 100) / 100
  };
}

export interface RagHistBin {
  label: string;
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound (last bin is inclusive to 1). */
  max: number;
  total: number;
  /** Of the rows in this band, how many grounded (respects explorer cutoff). */
  grounded: number;
  /** Of the rows in this band, how many had concept-gate rejections. */
  gated: number;
}

/** Similarity-band histogram of the retrieval log — shows where retrieval
    quality lands relative to the grounding cutoff and the 0.85 hard floor.
    With a `threshold`, grounded is reclassified per-band like the explorer. */
export function ragHistogram(rows: RagHealthRow[], threshold: number | null = null): RagHistBin[] {
  const bands = [
    { label: "< 0.35", min: 0, max: 0.35 },
    { label: "0.35–0.50", min: 0.35, max: 0.5 },
    { label: "0.50–0.65", min: 0.5, max: 0.65 },
    { label: "0.65–0.80", min: 0.65, max: 0.8 },
    { label: "≥ 0.80", min: 0.8, max: 1.01 }
  ];
  return bands.map(b => {
    const inBand = rows.filter(r => r.topSim >= b.min && r.topSim < b.max);
    return {
      label: b.label,
      min: b.min,
      max: b.max,
      total: inBand.length,
      grounded: inBand.filter(r => (threshold == null ? r.grounded : r.topSim >= threshold)).length,
      gated: inBand.filter(r => (r.gateRejects ?? 0) > 0).length
    };
  });
}

export interface RagWeeklyDigest {
  /** Last 7 days. */
  total: number;
  grounded: number;
  empty: number;
  avgTopSim: number;
  gateRejects: number;
  /** Previous 7 days (for deltas). */
  prevTotal: number;
  prevGrounded: number;
  topQueries: { q: string; n: number }[];
  topDocs: { id: number; n: number }[];
}

export interface RagDigestOpts {
  /** Alert when the weekly grounded rate falls below this % (default 60). */
  minGroundedRate?: number;
  /** Alert when the weekly empty-hit rate rises above this % (default 40). */
  maxEmptyRate?: number;
  /** Alert when weekly concept-gate rejections exceed this count (default 10). */
  maxGateRejects?: number;
  /** Delivery webhook (Slack / email bridge) called once per week on breach. */
  webhook?: string;
  /** Also send the FULL weekly digest once per week (not just breaches). */
  sendWeekly?: boolean;
  /** Recipient emails the webhook / email bridge should deliver the digest to. */
  email?: string;
  /** Deliver via the send-rag-digest Edge Function instead of a webhook. */
  nativeEmail?: boolean;
  /** From address used by the email bridge / Edge Function. */
  from?: string;
}

export interface RagDigestAlert {
  severity: "ok" | "warn" | "bad";
  title: string;
  detail: string;
  /** True when the threshold was actually breached (the alert fires). */
  fired: boolean;
}

/** Evaluates a weekly digest against the alert thresholds — pure, unit-tested.
    Healthy checks are returned with fired:false so the UI can show what's green
    alongside what breached; an empty digest yields no alerts at all. */
export function evaluateRagDigest(digest: RagWeeklyDigest | null, opts: RagDigestOpts = {}): RagDigestAlert[] {
  if (!digest || digest.total <= 0) return [];
  const minG = opts.minGroundedRate ?? 60;
  const maxE = opts.maxEmptyRate ?? 40;
  const maxR = opts.maxGateRejects ?? 10;
  const groundedRate = Math.round((digest.grounded / digest.total) * 100);
  const emptyRate = Math.round((digest.empty / digest.total) * 100);
  const alerts: RagDigestAlert[] = [];
  if (groundedRate < minG) {
    alerts.push({ severity: "bad", title: "Grounded rate dropped", detail: `${groundedRate}% of retrievals grounded this week — below the ${minG}% target. Users' questions aren't in the knowledge base.`, fired: true });
  } else {
    alerts.push({ severity: "ok", title: "Grounded rate healthy", detail: `${groundedRate}% grounded this week (target ≥ ${minG}%).`, fired: false });
  }
  if (emptyRate > maxE) {
    alerts.push({ severity: "warn", title: "Empty-hit rate high", detail: `${emptyRate}% of retrievals found no matches — above the ${maxE}% ceiling.`, fired: true });
  }
  if (digest.gateRejects > maxR) {
    alerts.push({ severity: "warn", title: "Concept-gate rejects spiked", detail: `${digest.gateRejects} high-sim candidates were dropped by the concept gate — above ${maxR}. Consider lowering the hard floor.`, fired: true });
  }
  return alerts;
}

/** Suggests a hard floor from the retrieval log: when the concept gate dropped
    high-similarity candidates, the floor is too strict — lower it to the
    highest dropped top-hit so the closest matches still cite. Pure, unit-tested. */
export function suggestHardFloor(
  rows: RagHealthRow[],
  current: number,
  minSim: number
): { value: number; reason: string; changed: boolean } {
  const gated = rows.filter(r => (r.gateRejects ?? 0) > 0);
  if (!gated.length) {
    return { value: current, reason: "No concept-gate rejections in this window — the floor isn't dropping candidates", changed: false };
  }
  const highest = Math.max(...gated.map(r => r.topSim));
  const value = Math.round(Math.min(current, Math.max(minSim, highest)) * 100) / 100;
  const changed = value !== current;
  return {
    value,
    reason: changed
      ? `${gated.length} retrieval(s) had high-sim candidates dropped by the concept gate (top ${highest.toFixed(2)}) — lower the floor to ${value.toFixed(2)} so the closest matches still cite`
      : `${gated.length} retrieval(s) had gate rejections but the highest (${highest.toFixed(2)}) is already at/below the floor — the gate is behaving as tuned`,
    changed
  };
}

/* ------------------------------------------------------------------ */
/* Tuning playground — what WOULD the week look like at other cutoffs   */
/* ------------------------------------------------------------------ */

/** A single playground cell: the week reclassified at one (minSim, hardFloor). */
export interface TuningCell {
  minSim: number;
  hardFloor: number;
  total: number;
  grounded: number;
  /** Concept-gate rejections that WOULD occur at these thresholds. */
  gateRejects: number;
  groundedRate: number;
}

/** The grounding decision for ONE candidate at arbitrary thresholds — mirrors
    rag.isGrounded so the simulator stays exact without importing the service
    (keeps quality.ts free of cycles; rag.ts already imports this module's type).
    `lx` is the recorded lexical score; when it's missing (pre-upgrade events)
    we fall back to the recorded state: grounded rows keep grounding (they had
    concept signal at recording time), gate-rejected rows only ground if the
    new hard floor covers them. */
export function simCandidateGrounded(
  s: number,
  st: 0 | 1 | 2,
  lx: number | undefined,
  minSim: number,
  hardFloor: number
): boolean {
  if (s < minSim) return false;
  if (lx != null) return lx > 0 || s >= hardFloor;
  /* no lexical score recorded (older events) — approximate from the state */
  if (st === 1) return true;
  return s >= hardFloor;
}

/** Reclassifies the recent retrieval log against a grid of candidate
    (minSim, hardFloor) cutoffs — the "tuning playground". For each cell it
    recomputes which rows would have grounded (any candidate citable) and how
    many concept-gate rejections would occur, so admins can see where the week
    lands before publishing a change. Pure — unit-tested. */
export function simulateTuning(
  rows: RagHealthRow[],
  minSims: number[],
  hardFloors: number[]
): TuningCell[] {
  const cells: TuningCell[] = [];
  for (const minSim of minSims) {
    for (const hardFloor of hardFloors) {
      let grounded = 0;
      let gateRejects = 0;
      for (const r of rows) {
        const cands: RagCand[] = (r.cands ?? []).length
          ? r.cands!
          /* no per-candidate data (older events) → one synthetic candidate so
             the row still contributes its recorded outcome */
          : [{ s: r.topSim, st: r.grounded ? 1 : 2, lx: undefined }];
        let rowGrounded = false;
        for (const c of cands) {
          if (simCandidateGrounded(c.s, c.st, c.lx, minSim, hardFloor)) { rowGrounded = true; break; }
        }
        for (const c of cands) {
          if (c.s >= minSim && !simCandidateGrounded(c.s, c.st, c.lx, minSim, hardFloor)) gateRejects++;
        }
        if (rowGrounded) grounded++;
      }
      cells.push({
        minSim,
        hardFloor,
        total: rows.length,
        grounded,
        gateRejects,
        groundedRate: rows.length ? Math.round((grounded / rows.length) * 100) : 0
      });
    }
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Per-domain breakdown — which fields/levels ground best               */
/* ------------------------------------------------------------------ */

/** Picks the playground cell to recommend: highest grounded rate, ties broken
    by fewest gate rejections, then closest to the current pair. Pure — the
    "Apply best" one-click action in the admin RAG health tab. */
export function bestTuningCell(
  cells: TuningCell[],
  currentMinSim: number,
  currentHardFloor: number
): TuningCell | null {
  if (!cells.length) return null;
  let best = cells[0];
  for (const c of cells) {
    if (c.groundedRate > best.groundedRate) { best = c; continue; }
    if (c.groundedRate === best.groundedRate) {
      if (c.gateRejects < best.gateRejects) { best = c; continue; }
      if (c.gateRejects === best.gateRejects) {
        const dc = Math.abs(c.minSim - currentMinSim) + Math.abs(c.hardFloor - currentHardFloor);
        const db = Math.abs(best.minSim - currentMinSim) + Math.abs(best.hardFloor - currentHardFloor);
        if (dc < db) best = c;
      }
    }
  }
  return best;
}

export interface RagDomainRow {
  /** "field" or "level" — the aggregation dimension. */
  dimension: string;
  /** The field id or level id the retrieval happened in. */
  name: string;
  retrievals: number;
  grounded: number;
  empty: number;
  avgTopSim: number;
  gateRejects: number;
}

/** Grounding health per field and per level — where the knowledge base
    answers well and where users' questions miss it. */
export async function adminRagDomains(): Promise<RagDomainRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_rag_domains");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    dimension: String(r.dimension ?? ""),
    name: String(r.name ?? ""),
    retrievals: Number(r.retrievals ?? 0),
    grounded: Number(r.grounded ?? 0),
    empty: Number(r.empty ?? 0),
    avgTopSim: Number(r.avg_top_sim ?? 0),
    gateRejects: Number(r.gate_rejects ?? 0)
  }));
}

export interface KbSuggestionRow {
  topic: string;
  field: string;
  level: string;
  requests: number;
  latest: string;
}

/** Topics users asked to add to the knowledge base (queued by the coach's
    suggest-a-topic button). Grouped by topic — most-requested first. */
export async function adminKbSuggestions(): Promise<KbSuggestionRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_kb_suggestions");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    topic: String(r.topic ?? ""),
    field: String(r.field ?? "general"),
    level: String(r.level ?? "general"),
    requests: Number(r.requests ?? 0),
    latest: r.latest as string
  }));
}

/** Weekly RAG digest — last-7-days aggregates + week-over-week deltas + top
    queries/docs. Returns null when the RPC is missing or has no data. */
export async function adminRagWeeklyDigest(): Promise<RagWeeklyDigest | null> {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.rpc("admin_rag_weekly_digest");
  if (error || !data || !Array.isArray(data) || !data.length) return null;
  const r = data[0] as Record<string, unknown>;
  return {
    total: Number(r.total ?? 0),
    grounded: Number(r.grounded ?? 0),
    empty: Number(r.empty ?? 0),
    avgTopSim: Number(r.avg_top_sim ?? 0),
    gateRejects: Number(r.gate_rejects ?? 0),
    prevTotal: Number(r.prev_total ?? 0),
    prevGrounded: Number(r.prev_grounded ?? 0),
    topQueries: ((r.top_queries as unknown[] | null) ?? []).map((q: unknown) => {
      const o = q as Record<string, unknown>;
      return { q: String(o.q ?? ""), n: Number(o.n ?? 0) };
    }),
    topDocs: ((r.top_docs as unknown[] | null) ?? []).map((d: unknown) => {
      const o = d as Record<string, unknown>;
      return { id: Number(o.id ?? 0), n: Number(o.n ?? 0) };
    })
  };
}
