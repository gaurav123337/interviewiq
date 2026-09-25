#!/usr/bin/env node
/* Pure seed-classification + discovery-planning helpers (Phase 4 Item D1).
   Zero I/O by design — the D2 orchestrator (crawl-sources.js) executes the
   plans these functions produce, and everything here is unit-testable from
   vitest without network access. Mirrors scrape-lib.js style. */

/** Seed kinds the discovery engine understands. */
export const SEED_KINDS = ["github-topic", "github-repo", "github-search", "json", "sitemap", "html"];

const GH_TOPIC_RE = /^\/topics\/([^/]+)\/?$/;
const GH_SEARCH_RE = /^\/search\/?$/;

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

/** Builds the keyless GitHub REST search URL for a query (search/repositories).
 *  Mirrors the D5 prober's endpoint; `GITHUB_TOKEN` can be layered on by the
 *  caller via headers — the URL itself stays token-free. */
export function githubSearchUrl(query, opts = {}) {
  const params = new URLSearchParams({ q: String(query ?? ""), per_page: String(opts.perPage ?? 10) });
  if (opts.sort) params.set("sort", opts.sort);
  return `https://api.github.com/search/repositories?${params.toString()}`;
}

/** Pure: picks the repository fields discovery needs from one REST search-hit
 *  (the items[] entries of /search/repositories). Returns null for junk rows.
 *  `license` is the SPDX id (null when the repo has no LICENSE — callers flag
 *  no-license repos and never auto-enter them, per the D2/D3 contract). */
export function parseRepoSearchHit(hit) {
  if (!hit || typeof hit !== "object") return null;
  const fullName = typeof hit.full_name === "string" ? hit.full_name.trim() : "";
  const htmlUrl = typeof hit.html_url === "string" ? hit.html_url.trim() : "";
  if (!fullName || !htmlUrl) return null;
  const [owner, ...repoParts] = fullName.split("/");
  const repo = repoParts.join("/");
  if (!owner || !repo) return null;
  return {
    kind: "github-repo",
    url: canonicalSeedUrl(htmlUrl) ?? htmlUrl,
    owner,
    repo,
    description: typeof hit.description === "string" ? hit.description.slice(0, 300) : "",
    stars: typeof hit.stargazers_count === "number" ? hit.stargazers_count : 0,
    license: hit.license && typeof hit.license.spdx_id === "string" && hit.license.spdx_id !== "NOASSERTION"
      ? hit.license.spdx_id
      : null,
    attributionSource: "github",
    licenseCheck: true
  };
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
    /* GitHub's search-results UI is JS-rendered — the crawler would only see
       nav chrome. Classify it as `github-search` so the orchestrator executes
       the plan against the keyless REST API instead of the HTML page. */
    if (GH_SEARCH_RE.test(path)) {
      const q = u.searchParams.get("q") ?? "";
      const type = (u.searchParams.get("type") ?? "repositories").toLowerCase();
      return {
        kind: "github-search",
        url: canonical,
        host,
        path,
        query: q,
        resultType: type === "repositories" || type === "repos" ? "repositories" : type,
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
    case "github-search": {
      /* Keyless REST search — same rate budget as the D5 prober, deterministic,
         and returns structured repos (full_name, license, html_url) instead of
         the JS-rendered chrome the HTML page would give the crawler. */
      const api = githubSearchUrl(cls.query, { perPage: opts.perPage ?? 10, sort: opts.sort });
      steps = [
        { action: "github-search-api", url: api, note: `keyless REST search for "${cls.query}" — repos flow to license-checked repo plans` },
        { action: "github-search-render-fallback", url: cls.url, note: "HTML fallback when the API is rate-limited (403) — results not guaranteed (JS-rendered)" }
      ];
      break;
    }
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
