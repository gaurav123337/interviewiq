/* Provider-agnostic payment core — shared by the pay-checkout and
   pay-webhook Edge Functions, and unit-tested from the app's vitest suite
   (pure TS: no Deno globals at import time).

   The app never knows which provider it's talking to: a single checkout
   URL + a webhook that verifies the provider signature and grants the
   entitlement. Swap providers by changing PAYMENT_PROVIDER + the provider
   secrets — nothing else moves. Razorpay is the default (International);
   Stripe is implemented as a drop-in comparison. */

export interface CheckoutRequest {
  plan: "monthly" | "yearly" | "lifetime";
  discountPct: number;
  userId: string;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  provider: string;
  url: string;
  externalId: string;
  amountMinor: number;
  currency: string;
}

export interface VerifiedWebhook {
  valid: boolean;
  /** e.g. "payment.captured" | "checkout.session.completed" — null when invalid. */
  event: string | null;
  externalId: string | null;
  userId: string | null;
  plan: string | null;
  amountMinor: number | null;
  currency: string | null;
}

export interface PaymentProvider {
  name: string;
  createCheckout(r: CheckoutRequest): Promise<CheckoutResult>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<VerifiedWebhook>;
}

/* ------------------------------------------------------------------ */
/* Plan catalog + expiry math                                           */
/* ------------------------------------------------------------------ */

export const PLAN_CATALOG: Record<string, { label: string; days: number | null; amountMinor: number }> = {
  monthly: { label: "Monthly", days: 30, amountMinor: 900 },
  yearly: { label: "Yearly", days: 365, amountMinor: 7900 },
  lifetime: { label: "Lifetime", days: null, amountMinor: 19900 }
};

export function planDays(plan: string): number | null {
  return PLAN_CATALOG[plan]?.days ?? null;
}

/** Renewals EXTEND from the current expiry instead of stacking from today —
    buying a year while 2 months remain adds 12 months to the 2. */
export function extendExpiry(existing: string | null, days: number | null): string | null {
  if (days == null) return null; /* lifetime */
  const now = Date.now();
  const base = existing && new Date(existing).getTime() > now ? new Date(existing).getTime() : now;
  return new Date(base + days * 86400000).toISOString();
}

export function priceWithDiscount(baseMinor: number, discountPct: number): number {
  const pct = Math.max(0, Math.min(100, discountPct || 0));
  return Math.round(baseMinor * (1 - pct / 100));
}

/* ------------------------------------------------------------------ */
/* Razorpay (International)                                             */
/* ------------------------------------------------------------------ */

export class RazorpayProvider implements PaymentProvider {
  name = "razorpay";
  constructor(
    private keyId: string,
    private keySecret: string,
    private webhookSecret: string,
    private apiBase = "https://api.razorpay.com"
  ) {}

  async createCheckout(r: CheckoutRequest): Promise<CheckoutResult> {
    const amount = priceWithDiscount(PLAN_CATALOG[r.plan].amountMinor, r.discountPct);
    const res = await fetch(`${this.apiBase}/v1/payment_links`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${this.keyId}:${this.keySecret}`),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount,
        currency: r.currency,
        description: `InterviewIQ Pro — ${PLAN_CATALOG[r.plan].label}`,
        callback_url: r.successUrl,
        callback_method: "get",
        notes: { user_id: r.userId, plan: r.plan, discount_pct: String(r.discountPct) }
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Razorpay checkout failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      provider: this.name,
      url: data.short_url as string,
      externalId: data.id as string,
      amountMinor: amount,
      currency: r.currency
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<VerifiedWebhook> {
    const sig = headers["x-razorpay-signature"] ?? "";
    const expected = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", expected, new TextEncoder().encode(rawBody));
    const computed = btoa(String.fromCharCode(...new Uint8Array(mac)));
    if (computed !== sig) return { valid: false, event: null, externalId: null, userId: null, plan: null, amountMinor: null, currency: null };

    try {
      const payload = JSON.parse(rawBody) as {
        event: string;
        payload?: {
          payment_link?: { entity?: { id?: string; notes?: Record<string, string>; amount?: number; currency?: string } };
          payment?: { entity?: { id?: string; notes?: Record<string, string> } };
        };
      };
      const link = payload.payload?.payment_link?.entity;
      const pay = payload.payload?.payment?.entity;
      const notes = link?.notes ?? pay?.notes ?? {};
      const amount = link?.amount ?? null;
      const currency = link?.currency ?? "USD";
      return {
        valid: true,
        event: payload.event ?? null,
        externalId: link?.id ?? pay?.id ?? null,
        userId: notes.user_id ?? null,
        plan: notes.plan ?? null,
        amountMinor: amount,
        currency
      };
    } catch {
      return { valid: false, event: null, externalId: null, userId: null, plan: null, amountMinor: null, currency: null };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Stripe (drop-in comparison provider)                                */
/* ------------------------------------------------------------------ */

export class StripeProvider implements PaymentProvider {
  name = "stripe";
  constructor(private secretKey: string, private webhookSecret: string) {}

  async createCheckout(r: CheckoutRequest): Promise<CheckoutResult> {
    const amount = priceWithDiscount(PLAN_CATALOG[r.plan].amountMinor, r.discountPct);
    const form = new URLSearchParams({
      mode: "payment",
      "client_reference_id": r.userId,
      "success_url": r.successUrl,
      "cancel_url": r.cancelUrl,
      "metadata[user_id]": r.userId,
      "metadata[plan]": r.plan,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": r.currency,
      "line_items[0][price_data][unit_amount]": String(amount),
      "line_items[0][price_data][product_data][name]": `InterviewIQ Pro — ${PLAN_CATALOG[r.plan].label}`
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${this.secretKey}:`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Stripe checkout failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      provider: this.name,
      url: data.url as string,
      externalId: data.id as string,
      amountMinor: amount,
      currency: r.currency
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<VerifiedWebhook> {
    const sig = headers["stripe-signature"] ?? "";
    const m = sig.match(/t=(\d+),v1=([0-9a-f]+)/);
    if (!m) return { valid: false, event: null, externalId: null, userId: null, plan: null, amountMinor: null, currency: null };
    const signed = `${m[1]}.${rawBody}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
    const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
    if (hex !== m[2]) return { valid: false, event: null, externalId: null, userId: null, plan: null, amountMinor: null, currency: null };

    try {
      const payload = JSON.parse(rawBody) as {
        type?: string;
        data?: { object?: { client_reference_id?: string; metadata?: Record<string, string>; id?: string; amount_total?: number; currency?: string } };
      };
      const obj = payload.data?.object;
      return {
        valid: true,
        event: payload.type ?? null,
        externalId: obj?.id ?? null,
        userId: obj?.client_reference_id ?? obj?.metadata?.user_id ?? null,
        plan: obj?.metadata?.plan ?? null,
        amountMinor: obj?.amount_total ?? null,
        currency: obj?.currency ?? "USD"
      };
    } catch {
      return { valid: false, event: null, externalId: null, userId: null, plan: null, amountMinor: null, currency: null };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Provider selection (env-driven — the swap point)                     */
/* ------------------------------------------------------------------ */

export interface ProviderEnv {
  PAYMENT_PROVIDER?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  RAZORPAY_API_BASE?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export function getPaymentProvider(env: ProviderEnv): PaymentProvider {
  const provider = (env.PAYMENT_PROVIDER ?? "razorpay").toLowerCase();
  if (provider === "stripe") {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Stripe not configured — set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET");
    }
    return new StripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET);
  }
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error("Razorpay not configured — set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET");
  }
  return new RazorpayProvider(
    env.RAZORPAY_KEY_ID,
    env.RAZORPAY_KEY_SECRET,
    env.RAZORPAY_WEBHOOK_SECRET,
    env.RAZORPAY_API_BASE
  );
}

/** Which events should trigger a Pro grant (paid, not failed). */
export function isPaidEvent(provider: string, event: string | null): boolean {
  if (!event) return false;
  if (provider === "stripe") return event === "checkout.session.completed";
  /* razorpay */
  return ["payment.captured", "payment_link.paid", "order.paid"].includes(event);
}
