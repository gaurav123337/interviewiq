#!/usr/bin/env node
/* engine-lifecycle — the OFF switch, enforced at the PROCESS level.
 *
 * WHY THIS EXISTS: apply mode Off used to be a SKIP switch — run cycles read
 * it and did nothing, but the scheduled tasks kept the watcher, the Telegram
 * listener and the relay Chromium alive (and respawned them forever), burning
 * RAM and a parked console window for zero work. The owner asked the obvious
 * question: "I closed auto-apply — why is my machine still working for it?"
 * Off is now a KILL switch:
 *   - every supervisor (listen watchdog, watcher supervisor, relay starter)
 *     calls isApplyOff() BEFORE respawning anything, so nothing comes back
 *     while the switch is off, and
 *   - the minute-level listen watchdog calls sweepEngineProcesses() so any
 *     survivor (watcher, listener, run child, engine/relay browser) is killed
 *     within ~1 minute of the flip.
 *
 * FAIL-SAFE DIRECTION: a failed config read never kills anything (fail-open
 * here). The engine's run cycles stay fail-CLOSED on unknown mode
 * (applyModeBlocked in auto-apply-jobs.js) — so a Supabase blip can at worst
 * leave idle processes running, never run applications while Off.
 *
 * SIGN-IN HANDOFF: a live 🔑 sign-in window always wins. The sweep never
 * touches --login-only runs, chrome on the sign-in clone profile, or the
 * listener while such a window is open — only the LISTENER kill is deferred
 * (the window is its child); watcher/run/browser kills stay safe because the
 * sign-in flow uses its own clone profile, never the engine profile.
 */

import { exec } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getApplyConfig } from "./job-sites-db.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(ROOT, "..");
const REPORTS_DIR = path.join(PROJECT, "freebuff-apply-reports");
const FLOW_LOCK = path.join(REPORTS_DIR, "signin-flow.lock");
const SIGNIN_LOCK = path.join(REPORTS_DIR, "signin-active.lock");

export const isWindows = process.platform === "win32";

/** True ONLY when apply_config.mode is confirmed "off". Any read failure
 *  returns false — supervisors must not kill on a maybe. */
export async function isApplyOff() {
  try {
    const rows = await getApplyConfig();
    return (rows ?? [])[0]?.mode === "off";
  } catch { return false; }
}

/* ── process listing (wmic with a PowerShell CIM fallback) ──────────── */

const normCmd = (s) => String(s ?? "").toLowerCase().replace(/["']/g, "").replace(/\\/g, "/");

function wmicBlocks(query) {
  return new Promise((resolve) => {
    exec(`wmic process where "${query}" get processid,commandline /format:list`,
      { windowsHide: true, timeout: 20_000, maxBuffer: 1 << 22, encoding: "utf8" },
      (err, stdout) => resolve(err ? null : String(stdout ?? "")));
  });
}

/** Fallback when wmic is absent (newer Win11 builds): "pid|commandline" lines. */
function psList(name) {
  return new Promise((resolve) => {
    const psCmd = `Get-CimInstance Win32_Process -Filter "Name='${name}'" | `
      + `ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }`;
    exec(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`,
      { windowsHide: true, timeout: 30_000, maxBuffer: 1 << 22, encoding: "utf8" },
      (err, stdout) => resolve(err ? [] : String(stdout ?? "").split(/\r?\n/)));
  });
}

/** One wmic record per block: CommandLine=… / ProcessId=N. wmic prints
 *  \r\r\n line endings (a blank separator line is \r\r\n\r\r\n), so collapse
 *  each \r\r\n to a plain \n FIRST — then records separate on blank lines
 *  and fields on single newlines. (Splitting on /\r?\n\r?\n/ directly
 *  silently fails on \r\r\n and merges ALL records into one block.) */
function parseWmicBlocks(raw) {
  const text = raw.replace(/\r\r\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const out = [];
  for (const block of text.split(/\n{2,}/)) {
    let cmd = "", pid = 0;
    for (const line of block.split("\n")) {
      const t = line.trim();
      if (/^CommandLine=/i.test(t)) cmd = t.slice("CommandLine=".length);
      else if (/^ProcessId=/i.test(t)) pid = Number(t.slice("ProcessId=".length).match(/\d+/)?.[0] ?? 0);
    }
    if (cmd && pid) out.push({ cmd, pid });
  }
  return out;
}

function parsePsLines(lines) {
  const out = [];
  for (const line of lines) {
    const m = /^(\d+)\|(.*)$/.exec(line.trim());
    if (m && m[2]) out.push({ cmd: m[2], pid: Number(m[1]) });
  }
  return out;
}

async function processRecords(name) {
  const raw = isWindows ? await wmicBlocks(`name='${name}'`) : "";
  if (raw === null) return parsePsLines(await psList(name)); // wmic missing
  return parseWmicBlocks(raw);
}

/** Every engine-relevant process, classified by its command-line marker.
 *  Markers match ONLY engine-spawned processes: the owner's personal Chrome
 *  carries no freebuff profile flag and is never listed here. */
export async function listEngineProcesses() {
  const nodes = await processRecords("node.exe");
  const chromes = await processRecords("chrome.exe");
  const listenPids = [], watchPids = [], runPids = [], loginOnlyPids = [], relayNodePids = [];
  for (const { cmd, pid } of nodes) {
    const n = normCmd(cmd);
    if (n.includes("start-apply-relay.js")) { relayNodePids.push(pid); continue; } // relay wrapper — its Chromium is a child of it
    if (!n.includes("auto-apply-jobs.js")) continue;
    if (n.includes("--login-only")) { loginOnlyPids.push(pid); continue; } // a live sign-in run — protected
    if (n.includes("--listen")) { listenPids.push(pid); continue; }
    if (n.includes("--watch")) { watchPids.push(pid); continue; }
    if (n.includes("--all") || n.includes("--url")) runPids.push(pid);    // per-site children + parent cycles
  }
  const engineChromePids = [], relayChromePids = [], signinChromePids = [];
  for (const { cmd, pid } of chromes) {
    const n = normCmd(cmd);
    if (n.includes("freebuff-apply-signin-profile")) { signinChromePids.push(pid); continue; } // protected
    if (n.includes("freebuff-apply-relay-profile") || n.includes("--remote-debugging-port=9222")) relayChromePids.push(pid);
    else if (n.includes("freebuff-apply-profile")) engineChromePids.push(pid);
  }
  return { listenPids, watchPids, runPids, loginOnlyPids, relayNodePids, engineChromePids, relayChromePids, signinChromePids };
}

/** taskkill the whole tree — engine children (browsers, per-site runs) die
 *  with their parent. */
export function killTree(pid) {
  return new Promise((resolve) => {
    if (!isWindows || !pid) return resolve(false);
    exec(`taskkill /F /T /PID ${pid}`, { windowsHide: true, timeout: 15_000 }, (err) => resolve(!err));
  });
}

/* ── sign-in liveness (pid-aware locks — an orphaned lock no longer
      defers the watcher forever) ──────────────────────────────────────── */

/** Pids recorded in a lifecycle lock. Locks are JSON {pid, listener, ts};
 *  legacy plain-text locks count as alive for 24h after their mtime. */
export function lockHolderPids(file) {
  try {
    const raw = readFileSync(file, "utf8");
    try {
      const j = JSON.parse(raw);
      return [j.pid, j.listener, j.owner].filter((p) => Number.isFinite(p) && p > 0);
    } catch {
      try { return Date.now() - statSync(file).mtimeMs < 24 * 3600_000 ? [-1] : []; }
      catch { return []; }
    }
  } catch { return []; }
}

export function lockHolderAlive(file) {
  return lockHolderPids(file).some((pid) => {
    if (pid < 0) return true; // legacy age-based lock
    try { process.kill(pid, 0); return true; } catch { return false; }
  });
}

/** A 🔑 sign-in flow is LIVE when its lock has a living holder or a browser
 *  is actually running on the clone profile / a login-only run exists. */
export async function signinFlowAlive(procs) {
  if (lockHolderAlive(FLOW_LOCK) || lockHolderAlive(SIGNIN_LOCK)) return true;
  const p = procs ?? await listEngineProcesses();
  return p.signinChromePids.length > 0 || p.loginOnlyPids.length > 0;
}

/* ── the sweep ───────────────────────────────────────────────────────── */

/** Kill everything the engine left running. `killListener: false` spares the
 *  Telegram listener (the caller IS the listener); `selfPid` is never killed.
 *  Returns the number of processes actually killed. */
export async function sweepEngineProcesses({ killListener = true, selfPid = 0 } = {}) {
  const procs = await listEngineProcesses();
  const deferListener = killListener && (await signinFlowAlive(procs));
  let killed = 0;
  const targets = [...procs.watchPids, ...procs.runPids, ...procs.relayNodePids, ...procs.engineChromePids, ...procs.relayChromePids];
  if (killListener && !deferListener) targets.push(...procs.listenPids);
  for (const pid of targets) {
    if (pid === selfPid) continue;
    if (await killTree(pid)) killed++;
  }
  return { killed, deferredListener: deferListener };
}
