/* send-recommendations-digest — serverless email delivery for the weekly
   company-recommendations digest (Best-fit / top picks). Two paths:
     1. On demand — a signed-in client posts { to, text }: the function sends
        the composed digest (the client composes it from the same pure code
        the app shows).
     2. Scheduled — a pg_cron job (see supabase/send-recommendations-digest-cron.sql)
        POSTs an EMPTY body every Monday 08:00 UTC. The function then reads
        every user's uploaded resume (uploaded_resumes → extracted profile),
        ranks the live feed with the SAME match engine the app uses
        (_shared/recommendationsDigest.ts), and emails each user their picks.
        The broadcast path accepts the shared secret (x-apply-secret ===
        RECS_DIGEST_SECRET, env) for pg_cron, OR a signed-in admin's JWT for
        the dashboard's dry-run/send.
   On demand, a signed-in user emails their OWN digest ({ to, text }) — the
   JWT is verified and `to` must be their own email (admins may send to
   anyone). Sends via Resend using the RESEND_API_KEY function secret only —
   the client never supplies a key (docs/app-security.md G3/G6). CORS is
   restricted to the app's origins. */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getSecret } from "../_shared/secrets.ts";
import { composeIndiaDigest, composeRecommendationsDigest, type Job, type Profile } from "../_shared/recommendationsDigest.ts";
import { requireUser, requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";

/** Minimal text→HTML so the digest reads well in email clients. */
function renderHtml(text: string, title: string, subtitle: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = esc(text)
    .split(/\n{2,}/)
    .map(para => `<p style="margin:0 0 10px;color:#334155;line-height:1.6">${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#4f46e5;margin:0 0 4px">${esc(title)}</h2>
    <p style="color:#94a3b8;font-size:12px;margin:0 0 16px">${esc(subtitle)}</p>
    ${body}
    <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">Update your resume in the app — the digest is generated from your current profile and the live feed.</p>
  </div>`;
}

async function sendOne(apiKey: string, to: string, text: string, from: string, subject: string, title: string, subtitle: string): Promise<{ ok: boolean; id?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, html: renderHtml(text, title, subtitle) })
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, id: (data as { id?: string }).id };
}

/* ------------------------------------------------------------------ */
/* Scheduled broadcast (pg_cron) — empty body + shared secret.         */
/* A { dryRun: true } body counts recipients without sending, so the   */
/* admin panel can preview the blast before the cron goes live.        */
/* ------------------------------------------------------------------ */

async function handleBroadcast(req: Request, dryRun: boolean, kind: string): Promise<Response> {
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  /* pg_cron carries the shared secret; the dashboard authenticates as admin */
  const secret = Deno.env.get("RECS_DIGEST_SECRET") ?? "";
  const provided = req.headers.get("x-apply-secret") ?? "";
  const caller = await requireAdmin(req);
  if (!caller && !(secret && provided === secret)) {
    return new Response(JSON.stringify({ sent: false, reason: "forbidden — broadcast needs the cron secret or an admin session" }), { status: 401, headers });
  }
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  const apiKey = await getSecret("RESEND_API_KEY");
  if (!serviceKey || !apiKey) {
    return new Response(JSON.stringify({ sent: false, reason: apiKey ? "service role key missing" : "no Resend key — set the function secret RESEND_API_KEY" }), { status: 200, headers });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  /* everyone who synced an uploaded resume (its extracted profile is the
     source of truth for matching) */
  const { data: resumes, error } = await admin.from("uploaded_resumes").select("user_id, data");
  if (error || !resumes?.length) {
    return new Response(JSON.stringify({ sent: false, reason: "no uploaded resumes to rank", emailsSent: 0 }), { status: 200, headers });
  }

  const { data: jobRows } = await admin.from("jobs")
    .select("source, external_id, title, company, location, remote, description, url, skills, level, salary, company_size, posted_at");
  const jobs: Job[] = (jobRows ?? []).map((j: Record<string, unknown>) => ({
    title: String(j.title ?? ""),
    company: String(j.company ?? ""),
    location: (j.location as string) ?? "",
    remote: Boolean(j.remote),
    level: (j.level as string) ?? null,
    skills: Array.isArray(j.skills) ? (j.skills as string[]) : []
  }));
  if (!jobs.length) {
    return new Response(JSON.stringify({ sent: false, reason: "no jobs in the feed to rank", emailsSent: 0 }), { status: 200, headers });
  }

  const { data: users } = await admin.from("auth.users").select("id, email");
  const emailOf = new Map<string, string>((users ?? []).map((u: { id: string; email: string | null }) => [u.id, u.email ?? ""] as [string, string]));

  const india = kind === "india";
  const subject = india ? "InterviewIQ — weekly 🇮🇳 India & startup recommendations" : "InterviewIQ — weekly company recommendations";
  const title = india ? "🇮🇳 InterviewIQ — India & startup recommendations" : "🏆 InterviewIQ — weekly company recommendations";
  const subtitle = india
    ? "Your best-fit Indian-market & startup companies, scored from your resume."
    : "Your best-fit companies, scored from your resume.";
  const recipients: { email: string; digest: string }[] = [];
  for (const row of resumes as { user_id: string; data: unknown }[]) {
    const profile = ((row.data ?? {}) as { profile?: Profile }).profile ?? null;
    const digest = india ? composeIndiaDigest(profile, jobs) : composeRecommendationsDigest(profile, jobs);
    const email = emailOf.get(row.user_id);
    if (!digest || !email) continue;
    recipients.push({ email, digest });
  }
  if (dryRun) {
    console.log(`[send-recommendations-digest] ${india ? "india " : ""}dry run — would email ${recipients.length} user${recipients.length === 1 ? "" : "s"}`);
    return new Response(JSON.stringify({ sent: false, dryRun: true, wouldEmail: recipients.length, recipients: recipients.map(r => r.email), reason: "dry run — nothing sent" }), { status: 200, headers });
  }
  let sent = 0;
  for (const r of recipients) {
    const out = await sendOne(apiKey, r.email, r.digest, "InterviewIQ <digest@interviewiq.app>", subject, title, subtitle);
    if (out.ok) sent++;
  }
  console.log(`[send-recommendations-digest] broadcast sent ${sent} ${india ? "india " : ""}digest${sent === 1 ? "" : "s"}`);
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
       the admin panel posts { dryRun: true } to preview the blast, or
       { kind: "india" } for the India & startup digest */
    if (!body.to) return handleBroadcast(req, !!body.dryRun, (body as { kind?: string }).kind ?? "default");

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
    const subject = body.subject ?? "InterviewIQ — weekly company recommendations";
    const from = body.from ?? "InterviewIQ <digest@interviewiq.app>";

    /* provider key: app-managed secret only — never accepted from the client */
    const apiKey = await getSecret("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ sent: false, reason: "no Resend key — set the function secret RESEND_API_KEY" }), { status: 200, headers });
    }

    /* on-demand is the caller's own digest (default kind) — pass the full
       subject/title/subtitle; previously these were undefined here, so the
       email went out without a subject. */
    const r = await sendOne(apiKey, to, text, from, subject, "🏆 InterviewIQ — weekly company recommendations", "Your best-fit companies, scored from your resume.");
    return new Response(
      JSON.stringify({ sent: r.ok, id: r.id ?? null, reason: r.ok ? "sent" : "provider error" }),
      { status: r.ok ? 200 : 502, headers }
    );
  } catch (e) {
    return new Response(JSON.stringify({ sent: false, reason: "error: " + String(e) }), { status: 500, headers });
  }
});
