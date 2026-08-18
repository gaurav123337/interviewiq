/* pay-refund — admin-initiated payment refund.
   Provider-agnostic, JWT-gated (verify_jwt: true). Mirrors pay-cancel:
   - the caller MUST be an admin — verified server-side by looking up the
     caller's email in app_admins with the service-role client (the client's
     claim is never trusted), and
   - the payment is looked up first, so an admin can only refund payments
     that actually exist (and the payment's user/plan/amount come from the
     DB, never from the request).
   Then:
   1. the admin-published refund policy (app_config → refund_policy) is
      enforced — purchases inside the grace window always refund; outside it,
      a per-user refund cap applies unless the admin overrides explicitly;
   2. when the provider keys are configured, the real refund API is called
      (full, or partial when amountMinor is given — money actually moves);
   3. the payment is marked refunded through the shared apply_refund SQL
      helper (service role) — the exact same path the payment.refunded
      webhook uses — which subtracts the plan's days (scaled for partials)
      and lands in the billing audit trail with the reason + amount;
   4. when RESEND_API_KEY is set, the user gets a refund email.
   Without provider keys this is the honest test loop: the in-app state
   flips and a note says the provider wasn't contacted. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaymentProvider, refundPolicyCheck, type ProviderEnv, type RefundPolicy } from "../_shared/payment.ts";
import { getSecret } from "../_shared/secrets.ts";
import { sendRefundEmail } from "../_shared/email.ts";

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

    const body = await req.json().catch(() => ({})) as {
      providerPaymentId?: string; reason?: string; amountMinor?: number; override?: boolean;
    };
    const providerPaymentId = String(body.providerPaymentId ?? "").trim();
    const reason = String(body.reason ?? "").trim().slice(0, 200) || undefined;
    const amountMinor = Number.isFinite(body.amountMinor) && Number(body.amountMinor) > 0 ? Math.round(Number(body.amountMinor)) : undefined;
    const override = Boolean(body.override);
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

    /* payment lookup — user/plan/amount come from the DB, never the request */
    const { data: pay, error: payErr } = await admin.from("payments")
      .select("user_id, plan, provider, amount_minor, currency, created_at")
      .eq("provider_payment_id", providerPaymentId).maybeSingle();
    if (payErr || !pay) {
      return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404, headers });
    }
    if (amountMinor && amountMinor > pay.amount_minor) {
      return new Response(JSON.stringify({ error: `Refund amount can't exceed the paid amount (${pay.amount_minor} minor units)` }), { status: 400, headers });
    }

    /* refund policy — grace window + per-user cap, enforced server-side */
    const { data: policyRow } = await admin.from("app_config")
      .select("value").eq("key", "refund_policy").maybeSingle();
    const policy = (policyRow?.value ?? null) as RefundPolicy | null;
    const { data: refunded } = await admin.from("payments")
      .select("id").eq("user_id", pay.user_id).eq("status", "refunded");
    const refundCount = (refunded ?? []).length;
    const purchaseAgeDays = Math.max(0, (Date.now() - new Date(pay.created_at).getTime()) / 86_400_000);
    const decision = refundPolicyCheck({ policy, refundCount, purchaseAgeDays, override });
    if (!decision.allowed) {
      return new Response(JSON.stringify({ error: decision.message ?? "Refund blocked by policy" }), { status: 409, headers });
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
      p_reason: reason,
      p_amount_minor: amountMinor ?? null,
      p_within_grace: decision.withinGrace
    });
    if (refErr) throw new Error("apply_refund: " + refErr.message);

    /* refund email — Resend when configured, clean no-op otherwise */
    const { data: profile } = await admin.from("profiles").select("email").eq("id", pay.user_id).maybeSingle();
    const amountLabel = `${pay.currency} ${((amountMinor ?? pay.amount_minor) / 100).toFixed(2)}`;
    const mail = await sendRefundEmail({
      to: profile?.email ?? "",
      plan: pay.plan,
      amountLabel,
      reason,
      refundId: providerRefundId,
      apiKey: await getSecret("RESEND_API_KEY")
    });

    return new Response(JSON.stringify({
      ok: true,
      providerStatus,
      providerRefundId,
      amountMinor: amountMinor ?? pay.amount_minor,
      withinGrace: decision.withinGrace,
      emailSent: mail.sent,
      emailNote: mail.note,
      note: note || `Refunded via ${pay.provider}${providerRefundId ? ` (refund ${providerRefundId})` : ""} — entitlement days subtracted.`
    }), { status: 200, headers });
  } catch (e) {
    const msg = (e as Error).message ?? "Refund failed";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
});
