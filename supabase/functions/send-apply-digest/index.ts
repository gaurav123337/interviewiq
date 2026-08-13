/* send-apply-digest — serverless email delivery for the weekly application
   digest (Apply Kit). Two paths:
     1. On demand — the app's "✉️ Email" button in the weekly report sends the
        signed-in user's own digest (composed client-side): body { to, text }.
     2. Scheduled — a pg_cron job (see supabase/send-apply-digest-cron.sql)
        POSTs an EMPTY body every Monday 08:00 UTC. The function then reads
        every user's synced tracker (user_sync key "iq.applyTrack") and emails
        each active user their digest. The broadcast path requires the shared
        secret (x-apply-secret === APPLY_DIGEST_SECRET) so random callers
        can't trigger mass mail.
   Sends via Resend when RESEND_API_KEY is configured as a function secret;
   otherwise it answers sent:false with a clear reason so the client can fall
   back to its mailto link. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { composeDigest, type Track } from "../_shared/applyDigest.ts";

const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-apply-secret, x-resend-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
});

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

async function handleBroadcast(req: Request): Promise<Response> {
  const headers = { ...cors(req), "Content-Type": "application/json" };
  const secret = Deno.env.get("APPLY_DIGEST_SECRET") ?? "";
  /* the broadcast path is only reachable through the pg_cron job, which
     carries the shared secret in x-apply-secret */
  const provided = req.headers.get("x-apply-secret");
  if (!secret) {
    return new Response(JSON.stringify({ sent: false, reason: "broadcast disabled — set the function secret APPLY_DIGEST_SECRET and the pg_cron job" }), { status: 200, headers });
  }
  if (provided !== secret) {
    return new Response(JSON.stringify({ sent: false, reason: "forbidden — missing or wrong x-apply-secret" }), { status: 401, headers });
  }
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!serviceKey || !apiKey) {
    return new Response(JSON.stringify({ sent: false, reason: apiKey ? "service role key missing" : "no Resend key — set the function secret RESEND_API_KEY" }), { status: 200, headers });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  const { data: rows, error } = await admin.from("user_sync")
    .select("user_id, value")
    .eq("key", APPLY_TRACK_KEY);
  if (error || !rows?.length) {
    return new Response(JSON.stringify({ sent: false, reason: "no synced trackers to email", emailsSent: 0 }), { status: 200, headers });
  }

  const { data: users } = await admin.from("auth.users").select("id, email");
  const emailOf = new Map((users ?? []).map((u: { id: string; email: string | null }) => [u.id, u.email]));

  let sent = 0;
  for (const row of rows as { user_id: string; value: unknown }[]) {
    const map = (row.value ?? {}) as Record<string, Track>;
    const digest = composeDigest(Object.values(map));
    const email = emailOf.get(row.user_id);
    if (!digest || !email) continue;
    const r = await sendOne(apiKey, email, digest, "InterviewIQ <digest@interviewiq.app>");
    if (r.ok) sent++;
  }
  console.log(`[send-apply-digest] broadcast sent ${sent} digest${sent === 1 ? "" : "s"}`);
  return new Response(JSON.stringify({ sent: true, emailsSent: sent }), { status: 200, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });

  const headers = { ...cors(req), "Content-Type": "application/json" };
  try {
    const body = await req.json().catch(() => ({})) as { to?: string; subject?: string; text?: string; from?: string };

    /* scheduled broadcast — pg_cron posts an empty body every Monday */
    if (!body.to) return handleBroadcast(req);

    const to = body.to ?? "";
    const text = body.text ?? "";
    if (!to.includes("@") || !text.trim()) {
      return new Response(JSON.stringify({ sent: false, reason: "recipient email and digest text are required" }), { status: 200, headers });
    }
    const subject = body.subject ?? "InterviewIQ — weekly application digest";
    const from = body.from ?? "InterviewIQ <digest@interviewiq.app>";

    /* provider key: function secret wins, else the admin-supplied per-request
       key (stored only in the admin's browser, never published to clients) */
    const apiKey = Deno.env.get("RESEND_API_KEY") ?? req.headers.get("x-resend-key") ?? "";
    if (!apiKey) {
      return new Response(JSON.stringify({ sent: false, reason: "no Resend key — set the function secret RESEND_API_KEY or enter one in the admin digest card" }), { status: 200, headers });
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
