import { describe, expect, it, vi, afterEach } from "vitest";
import {
  titleFromUrl, classifyLink, attributionFor, licenseGate, routeItems,
  mapSeedRows, buildSeedInsertSql, buildResourcesInsertSql,
  buildRunSummary, buildRunReportSql,
} from "../../scripts/crawl-orchestrate-lib.js";
import { crawlSeed, runGithubSearch } from "../../scripts/crawl-sources.js";
import { createFetcher, robotsAllowed } from "../../scripts/crawl-lib.js";
import { classifySeed } from "../../scripts/discover-lib.js";

const htmlSeed = { id: 7, url: "https://notes.dev/guide", kind: "html", skill: null, origin_detail: "" };

describe("titleFromUrl (pure)", () => {
  it("derives a human title from the URL slug", () => {
    expect(titleFromUrl("https://x.dev/blog/two-sum-explained")).toBe("Two sum explained");
    expect(titleFromUrl("https://x.dev/")).toBe("x.dev");
    expect(titleFromUrl("not a url")).toBe("not a url");
  });
});

describe("classifyLink (pure)", () => {
  it("routes interview/question links to qa", () => {
    const c = classifyLink("/questions/top-10", "https://s.dev/");
    expect(c?.kind).toBe("qa");
    expect(c?.url).toBe("https://s.dev/questions/top-10");
    expect(c?.title).toBe("Top 10");
  });

  it("routes problem links with a detected pattern", () => {
    const c = classifyLink("https://s.dev/problems/two-sum", "https://s.dev/");
    expect(c?.kind).toBe("problem");
    expect(c?.pattern).toBe("two-pointer");
  });

  it("classifies everything else as resource", () => {
    expect(classifyLink("/guides/system-design", "https://s.dev/")?.kind).toBe("resource");
  });

  it("skips unparseable and binary links", () => {
    expect(classifyLink("javascript:void(0)", "https://s.dev/")).toBeNull();
    expect(classifyLink("/deck.pdf", "https://s.dev/")).toBeNull();
  });

  it("prefers link text as the title when present", () => {
    expect(classifyLink("/a/b", "https://s.dev/", "Great prep guide")?.title).toBe("Great prep guide");
  });
});

describe("attributionFor (pure)", () => {
  it("carries GitHub owner/repo and topic", () => {
    const seed = classifySeed("https://github.com/topics/system-design")!;
    expect(seed.kind).toBe("github-topic");
    const a = attributionFor(seed, { license: "MIT" });
    expect(a.source).toBe("github");
    expect(a.topic).toBe("system-design");
    expect(a.license).toBe("MIT");
  });

  it("falls back to the host for html seeds", () => {
    expect(attributionFor(classifySeed("https://notes.dev/x")!).source).toBe("notes.dev");
  });
});

describe("licenseGate (pure)", () => {
  it("accepts known licenses", () => {
    expect(licenseGate("MIT")).toEqual({ known: true, license: "MIT", needsReview: false });
    expect(licenseGate("Apache-2.0").known).toBe(true);
  });

  it("flags unknown/absent licenses for human review", () => {
    expect(licenseGate(null).needsReview).toBe(true);
    expect(licenseGate("no-license").license).toBe("no-license");
    expect(licenseGate("no-license").needsReview).toBe(true);
  });
});

describe("routeItems (pure)", () => {
  const seed = classifySeed("https://github.com/x/y")!;

  it("routes answered items to qa with attribution in meta", () => {
    const items = [{ question: "What is a mutex?", answer: "A lock.", fieldId: "backend", level: "mid", keyPoints: [] }];
    const r = routeItems(items, seed, "MIT");
    expect(r.qa).toHaveLength(1);
    expect(r.problems).toHaveLength(0);
    const qa0 = r.qa[0] as { meta: { attribution: { repo: string }; needs_license_review?: boolean } };
    expect(qa0.meta.attribution.repo).toBe("y");
    expect(qa0.meta.needs_license_review).toBeUndefined();
  });

  it("flags needs_license_review when the license is unknown", () => {
    const r = routeItems([{ question: "Q?", answer: "A", keyPoints: [] }], seed, null);
    const qa0 = r.qa[0] as { meta: { needs_license_review?: boolean } };
    expect(qa0.meta.needs_license_review).toBe(true);
  });

  it("routes unanswered pattern-matching titles to problem candidates", () => {
    const r = routeItems([{ question: "How do you implement two sum?", answer: "", keyPoints: [] }], seed, "MIT");
    expect(r.qa).toHaveLength(0);
    expect(r.problems).toEqual([{ id: "how-do-you-implement-two-sum", title: "How do you implement two sum?", pattern: "two-pointer" }]);
  });
});

describe("mapSeedRows (pure)", () => {
  it("passes valid rows and skips bad ones with reasons", () => {
    const { seeds, skipped } = mapSeedRows([
      { id: 1, url: "https://a.dev/", kind: "html" },
      { id: 2, url: "  ", kind: "html" },
      { id: 3, url: "https://b.dev/", kind: "nope" },
    ]);
    expect(seeds).toHaveLength(1);
    expect(seeds[0].url).toBe("https://a.dev/");
    expect(skipped).toEqual([
      { id: 2, reason: "empty url" },
      { id: 3, reason: 'unknown kind "nope"' },
    ]);
  });
});

describe("SQL builders (pure)", () => {
  it("inserts pending seeds idempotently", () => {
    const sql = buildSeedInsertSql([{ url: "https://a.dev/", kind: "html", origin: "manual", originDetail: "card", skill: null }]);
    expect(sql).toContain("insert into public.discovery_seeds (url, kind, origin, origin_detail, skill)");
    expect(sql).toContain("on conflict (url) do nothing;");
    expect(sql).toContain("'https://a.dev/'");
  });

  it("returns empty SQL for empty inputs", () => {
    expect(buildSeedInsertSql([])).toBe("");
    expect(buildResourcesInsertSql([])).toBe("");
  });

  it("inserts resources as pending with attribution jsonb", () => {
    const sql = buildResourcesInsertSql([
      { url: "https://r.dev/guide", title: "Guide", kind: "resource", attribution: { source: "github", repo: "y" }, license: "MIT", seedId: 7, meta: {} },
    ]);
    expect(sql).toContain("insert into public.discovered_resources");
    expect(sql).toContain('{"source":"github","repo":"y"}');
    expect(sql).toContain(", 7, ");
  });
});

describe("run report builders (pure)", () => {
  it("summarizes ok runs", () => {
    const s = buildRunSummary({ a: { url: "https://a/", crawled: 2 } }, 0, 3, 0);
    expect(s.status).toBe("ok");
    expect(s.inserted).toBe(3);
    const sql = buildRunReportSql(s);
    expect(sql).toContain("insert into public.scraper_runs");
    expect(sql).toContain("'cron'");
    expect(sql).toContain('"crawled":2');
  });

  it("marks partial when one seed errored and failed when all did", () => {
    const partial = buildRunSummary({ a: { error: "HTTP 500" }, b: { crawled: 1 } }, 0, 0, 1);
    expect(partial.status).toBe("partial");
    const failed = buildRunSummary({ a: { error: "HTTP 500" } }, 0, 0, 1);
    expect(failed.status).toBe("failed");
  });
});

describe("runGithubSearch (keyless REST — the JS-rendered search-page blind-spot fix)", () => {
  const env = (globalThis as Record<string, unknown>).process as { env: Record<string, string | undefined> } | undefined;
  afterEach(() => { vi.unstubAllGlobals(); if (env) delete env.env.GITHUB_TOKEN; });

  const searchSeed = { id: "s1", url: "https://github.com/search?q=svelte+interview+questions&type=repositories", skill: "JavaScript" };

  it("fans a search seed out into license-stamped repo child seeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        total_count: 4,
        items: [
          { full_name: "a/svelte-iq", html_url: "https://github.com/a/svelte-iq", license: { spdx_id: "MIT" } },
          { full_name: "b/svelte-iq-gen", html_url: "https://github.com/b/svelte-iq-gen", license: { spdx_id: "NOASSERTION" } },
          { full_name: "bad-row" }, /* junk row — dropped */
        ],
      }),
    })));
    const out = await runGithubSearch(searchSeed, { maxRepos: 3 });
    expect(out.perSeed.s1.repos).toBe(2);
    expect(out.perSeed.s1.totalResults).toBe(4);
    expect(out.childSeeds).toHaveLength(2);
    expect(out.childSeeds[0]).toMatchObject({ kind: "github-repo", url: "https://github.com/a/svelte-iq", license: "MIT", origin: "search-child", skill: "JavaScript" });
    /* no-license child keeps the review flag path — license null, never auto-rotated downstream */
    expect(out.childSeeds[1].license).toBeNull();
    const called = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(called[0]).toContain("api.github.com/search/repositories");
    expect(called[0]).toContain("per_page=3");
    expect(called[1].headers.Authorization).toBeUndefined(); /* keyless */
  });

  it("attaches GITHUB_TOKEN when set and reports rate-limit without child seeds", async () => {
    if (env) env.env.GITHUB_TOKEN = "tok";
    vi.stubGlobal("fetch", vi.fn(async (_u, init: { headers: Record<string, string> }) => {
      expect(init.headers.Authorization).toBe("Bearer tok");
      return { ok: false, status: 403, json: async () => ({}) };
    }));
    const out = await runGithubSearch(searchSeed, {});
    expect(out.perSeed.s1.note).toContain("rate-limited");
    expect(out.childSeeds).toHaveLength(0);
  });

  it("ignores non-search seeds", async () => {
    const out = await runGithubSearch({ id: 1, url: "https://github.com/vuejs/pinia" }, {});
    expect(out.childSeeds).toHaveLength(0);
    expect(out.perSeed["1"].kind).toBe("github-search"); /* inert empty entry */
  });
});

describe("crawlSeed (BFS over an injected fake fetcher)", () => {
  function fakeFetcher(pages: Record<string, string>) {
    const fetches: string[] = [];
    const fetcher = {
      fetchText: async (url: string) => {
        fetches.push(url);
        if (url.endsWith("/robots.txt")) return { ok: true, status: 200, text: "User-agent: *\nAllow: /" };
        const page = pages[url];
        if (!page) return { ok: false, status: 404, text: "" };
        return { ok: true, status: 200, text: page };
      },
      _fetches: fetches,
    };
    return fetcher;
  }

  const seedUrl = "https://s.dev/guide"; /* canonical — classifySeed strips trailing slashes */
  const homePage = [
    "<html><body>",
    "<h1>What is a deadlock?</h1>",
    "<p>A deadlock is when two processes wait on each other forever.</p>",
    "<a href=\"/questions/thread-safety\">Top thread safety questions</a>",
    "<a href=\"/problems/two-sum\">Two sum</a>",
    "<a href=\"https://other.dev/great-resource\">Great prep guide</a>",
    "<a href=\"/deck.pdf\">slides</a>",
    "</body></html>",
  ].join("\n");
  const qaPage = "<html><body><h2>What is a race condition?</h2><p>Two threads access shared state without sync.</p></body></html>";

  it("crawls within budget, routes links, extracts Q&A", async () => {
    const f = fakeFetcher({ [seedUrl]: homePage, "https://s.dev/questions/thread-safety": qaPage });
    const seed = { id: 42, url: seedUrl, kind: "html", license: "MIT" };
    const res = await crawlSeed(seed, { fetcher: f, maxTotal: 10, maxDepth: 1 });

    const row = res.perSeed["42"];
    expect(row.crawled).toBe(2); /* seed + qa page */
    expect(row.error).toBeUndefined();
    expect(res.qa.length).toBeGreaterThanOrEqual(1); /* deadlock Q&A from seed page */
    /* link routing happened */
    expect(res.qa.some((q: Record<string, unknown>) => String(q.question).includes("race condition"))).toBe(true);
    expect(res.problems.some((p: { id: string }) => p.id === "two-sum")).toBe(true);
    expect(res.resources.map((r: Record<string, unknown>) => r.url)).toContain("https://other.dev/great-resource");
    expect(res.resources).toHaveLength(1); /* no duplicates, no pdf */
  });

  it("respects robots.txt and budget caps", async () => {
    const f = fakeFetcher({ [seedUrl]: homePage });
    f.fetchText = async (url) => {
      if (url.endsWith("/robots.txt")) return { ok: true, status: 200, text: "User-agent: interviewiq-crawler\nDisallow: /" };
      return { ok: true, status: 200, text: homePage };
    };
    const res = await crawlSeed({ id: 1, url: seedUrl }, { fetcher: f });
    expect(res.perSeed["1"].skippedRobots).toBeGreaterThanOrEqual(1);
    expect(res.perSeed["1"].crawled).toBe(0);
  });

  it("reports budget exhaustion without an error", async () => {
    const f = fakeFetcher({ [seedUrl]: homePage });
    const res = await crawlSeed({ id: 1, url: seedUrl }, { fetcher: f, maxPagesPerSeed: 1 });
    expect(res.perSeed["1"].crawled).toBe(1);
    expect(res.perSeed["1"].error).toBeUndefined();
  });

  it("returns an error row for unclassifiable seeds", async () => {
    const f = fakeFetcher({});
    const res = await crawlSeed({ id: 9, url: "not a url" }, { fetcher: f });
    expect(res.perSeed["9"].error).toBe("unclassifiable seed");
  });
});

describe("regression: crawl-lint fetcher seam compatibility", () => {
  it("crawlSeed works with the real createFetcher interface (never called in test)", () => {
    const f = createFetcher({ fetchImpl: async () => new Response("x") });
    expect(typeof f.fetchText).toBe("function");
    expect(robotsAllowed("User-agent: *\nAllow: /", "https://x.dev/a")).toBe(true);
  });
});
