/* pay-webhook — the ONLY place a payment becomes Pro.
   Provider-agnostic: verifies the provider's signature over the raw body,
   maps the event, then funnels through the shared apply_purchase /
   apply_refund SQL (gated to service role / admins) so simulated and real
   payments are indistinguishable. Handles one-time payments, subscription
   renewals (subscription.charged) and refunds (payment.refunded). */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaymentProvider, isPaidEvent, isRefundEvent } from "../_shared/payment.ts";

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

    /* acknowledge non-payment events so the provider stops retrying */
    if (!isPaidEvent(provider.name, v.event)) {
      return new Response(JSON.stringify({ ok: true, ignored: v.event }), { status: 200 });
    }
    if (!v.userId || !v.plan) {
      return new Response(JSON.stringify({ ok: false, error: "missing user/plan binding" }), { status: 400 });
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
      p_kind: kind
    });
    if (payErr) throw new Error("apply_purchase: " + payErr.message);

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
