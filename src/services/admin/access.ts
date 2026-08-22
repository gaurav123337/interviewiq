/* Admin access control — grant/revoke admin, miss candidates, admin list. */

import { getSupabaseClient } from "../cloud";

export async function grantAdmin(email: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.rpc("admin_grant_admin", { p_email: email.trim().toLowerCase() });
  if (error) throw new Error(error.message);
}

export async function revokeAdmin(email: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.rpc("admin_revoke_admin", { p_email: email.trim().toLowerCase() });
  if (error) throw new Error(error.message);
}

export interface MissCandidate {
  question: string;
  field_id: string;
  level: string;
  attempts: number;
  misses: number;
  miss_rate: number;
  avg_score: number;
}

/** Questions real users score poorly on (score ≤ 2). */
export async function adminMissCandidates(): Promise<MissCandidate[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_miss_candidates");
  if (error) throw new Error(error.message);
  return (data ?? []) as MissCandidate[];
}

/** Emails currently allowed to see the dashboard. */
export async function listAdmins(): Promise<string[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("app_admins").select("email");
  if (error) return [];
  return ((data ?? []) as { email: string }[]).map(r => r.email);
}
