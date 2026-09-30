/* #135 follow-up — send-notify-test goes PER-USER and entitlement-gated.
   Auth: (a) any signed-in user's JWT → they test THEIR OWN user_notify_config
   row, and ONLY when their server entitlement grants auto-apply (platinum
   tier or the auto_apply addon; admins keep the bypass); (b) the shared
   NOTIFY_TEST_SECRET (engine/cron) → resolves via engine_notify_config()
   (entitled rows first, admin bypass included). Telegram's real verdict
   comes back either way. */

import { requireAdmin, serviceClient, callerFrom, isAdminUser } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";

function json(headers: Record<string, string>, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

/** True when the caller holds the dedicated function secret — engine and
    cron callers authenticate with x-apply-secret (send-apply-digest shape). */
function holdsNotifySecret(req: Request): boolean {
  const expected = Deno.env.get("NOTIFY_TEST_SECRET") ?? "";
  if (!expected) return false;
  return (req.headers.get("x-apply-secret") ?? "") === expected;
}

/** Server-verified auto-apply access for one user: platinum tier (active)
    or the auto_apply addon — mirroring the client's serverAutoApply() and
    the admin bypass rule (#100). */
async function hasAutoApply(admin: ReturnType<typeof serviceClient>, uid: string): Promise<boolean> {
  const client = admin;
  if (!client) return false;
  const { data } = await client.from("entitlements").select("tier, expires_at, addons").eq("user_id", uid).maybeSingle();
  if (data) {
    const e = data as { tier: string | null; expires_at: string | null; addons: Record<string, unknown> | null };
    const tierActive = e.tier === "platinum" && (!e.expires_at || new Date(e.expires_at) > new Date());
    const addon = (e.addons as { auto_apply?: { active?: boolean } } | null)?.auto_apply?.active === true;
    if (tierActive || addon) return true;
  }
  const { data: emailRow } = await client.from("profiles").select("email").eq("id", uid).maybeSingle();
  return !!(emailRow && (await isAdminUser((emailRow as { email?: string }).email ?? "")));
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

  const client = serviceClient();
  if (!client) return json(headers, { sent: false, reason: "service client unavailable" }, 500);

  /* resolve WHOSE config to test: the secret caller → engine resolution
     (entitled per-user row, admin bypass included); a signed-in user →
     their OWN row, gated on their server entitlement */
  let cfg: { chat_id: string; bot_token: string } | undefined;
  let who = "engine";
  if (holdsNotifySecret(req)) {
    const { data } = await client.rpc("engine_notify_config");
    cfg = (data ?? [])[0] as { chat_id: string; bot_token: string } | undefined;
  } else {
    const caller = await callerFrom(req);
    if (!caller) return json(headers, { sent: false, reason: "forbidden — sign in to test your Telegram binding" }, 401);
    who = caller.email;
    const { data: ent } = await client.from("profiles").select("id").eq("email", caller.email).maybeSingle();
    const uid = (ent as { id?: string } | null)?.id;
    if (!uid) return json(headers, { sent: false, reason: "profile not found" });
    if (!(await hasAutoApply(client, uid))) {
      return json(headers, { sent: false, reason: "💎 Telegram pings are part of the auto-apply engine (Platinum or the auto-apply add-on). Upgrade to bind your chat." });
    }
    const { data: rows } = await client.from("user_notify_config").select("chat_id, bot_token").eq("user_id", uid);
    cfg = (rows ?? [])[0] as { chat_id: string; bot_token: string } | undefined;
  }
  if (!cfg?.chat_id || !cfg?.bot_token) {
    return json(headers, { sent: false, reason: "no config — save a bot token and chat id first" });
  }

  const lines = await digestLines(client);
  let msg = "✅ InterviewIQ notify test — Telegram pings are live.\n\n📊 Last 7 days (engine → your verdicts):\n";
  msg += lines.length ? lines.join("\n") : "(no engine activity yet this week)";
  msg += `\n\nNeeds-review rows will ping this chat the moment the engine queues them.${who !== "engine" ? `\n(bound to ${who})` : ""}`;

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
  console.log(`[send-notify-test] delivered to chat ${cfg.chat_id} (message ${body.result?.message_id ?? "?"}) for ${who}`);
  return json(headers, { sent: true, message_id: body.result?.message_id ?? null });
});
