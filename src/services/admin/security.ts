/* Admin security — MFA enforcement + audit log.
   docs/app-security.md G8/G9 — supabase/security.sql */

import { getSupabaseClient } from "../cloud";
import { refreshAdminData } from "./state";

export interface AdminSecurityStatus {
  enforced: boolean;
  mfaVerified: boolean;
  factors: { id: string; status: string }[];
}

/** What the dashboard security banner shows (RPC enforces is_admin). */
export async function adminSecurityStatus(): Promise<AdminSecurityStatus | null> {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.rpc("admin_security_status");
  if (error || data === null || data === undefined) return null;
  return data as AdminSecurityStatus;
}

/** Owner-only: flip MFA enforcement for admin actions. */
export async function adminSetMfaEnforced(enforced: boolean): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("app_config").upsert(
    { key: "admin_security", value: { mfa: enforced }, updated_at: Date.now() },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

export interface AdminAuditRow {
  actor: string;
  action: string;
  target: string;
  meta: unknown;
  created_at: string;
}

/** Append-only admin action log. */
export async function adminAuditLog(maxRows = 50): Promise<AdminAuditRow[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("admin_audit_log", { max_rows: maxRows });
  if (error) return [];
  return (data ?? []) as AdminAuditRow[];
}
