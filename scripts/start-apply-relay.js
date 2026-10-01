#!/usr/bin/env node
/* start-apply-relay — the RESIDENTIAL-EXIT RELAY (docs/cloud-browser-research.md).
 *
 * A DEDICATED persistent Chromium runs on the owner's machine with CDP
 * listening on loopback (http://127.0.0.1:9222). The apply engine's CLOUD
 * mode connects to it over CDP: the browser session (job-board logins)
 * lives in this browser, NOT in the engine process — so apply runs can
 * happen from any machine that can reach this one, while all traffic
 * still egresses from the owner's residential IP (LinkedIn-grade boards
 * stay happy; $0 vs a hosted-vendor session).
 *
 * Why a DEDICATED profile (freebuff-apply-relay-profile/): the local-mode
 * engine locks its own profile while a run is active. Relay and engine
 * must never share a profile dir, or one would block the other.
 *
 * Modes:
 *   --foreground  run attached (for manual testing)
 *   default       daemonize: spawn detached + exit; safe for a scheduled
 *                 task every 5 minutes (idempotent — a health check on the
 *                 CDP port makes it a no-op when the relay is already up)
 *
 * Windows-first (the owner's rig); other OSes work but tasks/shims differ.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readApplyModeConfig, isHomeRelayEndpoint, sweepEngineProcesses, sweepRelayOnly } from "./engine-lifecycle.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RELAY_PROFILE = path.join(ROOT, "..", "freebuff-apply-relay-profile");
const CDP_PORT = 9222;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}/json/version`;

const isWindows = process.platform === "win32";

function cdpAlive(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(CDP_URL, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
  });
}

async function resolveChromium() {
  const spec = ["play", "wright"].join("");
  const { chromium } = await import(/* @vite-ignore */ spec);
  return chromium;
}

async function spawnRelay() {
  mkdirSync(RELAY_PROFILE, { recursive: true });
  const chromium = await resolveChromium();
  /* launchPersistentContext with a pipe-free CDP port: the RELAY browser is
     the long-lived session; engine runs CONNECT to it and disconnect. */
  const ctx = await chromium.launchPersistentContext(RELAY_PROFILE, {
    headless: false, // a headed relay keeps job-board fingerprint checks calm
    viewport: { width: 1380, height: 900 },
    args: [
      "--disable-blink-features=AutomationControlled",
      `--remote-debugging-port=${CDP_PORT}`,
      "--remote-allow-origins=*", // CDP websocket accepts the engine's origin
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
  /* keep a handle so the process stays alive serving the browser */
  await new Promise(() => {}); // never resolves — the relay IS this process
}

async function daemonize() {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--foreground"], {
    cwd: path.join(ROOT, ".."),
    detached: true,
    stdio: "ignore",
    windowsHide: false, // headed browser must be visible on the desktop
  });
  child.unref();
  /* wait for CDP to come up before reporting */
  for (let i = 0; i < 20; i++) {
    if (await cdpAlive()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const foreground = process.argv.includes("--foreground");

if (foreground) {
  await spawnRelay();
} else {
  /* apply-mode gate FIRST: the relay is the HOME piece of CLOUD mode only —
     it must not burn a headed browser in any other state. Off: full engine
     sweep (enforced at 5-min cadence as well as every minute). Local mode:
     the engine drives its own browser, so an idle relay is killed too.
     Cloud against a VENDOR endpoint (wss://…): the remote session serves
     CDP, so the home relay is killed as well. Cloud WITH a home-relay
     endpoint (http://…:9222): start it when down, as always. Unknown
     (config unreadable): start nothing, kill nothing — the next tick
     decides with real data. */
  const cfg = await readApplyModeConfig();
  if (cfg.mode === "off") {
    const r = await sweepEngineProcesses({ killListener: true });
    console.log(`apply mode OFF — relay not started; killed ${r.killed} engine process(es)`);
    process.exit(0);
  }
  if (cfg.mode !== "cloud" || !isHomeRelayEndpoint(cfg.endpoint)) {
    const r = await sweepRelayOnly();
    console.log(`apply mode ${cfg.mode}${isHomeRelayEndpoint(cfg.endpoint) ? "" : " (non-home relay endpoint)"} — relay not needed`
      + (r.killed ? `; killed ${r.killed} relay process(es)` : ""));
    process.exit(0);
  }
  if (await cdpAlive()) {
    console.log(`apply relay already up — ${CDP_URL}`);
    process.exit(0);
  }
  /* zombie guard: a dead relay may leave a half-alive chrome holding the
     profile lock. CDP is down → kill any chrome bound to our CDP port. */
  if (isWindows) {
    try {
      const { execSync } = await import("node:child_process");
      const out = execSync("netstat -ano | findstr :9222").toString();
      const pids = [...new Set([...out.matchAll(/\s(\d+)\s*$/gm)].map((m) => m[1]))];
      for (const pid of pids) {
        try { process.kill(Number(pid)); console.log(`killed stale relay process ${pid}`); } catch { /* already gone */ }
      }
    } catch { /* nothing listening — fine */ }
  }
  const up = await daemonize();
  if (!up) { console.error("relay failed to come up within 20s"); process.exit(1); }
  console.log(`apply relay up — CDP ${CDP_URL} (persistent profile: ${path.basename(RELAY_PROFILE)})`);
}
