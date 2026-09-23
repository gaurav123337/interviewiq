// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/* services reach for Supabase — stub the client module so tests stay offline;
   each test installs its own fake client via mockResolvedValue */
vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn()
}));

import { getSupabaseClient } from "../services/cloud";
import { publishedFor, setPublishedQuestions, type PublishedQuestion } from "../services/remoteConfig";
import { restoreQuestion, takeDownQuestion } from "../services/admin/questions";
import { buildSuppressionClause, buildUpsertSql, MAX_QUESTION_CHARS } from "../../scripts/scrape-lib.js";
import { excludeProblems, problemEntry, questionHash, takedownNote } from "../../scripts/takedown-lib.js";

const baseQ = (over: Partial<PublishedQuestion>): PublishedQuestion => ({
  id: 1, fieldId: "backend", level: "senior", question: "Q", answer: "A",
  keyPoints: [], published: true, updatedAt: null, ...over
});

interface Recorded { table: string; method: string; args: unknown[] }

/** Universal thenable fake: every method records (table, method, args) and any
    awaited chain resolves { data, error }. `failUpdateOn` makes update-queries
    against those tables resolve an error (pre-migration degradation path). */
function makeFake(opts: { failUpdateOn?: string[] } = {}) {
  const calls: Recorded[] = [];
  const failUpdateOn = new Set(opts.failUpdateOn ?? []);
  const updateCount = new Map<string, number>();
  const client = (table: string) => {
    const h: any = {};
    const record = (method: string) => (...args: unknown[]) => {
      calls.push({ table, method, args });
      if (method === "update") updateCount.set(table, (updateCount.get(table) ?? 0) + 1);
      return h;
    };
    const resolve = () => {
      /* fail only the FIRST update on a listed table — models "status column
         missing" (one failing attempt), not a permanently dead table */
      const isFirstUpdate = (updateCount.get(table) ?? 0) === 1;
      return isFirstUpdate && failUpdateOn.has(table)
        ? { data: null, error: { message: "column status does not exist" } }
        : { data: [], error: null };
    };
    for (const m of ["insert", "select", "update", "eq", "is", "in", "order", "limit", "delete"]) {
      h[m] = record(m);
    }
    h.then = (onF: any, onR: any) => Promise.resolve(resolve()).then(onF, onR);
    return h;
  };
  const fake = {
    from: vi.fn((t: string) => client(t)),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    rpc: vi.fn().mockResolvedValue({ data: null })
  };
  return { fake: fake as unknown as NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>, calls };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(getSupabaseClient).mockResolvedValue(null);
});

describe("takedown — public read exclusion (Item D3)", () => {
  it("publishedFor never surfaces taken_down questions, even when published=true", () => {
    setPublishedQuestions([
      baseQ({ id: 1, question: "Live question", status: "active" }),
      baseQ({ id: 2, question: "Taken-down question", status: "taken_down", published: true }),
      /* pre-migration cache rows carry no status at all — treated as active */
      baseQ({ id: 3, question: "Legacy row without status" })
    ]);
    const out = publishedFor("backend", "senior");
    expect(out.map(q => q.q).sort()).toEqual(["Legacy row without status", "Live question"]);
    expect(out.some(q => q.q === "Taken-down question")).toBe(false);
    /* plain-QA assignability survives (coach/compose pools keep compiling) */
    expect(out.every(q => "kp" in q && "addedAt" in q)).toBe(true);
  });
});

describe("takedown — admin flow through the fake client", () => {
  it("takeDownQuestion inserts the audit row and flips status (post-migration path)", async () => {
    const { fake, calls } = makeFake();
    vi.mocked(getSupabaseClient).mockResolvedValue(fake);

    await takeDownQuestion(42, "What is hoisting?", "dmca", "notice #1");

    expect(calls).toContainEqual({
      table: "takedowns", method: "insert",
      args: [{ target_kind: "question", target_id: "42", question_text: "What is hoisting?", reason: "dmca", note: "notice #1", action: "soft" }]
    });
    const updates = calls.filter(c => c.table === "published_questions" && c.method === "update");
    expect(updates).toHaveLength(1); /* no fallback retry on a healthy DB */
    expect(updates[0].args[0]).toEqual({ status: "taken_down", published: false });
    expect(calls.some(c => c.table === "published_questions" && c.method === "eq" && c.args[0] === "id" && c.args[1] === 42)).toBe(true);
  });

  it("degrades gracefully pre-migration: status update fails → unpublish fallback", async () => {
    const { fake, calls } = makeFake({ failUpdateOn: ["published_questions"] });
    vi.mocked(getSupabaseClient).mockResolvedValue(fake);

    await takeDownQuestion(42, "What is hoisting?", "dmca");

    const updates = calls.filter(c => c.table === "published_questions" && c.method === "update");
    expect(updates).toHaveLength(2);
    expect(updates[0].args[0]).toEqual({ status: "taken_down", published: false });
    expect(updates[1].args[0]).toEqual({ published: false }); /* fallback */
  });

  it("restoreQuestion clears status and marks the takedown restored", async () => {
    const { fake, calls } = makeFake();
    vi.mocked(getSupabaseClient).mockResolvedValue(fake);

    await restoreQuestion(42, "What is hoisting?");

    expect(calls).toContainEqual({ table: "published_questions", method: "update", args: [{ status: "active", taken_down_at: null }] });
    expect(calls).toContainEqual({ table: "takedowns", method: "update", args: [{ restored_at: expect.any(String) }] });
    expect(calls.some(c => c.table === "takedowns" && c.method === "eq" && c.args[0] === "target_kind")).toBe(true);
    expect(calls.some(c => c.table === "takedowns" && c.method === "is" && c.args[0] === "restored_at")).toBe(true);
  });
});

describe("takedown — scraper suppression clause (pure)", () => {
  it("buildSuppressionClause is backward-compatible: empty → no clause", () => {
    expect(buildSuppressionClause(undefined)).toBe("");
    expect(buildSuppressionClause([])).toBe("");
    expect(buildSuppressionClause([{ question_text: null }])).toBe("");
  });

  it("builds a lower(trim(question)) NOT IN clause over stored texts", () => {
    const sql = buildUpsertSql(
      [{ fieldId: "f", level: "senior", question: "Fresh question", answer: "A", keyPoints: [] }],
      [{ question_text: "What is hoisting?" }, { question_text: "  TAKEN DOWN ROW  " }]
    );
    expect(sql).toContain("on conflict (question) and lower(trim(question)) not in");
    expect(sql).toContain("'what is hoisting?'");
    expect(sql).toContain("'taken down row'"); /* lower-trim'd, matching the DB hash side */
    expect(sql).toContain("'Fresh question'"); /* row text inserted as-is */
  });

  it("no suppressions → byte-identical upsert to pre-D3", () => {
    const rows = [{ fieldId: "f", level: "senior", question: "Q?", answer: "", keyPoints: [] }];
    expect(buildUpsertSql(rows)).toBe(buildUpsertSql(rows, undefined));
    expect(buildUpsertSql(rows, [])).toBe(buildUpsertSql(rows));
  });

  it("suppression hashes match the DB-side md5(lower(trim(text)))", () => {
    /* discovery.sql stores md5(lower(trim(question_text))) — the JS side must
       agree so tests + future DB checks can compare hashes directly */
    expect(questionHash("  What is Hoisting?  ")).toHaveLength(32);
    expect(questionHash("abc")).toBe("900150983cd24fb0d6963f7d28e17f72"); /* RFC 1321 vector */
  });

  it("oversize questions still can't poison a batch (regression guard intact)", () => {
    const huge = { fieldId: "f", level: "senior", question: "x".repeat(MAX_QUESTION_CHARS + 1), answer: "", keyPoints: [] };
    expect(buildUpsertSql([huge], [{ question_text: "y" }])).toBe("");
  });
});

describe("takedown — coding-problem regeneration helpers (pure)", () => {
  const problems = [
    { id: "two-sum", title: "Two Sum", source: "mirror:leetcode" },
    { id: "own-idea", title: "Own Idea", source: null },
    { id: "meta-sourced", title: "Meta Sourced", meta: { source: "mirror:other" } }
  ];

  it("excludeProblems drops exactly the taken-down ids", () => {
    expect(excludeProblems(problems, ["two-sum"]).map(p => p.id)).toEqual(["own-idea", "meta-sourced"]);
    expect(excludeProblems(problems, [])).toHaveLength(3);
    expect(excludeProblems(undefined, ["x"])).toEqual([]);
  });

  it("problemEntry normalizes attributed vs unattributed", () => {
    expect(problemEntry(problems[0])).toEqual({ id: "two-sum", title: "Two Sum", source: "mirror:leetcode", attributed: true });
    expect(problemEntry(problems[1]).attributed).toBe(false);
    expect(problemEntry(problems[2]).attributed).toBe(true); /* meta.source path */
  });

  it("takedownNote only appears when something was removed", () => {
    expect(takedownNote([])).toBe("");
    expect(takedownNote(["two-sum"])).toContain("1 attributed problem(s) removed");
  });
});
