#!/usr/bin/env node
/* apply-browser — browser ACQUISITION for the apply engine.
 *
 * One seam, two modes:
 *  - LOCAL (default): chromium.launchPersistentContext on the owner's
 *    profile dir (freebuff-apply-profile/) — sessions persist on disk,
 *    exactly the behavior the engine has always had.
 *  - SIGN-IN (signIn: true, used by --login-only): launches an INDEPENDENT
 *    browser on a THROWAWAY CLONE of the profile (freebuff-apply-signin-profile/)
 *    so a running engine instance or a locked ProcessSingleton can never
 *    crash-loop the window (the #141–#146 "opened and immediately closed"
 *    bug — the clone is always launchable, lock files are never copied).
 *    On close, mergeSigninProfileBack() folds the fresh cookies into the
 *    real profile and deletes the clone.
 *  - REMOTE (apply_config mode=cloud with a wss:// CDP endpoint):
 *    chromium.connectOverCDP against a PERSISTENT hosted browser session
 *    (Browserbase/Steel-style, see docs/cloud-browser-research.md). The
 *    session's cookies/localStorage live server-side and survive between
 *    runs — that is the entire point.
 *
 * Close semantics (the part that must never be "optimized" away):
 *  - local: ctx.close() really closes the browser.
 *  - remote: browser.close() on a CDP-connected browser only DISCONNECTS
 *    (Playwright contract); the hosted session and its login state survive
 *    for the next run. Callers MUST go through cleanup() instead of
 *    ctx.close() so both modes do the right thing automatically.
 *
 * The engine's per-job code (page/locator APIs) is mode-agnostic: a remote
 * context's pages behave like local ones.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(ROOT, "..", "freebuff-apply-profile");
/* independent sign-in window: a THROWAWAY clone of the engine profile. It
   deliberately lives OUTSIDE the repo (LOCALAPPDATA, not OneDrive): the repo
   tree syncs to OneDrive, and a Chromium profile is thousands of tiny files
   being written and deleted continuously — sync churn + hydration kills
   browsers. The real profile stays untouched (and lockable) while the owner
   signs in — then the fresh cookies are merged back. Never shipped. */
const SIGNIN_PROFILE_DIR = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "freebuff-apply-signin-profile")
  : path.join(ROOT, "..", "freebuff-apply-signin-profile");
const CLONE_OWNER_MARKER = "owner-alive.json";

/* Chromium's live-process lock files — copying ANY of them into the clone
   guarantees the "profile in use" crash the sign-in window exists to escape.
   Top level AND inside leveldb/local-storage subdirs (a leveldb dir carries
   its own LOCK file). */
function isProfileLockEntry(name) {
  return name === "SingletonLock" || name === "SingletonCookie"
    || name === "SingletonSocket" || name === "SingletonPid"
    || name.startsWith("Singleton") || name.startsWith("lockfile")
    || name === "LOCK" || name.endsWith(".lock");
}

/** Copy the engine profile → the throwaway sign-in clone, skipping every
    live-process lock file (any depth). Best-effort per file: something held
    exclusively by the running browser is simply left out — the clone lives
    without it. Returns true when real session data was carried over.
    THROWS when a LIVE sign-in run already owns the clone (its owner marker
    pid is alive) — no second run may ever wipe a live window's profile. */
export function cloneApplyProfileForSignin() {  try { const owner = JSON.parse(readFileSync(path.join(SIGNIN_PROFILE_DIR, CLONE_OWNER_MARKER), "utf8"));
    try { process.kill(owner.pid, 0); throw new Error(`sign-in already in progress — the clone profile is owned by a live run (pid ${owner.pid}); refusing to wipe it`); } catch (e) { if (e.code !== "ESRCH" && String(e.message).includes("refusing")) throw e; }
  } catch (e) { if (String(e.message).includes("refusing")) throw e; }
  /* Windows keeps a directory handle alive for a few seconds AFTER the
     sign-in Chrome dies — the first rmSync can fail with EPERM/EBUSY and a
     hard failure here killed the whole self-heal recovery (#160 live fire).
     Bounded retry: handles are released asynchronously. */
  for (let i = 0; ; i++) {
    try { rmSync(SIGNIN_PROFILE_DIR, { recursive: true, force: true }); break; }
    catch (e) {
      if (i >= 8 || !/^(EPERM|EBUSY|ENOTEMPTY)$/.test(e.code ?? "")) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
    }
  }
  mkdirSync(SIGNIN_PROFILE_DIR, { recursive: true });
  cpFilter(PROFILE_DIR, SIGNIN_PROFILE_DIR);
  try { writeFileSync(path.join(SIGNIN_PROFILE_DIR, CLONE_OWNER_MARKER), JSON.stringify({ pid: process.pid, ts: Date.now() })); } catch { /* best-effort claim */ }
  return existsSync(path.join(SIGNIN_PROFILE_DIR, "Default", "Cookies"));
}

function cpFilter(src, dest) {
  let entries;
  try { entries = readdirSync(src, { withFileTypes: true }); } catch { return; } // no profile yet — fresh clone
  for (const ent of entries) {
    if (ent.name === "freebuff-apply-signin-profile") continue; // paranoia: never copy the clone into itself
    if (isProfileLockEntry(ent.name)) continue;
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    try {
      if (ent.isDirectory()) { mkdirSync(d, { recursive: true }); cpFilter(s, d); }
      else if (ent.isFile()) cpSync(s, d);
    } catch { /* held exclusively by the running browser — skip */ }
  }
}

/** Fold the sign-in clone's (newer) session state back into the REAL engine
    profile and delete the clone. Only files the clone carries are written,
    so anything new in the real profile since the clone was made is kept.
    Returns the number of files merged (0 = nothing to do / all locked). */
export function mergeSigninProfileBack() {
  let merged = 0;
  try {
    if (!existsSync(SIGNIN_PROFILE_DIR)) return 0;
    try { rmSync(path.join(SIGNIN_PROFILE_DIR, CLONE_OWNER_MARKER), { force: true }); } catch { /* best-effort */ }
    mkdirSync(PROFILE_DIR, { recursive: true });
    merged = mergeInto(PROFILE_DIR, SIGNIN_PROFILE_DIR);
  } catch { /* best-effort — the verified cookie set still lives in the DB */ }
  try { rmSync(SIGNIN_PROFILE_DIR, { recursive: true, force: true }); } catch { /* best-effort */ }
  return merged;
}

function mergeInto(dest, src) {
  let merged = 0;
  let entries;
  try { entries = readdirSync(src, { withFileTypes: true }); } catch { return 0; }
  for (const ent of entries) {
    if (isProfileLockEntry(ent.name)) continue;
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    try {
      if (ent.isDirectory()) { mkdirSync(d, { recursive: true }); merged += mergeInto(d, s); }
      else if (ent.isFile()) { cpSync(s, d); merged++; }
    } catch { /* locked file in the real profile — skip it */ }
  }
  return merged;
}

/** Wait for Chromium to publish its ephemeral CDP port (first line of the
    DevToolsActivePort file inside the profile) — the --all parent uses this
    to hand ONE shared browser to its per-site children (tabs, not windows). */
export async function readLocalCdpEndpoint(retries = 20) {
  const f = path.join(PROFILE_DIR, "DevToolsActivePort");
  for (let i = 0; i < retries; i++) {
    try {
      const port = readFileSync(f, "utf8").split(/\r?\n/)[0].trim();
      if (port) return `http://127.0.0.1:${port}`;
    } catch { /* not written yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("DevToolsActivePort never appeared");
}

/** True when the clone profile is currently OWNED by a live sign-in run
    (owner marker present + its pid alive) — listeners use this to skip a
    whole flow cycle instead of walking into the clone mid-launch. */
export function signinCloneOwnedByLiveRun() {
  try {
    const owner = JSON.parse(readFileSync(path.join(SIGNIN_PROFILE_DIR, CLONE_OWNER_MARKER), "utf8"));
    try { process.kill(owner.pid, 0); return true; } catch { return false; }
  } catch { return false; }
}

/** Drop THIS process's ownership of the sign-in clone (owner marker out).
    Called by the self-healing sign-in flow right before it re-clones after
    the sign-in browser died mid-flow: cloneApplyProfileForSignin refuses to
    wipe a clone whose owner pid is ALIVE, and on an in-process relaunch that
    owner is the flow itself — the refusal must not deadlock the recovery. */
export function releaseSigninCloneOwnership() {
  try { rmSync(path.join(SIGNIN_PROFILE_DIR, CLONE_OWNER_MARKER), { force: true }); } catch { /* best-effort */ }
}

/** True when the endpoint is a CDP endpoint (ws/wss websocket or http(s)
    debugging URL — Playwright accepts both; http is how local CDP test
    servers are addressed, vendors serve wss). */
export function isRemoteEndpoint(endpoint) {
  return /^(wss?|https?):\/\//i.test(String(endpoint || "").trim());
}

/**
 * Acquire the apply browser context.
 * @returns {Promise<{ctx: import("playwright").BrowserContext, cleanup: () => Promise<void>, remote: boolean, reused: boolean}>}
 */
export async function acquireApplyContext({ headless = false, endpoint = "", signIn = false, extraArgs = [] } = {}) {
  /* computed specifier so vite/vitest never statically resolve playwright
     (same trick as the engine's launchBrowser) */
  const spec = ["play", "wright"].join("");
  const { chromium } = await import(/* @vite-ignore */ spec);

  const ep = String(endpoint || "").trim();
  if (isRemoteEndpoint(ep)) {
    const browser = await chromium.connectOverCDP(ep, { timeout: 60_000 });
    let ctx = browser.contexts()[0] ?? null;
    const reused = Boolean(ctx); // vendor persistent sessions expose one
    if (!ctx) ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
    /* disconnect-only (see header): the hosted session keeps its logins */
    const cleanup = () => browser.close().catch(() => {});
    return { ctx, cleanup, remote: true, reused };
  }

  if (signIn) {
    /* INDEPENDENT sign-in browser: fresh clone, zero lock contention — the
       owner's personal Chrome and any running engine instance are irrelevant
       here. No retry loop needed: the clone can never be "in use". */
    const hadCookies = cloneApplyProfileForSignin();
    console.log(`  🔐 independent sign-in browser: cloned freebuff-apply-profile → freebuff-apply-signin-profile${hadCookies ? " (saved sessions carried over)" : " (fresh — no saved sessions yet)"}`);
    /* MAXIMIZED real OS window: the sign-in window kept losing the z-order
       battle against the owner's browser/editor and sat hidden behind them
       ("nothing is happening") — a maximized launch cannot be missed.
       GOOGLE OAUTH NEEDS A BRANDED BROWSER: Playwright's bundled Chromium
       reports the "Chromium" brand and Google answers "This browser or app
       may not be secure" — the owner sat at a wall that could never submit.
       The sign-in window therefore uses the machine's INSTALLED Google Chrome
       (channel: "chrome") while still running on the isolated clone profile;
       fall back to bundled Chromium when Chrome is not installed. */
    const launchOpts = {
      headless,
      viewport: null,
      args: ["--disable-blink-features=AutomationControlled", "--start-maximized"],
    };
    let ctx;
    try {
      ctx = await chromium.launchPersistentContext(SIGNIN_PROFILE_DIR, { ...launchOpts, channel: "chrome" });
      console.log("  🌐 sign-in window: installed Google Chrome (Google OAuth accepts it) on the isolated clone profile");
    } catch {
      ctx = await chromium.launchPersistentContext(SIGNIN_PROFILE_DIR, launchOpts);
      console.log("  🌐 sign-in window: bundled Chromium (installed Chrome not found — Google OAuth may refuse it; use email/OTP)");
    }
    return { ctx, cleanup: () => ctx.close().catch(() => {}), remote: false, reused: false };
  }

  mkdirSync(PROFILE_DIR, { recursive: true });
  /* RETRY the launch: a freshly-killed stale engine browser releases its
     ProcessSingleton lock a few seconds AFTER taskkill returns (Windows
     handle cleanup is async) — first attempt can fail with the profile
     "in use" while the second succeeds. Bounded at 4 tries / ~18s. */
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
        headless,
        viewport: { width: 1380, height: 900 },
        args: ["--disable-blink-features=AutomationControlled", ...extraArgs],
      });
      return { ctx, cleanup: () => ctx.close().catch(() => {}), remote: false, reused: false };
    } catch (e) {
      lastErr = e;
      if (attempt < 4) await new Promise((r) => setTimeout(r, 6000));
    }
  }
  throw lastErr;
}
