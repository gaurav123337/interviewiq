/* The caller tests only their own notification binding and own weekly digest.
   The legacy function secret is restricted to the verified migration owner;
   a missing tenant migration never falls back to a global notification row. */
import { serviceClient } from "../_shared/serviceClient.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { makeLimiter, clientKey } from "../_shared/ratelimit.ts";
import { constantTimeEqual } from "../_shared/applyAgent.ts";

const limit = makeLimiter(5, 60_000);
const bytes = (s: string) => new TextEncoder().encode(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method !== "POST") return json(405, { sent: false, reason: "POST required" });
  if (!isAllowedOrigin(req)) return json(403, { sent: false, reason: "origin not allowed" });

  try {
    const client = serviceClient();
    const expected = Deno.env.get("NOTIFY_TEST_SECRET") ?? "";
    const supplied = req.headers.get("x-apply-secret") ?? "";
    let uid: string | null = null;
    if (expected && supplied && constantTimeEqual(bytes(expected), bytes(supplied))) {
      const { data, error } = await client.rpc("apply_legacy_user_id");
      if (!error) uid = data as string;
    } else {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
      if (token) {
        const { data, error } = await client.auth.getUser(token);
        if (!error) uid = data.user?.id ?? null;
      }
    }
    if (!uid) return json(401, { sent: false, reason: "Sign in to test your Telegram binding" });
    if (!limit(`${uid}:${clientKey(req)}`)) return json(429, { sent: false, reason: "Try again in a minute" });
    const access = await client.rpc("has_auto_apply_access", { p_user: uid });
    if (access.error || access.data !== true) return json(403, { sent: false, reason: "An active auto-apply plan or complimentary grant is required" });

    const config = await client.rpc("apply_agent_action", { p_user: uid, p_action: "notify.get", p_args: {} });
    const digest = await client.rpc("apply_agent_action", { p_user: uid, p_action: "digest.weekly", p_args: {} });
    if (config.error || digest.error) return json(503, { sent: false, reason: "Personal notification data is unavailable" });
    const cfg = config.data as { chat_id?: string; bot_token?: string } | null;
    if (!cfg?.chat_id || !cfg.bot_token) return json(400, { sent: false, reason: "Save your chat ID and bot token first" });
    const rows = (digest.data ?? []) as Array<{
      site_host: string; submitted: number; needs_review: number; skipped: number; errors: number;
      owner_applied: number; owner_dismissed: number; owner_closed: number;
    }>;
    const lines = rows.map(r => `${r.site_host}: engine ✅${r.submitted ?? 0} ⏸${r.needs_review ?? 0} ⏭${r.skipped ?? 0} ✗${r.errors ?? 0}` +
      ` — you: ✅${r.owner_applied ?? 0} ✕${r.owner_dismissed ?? 0} 🚫${r.owner_closed ?? 0}`);
    const message = "✅ InterviewIQ notification test\n\n📊 Your last 7 days:\n" +
      (lines.length ? lines.join("\n") : "No application activity yet this week.");
    const response = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.chat_id, text: message.slice(0, 3900), disable_web_page_preview: true }),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; result?: { message_id?: number } } | null;
    if (!response.ok || !result?.ok) return json(502, { sent: false, reason: "Telegram rejected the message; check your bot and chat settings" });
    return json(200, { sent: true, message_id: result.result?.message_id ?? null });
  } catch {
    // Error strings can contain a Telegram URL with its bearer token.
    return json(503, { sent: false, reason: "Notification service unavailable" });
  }
});
