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
  /** Admin-published price override (minor units) — remote pricing. */
  amountMinorOverride?: number;
  /** Applied coupon code — carried in the provider notes so the webhook
      can consume it only after the payment confirms. */
  coupon?: string;
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
  /** Provider notes/metadata (user_id, plan) — lets refund events find the
      original purchase when the payment id differs from the stored one. */
  notes: Record<string, string> | null;
  /** Billing-period end (ISO) — set for subscription events, so the client
      can show the next billing date and cancellation keeps access until it. */
  periodEnd: string | null;
}

export interface PaymentProvider {
  name: string;
  /** One-time purchase checkout URL. */
  createCheckout(r: CheckoutRequest): Promise<CheckoutResult>;
  /** Recurring subscription checkout URL (monthly/yearly). */
  createSubscription(r: CheckoutRequest): Promise<CheckoutResult>;
  supportsSubscriptions: boolean;
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<VerifiedWebhook>;
  /** Cancel a subscription at the end of its current period — access is
      kept until currentPeriodEnd, but future billing stops. */
  cancelSubscription(providerSubscriptionId: string): Promise<{ status: string; currentPeriodEnd: string | null }>;
  /** Refund a one-time payment. `amountMinor` omitted = full refund;
      provided = partial refund in minor units. Returns the provider refund
      id so it can be recorded alongside the DB mark. */
  refundPayment(providerPaymentId: string, amountMinor?: number): Promise<{ status: string; refundId: string | null }>;
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
    const base = r.amountMinorOverride ?? PLAN_CATALOG[r.plan].amountMinor;
    const amount = priceWithDiscount(base, r.discountPct);
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
        notes: { user_id: r.userId, plan: r.plan, discount_pct: String(r.discountPct), ...(r.coupon ? { coupon: r.coupon } : {}) }
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
    if (computed !== sig)    return { valid: false, event: null, externalId: null, userId: null, plan: null, amountMinor: null, currency: null, notes: null, periodEnd: null };

    try {
      const payload = JSON.parse(rawBody) as {
        event: string;
        payload?: {
          payment_link?: { entity?: { id?: string; notes?: Record<string, string>; amount?: number; currency?: string } };
          payment?: { entity?: { id?: string; notes?: Record<string, string>; amount?: number; currency?: string } };
          subscription?: { entity?: { id?: string; notes?: Record<string, string>; plan_id?: string; current_end?: number; status?: string } };
        };
      };
      const link = payload.payload?.payment_link?.entity;
      const pay = payload.payload?.payment?.entity;
      const sub = payload.payload?.subscription?.entity;
      const notes = link?.notes ?? pay?.notes ?? sub?.notes ?? {};
      const amount = link?.amount ?? pay?.amount ?? null;
      const currency = link?.currency ?? pay?.currency ?? "USD";
      const periodEnd = sub?.current_end ? new Date(sub.current_end * 1000).toISOString() : null;
      return {
        valid: true,
        event: payload.event ?? null,
        externalId: link?.id ?? pay?.id ?? sub?.id ?? null,
        userId: notes.user_id ?? null,
        plan: notes.plan ?? null,
        amountMinor: amount,
        currency,
        notes: Object.keys(notes).length ? notes : null,
        periodEnd
      };
    } catch {
      return { valid: false, event: null, externalId: null, userId: null, plan: null, amountMinor: null, currency: null, notes: null, periodEnd: null };
    }
  }

  supportsSubscriptions = true;

  async createSubscription(r: CheckoutRequest): Promise<CheckoutResult> {
    const base = r.amountMinorOverride ?? PLAN_CATALOG[r.plan].amountMinor;
    const amount = priceWithDiscount(base, r.discountPct);
    const period = r.plan === "yearly" ? "yearly" : "monthly";
    /* find a reusable plan, else create one */
    const plans = await this.rzpGet(`/v1/plans?period=${period}&interval=1`);
    const existing = (plans.items as { id: string; item?: { amount?: number } }[] | undefined)?.find(
      p => p.item?.amount === amount
    );
    const planId = existing?.id ?? (await this.rzpPost("/v1/plans", {
      period,
      interval: 1,
      item: { name: `InterviewIQ Pro — ${PLAN_CATALOG[r.plan].label}`, amount, currency: r.currency }
    })).id as string;
    const sub = await this.rzpPost("/v1/subscriptions", {
      plan_id: planId,
      total_count: r.plan === "yearly" ? 1 : 12,
      customer_notify: 1,
      notes: { user_id: r.userId, plan: r.plan, mode: "subscription", ...(r.coupon ? { coupon: r.coupon } : {}) }
    });
    return {
      provider: this.name,
      url: sub.short_url as string,
      externalId: sub.id as string,
      amountMinor: amount,
      currency: r.currency
    };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<{ status: string; currentPeriodEnd: string | null }> {
    const sub = await this.rzpGet(`/v1/subscriptions/${providerSubscriptionId}`);
    const cancelled = await this.rzpPost(`/v1/subscriptions/${providerSubscriptionId}/cancel`, { at_period_end: 1 });
    const end = (cancelled.current_end as number | undefined) ?? (sub.current_end as number | undefined);
    return {
      status: String(cancelled.status ?? sub.status ?? "cancelled"),
      currentPeriodEnd: end ? new Date(end * 1000).toISOString() : null
    };
  }

  async refundPayment(providerPaymentId: string, amountMinor?: number): Promise<{ status: string; refundId: string | null }> {
    const refund = await this.rzpPost(`/v1/payments/${providerPaymentId}/refund`, amountMinor ? { amount: amountMinor } : {});
    return { status: String(refund.status ?? "processed"), refundId: (refund.id as string) ?? null };
  }

  private async rzpGet(path: string): Promise<Record<string, unknown>> {
    return this.rzp(path, null);
  }

  private async rzpPost(path: string, body: unknown): Promise<Record<string, unknown>> {
    return this.rzp(path, body);
  }

  private async rzp(path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method: body == null ? "GET" : "POST",
      headers: {
        Authorization: "Basic " + btoa(`${this.keyId}:${this.keySecret}`),
        "Content-Type": "application/json"
      },
      body: body == null ? undefined : JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Razorpay ${path} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }
}

/* ------------------------------------------------------------------ */
/* Stripe (drop-in comparison provider)                                */
/* ------------------------------------------------------------------ */

export class StripeProvider implements PaymentProvider {
  name = "stripe";
  constructor(private secretKey: string, private webhookSecret: string) {}

  async createCheckout(r: CheckoutRequest): Promise<CheckoutResult> {
    const base = r.amountMinorOverride ?? PLAN_CATALOG[r.plan].amountMinor;
    const amount = priceWithDiscount(base, r.discountPct);
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
      "line_items[0][price_data][product_data][name]": `InterviewIQ Pro — ${PLAN_CATALOG[r.plan].label}`,
      ...(r.coupon ? { "metadata[coupon]": r.coupon } : {})
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
    if (!m)    return { valid: false, event: null, externalId: null, userId: null, plan: null, amountMinor: null, currency: null, notes: null, periodEnd: null } as VerifiedWebhook;
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
    if (hex !== m[2]) return { valid: false, event: null, externalId: null, userId: null, plan: null, amountMinor: null, currency: null, notes: null, periodEnd: null };

    try {
      const payload = JSON.parse(rawBody) as {
        type?: string;
        data?: { object?: { client_reference_id?: string; metadata?: Record<string, string>; id?: string; amount_total?: number; currency?: string; current_period_end?: number } };
      };
      const obj = payload.data?.object;
      const notes = obj?.metadata ?? {};
      return {
        valid: true,
        event: payload.type ?? null,
        externalId: obj?.id ?? null,
        userId: obj?.client_reference_id ?? obj?.metadata?.user_id ?? null,
        plan: obj?.metadata?.plan ?? null,
        amountMinor: obj?.amount_total ?? null,
        currency: obj?.currency ?? "USD",
        notes: Object.keys(notes).length ? notes : null,
        periodEnd: obj?.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null
      };
    } catch {
      return { valid: false, event: null, externalId: null, userId: null, plan: null, amountMinor: null, currency: null, notes: null, periodEnd: null };
    }
  }

  supportsSubscriptions = false;

  async createSubscription(): Promise<CheckoutResult> {
    throw new Error("Subscriptions aren't wired for Stripe yet — use Razorpay (set PAYMENT_PROVIDER=razorpay) or buy one-time.");
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<{ status: string; currentPeriodEnd: string | null }> {
    const get = await fetch(`https://api.stripe.com/v1/subscriptions/${providerSubscriptionId}`, {
      headers: { Authorization: "Basic " + btoa(`${this.secretKey}:`) }
    });
    if (!get.ok) throw new Error(`Stripe subscription lookup failed (${get.status})`);
    const sub = (await get.json()) as { status?: string; current_period_end?: number };
    const form = new URLSearchParams({ cancel_at_period_end: "true" });
    const post = await fetch(`https://api.stripe.com/v1/subscriptions/${providerSubscriptionId}`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${this.secretKey}:`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form
    });
    if (!post.ok) throw new Error(`Stripe subscription cancel failed (${post.status})`);
    const cancelled = (await post.json()) as { status?: string; current_period_end?: number };
    const end = cancelled.current_period_end ?? sub.current_period_end;
    return {
      status: String(cancelled.status ?? sub.status ?? "cancelled"),
      currentPeriodEnd: end ? new Date(end * 1000).toISOString() : null
    };
  }

  async refundPayment(providerPaymentId: string, amountMinor?: number): Promise<{ status: string; refundId: string | null }> {
    /* Stripe refunds are created against the payment_intent (or charge) id. */
    const form = new URLSearchParams();
    form.set("payment_intent", providerPaymentId);
    if (amountMinor) form.set("amount", String(amountMinor));
    const res = await fetch(`https://api.stripe.com/v1/refunds`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${this.secretKey}:`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Stripe refund failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { status?: string; id?: string };
    return { status: String(data.status ?? "succeeded"), refundId: data.id ?? null };
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
  RESEND_API_KEY?: string;
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
  return ["payment.captured", "payment_link.paid", "order.paid", "subscription.charged"].includes(event);
}

/** Which events should trigger a refund (subtract the plan days). */
export function isRefundEvent(provider: string, event: string | null): boolean {
  if (!event) return false;
  if (provider === "stripe") return event === "charge.refunded";
  return event === "payment.refunded";
}

/** Which events mean the subscription was cancelled (access continues until
    current_period_end; future billing stops). */
export function isCancelEvent(provider: string, event: string | null): boolean {
  if (!event) return false;
  if (provider === "stripe") return event === "customer.subscription.deleted";
  return event === "subscription.cancelled";
}

/* ------------------------------------------------------------------ */
/* Refund policy (admin-published via app_config → refund_policy)       */
/* ------------------------------------------------------------------ */

export interface RefundPolicy {
  /** Purchases younger than this are always refundable (no limit check). */
  grace_days?: number;
  /** Max refunds allowed per user outside the grace window (0 = unlimited). */
  max_refunds_per_user?: number;
  /** Reason presets surfaced as a picker in the admin refund form. */
  reason_presets?: string[];
}

export const REFUND_POLICY_DEFAULTS: RefundPolicy = {
  grace_days: 7,
  max_refunds_per_user: 3,
  reason_presets: ["Duplicate purchase", "Requested by user", "Billing error", "User cancelled" ]
};

export interface RefundPolicyDecision {
  allowed: boolean;
  withinGrace: boolean;
  message?: string;
}

/** Pure policy check — enforced server-side by pay-refund (the client's
    word is never trusted). `override` is the explicit admin force path. */
export function refundPolicyCheck(i: {
  policy: RefundPolicy | null;
  refundCount: number;
  purchaseAgeDays: number;
  override?: boolean;
}): RefundPolicyDecision {
  const p = { ...REFUND_POLICY_DEFAULTS, ...(i.policy ?? {}) };
  const graceDays = Math.max(0, p.grace_days ?? REFUND_POLICY_DEFAULTS.grace_days!);
  const max = Math.max(0, p.max_refunds_per_user ?? REFUND_POLICY_DEFAULTS.max_refunds_per_user!);
  const withinGrace = i.purchaseAgeDays <= graceDays;
  if (i.override) return { allowed: true, withinGrace };
  if (max > 0 && i.refundCount >= max && !withinGrace) {
    return {
      allowed: false,
      withinGrace,
      message: `This user already has ${i.refundCount} refund${i.refundCount === 1 ? "" : "s"} — the policy allows ${max} outside the ${graceDays}-day grace window. Refund within the window or override explicitly.`
    };
  }
  return { allowed: true, withinGrace };
}
