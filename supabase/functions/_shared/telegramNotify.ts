/* Own-user binding only. Keep transport/auth/storage injected so tests never
   import the Deno entrypoint, load credentials, or send real Telegram messages. */
import { constantTimeEqual } from "./applyAgent.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "./cors.ts";

export const TELEGRAM_TOKEN_RE = /^[0-9]{5,16}:[A-Za-z0-9_-]{20,128}$/;
export const TELEGRAM_CHAT_RE = /^-?[1-9][0-9]{0,19}$/;
export const TELEGRAM_MAX_BODY_BYTES = 4096;
export const TELEGRAM_TIMEOUT_MS = 15_000;

export interface NotifyMetadata {
  chat_id: string | null;
  has_token: boolean;
  time_zone: string;
  delivery_tested_at: string | null;
  updated_at: string | null;
  revision: number;
}
export interface BindingResult {
  ok: boolean;
  reason?: string;
  config?: NotifyMetadata | null;
  bot_token?: string | null;
}
export interface TelegramNotifyDeps {
  verifyJwt(token: string): Promise<string | null>;
  legacyOwner(): Promise<string | null>;
  legacySecret: string;
  hasAccess(userId: string): Promise<boolean>;
  binding(userId: string, operation: string, args: Record<string, unknown>): Promise<BindingResult>;
  fetch: typeof fetch;
}

type Operation = "save" | "test" | "unbind";
type Revision = number | null;
class InvalidSettings extends Error {}

async function readBounded(body: ReadableStream<Uint8Array> | null, max: number): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new InvalidSettings();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function requestBody(req: Request): Promise<Record<string, unknown>> {
  const length = req.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > TELEGRAM_MAX_BODY_BYTES)) {
    throw new InvalidSettings();
  }
  try {
    const text = await readBounded(req.body, TELEGRAM_MAX_BODY_BYTES);
    const value: unknown = text.trim() ? JSON.parse(text) : {};
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new InvalidSettings();
    return value as Record<string, unknown>;
  } catch {
    throw new InvalidSettings();
  }
}

function revision(value: unknown): Revision {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new InvalidSettings();
  return value;
}

function boundedString(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max) throw new InvalidSettings();
  return value.trim();
}

export function notifyTimeZone(value: unknown = "UTC"): string {
  const zone = boundedString(value, 100);
  if (!zone || /^[-+]\d/.test(zone)) throw new InvalidSettings();
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    throw new InvalidSettings();
  }
}

/** Explicit projection protects the response even if a storage adapter returns secrets. */
function metadata(value: NotifyMetadata | null | undefined): NotifyMetadata | null {
  if (!value) return null;
  return {
    chat_id: value.chat_id,
    has_token: value.has_token,
    time_zone: value.time_zone,
    delivery_tested_at: value.delivery_tested_at,
    updated_at: value.updated_at,
    revision: value.revision,
  };
}

async function sendTelegram(deps: TelegramNotifyDeps, chatId: string, botToken: string) {
  try {
    const response = await deps.fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "InterviewIQ Telegram delivery test.\nNotification delivery works. Settings are saved only after this test succeeds.",
        disable_web_page_preview: true,
      }),
    });
    const result = JSON.parse(await readBounded(response.body, 16_384)) as {
      ok?: unknown;
      result?: { message_id?: unknown };
    } | null;
    if (!response.ok || result?.ok !== true) return { sent: false, reason: "telegram_rejected" };
    const id = result.result?.message_id;
    return { sent: true, message_id: typeof id === "number" && Number.isSafeInteger(id) ? id : null };
  } catch {
    // Fetch errors can contain the bearer token in the URL; never expose/log them.
    return { sent: false, reason: "telegram_unavailable" };
  }
}

export function createTelegramNotifyHandler(deps: TelegramNotifyDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === "OPTIONS") return preflightResponse(req);
    const headers = { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" };
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
    let sent = false;
    const fail = (status: number, reason: string, message: string) => json(status, { sent, reason, message });
    if (req.method !== "POST") return fail(405, "method_not_allowed", "POST required");
    if (!isAllowedOrigin(req)) return fail(403, "origin_not_allowed", "Origin not allowed");
    try {
      const body = await requestBody(req);
      const legacyBody = Object.keys(body).length === 0;
      const operation = legacyBody ? "test" : body.operation as Operation;
      if (!["save", "test", "unbind"].includes(operation)) throw new InvalidSettings();
      const allowed = operation === "save" ? ["operation", "chatId", "botToken", "timeZone", "revision"] : ["operation", "revision"];
      if (Object.keys(body).some((key) => !allowed.includes(key))) throw new InvalidSettings();
      let expectedRevision = legacyBody ? null : revision(body.revision);
      const authorization = req.headers.get("authorization") ?? "";
      const token = /^Bearer\s+([^\s]+)\s*$/i.exec(authorization)?.[1] ?? "";
      const supplied = req.headers.get("x-apply-secret") ?? "";
      const bytes = (s: string) => new TextEncoder().encode(s);
      const legacy = operation === "test" && !!deps.legacySecret &&
        !!supplied && supplied.length <= 1024 && constantTimeEqual(bytes(deps.legacySecret), bytes(supplied));
      // Cron can also carry a gateway bearer; the verified legacy secret is test-only.
      const authenticate = () => legacy ? deps.legacyOwner() : token ? deps.verifyJwt(token) : Promise.resolve(null);
      const userId = await authenticate();
      if (!userId) return fail(401, "unauthorized", "Sign in to manage Telegram notifications");
      if (operation !== "unbind" && !await deps.hasAccess(userId)) {
        return fail(403, "not_entitled", "An active auto-apply plan or complimentary grant is required");
      }
      if (operation === "unbind") {
        const result = await deps.binding(userId, "unbind", { revision: expectedRevision });
        if (!result.ok) return bindingFailure(result);
        return json(200, { sent: false, disconnected: true, config: metadata(result.config) });
      }
      const stored = await deps.binding(userId, "read", {});
      if (!stored.ok) return bindingFailure(stored);
      const config = stored.config ?? null;
      if (legacyBody) expectedRevision = config?.revision ?? null;
      if (expectedRevision !== (config?.revision ?? null)) {
        return fail(409, "stale_binding", "Settings changed. Reload before trying again.");
      }
      const chatId = operation === "save" ? boundedString(body.chatId, 32) : config?.chat_id ?? "";
      const candidateToken = operation === "save" && body.botToken !== undefined ? boundedString(body.botToken, 160) : "";
      const botToken = candidateToken || stored.bot_token || "";
      const timeZone = operation === "save" ? notifyTimeZone(body.timeZone) : notifyTimeZone(config?.time_zone ?? "UTC");
      if (!TELEGRAM_CHAT_RE.test(chatId) || !TELEGRAM_TOKEN_RE.test(botToken)) {
        return fail(400, "invalid_settings", "Enter a valid chat ID and bot token. Start the bot in that chat first.");
      }
      const claim = await deps.binding(userId, "claim", { revision: expectedRevision });
      if (!claim.ok) return bindingFailure(claim);
      const delivery = await sendTelegram(deps, chatId, botToken);
      sent = delivery.sent;
      // Revoked sessions/access cannot persist a binding after the network await.
      if (await authenticate() !== userId) {
        return fail(401, "unauthorized", sent ? "Telegram accepted the test, but your session changed. Settings were not saved." : "Your session changed. Sign in again.");
      }
      if (!await deps.hasAccess(userId)) {
        return fail(403, "not_entitled", sent ? "Telegram accepted the test, but access expired. Settings were not saved." : "Auto-apply access is required");
      }
      if (!sent) return fail(delivery.reason === "telegram_rejected" ? 502 : 503,
        delivery.reason ?? "telegram_unavailable", "Telegram could not confirm delivery. Check the bot and chat settings; saved settings were not changed.");
      const result = await deps.binding(userId, operation, {
        revision: expectedRevision,
        ...(operation === "save" ? { chatId, botToken, timeZone } : {}),
      });
      if (!result.ok) return bindingFailure(result);
      return json(200, { sent: true, message_id: delivery.message_id, config: metadata(result.config) });
    } catch (error) {
      if (error instanceof InvalidSettings) return fail(400, "invalid_settings", "Invalid notification settings or revision");
      return fail(503, "service_unavailable", sent ? "Telegram accepted the test, but settings could not be saved. Reload before retrying." : "Notification service unavailable. Saved settings were not changed.");
    }

    function bindingFailure(result: BindingResult): Response {
      if (result.reason === "stale_binding") return fail(409, "stale_binding", sent
        ? "Telegram accepted the test, but settings changed. Reload before saving."
        : "Settings changed. Reload before trying again.");
      if (result.reason === "rate_limited") return fail(429, "rate_limited", "Too many delivery tests. Try again in a minute.");
      if (result.reason === "not_entitled") return fail(403, "not_entitled", sent
        ? "Telegram accepted the test, but access expired. Settings were not saved." : "Auto-apply access is required");
      if (result.reason === "invalid_settings") return fail(400, "invalid_settings", "Invalid notification settings");
      return fail(503, "service_unavailable", sent
        ? "Telegram accepted the test, but settings could not be saved. Reload before retrying." : "Personal notification settings are unavailable");
    }
  };
}
