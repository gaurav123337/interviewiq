/* pay-webhook — the ONLY place a payment becomes Pro.
   Provider-agnostic: verifies the provider's signature over the raw body,
   maps the event, then funnels through the shared SQL (apply_purchase /
   apply_refund / upsert_subscription / consume_coupon) so simulated and
   real payments are indistinguishable. Handles one-time payments,
   subscription renewals (subscription.charged), cancellations
   (subscription.cancelled — access continues until period end), and
   refunds (payment.refunded). Coupons are consumed ONLY here, after the
   payment confirms, so an abandoned checkout never burns a use. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaymentProvider, isCancelEvent, isPaidEvent, isRefundEvent } from "../_shared/payment.ts";

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    const provider = getPaymentProvider(Deno.env.toObject());
    const v = await provider.verifyWebhook(rawBody, headers);
    if (!v.valid) {
      return new Response(JSON.stringify({ ok: false, error: "bad signature" }), { status: 400 });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: "service role key not configured" }), { status: 500 });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

    /* refunds — subtract the plan's days from the entitlement */
    if (isRefundEvent(provider.name, v.event)) {
      if (!v.externalId && !v.notes?.user_id) {
        return new Response(JSON.stringify({ ok: true, ignored: "refund without binding" }), { status: 200 });
      }
      const match = await findPayment(admin, v);
      if (!match) {
        return new Response(JSON.stringify({ ok: true, ignored: "refund for unknown payment" }), { status: 200 });
      }
      const { error: refErr } = await admin.rpc("apply_refund", { p_provider_payment_id: match.provider_payment_id });
      if (refErr) throw new Error("apply_refund: " + refErr.message);
      return new Response(JSON.stringify({ ok: true, refunded: match.provider_payment_id }), { status: 200 });
    }

    /* cancellations — keep access until period end, stop future billing */
    if (isCancelEvent(provider.name, v.event)) {
      if (!v.userId || !v.externalId) {
        return new Response(JSON.stringify({ ok: true, ignored: "cancel without binding" }), { status: 200 });
      }
      const { error: upErr } = await admin.rpc("upsert_subscription", {
        p_user: v.userId,
        p_provider: provider.name,
        p_provider_sub_id: v.externalId,
        p_plan: v.plan ?? "monthly",
        p_status: "cancelled",
        p_period_end: v.periodEnd
      });
      if (upErr) throw new Error("upsert_subscription: " + upErr.message);
      return new Response(JSON.stringify({ ok: true, cancelled: v.externalId, access_until: v.periodEnd }), { status: 200 });
    }

    /* acknowledge non-payment events so the provider stops retrying */
    if (!isPaidEvent(provider.name, v.event)) {
      return new Response(JSON.stringify({ ok: true, ignored: v.event }), { status: 200 });
    }
    if (!v.userId || !v.plan) {
      return new Response(JSON.stringify({ ok: false, error: "missing user/plan binding" }), { status: 400 });
    }

    /* idempotency: a retried webhook for an already-processed payment must
       not double-grant (or double-consume a coupon) */
    if (v.externalId) {
      const { data: dup } = await admin.from("payments")
        .select("provider_payment_id").eq("provider_payment_id", v.externalId).maybeSingle();
      if (dup) {
        return new Response(JSON.stringify({ ok: true, already_processed: v.externalId }), { status: 200 });
      }
    }

    /* consume the coupon now that the payment is confirmed */
    let couponPct = 0;
    if (v.notes?.coupon) {
      const { data: pct, error: cErr } = await admin.rpc("consume_coupon", { p_code: v.notes.coupon });
      if (cErr) throw new Error("consume_coupon: " + cErr.message);
      couponPct = Number(pct ?? 0);
    }

    /* one-time or subscription renewal — same grant path */
    const kind = v.event === "subscription.charged" ? "subscription" : "one_time";
    const { error: payErr } = await admin.rpc("apply_purchase", {
      p_user: v.userId,
      p_provider: provider.name,
      p_external_id: v.externalId ?? `UNKNOWN-${Date.now()}`,
      p_plan: v.plan,
      p_amount_minor: v.amountMinor ?? 0,
      p_currency: v.currency ?? "USD",
      p_discount_pct: couponPct || Number(v.notes?.discount_pct ?? 0),
      p_kind: kind
    });
    if (payErr) throw new Error("apply_purchase: " + payErr.message);

    /* keep the subscription entity in sync (period end for the client's
       next-billing-date display) */
    if (v.event === "subscription.charged" && v.externalId) {
      const { error: upErr } = await admin.rpc("upsert_subscription", {
        p_user: v.userId,
        p_provider: provider.name,
        p_provider_sub_id: v.externalId,
        p_plan: v.plan,
        p_status: "active",
        p_period_end: v.periodEnd
      });
      if (upErr) throw new Error("upsert_subscription: " + upErr.message);
    }

    return new Response(JSON.stringify({ ok: true, granted: v.userId, plan: v.plan, kind }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message ?? "webhook failed" }), { status: 500 });
  }
});

/** Finds the stored payment for a refund event: exact id match first, then
    the user's latest payment for that plan (Razorpay refund events carry the
    payment id, which differs from the payment-link id we stored). */
async function findPayment(
  admin: ReturnType<typeof createClient>,
  v: { externalId: string | null; notes: Record<string, string> | null; plan: string | null }
): Promise<{ provider_payment_id: string } | null> {
  if (v.externalId) {
    const { data } = await admin.from("payments")
      .select("provider_payment_id").eq("provider_payment_id", v.externalId).maybeSingle();
    if (data) return data as { provider_payment_id: string };
  }
  if (v.notes?.user_id) {
    let q = admin.from("payments").select("provider_payment_id")
      .eq("user_id", v.notes.user_id).order("created_at", { ascending: false }).limit(1);
    if (v.plan) q = q.eq("plan", v.plan);
    const { data } = await q;
    if (data?.[0]) return data[0] as { provider_payment_id: string };
  }
  return null;
}
