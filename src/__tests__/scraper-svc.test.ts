import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestClient } from "../services/cloud";
import {
  deleteScraperSource, getScraperSchedule, listScraperSources, runScraperNow,
  saveScraperSchedule, saveScraperSource, setScraperSourceEnabled
} from "../services/scraper";

type Row = Record<string, unknown>;

function makeClient() {
  const calls: string[] = [];
  const rows: Record<string, Row[]> = {
    scraper_sources: [
      { id: "backend-arialdo-questions", url: "https://example.com/backend.md", type: "markdown", field_id: "backend", level: "senior", max_items: 30, enabled: true, note: "note" }
    ],
    scraper_config: [{ key: "schedule", value: { days: [1, 3], hour: 5, minute: 30 } }]
  };
  const chain = (table: string) => {
    const c = {
      select: (cols: string) => { calls.push(`select:${cols}`); return c; },
      order: (col: string) => { calls.push(`order:${col}`); return c; },
      eq: (k: string, v: unknown) => { calls.push(`eq:${k}=${String(v)}`); return c; },
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
});
