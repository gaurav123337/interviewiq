/* Provider-agnostic billing client.
   The client never talks to Razorpay/Stripe directly — it calls the
   pay-checkout Edge Function (which dispatches to the provider selected by
   the PAYMENT_PROVIDER env) and reads history from Supabase RPCs. Swapping
   providers is a server-side env change; this module doesn't change. */

import { CONFIG } from "../config";
import { getCloudState, getSupabaseClient } from "./cloud";

/** UI label for the active provider (mirrors the server's PAYMENT_PROVIDER). */
export function paymentProviderName(): string {
  return CONFIG.payment.provider ?? "razorpay";
}

export interface CheckoutResponse {
  provider: string;
  url: string;
  externalId: string;
  amountMinor: number;
  currency: string;
}

/** Creates a provider checkout URL for the signed-in user and returns it.
    Throws with a friendly message when not signed in or not configured. */
export async function createCheckout(plan: string, discountPct = 0): Promise<CheckoutResponse> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) {
    throw new Error("Sign in to your cloud account first — purchases are tied to it.");
  }
  const { data: session } = await client.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("You're signed out — sign in again to purchase.");

  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/pay-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan, discountPct })
  });
  const body = (await res.json().catch(() => ({}))) as CheckoutResponse & { error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? "Checkout failed — try again.");
  return body;
}

export interface MyPayment {
  provider: string;
  plan: string;
  amountMinor: number;
  currency: string;
  discountPct: number;
  status: string;
  createdAt: string;
}

/** The signed-in user's confirmed purchases. */
export async function getMyPayments(): Promise<MyPayment[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("get_my_payments");
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    provider: String(r.provider ?? ""),
    plan: String(r.plan ?? ""),
    amountMinor: Number(r.amount_minor ?? 0),
    currency: String(r.currency ?? "USD"),
    discountPct: Number(r.discount_pct ?? 0),
    status: String(r.status ?? "paid"),
    createdAt: r.created_at as string
  }));
}

export interface AdminPaymentRow extends MyPayment {
  userId: string;
  email: string | null;
}

export async function adminListPayments(): Promise<AdminPaymentRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_list_payments");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    userId: String(r.user_id ?? ""),
    email: (r.email as string | null) ?? null,
    provider: String(r.provider ?? ""),
    plan: String(r.plan ?? ""),
    amountMinor: Number(r.amount_minor ?? 0),
    currency: String(r.currency ?? "USD"),
    discountPct: Number(r.discount_pct ?? 0),
    status: String(r.status ?? "paid"),
    createdAt: r.created_at as string
  }));
}

export interface BillingActionRow {
  action: string;
  adminId: string | null;
  userId: string | null;
  email: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

/** The billing audit trail — grants, revokes, discounts, codes, redeems, purchases. */
export async function adminBillingActions(limit = 50): Promise<BillingActionRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_billing_actions", { max_rows: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    action: String(r.action ?? ""),
    adminId: (r.admin_id as string | null) ?? null,
    userId: (r.user_id as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    detail: (r.detail as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at as string
  }));
}

export function fmtMinor(amountMinor: number, currency: string): string {
  const sym = currency === "INR" ? "₹" : "$";
  return sym + (amountMinor / 100).toFixed(2);
}
