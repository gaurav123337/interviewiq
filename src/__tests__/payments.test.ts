/* Provider-agnostic payment core — the pure module in supabase/functions
   is unit-tested here so a provider swap or webhook regression can't slip
   through: plan pricing, expiry extension, signature verification for
   Razorpay (default) and Stripe (drop-in), and provider selection. */

import { describe, expect, it } from "vitest";
import {
  extendExpiry, getPaymentProvider, isPaidEvent, planDays, priceWithDiscount,
  RazorpayProvider, StripeProvider
} from "../../supabase/functions/_shared/payment";

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
});
