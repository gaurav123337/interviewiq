/* test-email — one-click validation of the RESEND_API_KEY secret from the
   Admin → Secrets dashboard. Sends a plain test email to the CALLER's own
   verified address only (never an arbitrary inbox), proving the whole email
   path — secret present, key valid, Resend reachable — end-to-end without
   touching user data.

   Security: POST only, caller must be a signed-in ADMIN (Supabase JWT
   verified server-side against app_admins / the owner, plus the MFA
   enforcement gate). CORS restricted to the app's origins. */

import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ ok: false, error: "origin not allowed" }), { status: 403, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405, headers });
  }
  try {
    const admin = await requireAdmin(req);
    if (!admin) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden — admin session required" }), { status: 401, headers });
    }

    /* the admin may pick the recipient (default: their own address). Resend
       TEST keys only deliver to the key owner's own inbox (e.g. a
       garudagaura@gmail.com-owned key), so an optional `to` lets the admin
       verify against the address the key can actually reach. Admin-gated,
       so a non-admin can never use this as an open relay. */
    const body = (await req.json().catch(() => ({}))) as { to?: unknown };
    const to = typeof body?.to === "string" && body.to.includes("@") ? body.to.trim().toLowerCase() : admin.email;

    const r = await sendEmail({
      to,
      apiKey: Deno.env.get("RESEND_API_KEY") ?? "",
      subject: "InterviewIQ — test email ✅",
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">✅ InterviewIQ test email</h2>
        <p style="font-size:14px;line-height:1.6">If you're reading this, the <code>RESEND_API_KEY</code> function secret is
        configured and the email path works end-to-end. Sent from the Admin → Secrets dashboard.</p>
      </div>`
    });

    if (!r.sent) {
      return new Response(JSON.stringify({ ok: false, sent: false, error: r.note }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ ok: true, sent: true, note: `Test email sent to ${to} — check that inbox` }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "error: " + String(e) }), { status: 500, headers });
  }
});
