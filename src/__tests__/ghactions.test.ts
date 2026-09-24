import { describe, expect, it, vi, afterEach } from "vitest";
import {
  ghFilterQuery, ghRangeToCreated, ghRunToRow, listWorkflowRuns, pairRunToScraperRow, WORKFLOWS
} from "../services/ghActions";

describe("WORKFLOWS", () => {
  it("covers the pipelines that report into the cron log", () => {
    const ids = WORKFLOWS.map(w => w.id);
    expect(ids).toContain("scrape-weekly.yml");
    expect(ids).toContain("jobs-playwright.yml"); /* Phase 4 Item C */
    expect(ids).toContain("discover-weekly.yml"); /* Phase 4 Item D2 */
    expect(ids).toContain("crawl-weekly.yml"); /* Phase 4 discovery execution lever */
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("ghFilterQuery (pure)", () => {
  it("builds GitHub-native params, omitting empty ones", () => {
    expect(ghFilterQuery()).toBe("per_page=10");
    expect(ghFilterQuery({ status: "completed" }, 5)).toBe("status=completed&per_page=5");
    expect(ghFilterQuery({ conclusion: "failure" })).toBe("conclusion=failure&per_page=10");
    expect(ghFilterQuery({ status: "completed", conclusion: "success" })).toBe("status=completed&conclusion=success&per_page=10");
  });
});

describe("ghRangeToCreated (pure)", () => {
  it("maps range chips to GitHub created ISO ranges", () => {
    const now = Date.parse("2026-09-22T12:00:00Z");
    expect(ghRangeToCreated("24h", "", "", now)).toBe(`>=${new Date(now - 24 * 3600_000).toISOString()}`);
    expect(ghRangeToCreated("7d", "", "", now)).toContain("2026-09-15");
    expect(ghRangeToCreated("30d", "", "", now)).toContain("2026-08-23");
    expect(ghRangeToCreated("custom", "2026-09-01", "2026-09-10", now))
      .toBe(">=2026-09-01T00:00:00.000Z <=2026-09-10T00:00:00.000Z");
    expect(ghRangeToCreated("custom", "", "", now)).toBeUndefined();
  });
});

describe("ghRunToRow (pure)", () => {
  it("maps a raw REST run to the client shape with derived duration", () => {
    const row = ghRunToRow({
      id: 42, name: "Scrape weekly", event: "schedule", status: "completed", conclusion: "success",
      head_branch: "main", html_url: "https://github.com/x/y/actions/runs/42",
      created_at: "2026-09-22T03:00:00Z", updated_at: "2026-09-22T03:04:30Z", run_started_at: "2026-09-22T03:00:10Z",
      actor: { login: "gaurav123337" }
    });
    expect(row).toMatchObject({
      id: 42, event: "schedule", status: "completed", conclusion: "success",
      headBranch: "main", actor: "gaurav123337", durationSec: 260
    });
  });

  it("tolerates missing/odd fields", () => {
    const row = ghRunToRow({ id: "9", status: "queued", conclusion: null });
    expect(row.id).toBe(9);
    expect(row.conclusion).toBeNull();
    expect(row.durationSec).toBeNull();
    expect(row.actor).toBeNull();
  });
});

describe("pairRunToScraperRow (pure)", () => {
  const cron = (ranAt: string) => ({ ranAt, trigger: "cron" as const });
  const manual = { ranAt: "2026-09-22T03:00:00Z", trigger: "manual" as const };

  it("pairs the nearest cron run within ±30 min", () => {
    const run = { createdAt: "2026-09-22T03:05:00Z" };
    expect(pairRunToScraperRow(run, [cron("2026-09-22T03:20:00Z"), cron("2026-09-22T03:04:00Z"), manual]))
      .toEqual(cron("2026-09-22T03:04:00Z"));
  });

  it("ignores manual rows and runs outside the window", () => {
    const run = { createdAt: "2026-09-22T03:05:00Z" };
    expect(pairRunToScraperRow(run, [manual])).toBeNull();
    expect(pairRunToScraperRow(run, [cron("2026-09-22T04:00:00Z")])).toBeNull();
    expect(pairRunToScraperRow(run, [])).toBeNull();
  });
});

describe("listWorkflowRuns (fetch)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps runs and returns ok on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ workflow_runs: [{ id: 1, event: "schedule", status: "completed", conclusion: "success", created_at: "2026-09-22T03:00:00Z" }] })
    }));
    const out = await listWorkflowRuns("scrape-weekly.yml");
    expect(out.ok).toBe(true);
    expect(out.runs).toHaveLength(1);
    expect(out.runs[0].conclusion).toBe("success");
  });

  it("degrades gracefully on 403 rate-limit / 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
    let out = await listWorkflowRuns("scrape-weekly.yml");
    expect(out.ok).toBe(false);
    expect(out.error).toContain("rate limit");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    out = await listWorkflowRuns("nope.yml");
    expect(out.ok).toBe(false);
    expect(out.error).toContain("not found");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    out = await listWorkflowRuns("scrape-weekly.yml");
    expect(out.ok).toBe(false);
    expect(out.error).toContain("offline");
  });
});
