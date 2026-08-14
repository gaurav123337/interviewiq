/* Phase 2 — platform integrations: import pipeline (Lane B), source
   filter chips, and the apply hand-off (Lane C). */

import { afterEach, describe, expect, it } from "vitest";
import type { JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import { addImportedJob, EMPTY_FILTERS, filterJobs } from "../services/jobs";
import { markAppliedVia, setStatus } from "../services/applyTrack";
import {
  extractFromJsonLd, importFromUrl, normalizeImportedJob, platformFromUrl, robotsAllows, sourceLabel, sourcePriority, splitJobUrls, stableHash, stripHtml
} from "../services/importJob";

afterEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

const job = (over: Partial<JobPosting> = {}): JobPosting => ({
  id: "imported:naukri:abc",
  source: "imported:naukri",
  externalId: "abc",
  title: "Senior React Engineer",
  company: "Acme",
  location: "Bengaluru, India",
  remote: false,
  description: "React, TypeScript, AWS.",
  url: "https://www.naukri.com/job/abc",
  skills: ["react", "typescript"],
  level: "senior",
  salary: null,
  companySize: null,
  postedAt: null,
  ...over
});

describe("platformFromUrl", () => {
  it("detects the big platforms by hostname", () => {
    expect(platformFromUrl("https://www.naukri.com/job/123")?.id).toBe("naukri");
    expect(platformFromUrl("https://www.linkedin.com/jobs/view/123")?.id).toBe("linkedin");
    expect(platformFromUrl("https://in.indeed.com/viewjob?jk=abc")?.id).toBe("indeed");
    expect(platformFromUrl("https://boards.greenhouse.io/airbnb/jobs/1")?.id).toBe("other");
  });

  it("rejects non-URLs and non-http schemes", () => {
    expect(platformFromUrl("not a url")).toBeNull();
    expect(platformFromUrl("ftp://naukri.com/job/1")).toBeNull();
    expect(platformFromUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("sourcePriority (region-aware ordering)", () => {
  it("favors Naukri for India locations", () => {
    const p = sourcePriority("Bengaluru, India");
    expect(p["imported:naukri"]).toBeLessThan(p["imported:linkedin"]);
    expect(p["imported:naukri"]).toBe(0);
  });

  it("favors LinkedIn/Indeed elsewhere and defaults unknown sources to last", () => {
    const p = sourcePriority("San Francisco, US");
    expect(p["imported:linkedin"]).toBeLessThan(p["imported:naukri"]);
    expect(p["imported:indeed"]).toBeLessThan(p["imported:naukri"]);
    expect(p["imported:monster"]).toBeUndefined();
  });

  it("treats an empty location as non-India", () => {
    expect(sourcePriority("")["imported:naukri"]).toBeGreaterThan(sourcePriority("")["imported:linkedin"]);
  });
});

describe("splitJobUrls", () => {
  it("splits newline- and comma-separated links, trims, dedupes, drops blanks", () => {
    expect(splitJobUrls("https://a.com/j1\nhttps://b.com/j2, https://a.com/j1\n\n   ")).toEqual(["https://a.com/j1", "https://b.com/j2"]);
    expect(splitJobUrls("")).toEqual([]);
  });
});

describe("sourceLabel", () => {
  it("maps native + imported sources to human labels", () => {
    expect(sourceLabel("greenhouse")).toBe("Greenhouse");
    expect(sourceLabel("rss")).toBe("RSS");
    expect(sourceLabel("imported:naukri")).toBe("Naukri");
    expect(sourceLabel("imported:linkedin")).toBe("LinkedIn");
    expect(sourceLabel("imported:other")).toBe("company page");
    expect(sourceLabel("imported:monster")).toBe("monster");
  });
});

describe("stripHtml", () => {
  it("removes tags, scripts and collapses whitespace", () => {
    expect(stripHtml("<div>Hello <b>world</b><script>evil()</script></div>")).toBe("Hello world");
    expect(stripHtml("a&amp;b")).toBe("a&b");
    expect(stripHtml("a&nbsp;b")).toBe("a b");
  });
});

describe("robotsAllows", () => {
  it("defaults to allow", () => {
    expect(robotsAllows("", "/jobs/1")).toBe(true);
  });

  it("honors the User-agent: * group's Disallow rules", () => {
    const txt = "User-agent: *\nDisallow: /jobs/\nUser-agent: googlebot\nDisallow: /everything";
    expect(robotsAllows(txt, "/jobs/123")).toBe(false);
    expect(robotsAllows(txt, "/careers")).toBe(true);
  });

  it("supports * wildcards", () => {
    expect(robotsAllows("User-agent: *\nDisallow: /job*", "/jobposting/9")).toBe(false);
  });
});

describe("extractFromJsonLd", () => {
  it("parses a JobPosting schema.org block", () => {
    const html = `<html><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Backend Engineer",
      hiringOrganization: { name: "Acme Corp" },
      jobLocation: { address: { addressLocality: "Remote", addressCountry: "US" } },
      description: "<p>Go and <b>Kubernetes</b>.</p>",
      url: "https://acme.com/jobs/9"
    })}</script></html>`;
    const p = extractFromJsonLd(html);
    expect(p?.title).toBe("Backend Engineer");
    expect(p?.company).toBe("Acme Corp");
    expect(p?.location).toBe("Remote, US");
    expect(p?.description).toBe("Go and Kubernetes.");
    expect(p?.applyUrl).toBe("https://acme.com/jobs/9");
  });
});

describe("normalizeImportedJob", () => {
  it("builds a feed-ready posting with the imported: source and mined skills", () => {
    const p = normalizeImportedJob({ id: "naukri", label: "Naukri", host: "naukri.com" }, {
      title: "Senior React Engineer",
      company: "Acme",
      location: "Remote",
      description: "We need React, TypeScript and GraphQL expertise.",
      applyUrl: "https://naukri.com/job/9"
    }, "https://naukri.com/job/9");
    expect(p.source).toBe("imported:naukri");
    expect(p.id).toBe(`imported:naukri:${stableHash("https://naukri.com/job/9")}`);
    expect(p.title).toBe("Senior React Engineer");
    expect(p.company).toBe("Acme");
    expect(p.remote).toBe(true);
    expect(p.skills.some(s => s.toLowerCase().includes("react"))).toBe(true);
    expect(p.skills.some(s => s.toLowerCase().includes("typescript"))).toBe(true);
    expect(p.level).toBe("senior");
    expect(p.url).toBe("https://naukri.com/job/9");
  });
});

describe("importFromUrl (direct public fetch)", () => {
  it("extracts title/description from meta tags when the fetch succeeds", async () => {
    const html = `<html><head><title>Staff Data Engineer</title>` +
      `<meta property="og:title" content="Staff Data Engineer — Acme">` +
      `<meta property="og:site_name" content="Acme">` +
      `<meta name="description" content="SQL, Spark, Airflow at scale."></head></html>`;
    const fetcher = async (u: string) => {
      if (u.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /secret", { status: 200 });
      return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
    };
    const out = await importFromUrl("https://acme.com/jobs/1", fetcher);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.job.title).toContain("Staff Data Engineer");
      expect(out.job.company).toBe("Acme");
      expect(out.job.source).toBe("imported:other");
    }
  });

  it("blocks when robots.txt disallows the path", async () => {
    const fetcher = async (u: string) =>
      u.endsWith("/robots.txt") ? new Response("User-agent: *\nDisallow: /jobs/", { status: 200 }) : new Response("", { status: 200 });
    const out = await importFromUrl("https://acme.com/jobs/1", fetcher);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("blocked");
  });

  it("fails gracefully on HTTP errors and CORS throws", async () => {
    const httpErr = await importFromUrl("https://acme.com/jobs/1", async () => new Response("nope", { status: 404 }));
    expect(httpErr.ok).toBe(false);
    if (!httpErr.ok) expect(httpErr.reason).toBe("network");
    const corsErr = await importFromUrl("https://acme.com/jobs/1", async () => { throw new TypeError("Failed to fetch"); });
    expect(corsErr.ok).toBe(false);
    if (!corsErr.ok) expect(corsErr.reason).toBe("network");
  });

  it("rejects invalid URLs", async () => {
    const out = await importFromUrl("not a url");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("invalid-url");
  });
});

describe("addImportedJob", () => {
  it("adds at the front and dedupes by apply URL", () => {
    addImportedJob(job());
    addImportedJob(job()); /* same id + url — no duplicate */
    addImportedJob(job({ id: "imported:naukri:def", externalId: "def", url: "https://www.naukri.com/job/def", title: "Backend Engineer" }));
    const jobs = addImportedJob(job({ id: "imported:naukri:xyz", externalId: "xyz", url: "https://www.naukri.com/job/xyz", title: "DevOps Engineer" }));
    expect(jobs.map(j => j.title)).toEqual(["DevOps Engineer", "Backend Engineer", "Senior React Engineer"]);
  });
});

describe("filterJobs source filter", () => {
  it("keeps only the selected source", () => {
    const jobs = [job(), job({ id: "greenhouse:1", source: "greenhouse", externalId: "1", title: "SWE", url: "https://gh.com/1" })];
    const out = filterJobs(jobs, { ...EMPTY_FILTERS, source: "imported:naukri" });
    expect(out.map(j => j.source)).toEqual(["imported:naukri"]);
    expect(filterJobs(jobs, EMPTY_FILTERS)).toHaveLength(2);
  });
});

describe("markAppliedVia (apply hand-off)", () => {
  it("marks applied, remembers the platform, and defaults a 2-week follow-up", () => {
    const t = markAppliedVia("imported:naukri:abc", "Naukri");
    expect(t.status).toBe("applied");
    expect(t.via).toBe("Naukri");
    expect(t.appliedAt).toBeTruthy();
    expect(t.followUpAt).toBeGreaterThan(Date.now());
  });

  it("never downgrades a later stage", () => {
    setStatus("j1", "offer");
    const t = markAppliedVia("j1", "LinkedIn");
    expect(t.status).toBe("offer");
    expect(t.via).toBe("LinkedIn");
  });
});
