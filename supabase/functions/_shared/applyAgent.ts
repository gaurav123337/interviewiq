/* applyAgent — pure pairing/token/action decisions shared by the Edge API.
   Plaintext pairing codes and binding tokens exist only at generation/request
   time; callers persist their SHA-256 digests, never these credentials. */

export const PAIRING_CODE_TTL_MS = 10 * 60_000;
export const APPLY_AGENT_MAX_BODY_BYTES = 256 * 1024;
export const PAIRING_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const PAIRING_CODE_CHARS = 20;
const PAIRING_CODE_GROUP = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^aiq1_([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/;

export const AGENT_ACTIONS = [
  "sites.list",
  "results.list",
  "results.record",
  "reviews.list",
  "reviews.queue",
  "reviews.resolve",
  "reviews.unresolve",
  "reviews.resolved",
  "reviews.has_pending",
  "reviews.reviewed_urls",
  "reviews.resolve_url",
  "variants.list",
  "variants.put",
  "variants.latest",
  "variants.approve",
  "memory.get",
  "memory.put",
  "memory.touch",
  "memory.stats",
  "strikes.list",
  "strikes.clear",
  "exemplars.list",
  "exemplars.put",
  "exemplars.delete",
  "feedback.put",
  "outcomes.record",
  "outcomes.stats",
  "outcomes.digest",
  "digest.weekly",
  "notify.get",
] as const;

export type AgentAction = (typeof AGENT_ACTIONS)[number];
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type AgentActionArgs = Record<string, JsonValue>;

export interface ParsedBindingToken {
  bindingId: string;
  secret: string;
  canonicalToken: string;
}

export interface GeneratedBindingCredential extends ParsedBindingToken {
  token: string;
}

const ACTION_SET = new Set<string>(AGENT_ACTIONS);
const USER_ID_KEYS = new Set([
  "user",
  "userid",
  "useruuid",
  "uid",
  "owner",
  "ownerid",
  "owneruuid",
  "puser",
  "puserid",
  "puid",
]);

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlBytes(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return bytesToBase64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

export function generatePairingCode(): string {
  const random = new Uint8Array(PAIRING_CODE_CHARS);
  crypto.getRandomValues(random);
  const compact = [...random].map((byte) => PAIRING_CODE_ALPHABET[byte & 31]).join("");
  return compact.match(new RegExp(`.{${PAIRING_CODE_GROUP}}`, "g"))?.join("-") ?? compact;
}

export function normalizePairingCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const compact = raw.trim().toUpperCase().replace(/[\s-]+/g, "");
  if (compact.length !== PAIRING_CODE_CHARS) return null;
  if ([...compact].some((char) => !PAIRING_CODE_ALPHABET.includes(char))) return null;
  return compact.match(new RegExp(`.{${PAIRING_CODE_GROUP}}`, "g"))?.join("-") ?? null;
}

export function generateBindingCredential(): GeneratedBindingCredential {
  const bindingId = crypto.randomUUID().toLowerCase();
  const secretBytes = new Uint8Array(32);
  crypto.getRandomValues(secretBytes);
  const secret = bytesToBase64Url(secretBytes);
  const token = `aiq1_${bindingId}.${secret}`;
  return { bindingId, secret, canonicalToken: token, token };
}

export function parseBindingToken(raw: unknown): ParsedBindingToken | null {
  if (typeof raw !== "string") return null;
  const match = TOKEN_RE.exec(raw.trim());
  if (!match || !UUID_RE.test(match[1])) return null;
  const secretBytes = base64UrlBytes(match[2]);
  if (!secretBytes || secretBytes.length !== 32) return null;
  const bindingId = match[1].toLowerCase();
  const secret = match[2];
  return { bindingId, secret, canonicalToken: `aiq1_${bindingId}.${secret}` };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Fixed-work comparison for already-decoded secrets/digests. */
export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let different = left.length ^ right.length;
  for (let index = 0; index < length; index++) {
    different |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return different === 0;
}

export type PairingCodeState = "usable" | "expired" | "used" | "revoked";

export function pairingCodeState(
  row: { expiresAt: string | number | Date; usedAt?: unknown; revokedAt?: unknown },
  now: string | number | Date = Date.now(),
): PairingCodeState {
  if (row.revokedAt) return "revoked";
  if (row.usedAt) return "used";
  const expiry = new Date(row.expiresAt).getTime();
  const current = new Date(now).getTime();
  return !Number.isFinite(expiry) || !Number.isFinite(current) || expiry <= current ? "expired" : "usable";
}

export type BindingState = "active" | "revoked" | "not_entitled";

export function bindingState(row: { revokedAt?: unknown; entitled?: boolean }): BindingState {
  if (row.revokedAt) return "revoked";
  return row.entitled === false ? "not_entitled" : "active";
}

export function isAgentAction(value: unknown): value is AgentAction {
  return typeof value === "string" && ACTION_SET.has(value);
}

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, "");
}

/** Agent ownership always comes from the binding, never request JSON. */
export function containsAuthoritativeUserId(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const seen = new Set<object>();
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) {
      for (const item of current) if (item && typeof item === "object") pending.push(item as object);
      continue;
    }
    for (const [key, item] of Object.entries(current)) {
      if (USER_ID_KEYS.has(normalizedKey(key))) return true;
      if (item && typeof item === "object") pending.push(item as object);
    }
  }
  return false;
}

export function browserOperationRequiresEntitlement(operation: unknown): boolean {
  return operation === "pair.create";
}

export async function readJsonObject(
  req: Request,
  maxBytes = APPLY_AGENT_MAX_BODY_BYTES,
): Promise<Record<string, unknown>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("invalid_body_limit");
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("invalid_content_length");
    if (size > maxBytes) throw new Error("body_too_large");
  }
  if (!req.body) throw new Error("invalid_json");

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("body_too_large");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("invalid_json");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_json");
  return value as Record<string, unknown>;
}

export type AgentActionValidation =
  | { ok: true; action: AgentAction; args: AgentActionArgs }
  | { ok: false; error: "unsupported_action" | "invalid_args" | "authoritative_user_forbidden" };

export function validateAgentActionRequest(value: unknown): AgentActionValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "invalid_args" };
  if (containsAuthoritativeUserId(value)) return { ok: false, error: "authoritative_user_forbidden" };
  const request = value as Record<string, unknown>;
  if (!isAgentAction(request.action)) return { ok: false, error: "unsupported_action" };
  const args = request.args ?? {};
  if (!args || typeof args !== "object" || Array.isArray(args)) return { ok: false, error: "invalid_args" };
  return { ok: true, action: request.action, args: args as AgentActionArgs };
}
