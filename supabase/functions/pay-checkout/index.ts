/* pay-checkout — creates a provider checkout URL for a signed-in user.
   Provider-agnostic: the provider is chosen by PAYMENT_PROVIDER env and the
   adapter builds the payment link / session. Prices come from the published
   app_config 'pricing' row (admin-tunable without a deploy), falling back to
   the baked-in catalog. verify_jwt: true. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaymentProvider, PLAN_CATALOG } from "../_shared/payment.ts";

const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
});

interface PricingRow { currency?: string; monthly?: number; yearly?: number; lifetime?: number }

async function remotePricing(supabase: ReturnType<typeof createClient>): Promise<PricingRow> {
  const { data, error } = await supabase.from("app_config").select("value").eq("key", "pricing").maybeSingle();
  if (error || !data) return {};
  return (data.value as PricingRow) ?? {};
}

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
      return new Response(JSON.stringify({ error: "Sign in to purchase Pro" }), { status: 401, headers });
    }

    const body = await req.json().catch(() => ({})) as {
      plan?: string; discountPct?: number; subscribe?: boolean; successUrl?: string; cancelUrl?: string; coupon?: string;
    };
    const plan = body.plan ?? "monthly";
    if (!PLAN_CATALOG[plan]) {
      return new Response(JSON.stringify({ error: "Unknown plan: " + plan }), { status: 400, headers });
    }

    const pricing = await remotePricing(supabase);
    const currency = pricing.currency ?? Deno.env.get("PAYMENT_CURRENCY") ?? "USD";
    const appUrl = Deno.env.get("APP_URL") ?? "https://gaurav123337.github.io/interviewiq/";
    /* admin-published price (dollars → minor units) or the baked-in catalog */
    const amountMinorOverride = pricing[plan] != null ? Math.round(pricing[plan] * 100) : undefined;

    /* coupon codes are validated server-side — the client's word is not
       trusted. The better of the user discount and the coupon wins, and the
       coupon rides in the provider notes so the webhook can consume it only
       after the payment confirms. */
    let effectiveDiscount = Number(body.discountPct ?? 0);
    let coupon = String(body.coupon ?? "").trim().toUpperCase();
    if (coupon) {
      const { data: cData, error: cErr } = await supabase.rpc("validate_coupon", { p_code: coupon });
      const row = (cData as Record<string, unknown>[] | null)?.[0];
      if (cErr || !row?.valid) {
        return new Response(JSON.stringify({ error: String(row?.message ?? cErr?.message ?? "Invalid code") }), { status: 400, headers });
      }
      effectiveDiscount = Math.max(effectiveDiscount, Number(row.discount_pct ?? 0));
    }

    const provider = getPaymentProvider(Deno.env.toObject());
    const r = {
      plan: plan as "monthly" | "yearly" | "lifetime",
      discountPct: effectiveDiscount,
      userId: data.user.id,
      currency,
      successUrl: body.successUrl ?? `${appUrl}?pro=success`,
      cancelUrl: body.cancelUrl ?? appUrl,
      amountMinorOverride,
      coupon: coupon || undefined
    };

    /* subscriptions: monthly/yearly via the provider's recurring flow */
    if (body.subscribe && plan !== "lifetime" && provider.supportsSubscriptions) {
      const sub = await provider.createSubscription(r);
      return new Response(JSON.stringify({ ...sub, mode: "subscription" }), { status: 200, headers });
    }
    if (body.subscribe && plan !== "lifetime" && !provider.supportsSubscriptions) {
      /* provider can't subscribe — fall back to one-time and say so */
      const once = await provider.createCheckout(r);
      return new Response(JSON.stringify({ ...once, mode: "one_time", note: "provider doesn't support subscriptions" }), { status: 200, headers });
    }

    const checkout = await provider.createCheckout(r);
    return new Response(JSON.stringify({ ...checkout, mode: "one_time" }), { status: 200, headers });
  } catch (e) {
    const msg = (e as Error).message ?? "Checkout failed";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
});
