/* Synchronous runtime selection for auto-apply processes and child workers.
   Paired mode is the default and fails closed on a missing/malformed external
   binding config. Legacy service-role behavior requires an explicit opt-in. */

import { existsSync, readFileSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAgentConfigPath,
  createApplyAgentContext,
  resolveApplyAgentDataRoot,
} from "./apply-agent-context.js";

const MODULE_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_ENV = "INTERVIEWIQ_APPLY_AGENT_CONFIG";
const PROFILE_ENV = "INTERVIEWIQ_APPLY_PROFILE";
const LEGACY_ENV = "INTERVIEWIQ_LEGACY_OWNER";
const EXPECTED_BINDING_ENV = "INTERVIEWIQ_APPLY_EXPECTED_BINDING_ID";
const PAIRED_SECRET_ENV = new Set([
  "SUPA_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "FREEBUFF_SHARED_CDP_EP",
  "FREEBUFF_APPLY_LOG",
  "FREEBUFF_APPLY_LOG_FILE",
  "FREEBUFF_APPLY_REPORT_DIR",
  "FREEBUFF_WATCH_LOG",
  "FREEBUFF_LISTEN_LOG",
]);
let defaultRuntimeContext;

function optionValue(argv, name) {
  const exact = argv.reduce((indexes, value, index) => value === name ? [...indexes, index] : indexes, []);
  const assigned = argv.filter((value) => value.startsWith(`${name}=`));
  if (exact.length + assigned.length > 1) throw new Error(`${name} may be supplied only once`);
  if (assigned.length === 1) {
    const value = assigned[0].slice(name.length + 1).trim();
    if (!value) throw new Error(`${name} requires a value`);
    return value;
  }
  if (exact.length === 1) {
    const value = argv[exact[0] + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
    return value;
  }
  return null;
}

function hasFlag(argv, name) {
  return argv.includes(name);
}

function resolveExternalPath(value, repoRoot) {
  return path.resolve(repoRoot, String(value));
}

function profilePathFrom(argv, env, repoRoot) {
  const selected = optionValue(argv, "--profile") ?? env[PROFILE_ENV] ?? path.join(repoRoot, "apply-profile.json");
  if (!String(selected).trim()) throw new Error("Candidate profile path is empty");
  return resolveExternalPath(selected, repoRoot);
}

function canonicalPath(value) {
  const resolved = path.resolve(String(value));
  try {
    return realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function pathInside(candidate, parent) {
  const relative = path.relative(canonicalPath(parent), canonicalPath(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function assertExternalConfig(configPath, repoRoot) {
  if (pathInside(configPath, repoRoot)) {
    throw new Error("Apply-agent config must be stored outside the repository");
  }
}

function readConfig(configPath) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    if (!existsSync(configPath)) throw new Error(`Apply-agent config not found: ${configPath}`);
    if (error instanceof SyntaxError) throw new Error(`Apply-agent config is not valid JSON: ${configPath}`);
    throw new Error(`Apply-agent config could not be read: ${configPath}`);
  }
  return parsed;
}

export function getApplyAgentRuntimeContext(options) {
  if (options === undefined && defaultRuntimeContext) return defaultRuntimeContext;
  const {
    argv = process.argv,
    env = process.env,
    repoRoot = MODULE_REPO_ROOT,
    home = os.homedir(),
    platform = process.platform,
  } = options ?? {};
  const args = Array.from(argv ?? [], String);
  const root = path.resolve(String(repoRoot));
  const profilePath = profilePathFrom(args, env, root);
  const cliConfig = optionValue(args, "--agent-config");
  const envConfig = String(env[CONFIG_ENV] ?? "").trim() || null;
  const legacy = hasFlag(args, "--legacy-owner") || env[LEGACY_ENV] === "1";

  if (legacy) {
    if (cliConfig || envConfig) throw new Error("Legacy owner mode cannot be combined with an apply-agent config");
    const context = Object.freeze({ mode: "legacy", profilePath });
    if (options === undefined) defaultRuntimeContext = context;
    return context;
  }

  const dataRoot = resolveApplyAgentDataRoot({ platform, env, home });
  const configPath = cliConfig || envConfig
    ? resolveExternalPath(cliConfig ?? envConfig, root)
    : applyAgentConfigPath(dataRoot, platform);
  assertExternalConfig(configPath, root);
  const config = readConfig(configPath);
  const context = createApplyAgentContext(config, dataRoot, platform);
  const expectedBinding = String(env[EXPECTED_BINDING_ENV] ?? "").trim().toLowerCase();
  if (expectedBinding && expectedBinding !== context.bindingId) {
    throw new Error("Apply-agent binding changed while the process tree was running");
  }
  const runtime = Object.freeze({
    mode: "paired",
    configPath,
    endpoint: context.endpoint,
    token: context.token,
    bindingId: context.bindingId,
    stateRoot: context.stateRoot,
    profilePath,
  });
  if (options === undefined) defaultRuntimeContext = runtime;
  return runtime;
}

/** Arguments safe to display in process listings: config/profile paths only. */
export function applyAgentChildArgs(context, profilePath) {
  if (!context || (context.mode !== "paired" && context.mode !== "legacy")) {
    throw new Error("Valid apply-agent runtime context required");
  }
  const selectedProfile = profilePath ? path.resolve(String(profilePath)) : context.profilePath;
  if (!selectedProfile) throw new Error("Candidate profile path is required");
  return context.mode === "paired"
    ? ["--agent-config", context.configPath, "--profile", selectedProfile]
    : ["--legacy-owner", "--profile", selectedProfile];
}

/** Child processes receive only external file paths, never bearer credentials. */
export function applyAgentChildEnv(context, env = process.env) {
  if (!context || (context.mode !== "paired" && context.mode !== "legacy")) {
    throw new Error("Valid apply-agent runtime context required");
  }
  const child = { ...env, [PROFILE_ENV]: context.profilePath };
  /* Scrub any stale/raw token inherited from older local wrappers. */
  delete child.INTERVIEWIQ_APPLY_AGENT_TOKEN;
  if (context.mode === "paired") {
    for (const key of Object.keys(child)) {
      if (PAIRED_SECRET_ENV.has(key) || /^FREEBUFF_.*(?:LOG|REPORT|CDP)/.test(key)) delete child[key];
    }
    child[CONFIG_ENV] = context.configPath;
    child[EXPECTED_BINDING_ENV] = context.bindingId;
    delete child[LEGACY_ENV];
  } else {
    child[LEGACY_ENV] = "1";
    delete child[CONFIG_ENV];
    delete child[EXPECTED_BINDING_ENV];
  }
  return child;
}
