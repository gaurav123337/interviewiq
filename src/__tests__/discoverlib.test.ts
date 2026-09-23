import { describe, expect, it } from "vitest";
import {
  canonicalSeedUrl,
  classifySeed,
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
