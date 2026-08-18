/* recovery-backup — email a copy of the freshly generated recovery codes
   (docs/app-security.md G8 extension).

   The user opts in at enrollment ("email me a backup copy"). The codes are
   emailed to the SIGNED-IN user's own verified address — never to an
   arbitrary recipient. Rate-limited to one email per 24h per account
   (recovery_backup_requests table), so a compromised session can't spam.

   Security tradeoff: codes in email are weaker than a password manager —
   the UI says so before sending. Single-use codes still cap the blast
   radius: each emailed code works exactly once. */

import { requireUser } from "../_shared/auth.ts";
import { getSecret } from "../_shared/secrets.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";
import { isValidRecoveryCode } from "../_shared/recoveryCodes.ts";
import { serviceClient } from "../_shared/serviceClient.ts";

const COOLDOWN_MS = 24 * 60 * 60 * 1000; /* one email per account per day */

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
    const caller = await requireUser(req);
    if (!caller) {
      return new Response(JSON.stringify({ ok: false, error: "sign in required" }), { status: 401, headers });
    }

    const body = (await req.json().catch(() => null)) as { codes?: unknown[]; email?: unknown } | null;
    const codes = Array.isArray(body?.codes) ? (body.codes as unknown[]).map((c) => String(c)) : [];
    if (codes.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "no codes to back up" }), { status: 400, headers });
    }
    for (const c of codes) {
      if (!isValidRecoveryCode(c)) {
        return new Response(JSON.stringify({ ok: false, error: "malformed recovery code" }), { status: 400, headers });
      }
    }

    const accountEmail = caller.caller.email.toLowerCase();
    const email = (body?.email ? String(body.email).trim().toLowerCase() : accountEmail).toLowerCase();
    if (email !== accountEmail) {
      /* only your own address — never an arbitrary inbox */
      return new Response(JSON.stringify({ ok: false, error: "email must match your account" }), { status: 403, headers });
    }

    const service = serviceClient();
    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const { count, error: countErr } = await service.from("recovery_backup_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);
    if (countErr) {
      return new Response(JSON.stringify({ ok: false, error: countErr.message }), { status: 500, headers });
    }
    if ((count ?? 0) >= 1) {
      return new Response(JSON.stringify({ ok: false, error: "already emailed — try again in 24 hours" }), { status: 429, headers });
    }
    await service.from("recovery_backup_requests").insert({ email }).then(() => {});

    const rowsHtml = codes.map(c => `<div style="font-family:monospace;font-size:15px;letter-spacing:1px;padding:8px 12px;margin:4px 0;background:#f1f5f9;border-radius:8px;color:#0f172a">${c}</div>`).join("");
    const r = await sendEmail({
      to: email,
      apiKey: await getSecret("RESEND_API_KEY"),
      subject: "InterviewIQ — your recovery codes backup",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">🔑 InterviewIQ recovery codes</h2>
        <p style="font-size:14px;line-height:1.5">Here is the backup copy of your one-time recovery codes.
        Keep them somewhere safe — each code works <b>once</b>. If you ever lose your authenticator app,
        enter one of these at the sign-in challenge to reset it.</p>
        ${rowsHtml}
        <p style="font-size:12px;color:#64748b;margin-top:16px">Codes stored in this email are a less-secure
        copy than a password manager — treat them like a password. Reply to nothing; this inbox is not monitored.</p>
      </div>`
    });

    if (!r.sent) {
      return new Response(JSON.stringify({ ok: false, error: r.note }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ ok: true, message: "Backup emailed — check your inbox" }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers });
  }
});
