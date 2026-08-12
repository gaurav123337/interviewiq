/* pay-verify — synchronous confirmation for Razorpay Standard Checkout.
   verify_jwt: true. Flow: the client opens checkout.js with an order from
   pay-checkout (mode=standard), the modal returns
   { razorpay_payment_id, razorpay_order_id, razorpay_signature }, and this
   function:
   1. verifies the HMAC-SHA256 signature over `order_id|payment_id` with the
      key secret (the KEY_SECRET never leaves the server — a forged callback
      can't produce a valid signature);
   2. re-checks with Razorpay that the payment is actually CAPTURED and that
      the paid amount matches the order amount (server-authoritative — the
      client's word is never trusted);
   3. confirms the order was created for THIS user (notes.user_id);
   4. funnels through the shared apply_purchase SQL helper — the exact same
      grant the webhook uses — with payment-id idempotency, so a retried
      callback or a racing payment.captured webhook can't double-grant.
   The webhook remains the primary grant path for provider-initiated events;
   this is the synchronous path for the modal flow. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaymentProvider, verifyPaymentSignature, type ProviderEnv, type RazorpayProvider } from "../_shared/payment.ts";

const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const headers = { ...cors(req), "Content-Type": "application/json" };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: "Sign in to confirm your payment" }), { status: 401, headers });
    }

    const body = await req.json().catch(() => ({})) as { paymentId?: string; orderId?: string; signature?: string };
    const paymentId = String(body.paymentId ?? "").trim();
    const orderId = String(body.orderId ?? "").trim();
    const signature = String(body.signature ?? "").trim();
    if (!paymentId || !orderId || !signature) {
      return new Response(JSON.stringify({ error: "Missing payment_id, order_id or signature" }), { status: 400, headers });
    }

    const env = Deno.env.toObject() as ProviderEnv;
    if ((env.PAYMENT_PROVIDER ?? "razorpay").toLowerCase() !== "razorpay") {
      return new Response(JSON.stringify({ error: "Standard Checkout is Razorpay-only" }), { status: 400, headers });
    }
    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return new Response(JSON.stringify({ error: "Razorpay not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET" }), { status: 500, headers });
    }

    /* 1 — signature: the cryptographic proof the callback is genuine */
    const okSig = await verifyPaymentSignature(orderId, paymentId, signature, keySecret);
    if (!okSig) {
      return new Response(JSON.stringify({ ok: false, error: "Signature verification failed" }), { status: 400, headers });
    }

    /* 2 — server-side re-check: captured + amount matches the order */
    const rzp = getPaymentProvider(env) as RazorpayProvider;
    const [pay, order] = await Promise.all([rzp.fetchPayment(paymentId), rzp.fetchOrder(orderId)]);
    if (pay.status !== "captured") {
      return new Response(JSON.stringify({ ok: false, error: `Payment not captured (status: ${pay.status || "unknown"})` }), { status: 400, headers });
    }
    if (order.amount !== pay.amount) {
      return new Response(JSON.stringify({ ok: false, error: "Paid amount doesn't match the order" }), { status: 400, headers });
    }

    /* 3 — the order must belong to the caller (bound at creation) */
    const notes = order.notes ?? {};
    if (notes.user_id && notes.user_id !== data.user.id) {
      return new Response(JSON.stringify({ ok: false, error: "This order doesn't belong to you" }), { status: 403, headers });
    }
    const plan = notes.plan ?? "monthly";

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: "service role key not configured" }), { status: 500, headers });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

    /* 4 — idempotency: already granted for this payment → no double grant */
    const { data: dup } = await admin.from("payments")
      .select("provider_payment_id").eq("provider_payment_id", paymentId).maybeSingle();
    if (dup) {
      return new Response(JSON.stringify({ ok: true, already_processed: paymentId }), { status: 200, headers });
    }

    /* coupon consumed only after the payment confirms (mirrors the webhook) */
    let couponPct = 0;
    if (notes.coupon) {
      const { data: pct, error: cErr } = await admin.rpc("consume_coupon", { p_code: notes.coupon });
      if (cErr) throw new Error("consume_coupon: " + cErr.message);
      couponPct = Number(pct ?? 0);
    }

    const { error: payErr } = await admin.rpc("apply_purchase", {
      p_user: data.user.id,
      p_provider: "razorpay",
      p_external_id: paymentId,
      p_plan: plan,
      p_amount_minor: pay.amount,
      p_currency: order.currency,
      p_discount_pct: couponPct || Number(notes.discount_pct ?? 0),
      p_kind: "one_time"
    });
    if (payErr) throw new Error("apply_purchase: " + payErr.message);

    return new Response(JSON.stringify({ ok: true, granted: data.user.id, plan, paymentId }), { status: 200, headers });
  } catch (e) {
    const msg = (e as Error).message ?? "Verification failed";
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers });
  }
});
