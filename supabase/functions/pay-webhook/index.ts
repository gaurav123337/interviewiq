/* pay-webhook — the ONLY place a payment becomes Pro.
   Provider-agnostic: verifies the provider's signature over the raw body,
   maps the event to a user+plan, then writes the entitlement + payment row
   with the service role. Anyone can POST here — without a valid provider
   signature nothing happens, so self-granting is impossible. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { extendExpiry, getPaymentProvider, isPaidEvent, planDays } from "../_shared/payment.ts";

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    const provider = getPaymentProvider(Deno.env.toObject());
    const verified = await provider.verifyWebhook(rawBody, headers);
    if (!verified.valid) {
      return new Response(JSON.stringify({ ok: false, error: "bad signature" }), { status: 400 });
    }
    /* acknowledge non-payment events so the provider stops retrying */
    if (!isPaidEvent(provider.name, verified.event)) {
      return new Response(JSON.stringify({ ok: true, ignored: verified.event }), { status: 200 });
    }
    if (!verified.userId || !verified.plan || !planDays(verified.plan) || verified.plan === null) {
      return new Response(JSON.stringify({ ok: false, error: "missing user/plan binding" }), { status: 400 });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: "service role key not configured" }), { status: 500 });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

    const { data: existing } = await admin
      .from("entitlements").select("expires_at").eq("user_id", verified.userId).maybeSingle();
    const newExpiry = extendExpiry(existing?.expires_at ?? null, planDays(verified.plan));

    /* record the payment (dedupe by provider id) */
    const { error: payErr } = await admin.from("payments").upsert({
      user_id: verified.userId,
      provider: provider.name,
      provider_payment_id: verified.externalId,
      plan: verified.plan,
      amount_minor: verified.amountMinor ?? 0,
      currency: verified.currency ?? "USD",
      status: "paid"
    }, { onConflict: "provider_payment_id" });
    if (payErr) throw new Error("payment write: " + payErr.message);

    /* grant/extend Pro */
    const { error: entErr } = await admin.from("entitlements").upsert({
      user_id: verified.userId,
      tier: "pro",
      plan: verified.plan,
      expires_at: newExpiry,
      source: provider.name,
      discount_pct: 0
    }, { onConflict: "user_id" });
    if (entErr) throw new Error("entitlement write: " + entErr.message);

    /* audit trail */
    await admin.from("billing_actions").insert({
      action: "purchase",
      user_id: verified.userId,
      detail: { provider: provider.name, external_id: verified.externalId, plan: verified.plan }
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({ ok: true, granted: verified.userId, plan: verified.plan }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message ?? "webhook failed" }), { status: 500 });
  }
});
