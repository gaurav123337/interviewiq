#!/usr/bin/env node
/* Pure seed-classification + discovery-planning helpers (Phase 4 Item D1).
   Zero I/O by design — the D2 orchestrator (crawl-sources.js) executes the
   plans these functions produce, and everything here is unit-testable from
   vitest without network access. Mirrors scrape-lib.js style. */

/** Seed kinds the discovery engine understands. */
export const SEED_KINDS = ["github-topic", "github-repo", "json", "sitemap", "html"];

const GH_TOPIC_RE = /^\/topics\/([^/]+)\/?$/;

/** Canonicalizes a URL for comparisons: no hash, no tracking params, no trailing slash. */
export function canonicalSeedUrl(raw) {
  let u;
  try {
    u = new URL(String(raw));
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

/**
 * Classifies a seed URL into the kind of discovery plan it needs.
 * Returns null for anything unparseable or non-http(s) — callers decide how to report it.
 */
export function classifySeed(url) {
  const canonical = canonicalSeedUrl(url);
  if (!canonical) return null;
  const u = new URL(canonical);
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  const segs = path.split("/").filter(Boolean);

  if (host === "github.com" || host === "www.github.com") {
    const topic = GH_TOPIC_RE.exec(path);
    if (topic) {
      return {
        kind: "github-topic",
        url: canonical,
        host,
        path,
        topic: decodeURIComponent(topic[1]),
        attributionSource: "github",
        licenseCheck: true
      };
    }
    if (segs.length === 2) {
      return {
        kind: "github-repo",
        url: canonical,
        host,
        path,
        owner: decodeURIComponent(segs[0]),
        repo: decodeURIComponent(segs[1]),
        attributionSource: "github",
        licenseCheck: true
      };
    }
  }

  if (path.toLowerCase().endsWith(".json")) {
    return { kind: "json", url: canonical, host, path, attributionSource: host, licenseCheck: false };
  }
  const lower = path.toLowerCase();
  if (lower.endsWith(".xml") || lower.includes("sitemap")) {
    return { kind: "sitemap", url: canonical, host, path, attributionSource: host, licenseCheck: false };
  }
  return { kind: "html", url: canonical, host, path, attributionSource: host, licenseCheck: false };
}

/**
 * Builds the executable step list for a seed (URL string or a classifySeed result).
 * Pure: returns the plan; the orchestrator decides what to fetch and when.
 */
export function planDiscovery(seed, opts = {}) {
  const cls = typeof seed === "string" ? classifySeed(seed) : seed;
  if (!cls) return null;
  const budget = {
    maxDepth: opts.maxDepth ?? 2,
    maxPagesPerSeed: opts.maxPagesPerSeed ?? 25,
    maxTotal: opts.maxTotal ?? 100
  };
  let steps;
  switch (cls.kind) {
    case "github-topic":
      // Topic listing yields candidate repos; each candidate then gets its own
      // license-checked repo plan before anything enters the scrape rotation.
      steps = [{ action: "github-topic-listing", url: cls.url, note: `collect repos for topic "${cls.topic}"` }];
      break;
    case "github-repo":
      steps = [
        { action: "github-repo-meta", url: cls.url, note: "license + description — no-license repos are flagged, never auto-entered" },
        { action: "crawl", url: cls.url, note: "BFS the default branch's rendered pages within budget" }
      ];
      break;
    case "json":
      steps = [{ action: "extract-json", url: cls.url, note: "direct extractItems() on the JSON body" }];
      break;
    case "sitemap":
      steps = [{ action: "enumerate-sitemap", url: cls.url, note: "expand <loc> entries then crawl each within budget" }];
      break;
    default:
      steps = [{ action: "crawl", url: cls.url, note: "BFS from the page within budget" }];
  }
  return {
    seed: cls,
    steps,
    budget,
    attribution: { source: cls.attributionSource, licenseCheck: cls.licenseCheck },
    needsApproval: true // nothing discovered is used without a human approve
  };
}
