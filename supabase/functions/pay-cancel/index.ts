/* pay-cancel — user-initiated subscription cancellation.
   Provider-agnostic, JWT-gated (verify_jwt: true): the signed-in user asks
   to cancel THEIR subscription; the function verifies ownership against the
   subscriptions table, asks the provider to cancel at period end (access is
   kept until current_period_end, future billing stops), then persists the
   cancelled status through the shared upsert_subscription RPC (service
   role), which also lands in the billing audit trail. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaymentProvider } from "../_shared/payment.ts";

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
      return new Response(JSON.stringify({ error: "Sign in to manage your subscription" }), { status: 401, headers });
    }

    const body = await req.json().catch(() => ({})) as { providerSubscriptionId?: string };
    const subId = String(body.providerSubscriptionId ?? "").trim();
    if (!subId) {
      return new Response(JSON.stringify({ error: "Missing subscription id" }), { status: 400, headers });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: "service role key not configured" }), { status: 500, headers });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

    /* ownership check — a user can only cancel their own subscription */
    const { data: sub, error: subErr } = await admin.from("subscriptions")
      .select("user_id, plan, provider_subscription_id")
      .eq("provider_subscription_id", subId).maybeSingle();
    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Subscription not found" }), { status: 404, headers });
    }
    if (sub.user_id !== data.user.id) {
      return new Response(JSON.stringify({ error: "Not your subscription" }), { status: 403, headers });
    }

    const provider = getPaymentProvider(Deno.env.toObject());
    const r = await provider.cancelSubscription(subId);

    const { error: upErr } = await admin.rpc("upsert_subscription", {
      p_user: sub.user_id,
      p_provider: provider.name,
      p_provider_sub_id: subId,
      p_plan: sub.plan,
      p_status: "cancelled",
      p_period_end: r.currentPeriodEnd
    });
    if (upErr) throw new Error("upsert_subscription: " + upErr.message);

    return new Response(JSON.stringify({
      ok: true,
      status: r.status,
      currentPeriodEnd: r.currentPeriodEnd,
      note: "Subscription cancelled — you keep Pro until the end of the current billing period."
    }), { status: 200, headers });
  } catch (e) {
    const msg = (e as Error).message ?? "Cancel failed";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
});
