/* Content guard for item 8 parts 3-4 (interview-targeting).

   Locks the cost/quality invariants that "complete phase 1 without a leak" hinges on:
   1. Interview questions are FOLDED into the single existing normalize round-trip —
      `chat` is called exactly ONCE (never a second extraction call).
   2. That call is cost-attributed to `module: "articleNormalize"`.
   3. The normalize prompt actually asks the model for interview questions
      (guards the prompt edit from silent regression — content-quality gate).
   4. `mustKnowConcepts` is derived from question keyPoints, never requested from AI.
   5. `deriveMustKnowConcepts` de-dupes case-insensitively (first-seen), skips blanks, caps at 8. */

import { describe, expect, it, beforeEach, vi } from "vitest";

// articleNormalizer imports only `chat` (value) from ../ai; the factory replaces the module.
vi.mock("../ai", () => ({
  chat: vi.fn(),
  aiAvailable: vi.fn().mockReturnValue(false),
}));

// Not exercised by these tests (normalizeArticle never touches the DB), but its module-level
// import must resolve to something inert so the unit stays isolated from Supabase/config.
vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn().mockResolvedValue(null),
}));

// The cheap backfill extractor. Must NOT be called on the fold path — mocked so we can assert that.
vi.mock("../services/cleaner", () => ({
  cleanTextToQuestions: vi.fn().mockResolvedValue([]),
}));

import { chat } from "../ai";
import { getSupabaseClient } from "../services/cloud";
import { cleanTextToQuestions } from "../services/cleaner";
import {
  deriveMustKnowConcepts,
  normalizeArticle,
  normalizeAndUpdateContent,
  type InterviewQuestion,
} from "../services/articleNormalizer";

const chatMock = vi.mocked(chat);
const cleanMock = vi.mocked(cleanTextToQuestions);
const getClientMock = vi.mocked(getSupabaseClient);

/** Minimal fake Supabase client for `normalizeAndUpdateContent`:
    the fetch chain ends in `.single()`, the write chain ends in `.eq()` (awaited).
    Captures the update payload so tests can assert what was persisted. */
function fakeClient(item: Record<string, unknown>, onUpdate: (payload: Record<string, unknown>) => void) {
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    update: (payload: Record<string, unknown>) => { onUpdate(payload); return builder; },
    eq: () => builder,
    single: () => Promise.resolve({ data: item, error: null }),
    // Thenable so `await client.from(..).update(..).eq(..)` resolves to a no-error result.
    then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
  });
  return { from: () => builder } as unknown as NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>;
}

/** A complete, well-formed normalize payload the AI is pretended to return. */
function fullPayload(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    summary: "A short summary of the CAP theorem for distributed systems.",
    keywords: ["cap", "consistency", "availability"],
    codeSections: [],
    beginner: "## What is it\n\nCAP is a trade-off between three guarantees in distributed systems.",
    intermediate: "## How it works\n\nUnder a partition you must choose consistency or availability.",
    advanced: "## Deep dive\n\nPACELC extends CAP to cover latency in the no-partition case.",
    glossary: [{ term: "Partition", definition: "A network split between nodes." }],
    keyTakeaways: ["CAP is a trade-off", "You cannot have all three under a partition"],
    interviewQuestions: [
      {
        question: "  Explain the CAP theorem.  ",
        answer: "  It says a distributed store can guarantee at most two of consistency, availability, and partition tolerance.  ",
        keyPoints: ["consistency", "availability", "  partition tolerance  "],
      },
      {
        question: "When would you choose AP over CP?",
        answer: "When the system must stay writable during a network partition and can tolerate stale reads.",
        keyPoints: ["availability", "eventual consistency"],
      },
    ],
    estimatedReadMinutes: 5,
    readTimeBeginner: 2,
    readTimeIntermediate: 4,
    readTimeAdvanced: 6,
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanMock.mockResolvedValue([]);
});

describe("deriveMustKnowConcepts", () => {
  const q = (keyPoints: string[]): InterviewQuestion => ({ question: "q", answer: "a", keyPoints });

  it("unions keyPoints, de-dupes case-insensitively, preserves first-seen order", () => {
    const out = deriveMustKnowConcepts([
      q(["Consistency", "Availability"]),
      q(["consistency", "Partition Tolerance", "AVAILABILITY"]),
    ]);
    expect(out).toEqual(["Consistency", "Availability", "Partition Tolerance"]);
  });

  it("skips blank / whitespace-only key points", () => {
    expect(deriveMustKnowConcepts([q(["", "  ", "Sharding"])])).toEqual(["Sharding"]);
  });

  it("caps at 8 concepts", () => {
    const many = Array.from({ length: 20 }, (_, i) => `concept-${i}`);
    expect(deriveMustKnowConcepts([q(many)])).toHaveLength(8);
  });

  it("returns [] for no questions", () => {
    expect(deriveMustKnowConcepts([])).toEqual([]);
  });
});

describe("normalizeArticle — interview fields folded into the single call", () => {
  it("makes exactly ONE chat call (no second extraction call) and no cleaner call", async () => {
    chatMock.mockResolvedValue(fullPayload());

    const res = await normalizeArticle({
      title: "CAP theorem",
      content: "Long article body about distributed systems...",
      sourceName: "blog",
    });

    expect(res.success).toBe(true);
    expect(chatMock).toHaveBeenCalledTimes(1);
    // Interview extraction is folded in — the standalone extractor is NOT invoked here.
    expect(cleanMock).not.toHaveBeenCalled();
  });

  it("attributes the call to module 'articleNormalize' and asks the model for interview questions", async () => {
    chatMock.mockResolvedValue(fullPayload());

    await normalizeArticle({ title: "T", content: "body", sourceName: "s" });

    const [messages, opts] = chatMock.mock.calls[0];
    expect(opts).toMatchObject({ module: "articleNormalize" });
    // Content-quality guard: the folded prompt must still instruct the model to write questions.
    const systemPrompt = (messages as { role: string; content: string }[])[0].content.toLowerCase();
    expect(systemPrompt).toContain("interview question");
  });

  it("parses interviewQuestions (trimmed) and derives mustKnowConcepts from their keyPoints", async () => {
    chatMock.mockResolvedValue(fullPayload());

    const res = await normalizeArticle({ title: "T", content: "body", sourceName: "s" });
    const n = res.normalized!;

    expect(n.interviewQuestions).toEqual([
      {
        question: "Explain the CAP theorem.",
        answer:
          "It says a distributed store can guarantee at most two of consistency, availability, and partition tolerance.",
        keyPoints: ["consistency", "availability", "partition tolerance"],
      },
      {
        question: "When would you choose AP over CP?",
        answer: "When the system must stay writable during a network partition and can tolerate stale reads.",
        keyPoints: ["availability", "eventual consistency"],
      },
    ]);
    // Derived, deduped (availability appears twice), first-seen order, not requested from AI.
    expect(n.mustKnowConcepts).toEqual([
      "consistency",
      "availability",
      "partition tolerance",
      "eventual consistency",
    ]);
  });

  it("degrades safely to empty arrays when the model omits interviewQuestions", async () => {
    // Force absence of the key (fullPayload always includes it, so build a bare-but-valid payload).
    chatMock.mockResolvedValue(
      JSON.stringify({
        beginner: "## Intro\n\nSomething long enough to be a valid beginner section.",
        intermediate: "## More\n\nIntermediate content.",
        advanced: "## Deep\n\nAdvanced content.",
        keyTakeaways: ["a"],
        keywords: ["x"],
        glossary: [],
        codeSections: [],
      }),
    );

    const res = await normalizeArticle({ title: "T", content: "body", sourceName: "s" });
    expect(res.success).toBe(true);
    expect(res.normalized!.interviewQuestions).toEqual([]);
    expect(res.normalized!.mustKnowConcepts).toEqual([]);
  });

  it("drops malformed question entries and tolerates a non-array keyPoints", async () => {
    chatMock.mockResolvedValue(
      fullPayload({
        interviewQuestions: [
          { answer: "no question field", keyPoints: ["x"] }, // dropped: missing question
          { question: "   ", answer: "blank question", keyPoints: ["y"] }, // dropped: blank question
          { question: "Valid one", answer: "ok", keyPoints: "not-an-array" }, // kept, keyPoints → []
        ],
      }),
    );

    const res = await normalizeArticle({ title: "T", content: "body", sourceName: "s" });
    const qs = res.normalized!.interviewQuestions!;
    expect(qs).toHaveLength(1);
    expect(qs[0]).toEqual({ question: "Valid one", answer: "ok", keyPoints: [] });
    expect(res.normalized!.mustKnowConcepts).toEqual([]);
  });
});

describe("normalizeAndUpdateContent — cheap, non-recharging backfill for stale rows", () => {
  it("backfills a SHORT-beginner stale row via the cheap extractor — never the full normalize", async () => {
    // Regression: the old `length > 50` guard let short-beginner rows fall through to the
    // ~8k-token full re-normalize. The guard is now `beginner != null` (mirrors the SQL predicate),
    // so even a 1-char beginner takes the cheap path.
    let updatePayload: Record<string, unknown> | undefined;
    const item = {
      id: "c1",
      title: "T",
      content: "RAW BODY — must NOT be fed to the extractor",
      source_name: "s",
      content_refined: {
        beginner: "x", // deliberately short — the exact case the old guard mis-routed
        intermediate: "Intermediate distilled text.",
        advanced: "Advanced distilled text with interview angles.",
        keyTakeaways: ["t"],
      },
    };
    getClientMock.mockResolvedValueOnce(fakeClient(item, p => { updatePayload = p; }));
    cleanMock.mockResolvedValueOnce([
      { fieldId: "swe", level: "mid", question: "Q1?", answer: "A1", keyPoints: ["Alpha", "Beta"] },
    ]);

    const res = await normalizeAndUpdateContent("c1");

    expect(res.success).toBe(true);
    // The whole point: NO full normalize round-trip.
    expect(chatMock).not.toHaveBeenCalled();
    expect(cleanMock).toHaveBeenCalledTimes(1);
    // Extractor is fed the COMPACT normalized levels (advanced+intermediate+beginner), NOT raw content.
    const source = cleanMock.mock.calls[0][0];
    expect(source).toContain("Advanced distilled text");
    expect(source).toContain("Intermediate distilled text");
    expect(source).not.toContain("RAW BODY");
    // No maxTokens/module override → resolveMaxTokens is driven by the small input, not a 6000 floor.
    expect(cleanMock.mock.calls[0][1]).toBeUndefined();
    // Persisted payload preserves prior fields and adds the interview-targeting fields.
    const refined = updatePayload!.content_refined as Record<string, unknown>;
    expect(refined.beginner).toBe("x");
    expect(refined.keyTakeaways).toEqual(["t"]);
    expect(refined.interviewQuestions).toEqual([
      { question: "Q1?", answer: "A1", keyPoints: ["Alpha", "Beta"] },
    ]);
    expect(refined.mustKnowConcepts).toEqual(["Alpha", "Beta"]);
  });

  it("is a no-op when interviewQuestions already present (even empty) — no AI, no write", async () => {
    let wrote = false;
    const item = {
      id: "c2",
      title: "T",
      content: "body",
      source_name: "s",
      content_refined: { beginner: "b", interviewQuestions: [] }, // [] = attempted, yielded none
    };
    getClientMock.mockResolvedValueOnce(fakeClient(item, () => { wrote = true; }));

    const res = await normalizeAndUpdateContent("c2");

    expect(res.success).toBe(true);
    expect(chatMock).not.toHaveBeenCalled();
    expect(cleanMock).not.toHaveBeenCalled();
    expect(wrote).toBe(false);
  });

  it("stamps [] and still succeeds when the extractor throws — no re-charge loop", async () => {
    // If backfill left interviewQuestions unset on failure, the stale query would re-select this
    // row forever and re-charge every batch. It must stamp [] so the row is permanently satisfied.
    let updatePayload: Record<string, unknown> | undefined;
    const item = {
      id: "c3",
      title: "T",
      content: "body",
      source_name: "s",
      content_refined: { beginner: "b", intermediate: "i", advanced: "a" },
    };
    getClientMock.mockResolvedValueOnce(fakeClient(item, p => { updatePayload = p; }));
    cleanMock.mockRejectedValueOnce(new Error("provider out of credits"));

    const res = await normalizeAndUpdateContent("c3");

    expect(res.success).toBe(true); // success ⇒ batch won't retry-loop this row
    const refined = updatePayload!.content_refined as Record<string, unknown>;
    expect(refined.interviewQuestions).toEqual([]);
    expect(refined.mustKnowConcepts).toEqual([]);
  });

  it("runs the FULL normalize for a truly-fresh row (no beginner) and persists interview fields", async () => {
    let updatePayload: Record<string, unknown> | undefined;
    const item = {
      id: "c4",
      title: "CAP",
      content: "Long article body...",
      source_name: "blog",
      content_refined: null, // never normalized
    };
    getClientMock.mockResolvedValueOnce(fakeClient(item, p => { updatePayload = p; }));
    chatMock.mockResolvedValueOnce(fullPayload());

    const res = await normalizeAndUpdateContent("c4");

    expect(res.success).toBe(true);
    expect(chatMock).toHaveBeenCalledTimes(1); // full normalize, folded questions
    expect(cleanMock).not.toHaveBeenCalled();  // no separate extraction
    const refined = updatePayload!.content_refined as Record<string, unknown>;
    expect((refined.interviewQuestions as unknown[]).length).toBe(2);
    expect(refined.mustKnowConcepts).toEqual([
      "consistency", "availability", "partition tolerance", "eventual consistency",
    ]);
  });
});
