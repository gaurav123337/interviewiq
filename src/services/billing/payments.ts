import { CONFIG } from "../../config";
import { getCloudState, getSupabaseClient } from "../cloud";

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

export interface RefundResult {
  ok: boolean;
  providerStatus: string | null;
  providerRefundId: string | null;
  amountMinor: number | null;
  withinGrace: boolean;
  emailSent: boolean;
  note: string;
}

/** Admin: refund a confirmed payment. Goes through the pay-refund Edge
    Function, which verifies the caller is an admin server-side (app_admins
    allow-list, never trusting the client), enforces the published refund
    policy (grace window + per-user cap unless overridden), calls the
    provider's refund API when its keys are configured, then marks the
    payment refunded through the shared apply_refund SQL helper — subtracting
    the plan's days (scaled for partial refunds) and landing the reason in
    the audit trail. `amountMinor` omitted = full refund; given = partial. */
export async function adminRefundPayment(providerPaymentId: string, reason = "", amountMinor?: number): Promise<RefundResult> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data: session } = await client.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("You're signed out — sign in again.");

  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/pay-refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      providerPaymentId,
      reason: reason.trim() || undefined,
      amountMinor: amountMinor && amountMinor > 0 ? amountMinor : undefined
    })
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean; providerStatus?: string | null; providerRefundId?: string | null;
    amountMinor?: number | null; withinGrace?: boolean; emailSent?: boolean; note?: string; error?: string;
  };
  if (!res.ok || !body.ok) throw new Error(body.error ?? "Refund failed — try again.");
  return {
    ok: true,
    providerStatus: body.providerStatus ?? null,
    providerRefundId: body.providerRefundId ?? null,
    amountMinor: body.amountMinor ?? null,
    withinGrace: Boolean(body.withinGrace),
    emailSent: Boolean(body.emailSent),
    note: body.note ?? "Refunded."
  };
}

/* ------------------------------------------------------------------ */
