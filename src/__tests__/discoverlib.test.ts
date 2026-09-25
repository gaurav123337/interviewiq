import { describe, expect, it } from "vitest";
import {
  canonicalSeedUrl,
  classifySeed,
  githubSearchUrl,
  parseRepoSearchHit,
  planDiscovery
} from "../../scripts/discover-lib.js";

describe("canonicalSeedUrl", () => {
  it("strips hash, tracking params, and trailing slash", () => {
    expect(canonicalSeedUrl("https://x.dev/guide/?utm_source=n&fbclid=z#/sec")).toBe("https://x.dev/guide");
  });

  it("keeps meaningful query params and rejects non-http protocols", () => {
    expect(canonicalSeedUrl("https://x.dev/list?page=2")).toBe("https://x.dev/list?page=2");
    expect(canonicalSeedUrl("ftp://x.dev/f")).toBeNull();
    expect(canonicalSeedUrl("not a url")).toBeNull();
  });
});

describe("classifySeed", () => {
  it("classifies GitHub topics with the topic name", () => {
    const c = classifySeed("https://github.com/topics/react-interview-questions/")!;
    expect(c.kind).toBe("github-topic");
    expect(c.topic).toBe("react-interview-questions");
    expect(c.licenseCheck).toBe(true);
  });

  it("classifies owner/repo URLs and ordinary pages", () => {
    expect(classifySeed("https://github.com/vuejs/pinia")!.kind).toBe("github-repo");
    expect(classifySeed("https://github.com/vuejs/pinia")!.owner).toBe("vuejs");
    expect(classifySeed("https://example.com/api/questions.json")!.kind).toBe("json");
    expect(classifySeed("https://example.com/sitemap.xml")!.kind).toBe("sitemap");
    expect(classifySeed("https://example.com/sitemaps/pages.xml")!.kind).toBe("sitemap");
    expect(classifySeed("https://example.com/interview-prep")!.kind).toBe("html");
    expect(classifySeed("mailto:x@y.dev")).toBeNull();
  });

  it("classifies GitHub search-UI URLs as github-search with the decoded query (2026-09-25 blind-spot fix)", () => {
    const c = classifySeed("https://github.com/search?q=nodejs+interview+questions&type=repositories")!;
    expect(c.kind).toBe("github-search");
    expect(c.query).toBe("nodejs interview questions");
    expect(c.resultType).toBe("repositories");
    expect(c.licenseCheck).toBe(true);
    /* type param defaults to repositories; license gate stays on */
    expect(classifySeed("https://github.com/search?q=x")!.resultType).toBe("repositories");
  });

  it("githubSearchUrl builds a keyless REST URL; parseRepoSearchHit picks repo fields and guards junk", () => {
    expect(githubSearchUrl("react interview", { perPage: 5 })).toBe(
      "https://api.github.com/search/repositories?q=react+interview&per_page=5"
    );
    const hit = parseRepoSearchHit({
      full_name: "sudheerj/reactjs-interview-questions",
      html_url: "https://github.com/sudheerj/reactjs-interview-questions",
      description: "A list of questions",
      stargazers_count: 1234,
      license: { spdx_id: "MIT" }
    });
    expect(hit).toMatchObject({ kind: "github-repo", owner: "sudheerj", repo: "reactjs-interview-questions", stars: 1234, license: "MIT", licenseCheck: true });
    /* no license → null (never auto-entered); NOASSERTION → null */
    expect(parseRepoSearchHit({ full_name: "a/b", html_url: "https://github.com/a/b", license: null })!.license).toBeNull();
    expect(parseRepoSearchHit({ full_name: "a/b", html_url: "https://github.com/a/b", license: { spdx_id: "NOASSERTION" } })!.license).toBeNull();
    expect(parseRepoSearchHit(null)).toBeNull();
    expect(parseRepoSearchHit({ full_name: "no-url", html_url: "" })).toBeNull();
  });

  it("plans github-search seeds against the REST API with an HTML render fallback", () => {
    const p = planDiscovery("https://github.com/search?q=nodejs+interview+questions&type=repositories", { perPage: 3 })!;
    expect(p.seed.kind).toBe("github-search");
    expect(p.steps[0].action).toBe("github-search-api");
    expect(p.steps[0].url).toContain("api.github.com/search/repositories");
    expect(p.steps[0].url).toContain("per_page=3");
    expect(p.steps[1].action).toBe("github-search-render-fallback");
    expect(p.needsApproval).toBe(true);
  });
});

describe("planDiscovery", () => {
  it("plans repo steps with license gate and default budget", () => {
    const p = planDiscovery("https://github.com/vuejs/pinia")!;
    expect(p.seed.kind).toBe("github-repo");
    expect(p.steps.map((s) => s.action)).toEqual(["github-repo-meta", "crawl"]);
    expect(p.budget).toEqual({ maxDepth: 2, maxPagesPerSeed: 25, maxTotal: 100 });
    expect(p.needsApproval).toBe(true);
  });

  it("honors budget overrides and plans topic/json/sitemap/html seeds", () => {
    expect(planDiscovery("https://github.com/topics/nodejs", { maxDepth: 3 })!.budget.maxDepth).toBe(3);
    expect(planDiscovery("https://x.dev/q.json")!.steps[0].action).toBe("extract-json");
    expect(planDiscovery("https://x.dev/sitemap.xml")!.steps[0].action).toBe("enumerate-sitemap");
    expect(planDiscovery("https://x.dev/page")!.steps[0].action).toBe("crawl");
    expect(planDiscovery("https://x.dev/sitemap.xml")!.seed.kind).toBe("sitemap");
  });

  it("returns null for bad input and accepts a pre-classified seed", () => {
    expect(planDiscovery("")).toBeNull();
    const cls = classifySeed("https://github.com/topics/nodejs")!;
    expect(planDiscovery(cls)!.seed.topic).toBe("nodejs");
  });
});
