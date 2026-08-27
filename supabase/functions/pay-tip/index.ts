/* pay-tip — Razorpay Standard Checkout for tip donations.
   Two modes:
   - POST { mode: "order", amount, currency, label } → creates a Razorpay order
   - POST { mode: "verify", paymentId, orderId, signature, label } → verifies + records

   verify_jwt: true (user must be signed in).
   The Razorpay KEY_SECRET never leaves the server. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPaymentSignature } from "../_shared/payment.ts";

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
      return new Response(JSON.stringify({ error: "Sign in to leave a tip" }), { status: 401, headers });
    }

    const env = Deno.env.toObject();
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return new Response(JSON.stringify({ error: "Razorpay not configured" }), { status: 500, headers });
    }

    const body = await req.json().catch(() => ({})) as {
      mode?: string;
      amount?: number;
      currency?: string;
      label?: string;
      paymentId?: string;
      orderId?: string;
      signature?: string;
    };

    const mode = body.mode ?? "order";

    /* ── MODE: CREATE ORDER ─────────────────────────────────────────── */
    if (mode === "order") {
      const amount = Math.max(1, Math.round(Number(body.amount ?? 0)));
      const currency = String(body.currency ?? "INR").toUpperCase();
      const label = String(body.label ?? "Support").slice(0, 100);

      if (amount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), { status: 400, headers });
      }

      // Razorpay amount is in paise/cents (minor units)
      const amountMinor = amount * 100;

      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: amountMinor,
          currency,
          receipt: `tip_${data.user.id}_${Date.now()}`.slice(0, 40),
          notes: {
            user_id: data.user.id,
            type: "tip",
            label
          }
        })
      });

      if (!rzpRes.ok) {
        const errText = await rzpRes.text().catch(() => "");
        return new Response(JSON.stringify({ error: `Razorpay order failed (${rzpRes.status}): ${errText.slice(0, 200)}` }), { status: 500, headers });
      }

      const order = await rzpRes.json();
      return new Response(JSON.stringify({
        ok: true,
        orderId: order.id,
        amountMinor,
        currency,
        keyId
      }), { status: 200, headers });
    }

    /* ── MODE: VERIFY PAYMENT ───────────────────────────────────────── */
    if (mode === "verify") {
      const paymentId = String(body.paymentId ?? "").trim();
      const orderId = String(body.orderId ?? "").trim();
      const signature = String(body.signature ?? "").trim();
      const label = String(body.label ?? "Support").slice(0, 100);

      if (!paymentId || !orderId || !signature) {
        return new Response(JSON.stringify({ error: "Missing payment_id, order_id or signature" }), { status: 400, headers });
      }

      // 1 — Verify HMAC signature
      const okSig = await verifyPaymentSignature(orderId, paymentId, signature, keySecret);
      if (!okSig) {
        return new Response(JSON.stringify({ ok: false, error: "Signature verification failed" }), { status: 400, headers });
      }

      // 2 — Server-side re-check: fetch payment + order from Razorpay
      const [payRes, orderRes] = await Promise.all([
        fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
          headers: { Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) }
        }),
        fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
          headers: { Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) }
        })
      ]);

      if (!payRes.ok || !orderRes.ok) {
        return new Response(JSON.stringify({ ok: false, error: "Failed to verify payment with Razorpay" }), { status: 500, headers });
      }

      const pay = await payRes.json();
      const order = await orderRes.json();

      if (pay.status !== "captured") {
        return new Response(JSON.stringify({ ok: false, error: `Payment not captured (status: ${pay.status})` }), { status: 400, headers });
      }
      if (order.amount !== pay.amount) {
        return new Response(JSON.stringify({ ok: false, error: "Paid amount doesn't match the order" }), { status: 400, headers });
      }

      // 3 — Verify order belongs to this user
      const notes = order.notes ?? {};
      if (notes.user_id && notes.user_id !== data.user.id) {
        return new Response(JSON.stringify({ ok: false, error: "This order doesn't belong to you" }), { status: 403, headers });
      }

      // 4 — Idempotency: already recorded?
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
      if (!serviceKey) {
        return new Response(JSON.stringify({ error: "service role key not configured" }), { status: 500, headers });
      }
      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

      const { data: dup } = await admin.from("tip_payments")
        .select("provider_payment_id").eq("provider_payment_id", paymentId).maybeSingle();
      if (dup) {
        return new Response(JSON.stringify({ ok: true, already_processed: paymentId }), { status: 200, headers });
      }

      // 5 — Record the tip
      const { error: insertErr } = await admin.from("tip_payments").insert({
        user_id: data.user.id,
        provider: "razorpay",
        provider_payment_id: paymentId,
        provider_order_id: orderId,
        amount_minor: pay.amount,
        currency: order.currency ?? "INR",
        tip_label: label,
        status: "captured"
      });

      if (insertErr) {
        console.error("tip_payments insert error:", insertErr.message);
        // Don't fail the user — payment was verified, just log the error
      }

      return new Response(JSON.stringify({
        ok: true,
        paymentId,
        amount: pay.amount,
        currency: order.currency
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), { status: 400, headers });

  } catch (e) {
    const msg = (e as Error).message ?? "Tip payment failed";
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers });
  }
});
