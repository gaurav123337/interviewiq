/* send-security-digest — the Monday admin summary (docs/skill-counselor.md §4.4).
   One email with everything an admin needs to run the week:
     - Market trends: the latest sweep's stage counts + top movers (score deltas)
     - Structural proposals awaiting review (accept/ignore decision needed)
     - Resources auto-quarantined by the re-validation sweep (post-approval decay)
   Triggered by pg_cron (supabase/send-security-digest-cron.sql) with the
   SECURITY_DIGEST_SECRET header, or by an admin via their JWT (requireAdmin).
   Email goes through the shared sendEmail helper (RESEND_API_KEY secret). */

import { OWNER_EMAIL, requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { makeLimiter, clientKey } from "../_shared/ratelimit.ts";
import { sendEmail } from "../_shared/email.ts";
import { serviceClient } from "../_shared/serviceClient.ts";

const limitSend = makeLimiter(1, 60_000);
const DAY = 86_400_000;

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
    const secret = Deno.env.get("SECURITY_DIGEST_SECRET") ?? "";
    const sent = (req.headers.get("x-security-secret") ?? "").trim();
    const admin = await requireAdmin(req);
    if (!((secret !== "" && sent === secret) || admin)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden — cron secret or admin session required" }), { status: 401, headers });
    }
    if (!limitSend(clientKey(req))) {
      return new Response(JSON.stringify({ ok: false, error: "digest already sending" }), { status: 429, headers });
    }

    const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const service = serviceClient();

    /* ---- gather the week's state ---- */
    const [signals, proposals, quarantined, admins] = await Promise.all([
      service.from("skill_signals").select("skill_id, window_start, trend_score, stage, job_mentions_30d, job_mentions_90d").order("window_start", { ascending: false }).limit(400),
      service.from("update_proposals").select("id, skill_id, kind, reason, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(8),
      service.from("resources").select("url, title, guard").eq("status", "quarantined").gte("reviewed_at", new Date(Date.now() - 7 * DAY).toISOString()).limit(20),
      service.from("app_admins").select("email")
    ]);

    /* split signals into the latest window vs the previous one */
    const rows = (signals.data ?? []) as { skill_id: string; window_start: string; trend_score: number; stage: string; job_mentions_30d: number; job_mentions_90d: number }[];
    const latestWindow = rows[0]?.window_start;
    const latest = rows.filter(r => r.window_start === latestWindow);
    const prev = rows.filter(r => r.window_start !== latestWindow);

    const stageCounts: Record<string, number> = {};
    for (const r of latest) stageCounts[r.stage] = (stageCounts[r.stage] ?? 0) + 1;

    const prevBySkill = new Map(prev.map(p => [p.skill_id, p.trend_score]));
    const movers = latest
      .map(r => ({ skill: r.skill_id, score: r.trend_score, stage: r.stage, jobs30: r.job_mentions_30d, jobs90: r.job_mentions_90d, delta: Math.round((r.trend_score - (prevBySkill.get(r.skill_id) ?? r.trend_score)) * 10) / 10 }))
      .filter(m => m.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 8);

    const pending = (proposals.data ?? []) as { id: number; skill_id: string; kind: string; reason: string; created_at: string }[];
    const quarantinedRows = (quarantined.data ?? []) as { url: string; title: string; guard: unknown }[];
    const recipientEmails = [...new Set([OWNER_EMAIL, ...((admins.data ?? []) as { email: string }[]).map(a => a.email)])].filter(Boolean);

    /* ---- compose ---- */
    const date = new Date().toISOString().slice(0, 10);
    const lines: string[] = [];
    lines.push(`📈 InterviewIQ weekly digest — ${date}`);
    lines.push("");
    lines.push("MARKET TRENDS (latest sweep)");
    if (latestWindow) lines.push(`  window ${latestWindow} · ${latest.length} skills tracked`);
    const stages = ["mainstream", "growing", "emerging", "nascent", "declining"];
    const icons: Record<string, string> = { mainstream: "🔥", growing: "📈", emerging: "🆕", nascent: "🌱", declining: "📉" };
    lines.push("  " + stages.map(s => `${icons[s]} ${s}: ${stageCounts[s] ?? 0}`).join(" · "));
    if (movers.length) {
      lines.push("  Top movers:");
      for (const m of movers) {
        lines.push(`    ${m.delta > 0 ? "+" : ""}${m.delta} ${m.skill} → ${m.stage} (30d jobs ${m.jobs30}, 90d ${m.jobs90})`);
      }
    } else {
      lines.push("  No score changes since the previous sweep.");
    }
    lines.push("");
    lines.push(`PROPOSALS AWAITING YOUR REVIEW (${pending.length})`);
    if (pending.length) {
      for (const p of pending) lines.push(`  [${p.kind}] ${p.skill_id} — ${p.reason} (created ${p.created_at.slice(0, 10)})`);
      lines.push("  Decide them in Admin → Trends (accept/ignore, audit-logged).");
    } else {
      lines.push("  None — no stage crossings this week.");
    }
    lines.push("");
    lines.push(`AUTO-QUARANTINED RESOURCES (last 7 days) (${quarantinedRows.length})`);
    if (quarantinedRows.length) {
      for (const q of quarantinedRows) lines.push(`  ⛔ ${q.title || q.url} — ${JSON.stringify(q.guard).slice(0, 120)}`);
    } else {
      lines.push("  None — every approved link still passes re-validation.");
    }
    lines.push("");
    lines.push("— InterviewIQ · Admin dashboard → Security & Trends");

    const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#e6edf3;background:#0d1117;padding:24px;border-radius:12px">
      <h2 style="margin:0 0 12px">📈 InterviewIQ weekly digest — ${date}</h2>
      <h3 style="margin:16px 0 6px;color:#7ee787">Market trends ${latestWindow ? `(window ${latestWindow})` : ""}</h3>
      <p style="margin:0">${stages.map(s => `${icons[s]} ${s}: ${stageCounts[s] ?? 0}`).join(" · ")}</p>
      ${movers.length ? `<h4 style="margin:12px 0 4px;color:#58a6ff">Top movers</h4><ul style="margin:0;padding-left:20px">${movers.map(m => `<li>${m.delta > 0 ? "+" : ""}${m.delta} <b>${m.skill}</b> → ${m.stage} (30d jobs ${m.jobs30}, 90d ${m.jobs90})</li>`).join("")}</ul>` : "<p style=\"margin:4px 0\">No score changes since the previous sweep.</p>"}
      <h3 style="margin:16px 0 6px;color:#ffa657">Proposals awaiting your review (${pending.length})</h3>
      ${pending.length ? `<ul style="margin:0;padding-left:20px">${pending.map(p => `<li>[${p.kind}] <b>${p.skill_id}</b> — ${p.reason}</li>`).join("")}</ul><p style="margin:4px 0;color:#8b949e">Decide in Admin → Trends.</p>` : "<p style=\"margin:4px 0\">None — no stage crossings this week.</p>"}
      <h3 style="margin:16px 0 6px;color:#ff7b72">Auto-quarantined resources (${quarantinedRows.length})</h3>
      ${quarantinedRows.length ? `<ul style="margin:0;padding-left:20px">${quarantinedRows.map(q => `<li>⛔ ${q.title || q.url}</li>`).join("")}</ul>` : "<p style=\"margin:4px 0\">None — every approved link still passes re-validation.</p>"}
    </div>`;

    if (!apiKey) {
      return json(headers, 200, { ok: true, sent: false, reason: "no RESEND_API_KEY secret", digest: lines.join("\n") });
    }

    /* ---- send ---- */
    const results: { to: string; sent: boolean; note: string }[] = [];
    for (const to of recipientEmails) {
      const r = await sendEmail({ to, subject: `📈 InterviewIQ weekly digest — ${date}`, html, apiKey });
      results.push({ to, sent: r.sent, note: r.note });
    }

    return json(headers, 200, { ok: true, sent: results.some(r => r.sent), recipients: recipientEmails.length, results, digest: lines.join("\n") });
  } catch (e) {
    return json(headers, 500, { ok: false, error: e instanceof Error ? e.message : "digest failed" });
  }
});

function json(headers: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
