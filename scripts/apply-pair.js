#!/usr/bin/env node
/* Pair this machine to one InterviewIQ account without a service-role key.
   Stores endpoint + long-lived bearer token only in the OS user-data directory;
   candidate profile data remains in its existing, separate location. */

import { chmod, mkdir, open, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import {
  APPLY_AGENT_CONFIG_VERSION,
  DEFAULT_APPLY_AGENT_ENDPOINT,
  applyAgentConfigPath,
  createApplyAgentContext,
  normalizeApplyAgentEndpoint,
  resolveApplyAgentDataRoot,
} from "./apply-agent-context.js";

function parseArgs(argv) {
  const options = { endpoint: DEFAULT_APPLY_AGENT_ENDPOINT, code: "", label: os.hostname() || "Paired agent", json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--endpoint") options.endpoint = argv[++index] ?? "";
    else if (arg === "--code") options.code = argv[++index] ?? "";
    else if (arg === "--label") options.label = argv[++index] ?? "";
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function usage() {
  return [
    "Usage: npm run apply:pair -- [--code CODE] [--endpoint URL] [--label NAME] [--json]",
    "",
    "Create a one-time code while signed in to InterviewIQ, then run this command.",
    "The code may also be supplied through INTERVIEWIQ_APPLY_PAIRING_CODE.",
  ].join("\n");
}

async function promptCode() {
  if (!process.stdin.isTTY) throw new Error("Pairing code required via --code or INTERVIEWIQ_APPLY_PAIRING_CODE");
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await terminal.question("One-time pairing code: ")).trim();
  } finally {
    terminal.close();
  }
}

async function writePrivateJson(file, value) {
  const directory = path.dirname(file);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700).catch(() => {});
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(temporary, 0o600).catch(() => {});
    /* Windows rename cannot replace an existing file; removing the old config
       first is acceptable because a failed exchange never reaches this write. */
    if (process.platform === "win32") await rm(file, { force: true });
    await rename(temporary, file);
    await chmod(file, 0o600).catch(() => {});
  } finally {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const endpoint = normalizeApplyAgentEndpoint(options.endpoint);
  const code = String(options.code || process.env.INTERVIEWIQ_APPLY_PAIRING_CODE || "").trim() || await promptCode();
  if (!code) throw new Error("Pairing code is required");
  const label = String(options.label || os.hostname() || "Paired agent").trim().slice(0, 80) || "Paired agent";

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "InterviewIQ-Apply-Agent/1" },
      body: JSON.stringify({ operation: "pair.exchange", code, label }),
      signal: AbortSignal.timeout(20_000),
      redirect: "error", // a pairing code must never follow a cross-host redirect
    });
  } catch {
    throw new Error("Could not reach the apply-agent endpoint");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || typeof payload.token !== "string") {
    const reason = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
    throw new Error(`Pairing failed: ${reason}`);
  }

  const dataRoot = resolveApplyAgentDataRoot({
    platform: process.platform,
    env: process.env,
    home: os.homedir(),
  });
  const config = { version: APPLY_AGENT_CONFIG_VERSION, endpoint, token: payload.token };
  const context = createApplyAgentContext(config, dataRoot, process.platform);
  const configFile = applyAgentConfigPath(dataRoot, process.platform);
  await writePrivateJson(configFile, config);
  await mkdir(context.stateRoot, { recursive: true, mode: 0o700 });
  await chmod(context.stateRoot, 0o700).catch(() => {});

  if (options.json) {
    /* Never print the token, even in machine-readable output. */
    console.log(JSON.stringify({ ok: true, binding_id: context.bindingId, config_path: configFile, state_root: context.stateRoot }));
  } else {
    console.log(`Paired binding ${context.bindingId}`);
    console.log(`Credential saved outside the repository: ${configFile}`);
    console.log(`Binding-scoped state: ${context.stateRoot}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Pairing failed");
  process.exitCode = 1;
});
