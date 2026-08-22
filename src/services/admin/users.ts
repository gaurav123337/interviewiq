/* Admin user management + metrics — RPC reads (server enforces is_admin). */

import { getSupabaseClient } from "../cloud";

export interface AdminUserRow {
  id: string;
  email: string;
  created_at: string;
  last_seen: string | null;
  tier: string;
  streak: number;
  sessions_count: number;
  ai_calls: number;
}

export interface AdminMetrics {
  totalUsers: number;
  newThisWeek: number;
  activeToday: number;
  active7d: number;
  proUsers: number;
  totalSessions: number;
  sessions7d: number;
  aiCalls7d: number;
  events7d: number;
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_list_users");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserRow[];
}

export async function adminMetrics(): Promise<AdminMetrics> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_metrics");
  if (error) throw new Error(error.message);
  return (data ?? {}) as AdminMetrics;
}
