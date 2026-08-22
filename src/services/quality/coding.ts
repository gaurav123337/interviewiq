/* Coding scoreboard — playground problem quality and coach gap analysis */

import { getSupabaseClient } from "../cloud";

import { QualityRow } from "./scoring";

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

