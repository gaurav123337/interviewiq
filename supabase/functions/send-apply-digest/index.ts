/* send-apply-digest — serverless email delivery for the weekly application
   digest (Apply Kit). Two paths:
     1. On demand — the app's "✉️ Email" button in the weekly report sends the
        signed-in user's OWN digest (body { to, text }): the caller's JWT is
        verified and `to` must be their own email (admins may send to anyone).
     2. Scheduled — a pg_cron job (see supabase/send-apply-digest-cron.sql)
        POSTs an EMPTY body every Monday 08:00 UTC. The broadcast path accepts
        the shared secret (x-apply-secret === APPLY_DIGEST_SECRET, env) for
        pg_cron, OR a signed-in admin's JWT for the dashboard's dry-run/send.
   Sends via Resend using the RESEND_API_KEY function secret only — the
   client never supplies a key (docs/app-security.md G3/G6). CORS is
   restricted to the app's origins. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getSecret } from "../_shared/secrets.ts";
import { composeDigest, type Track } from "../_shared/applyDigest.ts";
import { requireUser, requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";

/** Minimal text→HTML so the digest reads well in email clients. */
function renderHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = esc(text)
    .split(/\n{2,}/)
    .map(para => `<p style="margin:0 0 10px;color:#334155;line-height:1.6">${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#4f46e5;margin:0 0 4px">📬 InterviewIQ — weekly application digest</h2>
    <p style="color:#94a3b8;font-size:12px;margin:0 0 16px">Your application tracker, this week.</p>
    ${body}
    <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">Update your tracker in the app — the digest is generated from your current activity.</p>
  </div>`;
}

async function sendOne(apiKey: string, to: string, text: string, from: string): Promise<{ ok: boolean; id?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: "InterviewIQ — weekly application digest", text, html: renderHtml(text) })
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, id: (data as { id?: string }).id };
}

/* ------------------------------------------------------------------ */
/* Scheduled broadcast (pg_cron) — empty body + shared secret          */
/* ------------------------------------------------------------------ */

const APPLY_TRACK_KEY = "iq.applyTrack";

/* A { dryRun: true } body counts recipients without sending, so the admin
   panel can preview the blast before the pg_cron job fires it. */
async function handleBroadcast(req: Request, dryRun: boolean): Promise<Response> {
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };

  /* pg_cron carries the shared secret; the dashboard authenticates as admin */
  const secret = Deno.env.get("APPLY_DIGEST_SECRET") ?? "";
  const provided = req.headers.get("x-apply-secret") ?? "";
  const admin = await requireAdmin(req);
  if (!admin && !(secret && provided === secret)) {
    return new Response(JSON.stringify({ sent: false, reason: "forbidden — broadcast needs the cron secret or an admin session" }), { status: 401, headers });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  const apiKey = await getSecret("RESEND_API_KEY");
  if (!serviceKey || !apiKey) {
    return new Response(JSON.stringify({ sent: false, reason: apiKey ? "service role key missing" : "no Resend key — set the function secret RESEND_API_KEY" }), { status: 200, headers });
  }
  const adminClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  const { data: rows, error } = await adminClient.from("user_sync")
    .select("user_id, value")
    .eq("key", APPLY_TRACK_KEY);
  if (error || !rows?.length) {
    return new Response(JSON.stringify({ sent: false, reason: "no synced trackers to email", emailsSent: 0 }), { status: 200, headers });
  }

  const { data: users } = await adminClient.from("auth.users").select("id, email");
  const emailOf = new Map<string, string>((users ?? []).map((u: { id: string; email: string | null }) => [u.id, u.email ?? ""] as [string, string]));

  const recipients: { email: string; digest: string }[] = [];
  for (const row of rows as { user_id: string; value: unknown }[]) {
    const map = (row.value ?? {}) as Record<string, Track>;
    const digest = composeDigest(Object.values(map));
    const email = emailOf.get(row.user_id);
    if (!digest || !email) continue;
    recipients.push({ email, digest });
  }
  if (dryRun) {
    console.log(`[send-apply-digest] dry run — would email ${recipients.length} user${recipients.length === 1 ? "" : "s"}`);
    return new Response(JSON.stringify({ sent: false, dryRun: true, wouldEmail: recipients.length, recipients: recipients.map(r => r.email), reason: "dry run — nothing sent" }), { status: 200, headers });
  }
  let sent = 0;
  for (const r of recipients) {
    const out = await sendOne(apiKey, r.email, r.digest, "InterviewIQ <digest@interviewiq.app>");
    if (out.ok) sent++;
  }
  console.log(`[send-apply-digest] broadcast sent ${sent} digest${sent === 1 ? "" : "s"}`);
  return new Response(JSON.stringify({ sent: true, emailsSent: sent }), { status: 200, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ sent: false, reason: "origin not allowed" }), { status: 403, headers });
  }
  try {
    const body = await req.json().catch(() => ({})) as { to?: string; subject?: string; text?: string; from?: string; dryRun?: boolean };

    /* scheduled broadcast — pg_cron posts an empty body every Monday;
       the admin panel posts { dryRun: true } to preview the blast */
    if (!body.to) return handleBroadcast(req, !!body.dryRun);

    /* on-demand — signed-in user emails their OWN digest */
    const auth = await requireUser(req, { selfEmailOnly: true });
    if (!auth) {
      return new Response(JSON.stringify({ sent: false, reason: "forbidden — sign in to email your digest" }), { status: 401, headers });
    }
    const to = body.to ?? "";
    const text = body.text ?? "";
    if (!to.includes("@") || !text.trim()) {
      return new Response(JSON.stringify({ sent: false, reason: "recipient email and digest text are required" }), { status: 200, headers });
    }
    if (!auth.admin && to.trim().toLowerCase() !== auth.caller.email) {
      return new Response(JSON.stringify({ sent: false, reason: "forbidden — you can only email your own digest" }), { status: 403, headers });
    }
    const subject = body.subject ?? "InterviewIQ — weekly application digest";
    const from = body.from ?? "InterviewIQ <digest@interviewiq.app>";

    /* provider key: app-managed secret only — never accepted from the client */
    const apiKey = await getSecret("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ sent: false, reason: "no Resend key — set the function secret RESEND_API_KEY" }), { status: 200, headers });
    }

    const r = await sendOne(apiKey, to, text, from);
    return new Response(
      JSON.stringify({ sent: r.ok, id: r.id ?? null, reason: r.ok ? "sent" : "provider error" }),
      { status: r.ok ? 200 : 502, headers }
    );
  } catch (e) {
    return new Response(JSON.stringify({ sent: false, reason: "error: " + String(e) }), { status: 500, headers });
  }
});
