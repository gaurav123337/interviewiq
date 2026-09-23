import { describe, expect, it } from "vitest";
import {
  validateTarget, loadTargets, extractJob, jobIdentity, dedupeJobs,
  buildJobsUpsertSql, buildReport, buildReportSql, normalizeUrl, parseRelativeDate, sqlStr
} from "../../scripts/jobs-playwright-lib.js";

const okTarget = {
  id: "himalayas", kind: "html-listing", url: "https://himalayas.app/jobs",
  selectors: { item: "a.job", title: "h2", company: ".co" }
};

describe("validateTarget", () => {
  it("accepts a valid target and applies safe defaults", () => {
    const v = validateTarget(okTarget);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.target).toMatchObject({
        id: "himalayas", kind: "html-listing", host: "himalayas.app",
        maxItems: 25, delayMs: 1200, enabled: true, company: null
      });
    }
  });

  it("rejects missing selectors, bad kinds and non-absolute urls", () => {
    expect(validateTarget({}).ok).toBe(false);
    expect(validateTarget({ ...okTarget, kind: "nosuch" }).ok).toBe(false);
    expect(validateTarget({ ...okTarget, url: "not-a-url" }).ok).toBe(false);
    const noCompany = validateTarget({ id: "x", kind: "html-listing", url: "https://a.b/j", selectors: { item: "i", title: "t" } });
    expect(noCompany.ok).toBe(false);
  });

  it("honours target.company and clamps caps", () => {
    const v = validateTarget({ ...okTarget, company: "Acme", maxItems: 500, delayMs: -5 });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.target).toMatchObject({ company: "Acme", maxItems: 100, delayMs: 0 });
  });
});

describe("loadTargets", () => {
  it("skips invalid targets without throwing and drops disabled ones", () => {
    const { targets, skipped } = loadTargets({
      targets: [
        okTarget,
        { id: "broken" },
        { ...okTarget, id: "dup" },
        { ...okTarget, id: "dup" },
        { ...okTarget, id: "off", enabled: false }
      ]
    });
    expect(targets.map(t => t.id)).toEqual(["himalayas", "dup"]); /* first dup is valid + kept */
    expect(skipped.map(s => s.id)).toEqual(["broken", "dup"]); /* second dup skipped */
  });
});

describe("extractJob (fixture DOM)", () => {
  const target = validateTarget({
    ...okTarget,
    selectors: { item: "a.job", title: "h2", company: ".co", location: ".loc", link: "a", description: ".desc", postedAt: ".when" }
  }).ok ? validateTarget({
    ...okTarget,
    selectors: { item: "a.job", title: "h2", company: ".co", location: ".loc", link: "a", description: ".desc", postedAt: ".when" }
  }).target : null;

  it("maps selectors to a posting", () => {
    const node = {
      textContent: "",
      $$: {},
      query: (css: string) => {
        const map: Record<string, { textContent: string; getAttribute: (a: string) => string | null }> = {
          "h2": { textContent: "  Senior   React Dev ", getAttribute: () => null },
          ".co": { textContent: " Acme Corp ", getAttribute: () => null },
          ".loc": { textContent: " Remote — EU ", getAttribute: () => null },
          "a": { textContent: "", getAttribute: (a: string) => (a === "href" ? "/jobs/123?utm_source=x#top" : null) },
          ".desc": { textContent: " Build things. ".repeat(200), getAttribute: () => null },
          ".when": { textContent: "2d ago", getAttribute: () => null }
        };
        return map[css] ?? null;
      }
    };
    const job = extractJob(node, target!, (n: any, css: string) => n.query(css));
    expect(job).not.toBeNull();
    expect(job!.title).toBe("Senior React Dev");
    expect(job!.company).toBe("Acme Corp");
    expect(job!.location).toBe("Remote — EU");
    expect(job!.url).toContain("https://himalayas.app/jobs/123");
    expect(job!.url).not.toContain("utm_");
    expect(job!.description.length).toBeLessThanOrEqual(2000);
    expect(job!.postedAt).toBeTruthy();
  });

  it("returns null when title or company are missing", () => {
    const empty = { query: () => null };
    expect(extractJob(empty, target!, (n: any, css: string) => n.query(css))).toBeNull();
  });
});

describe("jobIdentity / dedupeJobs", () => {
  const mk = (title: string, url: string) => {
    const j = { title, company: "Acme", url, location: null, description: "", postedAt: null, targetId: "t1", host: "boards.example" };
    return { ...j, ...jobIdentity(j.host, j.targetId, j) };
  };

  it("mints stable playwright identities (host in external_id, source exact)", () => {
    const j = mk("React Dev", "https://boards.example/j/1?utm_campaign=x");
    expect(j.source).toBe("playwright");
    expect(j.externalId).toContain("boards.example/j/1");
    expect(j.externalId).not.toContain("utm_campaign");
    const again = mk("React Dev", "https://boards.example/j/1");
    expect(again.externalId).toBe(j.externalId); /* stable across runs */
  });

  it("dedupes by external_id and enforces per-target + total caps", () => {
    const a = mk("Job A", "https://x.example/1");
    const b = mk("Job B", "https://x.example/2");
    const a2 = mk("Job A", "https://x.example/1");
    const capped = dedupeJobs([a, a2, b], 1, 10);
    expect(capped.map((j: { title: string }) => j.title)).toEqual(["Job A"]);
    const many = Array.from({ length: 30 }, (_, i) => mk(`J${i}`, `https://x.example/${i}`));
    expect(dedupeJobs(many, 25, 80)).toHaveLength(25);
    expect(dedupeJobs(many, 25, 5)).toHaveLength(5);
  });
});

describe("SQL builders", () => {
  const base = {
    title: "Backend Eng", company: "O'Reilly & Co", location: "Pune", url: "https://j.example/1",
    description: "It's a job", postedAt: "2026-09-01T00:00:00.000Z", skills: ["node"],
    host: "j.example", extractedAt: "2026-09-22T00:00:00.000Z"
  };
  const job = { ...base, ...jobIdentity("j.example", "t1", base) };

  it("upsert is idempotent on (source, external_id) and escapes quotes", () => {
    const sql = buildJobsUpsertSql([job]);
    expect(sql).toContain("insert into public.jobs (source, external_id, title, company, location, remote, url, description, skills, posted_at, meta)");
    expect(sql).toContain("'playwright'");
    expect(sql).toContain("on conflict (source, external_id) do update");
    expect(sql).toContain("O''Reilly & Co"); /* sqlStr escaping */
    expect(sql).toContain("It''s a job");
    expect(sql).toContain("\"targetId\":\"t1\"");
  });

  it("returns empty sql for an empty batch", () => {
    expect(buildJobsUpsertSql([])).toBe("");
  });

  it("report row carries per-target detail and error strings only", () => {
    const r = buildReport([
      { targetId: "a", host: "a.x", found: 3, added: 3 },
      { targetId: "b", host: "b.x", found: 0, added: 0, error: "0 postings matched the selectors" }
    ], Date.parse("2026-09-22T00:00:00Z"));
    expect(r.added).toBe(3);
    expect(r.total).toBe(3);
    expect(r.errors).toEqual({ b: "0 postings matched the selectors" });
    const sql = buildReportSql(r, Date.parse("2026-09-22T00:00:00Z"));
    expect(sql).toContain("insert into public.jobs_fetch_reports");
    expect(sql).toContain("\"targetId\":\"a\"");
  });
});

describe("helpers", () => {
  it("normalizeUrl resolves relative hrefs and strips tracking params", () => {
    expect(normalizeUrl("/j/1?utm_source=n&keep=1#frag", "https://a.example/list"))
      .toBe("https://a.example/j/1?keep=1");
    expect(normalizeUrl("j/1", "https://a.example/list/")).toBe("https://a.example/list/j/1");
    expect(typeof normalizeUrl("not a url", "https://a.example")).toBe("string"); /* graceful */
  });

  it("parseRelativeDate handles board-style dates", () => {
    const now = Date.now();
    const out = parseRelativeDate("2d ago");
    expect(out).toBeTruthy();
    expect(Math.abs(Date.parse(out!) - (now - 2 * 86_400_000))).toBeLessThan(5000);
    expect(parseRelativeDate("3 hours ago")).toBeTruthy();
    expect(parseRelativeDate("2026-09-01")).toBe("2026-09-01T00:00:00.000Z");
    expect(parseRelativeDate("whenever")).toBeNull();
    expect(parseRelativeDate("")).toBeNull();
  });

  it("sqlStr escapes backslashes and quotes", () => {
    expect(sqlStr("it's \\ fine")).toBe("'it''s \\\\ fine'");
  });
});
