/* Playwright-backed fetcher for the discovery crawler (Phase 4 follow-up:
   "Playwright rendering in discovery" — the D1 createFetcher({fetchImpl})
   seam finally has a browser implementation).

   Scope decisions:
   - OFF by default: crawl-sources.js only uses it when started with
     DISCOVERY_RENDER=1 AND playwright is importable. Plain fetch stays the
     default everywhere (per-page browser loads cost seconds each; the crawl
     budget must absorb that deliberately, not by accident).
   - CI-first: playwright is installed by the workflow step (same pattern as
     jobs-playwright.yml). Locally it renders only if you install it yourself.
   - Interface-compatible with createFetcher's fetchText(): { ok, status, text }
     — crawlSeed, robots checks, and politeness delays all work unchanged.
   - HTML-only: after fetching, extractLinks() expands JS-discovered links that
     plain fetch can never see; non-HTML paths (json/sitemap) should keep the
     plain fetcher (pass renderHosts to scope it).
   - robots.txt still fetched via plain fetch (fast, no browser needed). */

/** Detects whether Playwright is usable in this environment. The module
 *  specifier is computed at runtime so bundlers (vite/vitest, where playwright
 *  is intentionally NOT a dependency) never try to resolve it statically. */
export async function playwrightAvailable() {
  try {
    const spec = ["play", "wright"].join("");
    await import(/* @vite-ignore */ spec);
    return true;
  } catch {
    return false;
  }
}

/** Builds a fetcher compatible with createFetcher's fetchText contract, backed
 *  by a single shared Chromium browser. Options mirror createFetcher's:
 *  { userAgent, timeoutMs, delayMs, viewport }.
 *  Call `await fetcher.close()` when done (idempotent). */
export async function createRenderFetcher({ userAgent, timeoutMs = 20000, delayMs = 250, viewport = { width: 1366, height: 900 } } = {}) {
  const spec = ["play", "wright"].join("");
  const { chromium } = await import(/* @vite-ignore */ spec);
  const browser = await chromium.launch({ headless: true });
  const lastHit = new Map();
  let closed = false;

  async function politenessDelay(host) {
    const last = lastHit.get(host);
    if (!last || delayMs <= 0) return 0;
    const elapsed = Date.now() - last;
    return elapsed >= delayMs ? 0 : delayMs - elapsed;
  }

  return {
    async fetchText(url) {
      if (closed) return { ok: false, status: 0, text: "", error: "fetcher closed" };
      let host;
      try { host = new URL(url).host; } catch { return { ok: false, status: 0, text: "", error: "bad URL" }; }
      const wait = await politenessDelay(host);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      lastHit.set(host, Date.now());

      let ctx = null;
      try {
        ctx = await browser.newContext({
          userAgent: userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          viewport,
          locale: "en-US"
        });
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        /* let client-rendered lists hydrate — the whole point of this fetcher */
        await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 8000) }).catch(() => {});
        /* one lazy-load scroll, like scrape-jobs-playwright does */
        await page.mouse.wheel(0, 1200).catch(() => {});
        await page.waitForTimeout(500);
        const status = page.statusCode?.() ?? 200;
        const text = await page.content();
        return { ok: true, status, text };
      } catch (err) {
        return { ok: false, status: 0, text: "", error: err instanceof Error ? err.message : String(err) };
      } finally {
        if (ctx) await ctx.close().catch(() => {});
      }
    },

    async close() {
      if (!closed) { closed = true; await browser.close().catch(() => {}); }
    }
  };
}

/** Resolves the fetcher for a crawl run: Playwright render fetcher when
 *  DISCOVERY_RENDER=1 and playwright is importable; plain createFetcher
 *  otherwise. Returns { fetcher, mode, close }. */
export async function resolveDiscoveryFetcher(createFetcher, opts = {}) {
  const wantRender = process.env.DISCOVERY_RENDER === "1";
  if (wantRender && (await playwrightAvailable())) {
    const f = await createRenderFetcher({
      userAgent: opts.userAgent,
      timeoutMs: opts.timeoutMs,
      delayMs: opts.delayMs
    });
    return { fetcher: f, mode: "playwright", close: () => f.close() };
  }
  const f = createFetcher({ userAgent: opts.userAgent, delayMs: opts.delayMs ?? 300 });
  return {
    fetcher: f,
    mode: wantRender ? "fallback-plain" : "plain",
    close: async () => {}
  };
}
