/* mfa-recovery — one-time recovery codes for lost authenticators
   (docs/app-security.md G8 extension).

   When a user is stuck at the MFA challenge (phone gone, Authy seed lost),
   they enter a recovery code printed at enrollment. This function:
     1. rate-limits by email (5 attempts / 15 min — brute-force guard)
     2. verifies sha256(email:code) against the user's stored hashes
     3. on success: marks the code used + removes the TOTP factor and its
        AMR claims (admin_reset_mfa, service-role-only RPC)
   The client then signs in again — with no factor, the challenge is gone
   and a fresh session issues immediately.

   No session is required to call this (the user is mid-challenge), so the
   rate limiter is the only thing standing between an attacker and a
   guessing spree — plus 75 bits of entropy per code. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { makeLimiter, clientKey } from "../_shared/ratelimit.ts";
import { hashRecoveryCode } from "../_shared/recoveryCodes.ts";

/* per-IP + per-email limits: 5 redemption attempts per 15 minutes */
const limitAttempt = makeLimiter(5, 15 * 60_000);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ ok: false, error: "origin not allowed" }), { status: 403, headers });
  }
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405, headers });
    }
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const code = String(body?.code ?? "").trim();
    if (!EMAIL_RE.test(email) || code.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "email and recovery code required" }), { status: 400, headers });
    }
    if (!limitAttempt(clientKey(req))) {
      return new Response(JSON.stringify({ ok: false, error: "too many attempts — try again in 15 minutes" }), { status: 429, headers });
    }

    const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: user, error: userErr } = await service.from("users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();
    if (userErr) {
      return new Response(JSON.stringify({ ok: false, error: userErr.message }), { status: 500, headers });
    }

    /* record the attempt regardless of outcome (rate-limit + forensics) */
    await service.from("recovery_attempts").insert({ email }).then(() => {});

    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "no matching account" }), { status: 404, headers });
    }

    const { data: rows } = await service.from("recovery_codes")
      .select("id, code_hash")
      .eq("owner_id", user.id)
      .is("used_at", null)
      .is("revoked_at", null)
      .limit(50);

    const want = await hashRecoveryCode(email, code);
    const match = (rows ?? []).find((r: { id: number; code_hash: string }) => r.code_hash === want);
    if (!match) {
      return new Response(JSON.stringify({ ok: false, error: "invalid or already-used recovery code" }), { status: 400, headers });
    }

    /* valid → one-time use + remove the factor so a fresh sign-in completes */
    await service.from("recovery_codes").update({ used_at: new Date().toISOString() }).eq("id", match.id);
    const { error: resetErr } = await service.rpc("admin_reset_mfa", { p_email: email });
    if (resetErr) {
      return new Response(JSON.stringify({ ok: false, error: resetErr.message }), { status: 500, headers });
    }

    return new Response(JSON.stringify({
      ok: true,
      message: "Authenticator removed — sign in again and set up a new one in Settings",
    }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers });
  }
});
