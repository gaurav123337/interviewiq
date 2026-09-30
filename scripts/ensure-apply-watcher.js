#!/usr/bin/env node
/* ensure-apply-watcher — SELF-HEALING SUPERVISOR for the local apply engine.
 *
 * `FreebuffApplyWatch` only triggers at logon, so any later restart of the
 * host app (or a watcher crash) leaves the apply watcher dead until the next
 * manual logon. This supervisor closes that gap: run it every 15 minutes
 * from a scheduled task; it starts the watcher when (and only when) it is
 * not already running.
 *
 * Idempotency: a running watcher is identified by its UNIQUE marker string
 * ("auto-apply-jobs.js --watch") in the node.exe command line, matched
 * case- and slash-insensitively (wmic backslash vs POSIX forward paths).
 *
 * Start mode: DETACHED — the child outlives this short-lived supervisor
 * (shell keeps the grandchild alive after exit); logs append to the same
 * freebuff-apply-reports/watch.log the watcher already uses.
 *
 * Windows-only by design: the owner's apply rig (headed Chromium, persistent
 * profile, scheduled tasks) is Windows. Non-Windows exits honestly with
 * code 3 — CI never runs this.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { exec } from "node:child_process";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(ROOT, "..");
const ENGINE = path.join(ROOT, "auto-apply-jobs.js");
const LOG = path.join(PROJECT, "freebuff-apply-reports", "watch.log");
const MARKER = "auto-apply-jobs.js --watch";
/* sign-in handoff: while a 🔑 Sign-in window is requested, the supervisor
   does NOT respawn the watcher — the watcher's profile use would kill the
   sign-in window (the #141–#145 crash loop). The listener removes this
   file when the login-only run finishes. */
const SIGNIN_LOCK = path.join(PROJECT, "freebuff-apply-reports", "signin-active.lock");

const isWindows = process.platform === "win32";

/** Collect PIDs of node.exe processes whose command line contains MARKER. */
function listWatcherPids() {
  if (!isWindows) return Promise.resolve([]);
  return new Promise((resolve) => {
    const c = exec("wmic process where name='node.exe' get processid,commandline",
      { windowsHide: true, maxBuffer: 1 << 20 });
    let out = "";
    c.stdout?.on("data", (d) => { out += d; });
    c.on("error", () => resolve(null));   // wmic missing → PowerShell fallback
    c.on("close", () => {
      const pids = [];
      /* one process per line: "... auto-apply-jobs.js --watch ...   12345" —
         take the LAST number on marker lines (wmic prints ProcessId last).
         Quotes are stripped before matching: the engine path is spawned
         quoted ("...auto-apply-jobs.js" --watch) when shell-started. */
      for (const line of out.split(/\r?\n/)) {
        const norm = line.toLowerCase().replace(/["']/g, "").replace(/\\/g, "/");
        if (!norm.includes(MARKER)) continue;
        const nums = line.match(/\d+/g);
        if (nums?.length) pids.push(Number(nums[nums.length - 1]));
      }
      resolve(pids);
    });
  });
}

/** Fallback when wmic is absent (newer Win11 builds): PowerShell CIM query. */
function listWatcherPidsPs() {
  return new Promise((resolve) => {
    const psCmd = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | `
      + "Where-Object { $_.CommandLine -like '*auto-apply-jobs.js*--watch*' } | "
      + "ForEach-Object { $_.ProcessId }";
    const c = exec(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`,
      { windowsHide: true, maxBuffer: 1 << 20 });
    let out = "";
    c.stdout?.on("data", (d) => { out += d; });
    c.on("error", () => resolve([]));
    c.on("close", () => {
      resolve([...out.matchAll(/\d+/g)].map((m) => Number(m[0])));
    });
  });
}

function startWatcher() {
  if (!existsSync(ENGINE)) {
    console.error("engine script missing:", ENGINE);
    process.exit(2);
  }
  /* detached grandchild outlives this short-lived supervisor. NO shell, NO
     `>>` redirect: shell appends on Windows open the log WITHOUT write-
     sharing, so a stale handle (e.g. a zombie watcher) makes every new
     start die instantly with "file in use by another process". Instead the
     watcher tees its own log (FREEBUFF_WATCH_LOG) via a node stream that
     opens share-aware. */
  const child = spawn(process.execPath,
    [ENGINE, "--watch", "--max", "5", "--every", "6", "--unattended"],
    {
      cwd: PROJECT,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, FREEBUFF_WATCH_LOG: LOG },
      windowsHide: true,
    });
  child.unref();
}

let pids = await listWatcherPids();
if (pids == null) pids = await listWatcherPidsPs();

if (pids.length > 0) {
  console.log(`apply watcher already running (pid ${pids.join(", ")}) — nothing to do`);
  process.exit(0);
}

/* sign-in handoff: a 🔑 Sign-in window is in progress — hold off so the
   watcher cannot steal the engine profile out from under it */
if (existsSync(SIGNIN_LOCK)) {
  console.log("sign-in in progress (signin-active.lock present) — watcher start deferred");
  process.exit(0);
}

if (!isWindows) {
  console.error("ensure-apply-watcher is Windows-only (a scheduled task drives it); start the watcher manually on this OS");
  process.exit(3);
}

startWatcher();
/* the spawn pid is the transient shell wrapper, not the watcher — re-probe
   for the real node process and report honestly */
await new Promise((r) => setTimeout(r, 6000));
let pids2 = await listWatcherPids();
if (pids2 == null) pids2 = await listWatcherPidsPs();
console.log(pids2.length
  ? `apply watcher was NOT running — started (pid ${pids2.join(", ")}), logging to ${path.relative(PROJECT, LOG)}`
  : `apply watcher start issued — pid not visible yet (check ${path.relative(PROJECT, LOG)})`);
