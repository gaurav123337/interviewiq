/* Payment provider identification and checkout URL creation.
   The client never talks to Razorpay/Stripe directly — it calls the
   pay-checkout Edge Function (which dispatches to the provider selected by
   the PAYMENT_PROVIDER env) and reads history from Supabase RPCs. Swapping
   providers is a server-side env change; this module doesn't change. */

import { CONFIG } from "../../config";
import { getCloudState, getSupabaseClient } from "../cloud";

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

