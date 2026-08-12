/* pay-checkout — creates a provider checkout URL for a signed-in user.
   Provider-agnostic: the provider is chosen by PAYMENT_PROVIDER env and the
   adapter builds the payment link / session. The client never sees provider
   secrets — it gets back one URL to open. verify_jwt: true (Supabase
   requires a valid session, so the user id is trustworthy). */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaymentProvider, PLAN_CATALOG } from "../_shared/payment.ts";

const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const headers = { ...cors(req), "Content-Type": "application/json" };

  try {
    /* the signed-in user from the session JWT (verify_jwt enforces it) */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: "Sign in to purchase Pro" }), { status: 401, headers });
    }

    const body = await req.json().catch(() => ({})) as { plan?: string; discountPct?: number; successUrl?: string; cancelUrl?: string };
    const plan = body.plan ?? "monthly";
    if (!PLAN_CATALOG[plan]) {
      return new Response(JSON.stringify({ error: "Unknown plan: " + plan }), { status: 400, headers });
    }
    const currency = Deno.env.get("PAYMENT_CURRENCY") ?? "USD";
    const appUrl = Deno.env.get("APP_URL") ?? "https://gaurav123337.github.io/interviewiq/";
    const provider = getPaymentProvider(Deno.env.toObject());

    const checkout = await provider.createCheckout({
      plan: plan as "monthly" | "yearly" | "lifetime",
      discountPct: Number(body.discountPct ?? 0),
      userId: data.user.id,
      currency,
      successUrl: body.successUrl ?? `${appUrl}?pro=success`,
      cancelUrl: body.cancelUrl ?? appUrl
    });

    return new Response(JSON.stringify(checkout), { status: 200, headers });
  } catch (e) {
    const msg = (e as Error).message ?? "Checkout failed";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
});
