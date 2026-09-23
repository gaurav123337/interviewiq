#!/usr/bin/env node
/* Pure crawl-engine helpers (Phase 4 Item D1).
   Zero I/O: normalizeUrl / extractLinks / detectType / Budget / robotsAllowed
   are all pure; the only I/O lives behind the pluggable createFetcher({fetchImpl})
   seam so a Playwright renderer can slot in later without touching call sites.
   Mirrors scrape-lib.js style. */

const MAX_DEPTH_DEFAULT = 2;
const MAX_PAGES_PER_SEED_DEFAULT = 25;
const MAX_TOTAL_DEFAULT = 100;

/** Crawl budget: per-seed and global caps for one discovery run. */
export class Budget {
  constructor(opts = {}) {
    this.maxDepth = opts.maxDepth ?? MAX_DEPTH_DEFAULT;
    this.maxPagesPerSeed = opts.maxPagesPerSeed ?? MAX_PAGES_PER_SEED_DEFAULT;
    this.maxTotal = opts.maxTotal ?? MAX_TOTAL_DEFAULT;
    this.consumed = 0;
    /** @type {Map<string, number>} seedKey -> pages fetched for that seed */
    this.perSeed = new Map();
  }

  /** Resets counters for a fresh run (the budget object is reusable across runs). */
  reset() {
    this.consumed = 0;
    this.perSeed.clear();
  }

  /** Registers a seed so its counter exists before the first consume. */
  addSeed(seedKey) {
    if (!this.perSeed.has(seedKey)) this.perSeed.set(seedKey, 0);
    return this;
  }

  /** Whether one more page may be fetched for the given seed. */
  canFetch(seedKey) {
    if (this.consumed >= this.maxTotal) return false;
    const used = this.perSeed.get(seedKey) ?? 0;
    return used < this.maxPagesPerSeed;
  }

  /** Records one page fetch; returns false when the caller must stop. */
  consume(seedKey) {
    if (!this.canFetch(seedKey)) return false;
    this.consumed += 1;
    this.perSeed.set(seedKey, (this.perSeed.get(seedKey) ?? 0) + 1);
    return true;
  }

  /** Remaining global allowance (0 when exhausted). */
  remaining() {
    return Math.max(0, this.maxTotal - this.consumed);
  }
}

/** Canonicalizes a URL for dedupe/queues: strips hash + tracking params + trailing slash. */
export function normalizeUrl(raw, base) {
  if (!String(raw ?? "").trim()) return null;
  let u;
  try {
    u = base ? new URL(String(raw), new URL(String(base))) : new URL(String(raw));
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = "";
  const drop = [];
  u.searchParams.forEach((_v, k) => {
    if (/^utm_/i.test(k) || /^(fbclid|gclid|mc_cid|mc_eid|igshid|ref_src|ref_url)$/i.test(k)) drop.push(k);
  });
  for (const k of drop) u.searchParams.delete(k);
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
  return u.href;
}

/** Extracts candidate links from an HTML string (regex-based, dependency-free). */
export function extractLinks(html, baseUrl) {
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*?href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = (m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    const abs = normalizeUrl(href, baseUrl);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}

/** Classifies a URL/page into a routing type the D2 orchestrator can act on. */
export function detectType(url, html = "") {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith(".json") || /(^|\?)format=json/.test(url)) return "json";
  if (path.endsWith(".xml") || /sitemap/.test(path)) return "sitemap";
  if (/(github\.com\/[^/]+\/[^/]+)/.test(url)) return "repo";
  if (/<html|<body|<div|<a\s/i.test(html)) return "html";
  return "unknown";
}

/**
 * Minimal robots.txt evaluator: parses User-agent/Disallow groups and matches
 * path prefixes. Each consecutive User-agent block forms a group; the exact-UA
 * group wins, else the `*` group, else allowed. Allow wins on longer prefix.
 * Unknown/absent file defaults to allowed — enough for the boards we crawl.
 */
export function robotsAllowed(robotsTxt, url, ua = "*") {
  if (!robotsTxt) return true;
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return false;
  }
  const path = u.pathname + (u.search || "");
  const groups = [];
  let current = null;
  for (const rawLine of String(robotsTxt).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^(user-agent|allow|disallow)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue; // unknown directive (crawl-delay, sitemap, …) — ignore
    const [, key, value] = m;
    if (key.toLowerCase() === "user-agent") {
      if (current && current.pendingUa) {
        current.agents.push(value.toLowerCase());
      } else {
        current = { agents: [value.toLowerCase()], allows: [], disallows: [], pendingUa: true };
        groups.push(current);
      }
    } else {
      if (!current) continue;
      current.pendingUa = false;
      const bucket = key.toLowerCase() === "allow" ? current.allows : current.disallows;
      if (value !== "") bucket.push(value);
    }
  }
  if (groups.length === 0) return true;
  const wanted = ua.toLowerCase();
  const group = groups.find((g) => g.agents.includes(wanted)) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  let best = -1;
  let allowed = true;
  for (const d of group.disallows) {
    const len = prefixLen(d, path);
    if (len > best) { best = len; allowed = false; }
  }
  for (const a of group.allows) {
    const len = prefixLen(a, path);
    if (len > best) { best = len; allowed = true; }
  }
  return allowed;

  function prefixLen(dir, p) {
    if (dir === "/" || dir === "") return p.length;
    const d = dir.replace(/\*$/, "");
    return p.startsWith(d) ? d.length : -1;
  }
}

/**
 * The pluggable fetcher seam. Default uses global fetch with a UA + timeout +
 * per-host politeness delay; tests (and the future Playwright renderer) inject
 * `fetchImpl` instead. Returned fetchText never throws — it returns a result
 * object so orchestrator code stays linear.
 */
export function createFetcher({ fetchImpl, userAgent, timeoutMs = 15000, delayMs = 250 } = {}) {
  const impl = fetchImpl ?? fetch;
  const lastHit = new Map(); // host -> timestamp of last request start
  return {
    async fetchText(url) {
      const host = new URL(url).host;
      const wait = await politenessDelay(host);
      if (wait > 0) await sleep(wait);
      lastHit.set(host, Date.now());
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctrl
        ? setTimeout(() => ctrl.abort(), timeoutMs)
        : null;
      try {
        const res = await impl(url, {
          headers: { "user-agent": userAgent ?? "freebuff-discovery/1.0 (+admin-configured crawler)" },
          signal: ctrl ? ctrl.signal : undefined
        });
        const text = res.ok ? await res.text() : "";
        return { ok: res.ok, status: res.status, text };
      } catch (err) {
        return { ok: false, status: 0, text: "", error: err instanceof Error ? err.message : String(err) };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  };

  async function politenessDelay(host) {
    const last = lastHit.get(host);
    if (!last || delayMs <= 0) return 0;
    const elapsed = Date.now() - last;
    return elapsed >= delayMs ? 0 : delayMs - elapsed;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
