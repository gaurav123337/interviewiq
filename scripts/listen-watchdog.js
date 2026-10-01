#!/usr/bin/env node
/* listen-watchdog — the MINUTE-LEVEL supervisor for the Telegram/bridge
 * listener (scripts/auto-apply-jobs.js --listen). listen-watchdog.cmd is now
 * a thin shim that calls this; the scheduled task itself is unchanged.
 *
 * Every run:
 *   1. apply mode OFF → sweep EVERYTHING (watcher, listener, run children,
 *      engine + relay browsers) and respawn nothing. Off used to only make
 *      cycles skip while this watchdog kept resurrecting the listener every
 *      minute — that is exactly the "why is my machine still working?"
 *      complaint this fixes.
 *   2. listener already up → nothing to do.
 *   3. otherwise spawn it DETACHED (own hidden console) and verify it came
 *      up. The listener used to run as a foreground child of this shim, so
 *      the scheduled-task cmd window stayed parked open on the desktop for
 *      as long as the listener lived.
 *
 * Windows-only by design (the scheduled task is Windows); non-Windows exits
 * with code 3, matching ensure-apply-watcher.js.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isWindows, isApplyOff, listEngineProcesses, sweepEngineProcesses } from "./engine-lifecycle.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(ROOT, "..");
const ENGINE = path.join(ROOT, "auto-apply-jobs.js");
const LISTEN_LOG = path.join(PROJECT, "freebuff-apply-reports", "listen.log");

const stamp = () => new Date().toISOString();

if (!isWindows) {
  console.error("listen-watchdog is Windows-only (a scheduled task drives it)");
  process.exit(3);
}
if (!existsSync(ENGINE)) {
  console.error("engine script missing:", ENGINE);
  process.exit(2);
}

/* kill switch FIRST — before any "is it up" logic, so an OFF flip also kills
   a listener that is already running */
if (await isApplyOff()) {
  const r = await sweepEngineProcesses({ killListener: true });
  console.log(stamp(), `apply mode OFF — killed ${r.killed} engine process(es)`
    + `${r.deferredListener ? " (listener spared: a sign-in window is live)" : ""};`
    + " listener not respawned until the switch is back on");
  process.exit(0);
}

const procs = await listEngineProcesses();
if (procs.listenPids.length) process.exit(0); // already up — nothing to do

/* detached + hidden: the listener owns no console, so the task instance
   completes in seconds instead of parking a cmd window open. The listener
   tees its own log (FREEBUFF_LISTEN_LOG) via a share-aware node stream —
   never a shell `>>` (that opens the file without write-sharing and a stale
   handle would block every future start). */
spawn(process.execPath, [ENGINE, "--listen"], {
  cwd: PROJECT,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
  env: { ...process.env, FREEBUFF_LISTEN_LOG: LISTEN_LOG },
}).unref();

/* honest re-probe (the spawn is detached — verify it actually came up) */
await new Promise((r) => setTimeout(r, 5000));
const after = await listEngineProcesses();
console.log(stamp(), after.listenPids.length
  ? `listener was down — started (pid ${after.listenPids.join(", ")}), logging to freebuff-apply-reports/listen.log`
  : "listener start issued — pid not visible yet (check freebuff-apply-reports/listen.log)");
