import { CONFIG } from "../../config";
import { getCloudState, getSupabaseClient } from "../cloud";

export interface MySubscription {
  provider: string;
  providerSubscriptionId: string;
  plan: string;
  /** "active" | "cancelled" | "expired" */
  status: string;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

/** The signed-in user's latest subscription (null when none). */
export async function getMySubscription(): Promise<MySubscription | null> {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.rpc("get_my_subscription");
  if (error || !data?.[0]) return null;
  const r = data[0] as Record<string, unknown>;
  return {
    provider: String(r.provider ?? ""),
    providerSubscriptionId: String(r.provider_subscription_id ?? ""),
    plan: String(r.plan ?? ""),
    status: String(r.status ?? "active"),
    currentPeriodEnd: (r.current_period_end as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
    createdAt: r.created_at as string
  };
}

/** Cancel the signed-in user's subscription at the end of the current
    billing period (pay-cancel Edge Function → provider API). Access stays
    until currentPeriodEnd. */
export async function cancelSubscription(providerSubscriptionId: string): Promise<{ status: string; currentPeriodEnd: string | null }> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data: session } = await client.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("You're signed out — sign in again.");

  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/pay-cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ providerSubscriptionId })
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string; currentPeriodEnd?: string | null; error?: string };
  if (!res.ok || !body.ok) throw new Error(body.error ?? "Cancel failed — try again.");
  return { status: String(body.status ?? "cancelled"), currentPeriodEnd: body.currentPeriodEnd ?? null };
}

export interface AdminSubscriptionRow {
  userId: string;
  email: string | null;
  provider: string;
  providerSubscriptionId: string;
  plan: string;
  /** "active" | "cancelled" | "expired" */
  status: string;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

/** Admin: every subscription across users (admin_list_subscriptions RPC). */
export async function adminListSubscriptions(): Promise<AdminSubscriptionRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_list_subscriptions");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    userId: String(r.user_id ?? ""),
    email: (r.email as string | null) ?? null,
    provider: String(r.provider ?? ""),
    providerSubscriptionId: String(r.provider_subscription_id ?? ""),
    plan: String(r.plan ?? ""),
    status: String(r.status ?? "active"),
    currentPeriodEnd: (r.current_period_end as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
    createdAt: r.created_at as string
  }));
}

/** Admin: cancel ANY user's subscription at the end of its current billing
    period. Goes through the same pay-cancel Edge Function as the user's own
    cancel — it verifies server-side (app_admins + target-user match) that
    the caller is allowed, then calls the provider API and persists the
    cancelled status (audit-logged). `reason` is carried into the audit
    trail so every admin cancel has a paper trail. */
export async function adminCancelSubscription(providerSubscriptionId: string, targetUserId: string, reason = ""): Promise<{ status: string; currentPeriodEnd: string | null }> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data: session } = await client.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("You're signed out — sign in again.");

  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/pay-cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ providerSubscriptionId, targetUserId, reason: reason.trim() || undefined })
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string; currentPeriodEnd?: string | null; error?: string };
  if (!res.ok || !body.ok) throw new Error(body.error ?? "Cancel failed — try again.");
  return { status: String(body.status ?? "cancelled"), currentPeriodEnd: body.currentPeriodEnd ?? null };
}

/* ------------------------------------------------------------------ */
