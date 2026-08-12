/* pay-refund — admin-initiated payment refund.
   Provider-agnostic, JWT-gated (verify_jwt: true). Mirrors pay-cancel:
   - the caller MUST be an admin — verified server-side by looking up the
     caller's email in app_admins with the service-role client (the client's
     claim is never trusted), and
   - the payment is looked up first, so an admin can only refund payments
     that actually exist (and the payment's user/plan are taken from the DB,
     never from the request).
   Then, when the provider keys are configured, the real refund API is
   called (money actually moves). Whether or not the provider call ran, the
   payment is marked refunded through the shared apply_refund SQL helper
   (service role) — the exact same path the payment.refunded webhook uses —
   which subtracts the plan's days and lands in the billing audit trail with
   the reason. Without provider keys this is the honest test loop: the
   in-app state flips and a note says the provider wasn't contacted. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaymentProvider, type ProviderEnv } from "../_shared/payment.ts";

const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
});

/** True when the active provider's credentials are present in the env —
    used to decide whether the provider API can actually be called. */
function providerConfigured(env: ProviderEnv): boolean {
  const provider = (env.PAYMENT_PROVIDER ?? "razorpay").toLowerCase();
  if (provider === "stripe") return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET);
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
      return new Response(JSON.stringify({ error: "Sign in as an admin to refund a payment" }), { status: 401, headers });
    }

    const body = await req.json().catch(() => ({})) as { providerPaymentId?: string; reason?: string; amountMinor?: number };
    const providerPaymentId = String(body.providerPaymentId ?? "").trim();
    const reason = String(body.reason ?? "").trim().slice(0, 200) || undefined;
    const amountMinor = Number.isFinite(body.amountMinor) && Number(body.amountMinor) > 0 ? Number(body.amountMinor) : undefined;
    if (!providerPaymentId) {
      return new Response(JSON.stringify({ error: "Missing payment id" }), { status: 400, headers });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: "service role key not configured" }), { status: 500, headers });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

    /* admin check — the caller's email must be on the allow-list */
    const email = (data.user.email ?? "").trim().toLowerCase();
    const { data: adminRow } = email
      ? await admin.from("app_admins").select("email").eq("email", email).maybeSingle()
      : { data: null };
    if (!adminRow) {
      return new Response(JSON.stringify({ error: "Admins only — this account isn't on the admin allow-list" }), { status: 403, headers });
    }

    /* payment lookup — user/plan come from the DB, never the request */
    const { data: pay, error: payErr } = await admin.from("payments")
      .select("user_id, plan, provider")
      .eq("provider_payment_id", providerPaymentId).maybeSingle();
    if (payErr || !pay) {
      return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404, headers });
    }

    const env = Deno.env.toObject() as ProviderEnv;
    let providerRefundId: string | null = null;
    let providerStatus: string | null = null;
    let note = "";

    if (providerConfigured(env)) {
      const provider = getPaymentProvider(env);
      const r = await provider.refundPayment(providerPaymentId, amountMinor);
      providerStatus = r.status;
      providerRefundId = r.refundId;
    } else {
      note = "Provider keys not configured — refund recorded in-app only (test mode; no money moved).";
    }

    const { error: refErr } = await admin.rpc("apply_refund", {
      p_provider_payment_id: providerPaymentId,
      p_reason: reason
    });
    if (refErr) throw new Error("apply_refund: " + refErr.message);

    return new Response(JSON.stringify({
      ok: true,
      providerStatus,
      providerRefundId,
      note: note || `Refunded via ${pay.provider}${providerRefundId ? ` (refund ${providerRefundId})` : ""} — entitlement days subtracted.`
    }), { status: 200, headers });
  } catch (e) {
    const msg = (e as Error).message ?? "Refund failed";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
});
