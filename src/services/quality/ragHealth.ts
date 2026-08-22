/* RAG health — knowledge-base retrieval monitoring, document stats, histograms, digests */

import { getSupabaseClient } from "../cloud";

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

