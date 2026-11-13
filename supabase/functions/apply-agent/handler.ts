/* apply-agent — paired local-agent control plane.

   One POST endpoint, five explicit operations:
     pair.create       signed-in + entitled; returns one short-lived code once
     bindings.list     signed-in; returns caller-owned metadata even after expiry
     bindings.revoke   signed-in; revokes caller-owned binding even after expiry
     pair.exchange     possession of an unused code; returns token once
     agent.action      binding bearer token; strict action allowlist only

   Deploy with --no-verify-jwt because pair.exchange and agent.action use their
   own high-entropy credentials. Signed-in operations still call auth.getUser.
   Agent routes intentionally return no Access-Control-Allow-Origin: they are
   native CLI/server routes, not browser APIs. No token/code is ever logged. */

import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { clientKey, makeLimiter } from "../_shared/ratelimit.ts";
import { serviceClient } from "../_shared/serviceClient.ts";
import {
  PAIRING_CODE_TTL_MS,
  browserOperationRequiresEntitlement,
  constantTimeEqual,
  generateBindingCredential,
  generatePairingCode,
  normalizePairingCode,
  parseBindingToken,
  readJsonObject,
  sha256Hex,
  validateAgentActionRequest,
} from "../_shared/applyAgent.ts";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const BROWSER_OPERATIONS = new Set(["pair.create", "bindings.list", "bindings.revoke"]);
const CONTROL_LIMIT = makeLimiter(30, 60_000);
const EXCHANGE_LIMIT = makeLimiter(10, 15 * 60_000);
const ACTION_LIMIT = makeLimiter(120, 60_000);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RpcResult = { data: unknown; error: { message: string; code?: string } | null };
type RpcClient = { rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult> };
type AuthClient = RpcClient & {
  auth: { getUser: (token: string) => PromiseLike<{ data: { user: { id: string } | null }; error: unknown }> };
};

interface BindingRow {
  owner_id: string;
  token_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function json(status: number, body: Record<string, unknown>, headers: HeadersInit = JSON_HEADERS): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function browserHeaders(req: Request): Record<string, string> {
  return { ...corsHeaders(req), ...JSON_HEADERS };
}

function bearer(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value && typeof value === "object" ? value as T : null;
}

function statusForRpc(message: string, fallback = 500): number {
  if (/forbidden|not entitled|permission denied/i.test(message)) return 403;
  if (/invalid|bad |violates|malformed/i.test(message)) return 400;
  return fallback;
}

async function rpc(client: RpcClient, name: string, args: Record<string, unknown> = {}): Promise<RpcResult> {
  return await client.rpc(name, args);
}

async function durableRateLimit(
  client: RpcClient,
  scope: "signed_control" | "pair_exchange" | "agent_action",
  rawKey: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const keyHash = await sha256Hex(`${scope}:${rawKey}`);
  const { data, error } = await rpc(client, "service_apply_agent_rate_limit", {
    p_scope: scope,
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return !error && data === true;
}

async function signedInCaller(req: Request, client: AuthClient): Promise<{ uid: string } | null> {
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  return !error && data.user ? { uid: data.user.id } : null;
}

async function hasEntitlement(client: RpcClient, uid: string): Promise<boolean> {
  const { data, error } = await rpc(client, "service_apply_agent_has_access", { p_user: uid });
  return !error && data === true;
}

async function handleBrowserOperation(
  req: Request,
  body: Record<string, unknown>,
  client: AuthClient,
): Promise<Response> {
  const headers = browserHeaders(req);
  if (!isAllowedOrigin(req)) return json(403, { ok: false, error: "origin_not_allowed" }, headers);
  const caller = await signedInCaller(req, client);
  if (!caller) return json(401, { ok: false, error: "unauthorized" }, headers);
  const limiterKey = `${caller.uid}:${clientKey(req)}`;
  if (!CONTROL_LIMIT(limiterKey) || !(await durableRateLimit(client, "signed_control", limiterKey, 60, 60))) {
    return json(429, { ok: false, error: "rate_limited" }, headers);
  }

  if (body.operation === "pair.create") {
    if (browserOperationRequiresEntitlement(body.operation) && !(await hasEntitlement(client, caller.uid))) {
      return json(403, { ok: false, error: "auto_apply_access_required" }, headers);
    }
    const code = generatePairingCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();
    const { data, error } = await rpc(client, "service_apply_agent_issue_code", {
      p_user: caller.uid,
      p_code_hash: codeHash,
      p_expires_at: expiresAt,
    });
    if (error) return json(statusForRpc(error.message), { ok: false, error: "pairing_code_not_created" }, headers);
    return json(201, { ok: true, pairing: { id: data, code, expires_at: expiresAt } }, headers);
  }

  if (body.operation === "bindings.list") {
    const { data, error } = await rpc(client, "service_apply_agent_list_bindings", { p_user: caller.uid });
    if (error) return json(statusForRpc(error.message), { ok: false, error: "bindings_unavailable" }, headers);
    return json(200, { ok: true, bindings: Array.isArray(data) ? data : [] }, headers);
  }

  const bindingId = typeof body.binding_id === "string" ? body.binding_id.trim() : "";
  if (!UUID_RE.test(bindingId)) return json(400, { ok: false, error: "invalid_binding_id" }, headers);
  const { data, error } = await rpc(client, "service_apply_agent_revoke_binding", {
    p_user: caller.uid,
    p_binding_id: bindingId,
  });
  if (error) return json(statusForRpc(error.message), { ok: false, error: "binding_not_revoked" }, headers);
  if (data !== true) return json(404, { ok: false, error: "binding_not_found" }, headers);
  return json(200, { ok: true, binding_id: bindingId, revoked: true }, headers);
}

async function handleExchange(
  req: Request,
  body: Record<string, unknown>,
  client: RpcClient,
): Promise<Response> {
  const ip = clientKey(req);
  if (!EXCHANGE_LIMIT(ip) || !(await durableRateLimit(client, "pair_exchange", ip, 10, 15 * 60))) {
    return json(429, { ok: false, error: "rate_limited" });
  }
  const code = normalizePairingCode(body.code);
  if (!code) return json(400, { ok: false, error: "invalid_or_expired_pairing_code" });
  const credential = generateBindingCredential();
  const codeHash = await sha256Hex(code);
  const tokenHash = await sha256Hex(credential.secret);
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "Paired agent";
  const { data, error } = await rpc(client, "service_apply_agent_exchange_code", {
    p_code_hash: codeHash,
    p_binding_id: credential.bindingId,
    p_token_hash: tokenHash,
    p_label: label || "Paired agent",
  });
  const row = firstRow<{ binding_id?: string; binding_created_at?: string }>(data);
  if (error || !row) return json(400, { ok: false, error: "invalid_or_expired_pairing_code" });
  return json(201, {
    ok: true,
    binding: { id: row.binding_id ?? credential.bindingId, created_at: row.binding_created_at ?? null },
    token: credential.token,
  });
}

async function authenticateBinding(
  req: Request,
  client: RpcClient,
): Promise<{ bindingId: string; ownerId: string } | null> {
  const parsed = parseBindingToken(bearer(req));
  if (!parsed) return null;
  const { data, error } = await rpc(client, "service_apply_agent_get_binding", { p_binding_id: parsed.bindingId });
  const row = firstRow<BindingRow>(data);
  if (error || !row || row.revoked_at) return null;

  const presentedHash = await sha256Hex(parsed.secret);
  const presentedBytes = new TextEncoder().encode(presentedHash);
  const storedBytes = new TextEncoder().encode(row.token_hash ?? "");
  if (!constantTimeEqual(presentedBytes, storedBytes)) return null;

  const entitlement = await rpc(client, "service_apply_agent_has_access", { p_user: row.owner_id });
  if (entitlement.error || entitlement.data !== true) return null;
  return { bindingId: parsed.bindingId, ownerId: row.owner_id };
}

async function handleAgentAction(
  req: Request,
  body: Record<string, unknown>,
  client: RpcClient,
): Promise<Response> {
  /* Any browser origin is rejected, including the app's normal CORS allowlist. */
  if (req.headers.has("origin")) return json(403, { ok: false, error: "browser_origin_forbidden" });
  const binding = await authenticateBinding(req, client);
  if (!binding) return json(401, { ok: false, error: "invalid_or_revoked_binding" });
  const rateKey = `${binding.bindingId}:${clientKey(req, "agent")}`;
  if (!ACTION_LIMIT(rateKey) || !(await durableRateLimit(client, "agent_action", binding.bindingId, 600, 60))) {
    return json(429, { ok: false, error: "rate_limited" });
  }
  const validated = validateAgentActionRequest(body);
  if (!validated.ok) {
    const status = validated.error === "unsupported_action" ? 404 : 400;
    return json(status, { ok: false, error: validated.error });
  }

  /* Binding validation and action execution share one locked SQL transaction;
     a concurrent revoke cannot commit before this request finishes its action. */
  const { data, error } = await rpc(client, "service_apply_agent_dispatch", {
    p_binding_id: binding.bindingId,
    p_token_hash: await sha256Hex(parseBindingToken(bearer(req))!.secret),
    p_action: validated.action,
    p_args: validated.args,
  });
  if (error) {
    const unsupported = /unsupported.action/i.test(error.message);
    return json(unsupported ? 404 : statusForRpc(error.message), {
      ok: false,
      error: unsupported ? "unsupported_action" : "action_failed",
    });
  }
  return json(200, { ok: true, action: validated.action, data });
}

export async function handleApplyAgent(
  req: Request,
  clientFactory: () => AuthClient = () => serviceClient() as unknown as AuthClient,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    /* Only signed-in browser controls receive CORS preflight support. Native
       agent clients never need OPTIONS and cannot make this route browser-open. */
    return preflightResponse(req);
  }
  if (req.method !== "POST") return json(405, { ok: false, error: "post_only" });

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(req);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "body_too_large";
    return json(tooLarge ? 413 : 400, { ok: false, error: tooLarge ? "body_too_large" : "invalid_json" });
  }

  const operation = typeof body.operation === "string" ? body.operation : "";
  try {
    const client = clientFactory();
    if (BROWSER_OPERATIONS.has(operation)) return await handleBrowserOperation(req, body, client);
    if (operation === "pair.exchange") return await handleExchange(req, body, client);
    if (operation === "agent.action") return await handleAgentAction(req, body, client);
    return json(404, { ok: false, error: "unsupported_operation" });
  } catch {
    /* Never interpolate thrown values: PostgREST errors can include request data. */
    return json(500, { ok: false, error: "apply_agent_failed" });
  }
}
