/* send-notify-test — serverless Telegram test-fire for the notify binding.
   The SQL twin (admin_test_notify_config) needs pg_net, which this hosted
   project cannot install via SQL; this function needs nothing beyond fetch.
   Deployed with --no-verify-jwt (the gateway cannot verify sb_secret_
   bearers); auth is enforced HERE: an admin's user JWT, or the shared
   NOTIFY_TEST_SECRET function secret via x-apply-secret (the engine/cron
   convention, set once via `supabase secrets set`). Sends a confirmation
   DM whose body carries the weekly digest, and returns Telegram's REAL
   verdict so the panel can surface bad tokens / wrong chat ids. */

import { requireAdmin, serviceClient } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";

function json(headers: Record<string, string>, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

/** True when the caller holds the dedicated function secret — engine and
    cron callers authenticate with x-apply-secret (send-apply-digest shape). */
function holdsNotifySecret(req: Request): boolean {
  const expected = Deno.env.get("NOTIFY_TEST_SECRET") ?? "";
  if (!expected) return false;
  const provided = req.headers.get("x-apply-secret") ?? "";
  return provided === expected;
}

/** Weekly digest lines: engine decisions beside owner verdicts per board. */
async function digestLines(admin: ReturnType<typeof serviceClient>): Promise<string[]> {
  if (!admin) return [];
  const { data } = await admin.rpc("admin_apply_weekly_digest");
  const rows = (data ?? []) as {
    site_host: string; submitted: number; needs_review: number; skipped: number; errors: number;
    owner_applied: number; owner_dismissed: number; owner_closed: number;
  }[];
  return rows.map(r =>
    `${r.site_host}: engine ✅${r.submitted ?? 0} ⏸${r.needs_review ?? 0} ⏭${r.skipped ?? 0} ✗${r.errors ?? 0}` +
    ` — you: ✅${r.owner_applied ?? 0} ✕${r.owner_dismissed ?? 0} 🚫${r.owner_closed ?? 0}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) return json(headers, { sent: false, reason: "origin not allowed" }, 403);

  const admin = holdsNotifySecret(req) ? { uid: "service", email: "service@internal" } : await requireAdmin(req);
  if (!admin) return json(headers, { sent: false, reason: "forbidden" }, 401);

  const client = serviceClient();
  if (!client) return json(headers, { sent: false, reason: "service client unavailable" }, 500);

  const { data: cfgRows } = await client.from("notify_config").select("chat_id, bot_token").eq("key", "telegram");
  const cfg = (cfgRows ?? [])[0];
  if (!cfg?.chat_id || !cfg?.bot_token) {
    return json(headers, { sent: false, reason: "no config — save a bot token and chat id first" });
  }

  const lines = await digestLines(client);
  let msg = "✅ InterviewIQ notify test — Telegram pings are live.\n\n📊 Last 7 days (engine → your verdicts):\n";
  msg += lines.length ? lines.join("\n") : "(no engine activity yet this week)";
  msg += "\n\nNeeds-review rows will ping this chat the moment the engine queues them.";

  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.chat_id, text: msg.slice(0, 3900), disable_web_page_preview: true }),
    });
  } catch (e) {
    return json(headers, { sent: false, reason: `network error: ${String(e).slice(0, 120)}` });
  }
  const body = await res.json().catch(() => ({})) as { ok?: boolean; description?: string; result?: { message_id?: number } };
  if (!res.ok || !body.ok) {
    return json(headers, { sent: false, reason: body.description ?? `Telegram HTTP ${res.status}` });
  }
  console.log(`[send-notify-test] delivered to chat ${cfg.chat_id} (message ${body.result?.message_id ?? "?"})`);
  return json(headers, { sent: true, message_id: body.result?.message_id ?? null });
});
