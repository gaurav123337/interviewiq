import { describe, expect, it, vi } from "vitest";
import {
  Budget,
  createFetcher,
  detectType,
  extractLinks,
  normalizeUrl,
  robotsAllowed
} from "../../scripts/crawl-lib.js";

describe("normalizeUrl", () => {
  it("resolves relative links and strips noise", () => {
    expect(normalizeUrl("/a?utm_source=x#f", "https://s.dev/base/")).toBe("https://s.dev/a");
    expect(normalizeUrl("//cdn.x.dev/lib", "https://s.dev/")).toBe("https://cdn.x.dev/lib");
    expect(normalizeUrl("https://s.dev/p/")).toBe("https://s.dev/p");
    expect(normalizeUrl("javascript:void(0)")).toBeNull();
    expect(normalizeUrl("", "https://s.dev/")).toBeNull();
  });
});

describe("Budget", () => {
  it("enforces per-seed caps before the global cap", () => {
    const b = new Budget({ maxPagesPerSeed: 2, maxTotal: 100 });
    b.addSeed("s1");
    expect(b.consume("s1")).toBe(true);
    expect(b.consume("s1")).toBe(true);
    expect(b.canFetch("s1")).toBe(false);
    expect(b.consume("s1")).toBe(false);
    b.addSeed("s2");
    expect(b.consume("s2")).toBe(true);
  });

  it("enforces the global cap across seeds and supports reset", () => {
    const b = new Budget({ maxPagesPerSeed: 5, maxTotal: 3 });
    for (const s of ["a", "b", "c"]) {
      b.addSeed(s);
      b.consume(s);
    }
    expect(b.consumed).toBe(3);
    expect(b.canFetch("a")).toBe(false);
    expect(b.remaining()).toBe(0);
    b.reset();
    expect(b.consumed).toBe(0);
    expect(b.canFetch("a")).toBe(true);
  });

  it("uses the documented defaults", () => {
    const b = new Budget();
    expect(b.maxDepth).toBe(2);
    expect(b.maxPagesPerSeed).toBe(25);
    expect(b.maxTotal).toBe(100);
  });
});

describe("extractLinks", () => {
  const page = [
    '<a href="/q?a=1&utm_source=rss">1</a>',
    '<a href="https://other.dev/x/">2</a>',
    '<a href="#local">3</a>',
    '<a href="mailto:a@b.c">4</a>',
    "<a href='/rel'>5</a>",
    '<a href="/q?a=1&utm_source=rss">dup</a>'
  ].join("\n");

  it("extracts, resolves, dedupes, and skips junk hrefs", () => {
    expect(extractLinks(page, "https://s.dev/page")).toEqual([
      "https://s.dev/q?a=1",
      "https://other.dev/x",
      "https://s.dev/rel"
    ]);
  });
});

describe("detectType", () => {
  it("routes by URL then falls back to html sniffing", () => {
    expect(detectType("https://x.dev/data.json")).toBe("json");
    expect(detectType("https://x.dev/sitemap.xml")).toBe("sitemap");
    expect(detectType("https://github.com/o/r")).toBe("repo");
    expect(detectType("https://x.dev/p", "<html><body></body></html>")).toBe("html");
    expect(detectType("https://x.dev/p", "")).toBe("unknown");
  });
});

describe("robotsAllowed", () => {
  const robots = [
    "# comment",
    "User-agent: *",
    "Disallow: /private/",
    "Allow: /private/public/",
    "Crawl-delay: 10",
    "",
    "User-agent: BadBot",
    "Disallow: /"
  ].join("\n");

  it("applies the * group with Allow-beats-longer-Disallow semantics", () => {
    expect(robotsAllowed(robots, "https://x.dev/open/page")).toBe(true);
    expect(robotsAllowed(robots, "https://x.dev/private/x")).toBe(false);
    expect(robotsAllowed(robots, "https://x.dev/private/public/y")).toBe(true);
  });

  it("handles explicit UA groups, absence, and malformed input", () => {
    expect(robotsAllowed(robots, "https://x.dev/anything", "BadBot")).toBe(false);
    expect(robotsAllowed(null, "https://x.dev/x")).toBe(true);
    expect(robotsAllowed("", "https://x.dev/x")).toBe(true);
    expect(robotsAllowed("not: a\\nvalid: robots", "https://x.dev/x")).toBe(true);
  });
});

describe("createFetcher", () => {
  it("wraps the injected fetchImpl and surfaces ok/status/text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("hello", { status: 200 }));
    const f = createFetcher({ fetchImpl, delayMs: 0 });
    const r = await f.fetchText("https://x.dev/a");
    expect(r).toEqual({ ok: true, status: 200, text: "hello" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://x.dev/a",
      expect.objectContaining({ headers: expect.objectContaining({ "user-agent": expect.any(String) }) })
    );
  });

  it("never throws: errors and non-2xx become result objects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("boom"));
    const f = createFetcher({ fetchImpl, delayMs: 0 });
    const err = await f.fetchText("https://x.dev/a");
    expect(err.ok).toBe(false);
    expect(err.status).toBe(0);
    expect(err.error).toBe("boom");

    const f2 = createFetcher({
      fetchImpl: vi.fn().mockResolvedValue(new Response("", { status: 404 })),
      delayMs: 0
    });
    const nf = await f2.fetchText("https://x.dev/missing");
    expect(nf).toEqual({ ok: false, status: 404, text: "" });
  });

  it("respects the politeness delay between same-host requests", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    const f = createFetcher({ fetchImpl, delayMs: 60 });
    const t0 = Date.now();
    await f.fetchText("https://same.dev/a");
    await f.fetchText("https://same.dev/b");
    expect(Date.now() - t0).toBeGreaterThanOrEqual(55);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
