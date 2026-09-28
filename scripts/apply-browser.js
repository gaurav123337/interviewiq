#!/usr/bin/env node
/* apply-browser — browser ACQUISITION for the apply engine.
 *
 * One seam, two modes:
 *  - LOCAL (default): chromium.launchPersistentContext on the owner's
 *    profile dir (freebuff-apply-profile/) — sessions persist on disk,
 *    exactly the behavior the engine has always had.
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

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(ROOT, "..", "freebuff-apply-profile");

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
export async function acquireApplyContext({ headless = false, endpoint = "" } = {}) {
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

  mkdirSync(PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    viewport: { width: 1380, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  return { ctx, cleanup: () => ctx.close().catch(() => {}), remote: false, reused: false };
}
