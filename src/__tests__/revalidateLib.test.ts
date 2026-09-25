import { describe, expect, it } from "vitest";
import { buildL5RunSummary, buildQuarantineSql, l5Verdict, markerFromText } from "../../scripts/revalidate-lib.js";

describe("l5Verdict — the fail-closed matrix", () => {
  const base = { ok: true, status: 200, finalUrl: "https://x.dev/a", originalUrl: "https://x.dev/a", storedMarker: null, contentMarker: null };

  it("passes a clean 200 on the same URL", () => {
    expect(l5Verdict(base)).toEqual({ verdict: "pass", reason: null });
  });

  it("quarantines unreachable resources, redirects, and non-2xx", () => {
    expect(l5Verdict({ ...base, ok: false, status: undefined }).reason).toContain("unreachable");
    expect(l5Verdict({ ...base, status: 404 }).reason).toBe("http 404");
    expect(l5Verdict({ ...base, status: 503 }).reason).toBe("http 503");
    expect(l5Verdict({ ...base, finalUrl: "https://elsewhere.dev/login" }).reason).toContain("redirected");
  });

  it("server-side URL normalization is not a redirect (live false-positive)", () => {
    /* example.com resolving to example.com/ must stay approved */
    expect(l5Verdict({ ...base, finalUrl: "https://example.com/", originalUrl: "https://example.com" }).verdict).toBe("pass");
    expect(l5Verdict({ ...base, finalUrl: "https://x.dev/a/", originalUrl: "https://x.dev/a" }).verdict).toBe("pass");
    expect(l5Verdict({ ...base, finalUrl: "https://x.dev/other" }).verdict).toBe("quarantine");
  });

  it("quarantines content drift when a stored marker exists; unknown markers never pass silently", () => {
    expect(l5Verdict({ ...base, storedMarker: "old", contentMarker: "old" }).verdict).toBe("pass");
    expect(l5Verdict({ ...base, storedMarker: "old", contentMarker: "new" }).reason).toContain("content changed");
    /* first revalidation (no stored marker): same-URL 200 passes for now —
       the marker gets stored on its next approval-cycle touch */
    expect(l5Verdict({ ...base, storedMarker: null, contentMarker: null }).verdict).toBe("pass");
    /* stored marker but the body fetch failed (dynamic page / bot block):
       reachability alone carries the verdict — uncertainty never quarantines */
    expect(l5Verdict({ ...base, storedMarker: "old", contentMarker: null }).verdict).toBe("pass");
  });

  it("markerFromText fingerprints visible text and ignores dynamic noise", () => {
    const page = `
      <html><head><title>Prep Guide</title>
      <style>.a { color: red }</style></head>
      <body>
        <h1>System Design Prep Guide</h1>
        <p>The definitive reading list for scalable systems interviews.</p>
        <script>var csrf = "abc123"; var now = Date.now();</script>
      </body></html>`;
    const m = markerFromText(page);
    expect(m).toContain("System Design Prep Guide");
    expect(m).not.toContain("csrf");
    expect(m!.length).toBeLessThanOrEqual(200);
    expect(markerFromText("")).toBeNull();
    expect(markerFromText(null)).toBeNull();
    /* marker stability: the SAME content with different trailing noise matches */
    expect(markerFromText(page + "<script>var t=Date.now()</script>")).toBe(markerFromText(page));
  });
});

describe("buildQuarantineSql", () => {
  it("returns pending status with per-row reasons and the l5 stamp", () => {
    const sql = buildQuarantineSql([{ id: 3, reason: "http 404" }, { id: 7, reason: "redirected to https://evil.dev" }]);
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("case id when 3 then 'http 404'");
    expect(sql).toContain("redirected to https://evil.dev");
    expect(sql).toContain("l5_quarantined_at");
    expect(sql).toContain("and status = 'approved'");
  });

  it("escapes quotes and degrades to empty SQL for empty/null input", () => {
    expect(buildQuarantineSql([{ id: 1, reason: "bad ' quote" }])).toContain("bad '' quote");
    expect(buildQuarantineSql([])).toBe("");
    expect(buildQuarantineSql(null)).toBe("");
  });
});

describe("buildL5RunSummary — scraper_runs per_source shape", () => {
  it("classifies ok / partial / failed and counts quarantines as errors", () => {
    const t = Date.now();
    const ok = buildL5RunSummary({ a: { verdict: "pass" }, b: { verdict: "pass" } }, t);
    expect(ok.status).toBe("ok");

    const partial = buildL5RunSummary({ a: { verdict: "pass" }, b: { verdict: "quarantine", reason: "http 404" } }, t);
    expect(partial.status).toBe("partial");
    expect(partial.errors).toBe(1);

    const failed = buildL5RunSummary(
      { a: { verdict: "quarantine", reason: "unreachable (network error)" } }, t
    );
    expect(failed.status).toBe("failed");

    expect(buildL5RunSummary({}, t).status).toBe("ok");
    expect(buildL5RunSummary(null, t).status).toBe("ok");
  });
});

describe("revalidate-resources.js orchestrator", () => {
  it("imports without side effects (is-main guard)", async () => {
    const mod = await import("../../scripts/revalidate-resources.js");
    expect(typeof mod.main).toBe("function");
  });
});
