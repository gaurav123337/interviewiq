/* trendSignals — the client side of the market-signal engine
   (docs/skill-counselor.md §4). The Counselor shows a stage badge per skill
   (📈 growing / 🆕 emerging / 📉 declining) from the latest sweep, which the
   trends-refresh edge function stores each week. The RPC is public (aggregate,
   non-sensitive); the cache keeps the badges offline. If the table isn't
   applied yet, we degrade to no badges — never a crash. */

import { getSupabaseClient } from "./cloud";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export type TrendStage = "declining" | "nascent" | "emerging" | "growing" | "mainstream";

export interface SkillSignal {
  skill_id: string;
  trend_score: number;
  stage: TrendStage;
  job_mentions_30d: number;
  share: number;
  at: string;
}

export const STAGE_META: Record<TrendStage, { label: string; icon: string }> = {
  declining: { label: "declining", icon: "📉" },
  nascent: { label: "nascent", icon: "🌱" },
  emerging: { label: "emerging", icon: "🆕" },
  growing: { label: "growing", icon: "📈" },
  mainstream: { label: "mainstream", icon: "🔥" }
};

export function getCachedSignals(): Record<string, SkillSignal> {
  return storageGet<Record<string, SkillSignal>>(STORAGE_KEYS.trendSignals, {});
}

export interface UpdateProposalRow {
  id: number;
  skill_id: string;
  kind: "promote" | "review" | "demote";
  reason: string;
  signals: unknown;
  created_at: string;
}

/** Pending structural proposals (admin-only RPC). */
export async function adminPendingProposals(): Promise<UpdateProposalRow[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("admin_pending_proposals");
  if (error) return [];
  return (data ?? []) as UpdateProposalRow[];
}

/** The recorded admin decision on a proposal (MFA-gated RPC). */
export async function adminDecisionProposal(id: number, decision: "accepted" | "ignored"): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Cloud not configured" };
  const { error } = await client.rpc("admin_decision_proposal", { p_id: id, p_decision: decision });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Latest signal per skill (public RPC), cached for offline. Returns {} on
    any error (table not applied yet, offline, etc.) — badges simply hide. */
export async function latestSignals(): Promise<Record<string, SkillSignal>> {
  const cached = getCachedSignals();
  const client = await getSupabaseClient();
  if (!client) return cached;
  try {
    const { data, error } = await client.rpc("latest_skill_signals");
    if (error) return cached;
    const rows = (data ?? []) as SkillSignal[];
    if (!rows.length) return cached;
    const map: Record<string, SkillSignal> = {};
    for (const r of rows) map[r.skill_id] = r;
    storageSet(STORAGE_KEYS.trendSignals, map);
    return map;
  } catch {
    return cached;
  }
}
