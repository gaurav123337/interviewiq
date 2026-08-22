import { CONFIG } from "../../config";
import { getCloudState, getSupabaseClient } from "../cloud";

export interface StandardOrder {
  provider: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  /** Public Razorpay key id — safe for the client (the secret never leaves
      the server; it's returned from pay-checkout's env, not a client env). */
  keyId: string;
}

export interface VerifyPaymentResult {
  ok: boolean;
  granted?: string;
  plan?: string;
  alreadyProcessed?: boolean;
}

/** Razorpay Standard Checkout — create an ORDER (not a link) so the
    checkout.js modal can open client-side. Returns the public key id too.
    Throws when the provider can't do the modal flow (pay-checkout answers
    with `fallback: true`) — the caller falls back to the payment link. */
export async function createStandardOrder(plan: string, discountPct = 0, coupon = ""): Promise<StandardOrder> {
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
    body: JSON.stringify({ plan, discountPct, coupon: coupon.trim() || undefined, mode: "standard" })
  });
  const body = (await res.json().catch(() => ({}))) as {
    order_id?: string; amount_minor?: number; currency?: string; key_id?: string;
    provider?: string; error?: string; fallback?: boolean;
  };
  if (!res.ok || !body.order_id) throw new Error(body.error ?? "Standard checkout unavailable — try again.");
  return {
    provider: body.provider ?? "razorpay",
    orderId: body.order_id,
    amountMinor: Number(body.amount_minor ?? 0),
    currency: body.currency ?? "USD",
    keyId: body.key_id ?? ""
  };
}

/** Send the modal callback { payment_id, order_id, signature } to pay-verify.
    The server re-verifies the signature + capture state before granting. */
export async function verifyPayment(paymentId: string, orderId: string, signature: string): Promise<VerifyPaymentResult> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data: session } = await client.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("You're signed out — sign in again.");

  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/pay-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paymentId, orderId, signature })
  });
  const body = (await res.json().catch(() => ({}))) as VerifyPaymentResult & { error?: string };
  if (!res.ok || !body.ok) throw new Error(body.error ?? "Payment verification failed — try again.");
  return { ok: true, granted: body.granted, plan: body.plan, alreadyProcessed: Boolean(body.alreadyProcessed) };
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

