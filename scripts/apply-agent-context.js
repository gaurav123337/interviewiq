/* Pure identity/config/path decisions for the paired auto-apply agent.
   The resulting binding.json contains only endpoint + bearer token. Candidate
   profile data belongs elsewhere and is deliberately rejected here. */

import { Buffer } from "node:buffer";
import path from "node:path";

export const APPLY_AGENT_CONFIG_VERSION = 1;
export const DEFAULT_APPLY_AGENT_ENDPOINT =
  "https://ndrusywvceojsoirhkhl.supabase.co/functions/v1/apply-agent";

const TOKEN_RE = /^aiq1_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;
const CONFIG_KEYS = new Set(["version", "endpoint", "token"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function pathFor(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function requireHome(home) {
  const value = String(home ?? "").trim();
  if (!value) throw new Error("OS user-data directory is unavailable");
  return value;
}

export function parseApplyAgentToken(raw) {
  if (typeof raw !== "string") return null;
  const token = raw.trim();
  const match = TOKEN_RE.exec(token);
  if (!match) return null;
  let bytes;
  try {
    bytes = Buffer.from(match[2], "base64url");
  } catch {
    return null;
  }
  if (bytes.length !== 32 || bytes.toString("base64url") !== match[2]) return null;
  return {
    token: `aiq1_${match[1].toLowerCase()}.${match[2]}`,
    bindingId: match[1].toLowerCase(),
    secret: match[2],
  };
}

export function normalizeApplyAgentEndpoint(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Apply-agent endpoint is required");
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Apply-agent endpoint must be a valid URL");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Apply-agent endpoint cannot contain credentials, query, or fragment");
  }
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Apply-agent endpoint must use HTTPS (HTTP is allowed only on loopback)");
  }
  const pathname = url.pathname.replace(/\/+$/, "");
  if (pathname === "") url.pathname = "/functions/v1/apply-agent";
  else if (pathname !== "/functions/v1/apply-agent") {
    throw new Error("Apply-agent endpoint must target /functions/v1/apply-agent");
  } else url.pathname = pathname;
  return url.toString();
}

export function validateApplyAgentConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Apply-agent config must be an object");
  }
  for (const key of Object.keys(value)) {
    if (!CONFIG_KEYS.has(key)) throw new Error(`Apply-agent config contains unsupported key: ${key}`);
  }
  if (value.version !== APPLY_AGENT_CONFIG_VERSION) {
    throw new Error(`Unsupported apply-agent config version: ${String(value.version)}`);
  }
  const parsed = parseApplyAgentToken(value.token);
  if (!parsed) throw new Error("Apply-agent token is malformed");
  return {
    version: APPLY_AGENT_CONFIG_VERSION,
    endpoint: normalizeApplyAgentEndpoint(value.endpoint),
    token: parsed.token,
  };
}

export function resolveApplyAgentDataRoot({ platform, env = {}, home } = {}) {
  const target = platform ?? process.platform;
  const p = pathFor(target);
  const userHome = requireHome(home);
  if (target === "win32") {
    const base = String(env.LOCALAPPDATA ?? env.APPDATA ?? "").trim()
      || p.join(userHome, "AppData", "Local");
    return p.resolve(base, "InterviewIQ", "apply-agent");
  }
  if (target === "darwin") {
    return p.resolve(userHome, "Library", "Application Support", "InterviewIQ", "apply-agent");
  }
  const stateHome = String(env.XDG_STATE_HOME ?? "").trim() || p.join(userHome, ".local", "state");
  return p.resolve(stateHome, "interviewiq", "apply-agent");
}

export function applyAgentConfigPath(dataRoot, platform = process.platform) {
  const root = String(dataRoot ?? "").trim();
  if (!root) throw new Error("Apply-agent data root is required");
  return pathFor(platform).resolve(root, "binding.json");
}

export function deriveBindingStateRoot(dataRoot, tokenOrBindingId, platform = process.platform) {
  const root = String(dataRoot ?? "").trim();
  if (!root) throw new Error("Apply-agent data root is required");
  const parsed = parseApplyAgentToken(tokenOrBindingId);
  const bindingId = parsed?.bindingId
    ?? (typeof tokenOrBindingId === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(tokenOrBindingId.trim())
      ? tokenOrBindingId.trim().toLowerCase()
      : null);
  if (!bindingId) throw new Error("A valid binding token or binding id is required");
  return pathFor(platform).resolve(root, "state", bindingId);
}

export function createApplyAgentContext(config, dataRoot, platform = process.platform) {
  const valid = validateApplyAgentConfig(config);
  const parsed = parseApplyAgentToken(valid.token);
  if (!parsed) throw new Error("Apply-agent token is malformed");
  const p = pathFor(platform);
  const root = p.resolve(String(dataRoot));
  return {
    ...valid,
    bindingId: parsed.bindingId,
    dataRoot: root,
    stateRoot: deriveBindingStateRoot(root, parsed.bindingId, platform),
  };
}
