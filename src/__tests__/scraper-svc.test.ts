import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestClient } from "../services/cloud";
import {
  deleteScraperSource, getScraperSchedule, listScraperRuns, listScraperSources,
  recordScraperRun, runFilterClauses, runScraperNow,
  saveScraperSchedule, saveScraperSource, setScraperSourceEnabled
} from "../services/scraper";

type Row = Record<string, unknown>;

function makeClient() {
  const calls: string[] = [];
  const rows: Record<string, Row[]> = {
    scraper_sources: [
      { id: "backend-arialdo-questions", url: "https://example.com/backend.md", type: "markdown", field_id: "backend", level: "senior", max_items: 30, enabled: true, note: "note" }
    ],
    scraper_config: [{ key: "schedule", value: { days: [1, 3], hour: 5, minute: 30 } }],
    scraper_runs: []
  };
  const chain = (table: string) => {
    const c = {
      select: (cols: string) => { calls.push(`select:${cols}`); return c; },
      order: (col: string) => { calls.push(`order:${col}`); return c; },
      limit: (n: number) => { calls.push(`limit:${n}`); return c; },
      eq: (k: string, v: unknown) => { calls.push(`eq:${k}=${String(v)}`); return c; },
      gte: (k: string, v: unknown) => { calls.push(`gte:${k}=${String(v)}`); return c; },
      lte: (k: string, v: unknown) => { calls.push(`lte:${k}=${String(v)}`); return c; },
      ilike: (k: string, v: unknown) => { calls.push(`ilike:${k}=${String(v)}`); return c; },
      insert: (r: unknown) => { calls.push(`insert:${JSON.stringify(r).slice(0, 500)}`); return c; },
      maybeSingle: async () => ({ data: rows.scraper_config[0] ?? null, error: null }),
      upsert: (r: unknown, opts?: unknown) => { calls.push(`upsert:${JSON.stringify(opts)}:${JSON.stringify(r).slice(0, 400)}`); return Promise.resolve({ error: null }); },
      update: (r: unknown) => { calls.push(`update:${JSON.stringify(r)}`); return c; },
      delete: () => { calls.push("delete"); return c; },
      then: (resolve: (v: unknown) => void) => { resolve({ data: rows[table] ?? [], error: null }); },
      catch: () => c
    };
    return c;
  };
  const client = {
    from: (t: string) => { calls.push(`from:${t}`); return chain(t); },
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) }
  };
  return { client, calls, rows };
}

let fake: ReturnType<typeof makeClient> | null = null;

beforeEach(() => {
  fake = makeClient();
  setTestClient(fake.client as never);
});

afterEach(() => {
  setTestClient(null);
  vi.unstubAllGlobals();
});

describe("scraper sources", () => {
  it("maps snake_case rows to the client shape", async () => {
    const sources = await listScraperSources();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ id: "backend-arialdo-questions", fieldId: "backend", level: "senior", maxItems: 30, enabled: true });
  });

  it("saves a source, slugging the id from field+level when none is given", async () => {
    await saveScraperSource({ url: "https://x.dev/q.md", type: "markdown", fieldId: "frontend", level: "mid", maxItems: 15 });
    const u = fake!.calls.find(c => c.startsWith("upsert:"));
    expect(u).toContain('"onConflict":"id"');
    expect(u).toContain('"id":"frontend-mid"');
    expect(u).toContain('"max_items":15');
  });

  it("toggles and deletes by id", async () => {
    await setScraperSourceEnabled("backend-arialdo-questions", false);
    expect(fake!.calls.some(c => c.startsWith("eq:id=backend-arialdo-questions"))).toBe(true);

    fake = makeClient();
    setTestClient(fake.client as never);
    await deleteScraperSource("backend-arialdo-questions");
    expect(fake!.calls.some(c => c === "delete")).toBe(true);
  });
});

describe("scraper schedule", () => {
  it("reads the configured days", async () => {
    expect(await getScraperSchedule()).toEqual({ days: [1, 3], hour: 5, minute: 30 });
  });

  it("defaults to Monday when unset", async () => {
    fake!.rows.scraper_config = [];
    expect(await getScraperSchedule()).toEqual({ days: [1], hour: 3, minute: 0 });
  });

  it("persists a schedule", async () => {
    await saveScraperSchedule({ days: [2, 5], hour: 3, minute: 0 });
    const u = fake!.calls.find(c => c.startsWith("upsert:"));
    expect(u).toContain('"days":[2,5]');
    expect(u).toContain('"onConflict":"key"');
  });
});

describe("runScraperNow", () => {
  it("fetches enabled sources, extracts and upserts drafts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# JS\n\n1. ### What is hoisting?\n\nVariables are moved to the top.\n\n2. ### What is JSON?\n\nA data format.\n"
    }));
    const report = await runScraperNow([{
      id: "js", url: "https://example.com/js.md", type: "markdown",
      fieldId: "frontend", level: "mid", maxItems: 5, enabled: true, note: ""
    }]);
    expect(report[0]).toMatchObject({ sourceId: "js", extracted: 2, inserted: 2 });
    const u = fake!.calls.find(c => c.startsWith("upsert:"));
    expect(u).toContain('"onConflict":"question"');
    expect(u).toContain('"field_id":"frontend"');
    expect(u).toContain('"published":false');
  });

  it("skips disabled sources and reports failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("CORS blocked")));
    const report = await runScraperNow([
      { id: "off", url: "https://example.com/a.md", type: "markdown", fieldId: "frontend", level: "mid", maxItems: 5, enabled: false, note: "" },
      { id: "bad", url: "https://example.com/b.md", type: "markdown", fieldId: "frontend", level: "mid", maxItems: 5, enabled: true, note: "" }
    ]);
    expect(report).toHaveLength(1); /* disabled source excluded */
    expect(report[0]).toMatchObject({ sourceId: "bad", extracted: 0, inserted: 0 });
    expect(report[0].error).toContain("CORS blocked");
  });

  it("records a manual scraper_runs report after a run", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# JS\n\n1. ### What is hoisting?\n\nVariables are moved to the top.\n"
    }));
    await runScraperNow([{
      id: "js", url: "https://example.com/js.md", type: "markdown",
      fieldId: "frontend", level: "mid", maxItems: 5, enabled: true, note: ""
    }]);
    const ins = fake!.calls.find(c => c.startsWith("insert:") && c.includes("scraper_runs") === false && c.includes('"trigger":"manual"'));
    expect(ins).toBeTruthy();
    expect(ins).toContain('"status":"ok"');
    expect(ins).toContain('"inserted":1');
  });
});

/* ------------------------------------------------------------------ */
/* Phase 4 Item B — run reports                                        */
/* ------------------------------------------------------------------ */

describe("runFilterClauses (pure)", () => {
  it("maps filter fields onto supabase clauses", () => {
    expect(runFilterClauses({})).toEqual([]);
    expect(runFilterClauses({ status: "partial", trigger: "cron" })).toEqual([
      { key: "eq", args: ["status", "partial"] },
      { key: "eq", args: ["trigger", "cron"] }
    ]);
    expect(runFilterClauses({ from: "2026-09-01T00:00:00Z", to: "2026-09-30T00:00:00Z" })).toEqual([
      { key: "gte", args: ["ran_at", "2026-09-01T00:00:00Z"] },
      { key: "lte", args: ["ran_at", "2026-09-30T00:00:00Z"] }
    ]);
    expect(runFilterClauses({ q: "example.com" })).toEqual([
      { key: "ilike", args: ["per_source::text", "%example.com%"] }
    ]);
  });
});

describe("recordScraperRun / listScraperRuns", () => {
  it("writes one row with derived status, per-source detail and totals", async () => {
    await recordScraperRun(fake!.client as never, [
      { sourceId: "a", url: "https://a.example.com", extracted: 3, inserted: 2 },
      { sourceId: "b", url: "https://b.example.com", extracted: 0, inserted: 0, error: "HTTP 500" }
    ], "cron");
    const ins = fake!.calls.find(c => c.startsWith("insert:"));
    expect(ins).toContain('"trigger":"cron"');
    expect(ins).toContain('"status":"partial"');
    expect(ins).toContain('"inserted":2');
    expect(ins).toContain('"errors":1');
    expect(ins).toContain("per_source");
    expect(ins).toContain('"error":"HTTP 500"');
    expect(ins).toContain('"extracted":3');
  });

  it("maps snake_case rows and tolerates a missing table (→ [])", async () => {
    fake!.rows.scraper_runs = [
      { id: 7, ran_at: "2026-09-22T03:00:00Z", trigger: "cron", status: "ok", per_source: { js: { url: "https://x", extracted: 4, inserted: 4 } }, inserted: 4, errors: 0 }
    ];
    const runs = await listScraperRuns({ trigger: "cron" }, 10, fake!.client as never);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ id: 7, trigger: "cron", status: "ok", inserted: 4, errors: 0 });
    expect(runs[0].perSource.js).toEqual({ url: "https://x", extracted: 4, inserted: 4 });

    /* missing table → select resolves with an error → [] (app must not crash) */
    const broken = makeClient();
    broken.client.from = (t: string) => {
      const base = broken.client.from(t);
      return t === "scraper_runs"
        ? { ...base, then: (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: "relation does not exist" } }) }
        : base;
    };
    const none = await listScraperRuns({}, 10, broken.client as never);
    expect(none).toEqual([]);
  });

  it("listScraperRuns applies filter clauses against the client chain", async () => {
    await listScraperRuns({ status: "failed", trigger: "manual", q: "github" }, 20, fake!.client as never);
    expect(fake!.calls).toContain("eq:status=failed");
    expect(fake!.calls).toContain("eq:trigger=manual");
    expect(fake!.calls).toContain("ilike:per_source::text=%github%");
    expect(fake!.calls).toContain("limit:20");
  });
});
