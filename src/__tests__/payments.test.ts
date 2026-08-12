/* Provider-agnostic payment core — the pure module in supabase/functions
   is unit-tested here so a provider swap or webhook regression can't slip
   through: plan pricing, expiry extension, signature verification for
   Razorpay (default) and Stripe (drop-in), and provider selection. */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extendExpiry, getPaymentProvider, isCancelEvent, isPaidEvent, isRefundEvent, planDays, priceWithDiscount,
  RazorpayProvider, StripeProvider
} from "../../supabase/functions/_shared/payment";
import { revenueSummary, subscriptionSummary, type AdminPaymentRow, type AdminSubscriptionRow } from "../services/billing";

/* WebCrypto helpers — no node builtins needed */
const hmac = async (secret: string, data: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
};
const hmacBase64 = async (secret: string, body: string) => {
  const mac = await hmac(secret, body);
  return btoa(String.fromCharCode(...mac));
};
const hmacHex = async (secret: string, body: string) =>
  [...(await hmac(secret, body))].map(b => b.toString(16).padStart(2, "0")).join("");

describe("plan catalog + expiry", () => {
  it("planDays maps the catalog", () => {
    expect(planDays("monthly")).toBe(30);
    expect(planDays("yearly")).toBe(365);
    expect(planDays("lifetime")).toBeNull();
    expect(planDays("nope")).toBeNull();
  });

  it("renewals EXTEND from the current expiry, not stack from today", () => {
    const future = new Date(Date.now() + 60 * 86400000).toISOString();
    const extended = extendExpiry(future, 30);
    /* 60d + 30d ≈ 90d out */
    const days = (new Date(extended!).getTime() - new Date(future).getTime()) / 86400000;
    expect(Math.round(days)).toBe(30);
  });

  it("starts fresh when there's no active expiry, lifetime never expires", () => {
    const fresh = extendExpiry(null, 30)!;
    const days = (new Date(fresh).getTime() - Date.now()) / 86400000;
    expect(Math.round(days)).toBe(30);
    /* an expired expiry is treated as fresh */
    const expired = new Date(Date.now() - 10 * 86400000).toISOString();
    const reset = extendExpiry(expired, 30)!;
    expect(Math.round((new Date(reset).getTime() - Date.now()) / 86400000)).toBe(30);
    expect(extendExpiry("2027-01-01T00:00:00Z", null)).toBeNull();
  });

  it("priceWithDiscount rounds and clamps", () => {
    expect(priceWithDiscount(900, 30)).toBe(630);
    expect(priceWithDiscount(7900, 10)).toBe(7110);
    expect(priceWithDiscount(900, 0)).toBe(900);
    expect(priceWithDiscount(900, 150)).toBe(0);
  });
});

describe("razorpay webhook verification (default provider)", () => {
  const provider = new RazorpayProvider("rzp_test", "secret", "whsec_rzp");
  const body = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment_link: {
        entity: { id: "plink_123", amount: 630, currency: "USD", notes: { user_id: "u1", plan: "monthly" } }
      }
    }
  });

  it("accepts a valid signature and maps the payload", async () => {
    const sig = await hmacBase64("whsec_rzp", body);
    const v = await provider.verifyWebhook(body, { "x-razorpay-signature": sig });
    expect(v.valid).toBe(true);
    expect(v.event).toBe("payment.captured");
    expect(v.externalId).toBe("plink_123");
    expect(v.userId).toBe("u1");
    expect(v.plan).toBe("monthly");
    expect(v.amountMinor).toBe(630);
    expect(isPaidEvent("razorpay", v.event)).toBe(true);
  });

  it("rejects a tampered or missing signature", async () => {
    expect((await provider.verifyWebhook(body, { "x-razorpay-signature": "bogus" })).valid).toBe(false);
    expect((await provider.verifyWebhook(body, {})).valid).toBe(false);
    /* a signature over DIFFERENT content must not verify */
    const otherSig = await hmacBase64("whsec_rzp", JSON.stringify({ event: "payment.failed" }));
    expect((await provider.verifyWebhook(body, { "x-razorpay-signature": otherSig })).valid).toBe(false);
  });
});

describe("stripe webhook verification (drop-in provider)", () => {
  const provider = new StripeProvider("sk_test", "whsec_stripe");
  const body = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { id: "cs_123", client_reference_id: "u2", metadata: { plan: "yearly" }, amount_total: 7110, currency: "USD" } }
  });

  it("accepts a valid t/v1 signature", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const v1 = await hmacHex("whsec_stripe", `${ts}.${body}`);
    const v = await provider.verifyWebhook(body, { "stripe-signature": `t=${ts},v1=${v1}` });
    expect(v.valid).toBe(true);
    expect(v.userId).toBe("u2");
    expect(v.plan).toBe("yearly");
    expect(v.amountMinor).toBe(7110);
    expect(isPaidEvent("stripe", v.event)).toBe(true);
    /* signature over a different body fails */
    const other = await hmacHex("whsec_stripe", `${ts}.{}`);
    expect((await provider.verifyWebhook(body, { "stripe-signature": `t=${ts},v1=${other}` })).valid).toBe(false);
  });

  it("rejects a malformed header", async () => {
    expect((await provider.verifyWebhook(body, {})).valid).toBe(false);
    expect((await provider.verifyWebhook(body, { "stripe-signature": "nope" })).valid).toBe(false);
  });
});

describe("provider selection (the swap point)", () => {
  it("defaults to Razorpay and enforces its config", () => {
    const env = { PAYMENT_PROVIDER: "razorpay", RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w" };
    expect(getPaymentProvider(env).name).toBe("razorpay");
    expect(() => getPaymentProvider({})).toThrow(/Razorpay not configured/);
  });

  it("selects Stripe when configured", () => {
    const env = { PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: "s", STRIPE_WEBHOOK_SECRET: "w" };
    expect(getPaymentProvider(env).name).toBe("stripe");
    expect(() => getPaymentProvider({ PAYMENT_PROVIDER: "stripe" })).toThrow(/Stripe not configured/);
  });

  it("ignores non-paid webhook events", () => {
    expect(isPaidEvent("razorpay", "payment.failed")).toBe(false);
    expect(isPaidEvent("razorpay", "payment_link.paid")).toBe(true);
    expect(isPaidEvent("stripe", "checkout.session.async_payment_failed")).toBe(false);
    expect(isPaidEvent("razorpay", null)).toBe(false);
  });

  it("maps refund events per provider (and never treats paid as refunded)", () => {
    expect(isRefundEvent("razorpay", "payment.refunded")).toBe(true);
    expect(isRefundEvent("stripe", "charge.refunded")).toBe(true);
    expect(isRefundEvent("razorpay", "payment.captured")).toBe(false);
    expect(isRefundEvent("stripe", "checkout.session.completed")).toBe(false);
    expect(isRefundEvent("razorpay", null)).toBe(false);
  });
});

describe("razorpay subscriptions + remote pricing (provider core)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const req = {
    plan: "monthly" as const, discountPct: 30, userId: "u9",
    currency: "USD", successUrl: "https://app/?pro=success", cancelUrl: "https://app/"
  };

  it("creates a subscription, discounting the plan amount and binding the user", async () => {
    /* no reusable plan → create one, then the subscription */
    const calls: { url: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body });
      const u = String(url);
      if (u.includes("/v1/plans?")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      if (u.endsWith("/v1/plans")) return new Response(JSON.stringify({ id: "plan_created" }), { status: 200 });
      if (u.includes("/v1/subscriptions")) {
        return new Response(JSON.stringify({ id: "sub_1", short_url: "https://rzp.io/i/sub" }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const provider = new RazorpayProvider("rzp_test", "sec", "wh", "https://api.razorpay.com");
    const r = await provider.createSubscription(req);

    expect(r.url).toBe("https://rzp.io/i/sub");
    expect(r.externalId).toBe("sub_1");
    expect(r.amountMinor).toBe(630); /* 900 − 30% */
    expect(r.provider).toBe("razorpay");
    /* plan created at the discounted amount, then subscription binds the user */
    const planPost = calls.find(c => c.url === "https://api.razorpay.com/v1/plans")!;
    expect(JSON.parse(String(planPost.body)).item.amount).toBe(630);
    const subPost = calls.find(c => c.url.includes("/v1/subscriptions"))!;
    const subBody = JSON.parse(String(subPost.body));
    expect(subBody.notes).toEqual({ user_id: "u9", plan: "monthly", mode: "subscription" });
    expect(subBody.plan_id).toBe("plan_created");
    /* yearly → 1 charge; monthly → 12 */
  });

  it("reuses an existing plan at the exact discounted amount", async () => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      const u = String(url);
      if (u.includes("/v1/plans?")) return new Response(JSON.stringify({ items: [{ id: "plan_existing", item: { amount: 630 } }] }), { status: 200 });
      if (u.endsWith("/v1/plans")) { posts.push(u); return new Response(JSON.stringify({ id: "plan_never" }), { status: 200 }); }
      if (u.includes("/v1/subscriptions")) return new Response(JSON.stringify({ id: "sub_2", short_url: "https://rzp.io/i/s2" }), { status: 200 });
      return new Response("{}", { status: 404 });
    });

    const provider = new RazorpayProvider("rzp_test", "sec", "wh", "https://api.razorpay.com");
    const r = await provider.createSubscription(req);
    expect(r.externalId).toBe("sub_2");
    expect(posts).toEqual([]); /* plan reuse — no plan POST */
  });

  it("remote pricing override wins over the catalog and still applies the discount", async () => {
    let amount: number | null = null;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/v1/payment_links")) {
        const body = JSON.parse(String(init?.body));
        amount = body.amount;
        return new Response(JSON.stringify({ id: "plink_9", short_url: "https://rzp.io/i/p9" }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const provider = new RazorpayProvider("rzp_test", "sec", "wh", "https://api.razorpay.com");
    const r = await provider.createCheckout({ ...req, plan: "yearly", amountMinorOverride: 5000 });
    expect(r.amountMinor).toBe(3500); /* $50 override − 30% (req discount) */
    expect(amount).toBe(3500);
  });

  it("carries a coupon code in the provider notes so the webhook can consume it", async () => {
    const captured: { notes: Record<string, string> | null } = { notes: null };
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/v1/payment_links")) {
        captured.notes = JSON.parse(String(init?.body)).notes;
        return new Response(JSON.stringify({ id: "plink_c", short_url: "https://rzp.io/i/c" }), { status: 200 });
      }
      if (u.includes("/v1/plans?")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      if (u.endsWith("/v1/plans")) return new Response(JSON.stringify({ id: "plan_c" }), { status: 200 });
      if (u.includes("/v1/subscriptions")) {
        captured.notes = JSON.parse(String(init?.body)).notes;
        return new Response(JSON.stringify({ id: "sub_c", short_url: "https://rzp.io/i/sc" }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const provider = new RazorpayProvider("rzp_test", "sec", "wh", "https://api.razorpay.com");
    await provider.createCheckout({ ...req, coupon: "LAUNCH20" });
    expect(captured.notes?.coupon).toBe("LAUNCH20");
    await provider.createSubscription({ ...req, coupon: "LAUNCH20" });
    expect(captured.notes?.coupon).toBe("LAUNCH20");
  });
});

describe("subscription lifecycle (period end, cancel adapters, cancel events)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("extracts periodEnd (ISO) from razorpay subscription events", async () => {
    const provider = new RazorpayProvider("rzp_test", "secret", "whsec_rzp");
    const body = JSON.stringify({
      event: "subscription.cancelled",
      payload: {
        subscription: {
          entity: { id: "sub_9", current_end: 1799999999, notes: { user_id: "u5", plan: "monthly" } }
        }
      }
    });
    const sig = await hmacBase64("whsec_rzp", body);
    const v = await provider.verifyWebhook(body, { "x-razorpay-signature": sig });
    expect(v.valid).toBe(true);
    expect(v.periodEnd).toBe(new Date(1799999999 * 1000).toISOString());
    expect(isCancelEvent("razorpay", v.event)).toBe(true);
    expect(isCancelEvent("razorpay", "payment.captured")).toBe(false);
  });

  it("maps stripe customer.subscription.deleted as a cancel event", () => {
    expect(isCancelEvent("stripe", "customer.subscription.deleted")).toBe(true);
    expect(isCancelEvent("stripe", "checkout.session.completed")).toBe(false);
    expect(isCancelEvent("razorpay", null)).toBe(false);
  });

  it("razorpay cancel keeps access until period end (at_period_end: 1)", async () => {
    const calls: { url: string; method?: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method, body: init?.body });
      const u = String(url);
      if (u.includes("/cancel")) {
        return new Response(JSON.stringify({ status: "cancelled", current_end: 1800000000 }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: "active", current_end: 1800000000 }), { status: 200 });
    });

    const provider = new RazorpayProvider("rzp_test", "sec", "wh", "https://api.razorpay.com");
    const r = await provider.cancelSubscription("sub_1");
    expect(r.status).toBe("cancelled");
    expect(r.currentPeriodEnd).toBe(new Date(1800000000 * 1000).toISOString());
    const cancel = calls.find(c => c.url.includes("/cancel"))!;
    expect(JSON.parse(String(cancel.body))).toEqual({ at_period_end: 1 });
  });

  it("stripe cancel requests cancel_at_period_end and keeps the period end", async () => {
    const calls: { url: string; method?: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method });
      const u = String(url);
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ status: "canceled", current_period_end: 1800000000 }), { status: 200 });
      }
      if (u.includes("/v1/subscriptions/")) {
        return new Response(JSON.stringify({ status: "active", current_period_end: 1800000000 }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const provider = new StripeProvider("sk_test", "whsec_stripe");
    const r = await provider.cancelSubscription("sub_1");
    expect(r.status).toBe("canceled");
    expect(r.currentPeriodEnd).toBe(new Date(1800000000 * 1000).toISOString());
    const post = calls.find(c => c.method === "POST")!;
    expect(String(post.url)).toContain("/v1/subscriptions/sub_1");
  });

  it("razorpay full refund posts the payment id (no amount = full)", async () => {
    const calls: { url: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", async (u: string, init?: RequestInit) => {
      calls.push({ url: String(u), body: init?.body });
      return new Response(JSON.stringify({ id: "rfnd_1", status: "processed" }), { status: 200 });
    });
    const provider = new RazorpayProvider("rzp_test", "sec", "wh", "https://api.razorpay.com");
    const r = await provider.refundPayment("pay_1");
    expect(r).toEqual({ status: "processed", refundId: "rfnd_1" });
    expect(calls[0].url).toBe("https://api.razorpay.com/v1/payments/pay_1/refund");
    expect(JSON.parse(String(calls[0].body))).toEqual({});
  });

  it("razorpay partial refund sends the amount in minor units", async () => {
    const calls: { body?: unknown }[] = [];
    vi.stubGlobal("fetch", async (_u: string, init?: RequestInit) => {
      calls.push({ body: init?.body });
      return new Response(JSON.stringify({ id: "rfnd_2", status: "processed" }), { status: 200 });
    });
    const provider = new RazorpayProvider("rzp_test", "sec", "wh", "https://api.razorpay.com");
    const r = await provider.refundPayment("pay_1", 500);
    expect(r.refundId).toBe("rfnd_2");
    expect(JSON.parse(String(calls[0].body))).toEqual({ amount: 500 });
  });

  it("stripe refund targets the payment intent (full + partial)", async () => {
    const calls: { url: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body });
      return new Response(JSON.stringify({ id: "re_1", status: "succeeded" }), { status: 200 });
    });
    const provider = new StripeProvider("sk_test", "whsec_stripe");
    const full = await provider.refundPayment("pi_1");
    expect(full).toEqual({ status: "succeeded", refundId: "re_1" });
    expect(String(calls[0].url)).toContain("/v1/refunds");
    expect(String(calls[0].body)).toContain("payment_intent=pi_1");
    await provider.refundPayment("pi_1", 500);
    expect(String(calls[1].body)).toContain("amount=500");
  });

  it("stripe refund surfaces a provider rejection", async () => {
    vi.stubGlobal("fetch", async () => new Response("no such payment_intent", { status: 404 }));
    const provider = new StripeProvider("sk_test", "whsec_stripe");
    await expect(provider.refundPayment("pi_missing")).rejects.toThrow(/Stripe refund failed/);
  });

  it("stripe webhook exposes periodEnd for subscription lifecycle events", async () => {
    const provider = new StripeProvider("sk_test", "whsec_stripe");
    const body = JSON.stringify({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_9", current_period_end: 1799999999, metadata: { user_id: "u6", plan: "monthly" } } }
    });
    const ts = Math.floor(Date.now() / 1000);
    const v1 = await hmacHex("whsec_stripe", `${ts}.${body}`);
    const v = await provider.verifyWebhook(body, { "stripe-signature": `t=${ts},v1=${v1}` });
    expect(v.valid).toBe(true);
    expect(v.periodEnd).toBe(new Date(1799999999 * 1000).toISOString());
    expect(isCancelEvent("stripe", v.event)).toBe(true);
  });
});

describe("revenue summary (admin analytics)", () => {
  const row = (over: Partial<AdminPaymentRow>): AdminPaymentRow => ({
    userId: "u1", email: "a@x.com", provider: "razorpay", providerPaymentId: "p1",
    plan: "monthly", amountMinor: 900, currency: "USD", discountPct: 0, status: "paid", kind: "one_time",
    createdAt: "2026-01-01T00:00:00Z", ...over
  });

  it("totals paid revenue, refunds, MRR and per-plan splits", () => {
    const rows: AdminPaymentRow[] = [
      row({ plan: "monthly", kind: "subscription", amountMinor: 900 }),
      row({ userId: "u2", plan: "yearly", kind: "subscription", amountMinor: 7900 }),
      row({ userId: "u3", plan: "monthly", amountMinor: 900 }),
      row({ userId: "u1", plan: "monthly", amountMinor: 900, status: "refunded" })
    ];
    const s = revenueSummary(rows);
    expect(s.paidCount).toBe(3);
    expect(s.totalPaidMinor).toBe(9700);
    expect(s.refundedCount).toBe(1);
    expect(s.refundedMinor).toBe(900);
    /* monthly 900 + yearly 7900/12 = 658 → 1558 */
    expect(s.mrrMinor).toBe(900 + Math.round(7900 / 12));
    expect(s.activeSubscriberUsers).toBe(2);
    expect(s.oneTimeRevenueMinor).toBe(900);
    expect(s.subscriptionRevenueMinor).toBe(8800);
    /* refunded rows are excluded from paid splits (byProvider counts all) */
    expect(s.byPlan.monthly).toEqual({ count: 2, amountMinor: 1800 });
    expect(s.byProvider.razorpay).toBe(4);
  });

  it("handles an empty ledger", () => {
    const s = revenueSummary([]);
    expect(s.paidCount).toBe(0);
    expect(s.mrrMinor).toBe(0);
    expect(Object.keys(s.byPlan)).toHaveLength(0);
  });
});

describe("subscription summary (admin analytics)", () => {
  const sub = (over: Partial<AdminSubscriptionRow>): AdminSubscriptionRow => ({
    userId: "u1", email: "a@x.com", provider: "razorpay", providerSubscriptionId: "sub_1",
    plan: "monthly", status: "active", currentPeriodEnd: null, cancelledAt: null,
    createdAt: "2026-01-01T00:00:00Z", ...over
  });
  const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

  it("counts active/cancelled/expired and renewals in the next 30 days", () => {
    const s = subscriptionSummary([
      sub({ plan: "monthly", currentPeriodEnd: daysFromNow(10) }),          /* renews soon: 900 */
      sub({ userId: "u2", plan: "yearly", currentPeriodEnd: daysFromNow(20) }), /* renews soon: 7900 */
      sub({ userId: "u3", plan: "monthly", currentPeriodEnd: daysFromNow(60) }), /* active, not soon */
      sub({ userId: "u4", status: "cancelled", plan: "monthly" }),
      sub({ userId: "u5", status: "expired", plan: "monthly" })
    ]);
    expect(s.activeCount).toBe(3);
    expect(s.cancelledCount).toBe(1);
    expect(s.expiredCount).toBe(1);
    expect(s.renewals30d).toBe(2);
    expect(s.renewals30dMinor).toBe(900 + 7900);
    /* cancelled ÷ decided = 1/4 → 25% */
    expect(s.churnRate).toBe(25);
  });

  it("ignores past period ends and unknown plans, zero churn when undecided", () => {
    const s = subscriptionSummary([
      sub({ currentPeriodEnd: daysFromNow(-5) }),      /* overdue — not a renewal */
      sub({ userId: "u2", plan: "lifetime", status: "cancelled" }),
      sub({ userId: "u3", plan: "yearly", currentPeriodEnd: daysFromNow(5) })
    ]);
    expect(s.renewals30d).toBe(1);
    expect(s.renewals30dMinor).toBe(7900);
    /* cancelled 1 of 3 decided (2 active + 1 cancelled) = 33% */
    expect(s.churnRate).toBe(33);
    expect(subscriptionSummary([]).churnRate).toBe(0);
  });
});
