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
  /** "one_time" | "subscription" — which flow the server picked. */
  mode?: string;
  note?: string;
}

/** Creates a provider checkout URL for the signed-in user and returns it.
    Throws with a friendly message when not signed in or not configured.
    `subscribe` asks the server for the provider's recurring flow (Razorpay
    subscriptions for monthly/yearly); providers without subscriptions fall
    back to one-time and say so via `note`. `coupon` is validated server-side
    by the checkout function — the better of it and `discountPct` wins. */
export async function createCheckout(plan: string, discountPct = 0, subscribe = false, coupon = ""): Promise<CheckoutResponse> {
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
    body: JSON.stringify({ plan, discountPct, subscribe, coupon: coupon.trim() || undefined })
  });
  const body = (await res.json().catch(() => ({}))) as CheckoutResponse & { error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? "Checkout failed — try again.");
  return body;
}

/** Admin-published pricing (app_config → "pricing", public-read so any
    client can render the storefront). Values are dollars; currency is
    optional and defaults to the server's PAYMENT_CURRENCY. Null when the
    admin hasn't published pricing (fall back to the baked-in catalog). */
export interface RemotePricing { monthly?: number; yearly?: number; lifetime?: number; currency?: string }

export async function getRemotePricing(): Promise<RemotePricing | null> {
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from("app_config").select("value").eq("key", "pricing").maybeSingle();
  if (error || !data) return null;
  return (data.value as RemotePricing) ?? null;
}

export interface MyPayment {
  provider: string;
  plan: string;
  amountMinor: number;
  currency: string;
  discountPct: number;
  status: string;
  /** "one_time" | "subscription" | "refunded"-aware via status — purchase flow kind. */
  kind: string;
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
    kind: String(r.kind ?? "one_time"),
    createdAt: r.created_at as string
  }));
}

export interface AdminPaymentRow extends MyPayment {
  userId: string;
  email: string | null;
  /** Provider-side payment/subscription id — used by admin refunds. */
  providerPaymentId: string;
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
    providerPaymentId: String(r.provider_payment_id ?? ""),
    plan: String(r.plan ?? ""),
    amountMinor: Number(r.amount_minor ?? 0),
    currency: String(r.currency ?? "USD"),
    discountPct: Number(r.discount_pct ?? 0),
    status: String(r.status ?? "paid"),
    kind: String(r.kind ?? "one_time"),
    createdAt: r.created_at as string
  }));
}

/** Admin: refund a confirmed payment — marks it refunded and subtracts the
    plan's days from the user's entitlement (server-side, audit-logged). */
export async function adminRefundPayment(providerPaymentId: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.rpc("admin_refund_payment", { p_provider_payment_id: providerPaymentId });
  if (error) throw new Error(error.message);
}

/** Admin: simulate a confirmed purchase — funnels through the exact same
    apply_purchase grant as a real webhook, so it's the full test path
    (grant + payment row + audit entry). Returns the synthetic payment id. */
export async function adminSimulatePurchase(userId: string, plan: string, kind = "one_time"): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_simulate_purchase", { p_user: userId, p_plan: plan, p_kind: kind });
  if (error) throw new Error(error.message);
  return String(data ?? "");
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

/* ------------------------------------------------------------------ */
/* Subscriptions                                                       */
/* ------------------------------------------------------------------ */

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
    cancelled status (audit-logged). */
export async function adminCancelSubscription(providerSubscriptionId: string, targetUserId: string): Promise<{ status: string; currentPeriodEnd: string | null }> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data: session } = await client.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("You're signed out — sign in again.");

  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/pay-cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ providerSubscriptionId, targetUserId })
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string; currentPeriodEnd?: string | null; error?: string };
  if (!res.ok || !body.ok) throw new Error(body.error ?? "Cancel failed — try again.");
  return { status: String(body.status ?? "cancelled"), currentPeriodEnd: body.currentPeriodEnd ?? null };
}

/* ------------------------------------------------------------------ */
/* Coupon codes                                                        */
/* ------------------------------------------------------------------ */

export interface CouponCheck {
  valid: boolean;
  discountPct: number;
  message: string;
}

/** Read-only storefront check — shows the discount before checkout. Usage
    is consumed server-side only when the payment actually confirms. */
export async function validateCoupon(code: string): Promise<CouponCheck> {
  const client = await getSupabaseClient();
  if (!client) return { valid: false, discountPct: 0, message: "Cloud not configured" };
  const { data, error } = await client.rpc("validate_coupon", { p_code: code });
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (error || !row) return { valid: false, discountPct: 0, message: error?.message ?? "Couldn't check that code" };
  return { valid: Boolean(row.valid), discountPct: Number(row.discount_pct ?? 0), message: String(row.message ?? "") };
}

export interface AdminCoupon {
  code: string;
  discountPct: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export async function adminListCoupons(): Promise<AdminCoupon[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_list_coupons");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    code: String(r.code ?? ""),
    discountPct: Number(r.discount_pct ?? 0),
    maxUses: Number(r.max_uses ?? 0),
    usedCount: Number(r.used_count ?? 0),
    expiresAt: (r.expires_at as string | null) ?? null,
    createdAt: r.created_at as string
  }));
}

/** Admin: create a reusable coupon code (upper-cased, audit-logged). */
export async function adminCreateCoupon(code: string, discountPct: number, maxUses = 0, expiresAt?: string): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_create_coupon", {
    p_code: code, p_discount_pct: discountPct, p_max_uses: maxUses, p_expires_at: expiresAt ?? null
  });
  if (error) throw new Error(error.message);
  return String(data ?? "");
}

/* ------------------------------------------------------------------ */
/* Revenue analytics (pure — unit-tested)                              */
/* ------------------------------------------------------------------ */

export interface RevenueSummary {
  paidCount: number;
  totalPaidMinor: number;
  refundedCount: number;
  refundedMinor: number;
  /** Recurring monthly revenue from active subscription payments
      (yearly = amount / 12). */
  mrrMinor: number;
  /** Distinct users with a paid subscription payment. */
  activeSubscriberUsers: number;
  oneTimeRevenueMinor: number;
  subscriptionRevenueMinor: number;
  byPlan: Record<string, { count: number; amountMinor: number }>;
  byProvider: Record<string, number>;
}

/** Aggregates confirmed payments into a revenue snapshot for the admin
    dashboard. Pure and deterministic so the numbers are unit-testable. */
export function revenueSummary(rows: AdminPaymentRow[]): RevenueSummary {
  const s: RevenueSummary = {
    paidCount: 0, totalPaidMinor: 0, refundedCount: 0, refundedMinor: 0,
    mrrMinor: 0, activeSubscriberUsers: 0, oneTimeRevenueMinor: 0, subscriptionRevenueMinor: 0,
    byPlan: {}, byProvider: {}
  };
  const subUsers = new Set<string>();
  for (const r of rows) {
    s.byProvider[r.provider] = (s.byProvider[r.provider] ?? 0) + 1;
    if (r.status === "refunded") {
      s.refundedCount++;
      s.refundedMinor += r.amountMinor;
      continue;
    }
    s.paidCount++;
    s.totalPaidMinor += r.amountMinor;
    s.byPlan[r.plan] = s.byPlan[r.plan] ?? { count: 0, amountMinor: 0 };
    s.byPlan[r.plan].count++;
    s.byPlan[r.plan].amountMinor += r.amountMinor;
    if (r.kind === "subscription") {
      s.subscriptionRevenueMinor += r.amountMinor;
      subUsers.add(r.userId);
      s.mrrMinor += r.plan === "yearly" ? Math.round(r.amountMinor / 12) : r.plan === "monthly" ? r.amountMinor : 0;
    } else {
      s.oneTimeRevenueMinor += r.amountMinor;
    }
  }
  s.activeSubscriberUsers = subUsers.size;
  return s;
}
