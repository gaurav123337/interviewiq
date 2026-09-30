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

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(ROOT, "..", "freebuff-apply-profile");
/* independent sign-in window: a THROWAWAY clone of the engine profile. The
   real profile stays untouched (and lockable) while the owner signs in —
   then the fresh cookies are merged back. Gitignored; never shipped. */
const SIGNIN_PROFILE_DIR = path.join(ROOT, "..", "freebuff-apply-signin-profile");

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
    without it. Returns true when real session data was carried over. */
export function cloneApplyProfileForSignin() {
  rmSync(SIGNIN_PROFILE_DIR, { recursive: true, force: true }); // stale clone from a crashed sign-in
  mkdirSync(SIGNIN_PROFILE_DIR, { recursive: true });
  cpFilter(PROFILE_DIR, SIGNIN_PROFILE_DIR);
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
export async function acquireApplyContext({ headless = false, endpoint = "", signIn = false } = {}) {
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
    const ctx = await chromium.launchPersistentContext(SIGNIN_PROFILE_DIR, {
      headless,
      viewport: { width: 1380, height: 900 },
      args: ["--disable-blink-features=AutomationControlled"],
    });
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
        args: ["--disable-blink-features=AutomationControlled"],
      });
      return { ctx, cleanup: () => ctx.close().catch(() => {}), remote: false, reused: false };
    } catch (e) {
      lastErr = e;
      if (attempt < 4) await new Promise((r) => setTimeout(r, 6000));
    }
  }
  throw lastErr;
}
