// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/* services reach for Supabase — stub the client module so tests stay offline */
vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn().mockResolvedValue(null)
}));

import { getSupabaseClient } from "../services/cloud";
import { publishedFor, setPublishedQuestions, type PublishedQuestion } from "../services/remoteConfig";
import { restoreQuestion, takeDownQuestion } from "../services/admin/questions";
import { setRemoteConfig } from "../services/remoteConfig";
import { buildSuppressionClause, buildUpsertSql, MAX_QUESTION_CHARS } from "../../scripts/scrape-lib.js";
import { excludeProblems, problemEntry, questionHash, takedownNote } from "../../scripts/takedown-lib.js";

const mockedClient = vi.mocked(await getSupabaseClient());

const baseQ = (over: Partial<PublishedQuestion>): PublishedQuestion => ({
  id: 1, fieldId: "backend", level: "senior", question: "Q", answer: "A",
  keyPoints: [], published: true, updatedAt: null, ...over
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("takedown — public read exclusion (Item D3)", () => {
  it("publishedFor never surfaces taken_down questions, even when published=true", () => {
    setPublishedQuestions([
      baseQ({ id: 1, question: "Live question", status: "active" }),
      baseQ({ id: 2, question: "Taken-down question", status: "taken_down", published: true }),
      /* pre-migration cache rows carry no status at all — treated as active */
      baseQ({ id: 3, question: "Legacy row without status" })
    ]);
    setRemoteConfig({ features: {}, ai: {}, limits: {} });
    const out = publishedFor("backend", "senior");
    expect(out.map(q => q.q).sort()).toEqual(["Live question", "Legacy row without status"]);
    expect(out.some(q => q.q === "Taken-down question")).toBe(false);
  });
});

describe("takedown — admin flow through the fake client", () => {
  it("takeDownQuestion inserts the audit row, flips status, and degrades gracefully pre-migration", async () => {
    const chain = () => {
      const c: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        then: undefined
      };
      /* insert(...).select(...) resolves ok; update(...).eq(...) resolves an error to hit the fallback */
      c.insert.mockResolvedValue([{ id: 1 }]);
      c.eq.mockResolvedValue({ error: { message: "column status does not exist" } });
      return c;
    };
    const takedowns = chain();
    const pq = chain();
    (mockedClient as any).from = vi.fn((t: string) => (t === "takedowns" ? takedowns : pq));

    await takeDownQuestion(42, "What is hoisting?", "dmca", "notice #1");

    expect(takedowns.insert).toHaveBeenCalledWith({
      target_kind: "question", target_id: "42", question_text: "What is hoisting?",
      reason: "dmca", note: "notice #1", action: "soft"
    });
    /* first update attempt includes status (post-migration); the fallback retries with published only */
    expect(pq.update).toHaveBeenCalledWith({ status: "taken_down", published: false });
    expect(pq.update).toHaveBeenLastCalledWith({ published: false });
  });

  it("restoreQuestion clears status and marks the takedown restored", async () => {
    const chain = () => {
      const c: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis()
      };
      c.is.mockResolvedValue({ error: null });
      c.eq.mockResolvedValueOnce({ error: null }).mockResolvedValue({ error: null });
      return c;
    };
    const takedowns = chain();
    const pq = chain();
    (mockedClient as any).from = vi.fn((t: string) => (t === "takedowns" ? takedowns : pq));

    await restoreQuestion(42, "What is hoisting?");

    expect(pq.update).toHaveBeenCalledWith({ status: "active", taken_down_at: null });
    expect(takedowns.update).toHaveBeenCalledWith({ restored_at: expect.any(String) });
    expect(takedowns.eq).toHaveBeenCalledWith("target_kind", "question");
    expect(takedowns.is).toHaveBeenCalledWith("restored_at", null);
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
    expect(sql).toContain("'taken down row'");
    expect(sql).toContain("'fresh question'");
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
