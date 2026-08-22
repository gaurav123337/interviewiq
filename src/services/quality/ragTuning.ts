/* RAG tuning playground — simulation, domain breakdown, KB suggestions */

import { getSupabaseClient } from "../cloud";

import { RagCand, RagHealthRow, RagWeeklyDigest } from "./ragHealth";

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

