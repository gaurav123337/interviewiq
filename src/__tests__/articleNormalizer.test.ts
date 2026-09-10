import { beforeEach, describe, expect, it, vi } from "vitest";

/* Item 20 (Phase 3) — load-bearing path: the article normalizer's parse +
   sanitize core, and its untested DB-gate functions.

   article-normalizer-interview.test.ts (item 8) already locks the interview-fold
   invariants (one chat call, module attribution, deriveMustKnowConcepts, the
   normalizeAndUpdateContent backfill paths). This suite deliberately covers the
   COMPLEMENT: parseNormalized's parse strategies + the raw-prose fallback (driven
   through the real normalizeArticle, chat mocked at the boundary), every field
   sanitizer/cap, the user-vs-admin content truncation, the pure estimateTokenCost,
   and the four DB helpers' client/auth guards + payload shaping.

   Scope honesty (avoiding the Item-19 tautology trap): normalizeArticle PRE-CLEANS
   the raw string (strips a leading ```json fence and any preamble before the first
   `{` when it's within 200 chars) BEFORE parseNormalized runs. So parseNormalized's
   own Strategy 1 (fenced) and Strategy 4 (backward-walk from "beginner") are largely
   shadowed by that pre-clean and by Strategy 2 succeeding first — we do NOT contrive
   inputs to force those defensive branches. We assert the REACHABLE behavior: the
   string-aware object parse (Strategy 2, incl. braces-inside-code), the single-quote
   + trailing-comma repair (Strategy 3), the >20-word prose fallback, the two null
   paths, and every post-parse sanitizer. */

vi.mock("../ai", () => ({ chat: vi.fn(), aiAvailable: vi.fn(() => false) }));
vi.mock("../services/cloud", () => ({ getSupabaseClient: vi.fn(async () => null) }));
vi.mock("../services/cleaner", () => ({ cleanTextToQuestions: vi.fn(async () => []) }));

import { chat } from "../ai";
import { getSupabaseClient } from "../services/cloud";
import {
  normalizeArticle,
  normalizeUserArticle,
  listUserArticles,
  deleteUserArticle,
  batchNormalizeContent,
  estimateTokenCost,
} from "../services/articleNormalizer";

const chatMock = vi.mocked(chat);
const getClientMock = vi.mocked(getSupabaseClient);

/** Build a valid normalize payload (three substantial levels so parseNormalized
    never nulls out) with arbitrary field overrides layered on top. */
function payload(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    summary: "A concise summary.",
    keywords: ["k1", "k2"],
    codeSections: [],
    beginner: "## What is it\n\nA beginner-level explanation that is clearly long enough.",
    intermediate: "## How it works\n\nAn intermediate-level explanation with detail.",
    advanced: "## Deep dive\n\nAn advanced-level explanation with interview angles.",
    glossary: [],
    keyTakeaways: ["takeaway one"],
    interviewQuestions: [],
    estimatedReadMinutes: 5,
    readTimeBeginner: 2,
    readTimeIntermediate: 4,
    readTimeAdvanced: 6,
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getClientMock.mockResolvedValue(null);
});

describe("parseNormalized — parse strategies (through real normalizeArticle)", () => {
  it("parses a clean JSON object and keeps braces that live inside a code string", async () => {
    // The string-aware brace matcher must not be fooled by { } inside a quoted code value.
    chatMock.mockResolvedValueOnce(
      payload({
        codeSections: [
          { language: "js", code: "function f(){ return {a:1}; }", description: "returns an object" },
        ],
      })
    );
    const res = await normalizeArticle({ title: "T", content: "body", sourceName: "s" });
    expect(res.success).toBe(true);
    expect(res.normalized!.codeSections).toEqual([
      { language: "js", code: "function f(){ return {a:1}; }", description: "returns an object" },
    ]);
  });

  it("repairs single-quoted JSON with trailing commas (Strategy 3)", async () => {
    // Not valid JSON as-is (single quotes + trailing commas); the repair pass rescues it.
    const raw =
      "{'beginner':'A beginner explanation long enough to be kept as content.'," +
      "'intermediate':'Intermediate explanation content.'," +
      "'advanced':'Advanced explanation content.'," +
      "'keyTakeaways':['only one',],}";
    chatMock.mockResolvedValueOnce(raw);
    const res = await normalizeArticle({ title: "T", content: "body", sourceName: "s" });
    expect(res.success).toBe(true);
    expect(res.normalized!.beginner).toBe(
      "A beginner explanation long enough to be kept as content."
    );
    expect(res.normalized!.keyTakeaways).toEqual(["only one"]);
  });

  it("falls back to a thirds-split when the response is prose with no JSON (>20 words)", async () => {
    const words = Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ");
    chatMock.mockResolvedValueOnce(words);
    const res = await normalizeArticle({ title: "T", content: "body", sourceName: "s" });
    expect(res.success).toBe(true);
    // third = ceil(30/3) = 10 → beginner is the first 10 tokens.
    expect(res.normalized!.beginner.startsWith("w0 w1")).toBe(true);
    expect(res.normalized!.advanced.endsWith("w29")).toBe(true);
    expect(res.normalized!.keyTakeaways).toEqual(["Read the original article for full details"]);
  });

  it("fails cleanly on sub-50-char input", async () => {
    chatMock.mockResolvedValueOnce("too short");
    const res = await normalizeArticle({ title: "T", content: "body", sourceName: "s" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Failed to parse/);
  });

  it("fails cleanly on >=50 chars but <=20 words of un-parseable prose", async () => {
    // Long enough to pass the 50-char guard, but the prose fallback needs >20 words.
    chatMock.mockResolvedValueOnce(
      "alpha bravo charlie delta echo foxtrot golfclub hotelroom indiapost juliet"
    );
    const res = await normalizeArticle({ title: "T", content: "body", sourceName: "s" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Failed to parse/);
  });
});

describe("parseNormalized — field sanitizers & caps", () => {
  it("slices the summary to 500 chars", async () => {
    chatMock.mockResolvedValueOnce(payload({ summary: "S".repeat(600) }));
    const res = await normalizeArticle({ title: "T", content: "b", sourceName: "s" });
    expect(res.normalized!.summary).toHaveLength(500);
  });

  it("caps keywords at 20, keyTakeaways at 10", async () => {
    chatMock.mockResolvedValueOnce(
      payload({
        keywords: Array.from({ length: 25 }, (_, i) => `kw${i}`),
        keyTakeaways: Array.from({ length: 15 }, (_, i) => `t${i}`),
      })
    );
    const res = await normalizeArticle({ title: "T", content: "b", sourceName: "s" });
    expect(res.normalized!.keywords).toHaveLength(20);
    expect(res.normalized!.keyTakeaways).toHaveLength(10);
  });

  it("drops code-less codeSections and defaults language/description", async () => {
    chatMock.mockResolvedValueOnce(
      payload({
        codeSections: [
          { code: "let x = 1;" }, // no language/description → defaults
          { language: "py", description: "no code here" }, // dropped (no code)
          { code: "   ", language: "js" }, // dropped (whitespace-only code)
        ],
      })
    );
    const res = await normalizeArticle({ title: "T", content: "b", sourceName: "s" });
    expect(res.normalized!.codeSections).toEqual([
      { language: "text", code: "let x = 1;", description: "" },
    ]);
  });

  it("drops term-less glossary entries and defaults the definition", async () => {
    chatMock.mockResolvedValueOnce(
      payload({
        glossary: [
          { term: "Kept" }, // definition defaults to ""
          { definition: "no term" }, // dropped
          { term: "   ", definition: "blank term" }, // dropped
        ],
      })
    );
    const res = await normalizeArticle({ title: "T", content: "b", sourceName: "s" });
    expect(res.normalized!.glossary).toEqual([{ term: "Kept", definition: "" }]);
  });

  it("caps interviewQuestions at 8 and each question's keyPoints at 6", async () => {
    chatMock.mockResolvedValueOnce(
      payload({
        interviewQuestions: Array.from({ length: 10 }, (_, i) => ({
          question: `Q${i}`,
          answer: `A${i}`,
          keyPoints: i === 0 ? Array.from({ length: 8 }, (_, j) => `kp${j}`) : ["one"],
        })),
      })
    );
    const res = await normalizeArticle({ title: "T", content: "b", sourceName: "s" });
    expect(res.normalized!.interviewQuestions).toHaveLength(8);
    expect(res.normalized!.interviewQuestions![0].keyPoints).toHaveLength(6);
  });

  it("clamps a negative read-time to 0", async () => {
    chatMock.mockResolvedValueOnce(payload({ estimatedReadMinutes: -5 }));
    const res = await normalizeArticle({ title: "T", content: "b", sourceName: "s" });
    expect(res.normalized!.estimatedReadMinutes).toBe(0);
  });
});

describe("buildNormalizationMessages — content truncation (via the chat payload)", () => {
  // A 12k-char body with a unique marker at index 7000: kept under the 10000 user
  // cap, dropped under the 6000 admin cap.
  const body = "x".repeat(7000) + "ZZMARKERZZ" + "y".repeat(5000);

  it("truncates admin articles to 6000 chars (marker at 7000 dropped)", async () => {
    chatMock.mockResolvedValueOnce(payload());
    await normalizeArticle({ title: "T", content: body, sourceName: "s" });
    const userMsg = (chatMock.mock.calls[0][0] as { role: string; content: string }[])[1].content;
    expect(userMsg).not.toContain("ZZMARKERZZ");
  });

  it("truncates user articles to 10000 chars (marker at 7000 kept)", async () => {
    chatMock.mockResolvedValueOnce(payload());
    await normalizeArticle({ title: "T", content: body, sourceName: "s", isUserArticle: true });
    const userMsg = (chatMock.mock.calls[0][0] as { role: string; content: string }[])[1].content;
    expect(userMsg).toContain("ZZMARKERZZ");
  });
});

describe("normalizeArticle — error mapping", () => {
  it("maps a missing-key / sign-in error to a friendly configuration hint", async () => {
    chatMock.mockRejectedValueOnce(new Error("No API key configured"));
    const res = await normalizeArticle({ title: "T", content: "b", sourceName: "s" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/AI not configured/);
  });

  it("passes an unrecognized error message through verbatim", async () => {
    chatMock.mockRejectedValueOnce(new Error("upstream 503"));
    const res = await normalizeArticle({ title: "T", content: "b", sourceName: "s" });
    expect(res.error).toBe("upstream 503");
  });
});

describe("estimateTokenCost — pure", () => {
  it("computes input tokens as ceil(len/4)+500 with a fixed 2000-token output", () => {
    const est = estimateTokenCost(4000);
    expect(est.inputTokens).toBe(1500);
    expect(est.outputTokens).toBe(2000);
    // 1500*0.000002 + 2000/1000*0.006 = 0.003 + 0.012 = 0.015. (Output cost alone
    // exceeds $0.01, so the "< $0.01" branch is unreachable — we assert the real one.)
    expect(est.estimatedCost).toBe("~$0.015");
  });

  it("floors input tokens at the 500-token prompt overhead for empty content", () => {
    expect(estimateTokenCost(0).inputTokens).toBe(500);
  });
});

/* ── DB-gate helpers: offline (null client) and auth guards ─────────────── */

describe("normalizeUserArticle — client & auth guards, payload shaping", () => {
  it("returns a not-configured error with no client", async () => {
    const res = await normalizeUserArticle({ text: "some article text", title: "T" });
    expect(res).toEqual({ success: false, error: "Cloud not configured" });
  });

  it("requires a signed-in user", async () => {
    getClientMock.mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as unknown as NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>);
    const res = await normalizeUserArticle({ text: "some article text", title: "T" });
    expect(res).toEqual({ success: false, error: "Sign in to use this feature" });
  });

  it("stores original_text sliced to 5000 chars and returns the new note id", async () => {
    let inserted: Record<string, unknown> | undefined;
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      insert: (p: Record<string, unknown>) => { inserted = p; return builder; },
      select: () => builder,
      single: async () => ({ data: { id: "note1" }, error: null }),
    });
    getClientMock.mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: () => builder,
    } as unknown as NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>);
    chatMock.mockResolvedValueOnce(payload());

    const longText = "a".repeat(6000);
    const res = await normalizeUserArticle({ text: longText, title: "My Article" });

    expect(res.success).toBe(true);
    expect(res.noteId).toBe("note1");
    expect(inserted!.user_id).toBe("u1");
    expect((inserted!.original_text as string)).toHaveLength(5000);
  });
});

describe("listUserArticles / deleteUserArticle — guards & mapping", () => {
  it("returns [] with no client", async () => {
    expect(await listUserArticles()).toEqual([]);
  });

  it("returns [] when not signed in", async () => {
    getClientMock.mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as unknown as NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>);
    expect(await listUserArticles()).toEqual([]);
  });

  it("maps stored rows to the public article shape", async () => {
    const rows = [
      {
        id: 42,
        title: "Stored Title",
        original_url: "https://example.com/post",
        normalized: { beginner: "b", intermediate: "i", advanced: "a" },
        created_at: "2026-01-02T00:00:00Z",
      },
    ];
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
    });
    getClientMock.mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: () => builder,
    } as unknown as NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>);

    const out = await listUserArticles();
    expect(out).toEqual([
      {
        id: "42",
        title: "Stored Title",
        url: "https://example.com/post",
        normalized: { beginner: "b", intermediate: "i", advanced: "a" },
        createdAt: "2026-01-02T00:00:00Z",
      },
    ]);
  });

  it("deleteUserArticle is a no-op with no client (no throw)", async () => {
    await expect(deleteUserArticle("note1")).resolves.toBeUndefined();
  });

  it("deleteUserArticle issues a scoped delete when a client exists", async () => {
    let deletedId: unknown;
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      delete: () => builder,
      eq: (_col: string, val: unknown) => { deletedId = val; return builder; },
      then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
    });
    getClientMock.mockResolvedValueOnce({
      from: () => builder,
    } as unknown as NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>);

    await deleteUserArticle("note-xyz");
    expect(deletedId).toBe("note-xyz");
  });
});

describe("batchNormalizeContent — client guard, de-dupe & cap", () => {
  it("throws when the cloud is not configured", async () => {
    await expect(batchNormalizeContent()).rejects.toThrow("Cloud not configured");
  });

  it("de-dupes the fresh+stale id sets and caps the batch at 20", async () => {
    vi.useFakeTimers();
    // fresh c0..c14, stale c8..c22 → union c0..c22 = 23 unique → sliced to 20.
    const fresh = Array.from({ length: 15 }, (_, i) => ({ id: `c${i}` }));
    const stale = Array.from({ length: 15 }, (_, i) => ({ id: `c${i + 8}` }));
    const queryQueue = [
      { data: fresh, error: null },
      { data: stale, error: null },
    ];
    // Every per-id fetch resolves the SAME already-complete row (beginner +
    // interviewQuestions:[] present) → normalizeAndUpdateContent takes the no-op
    // path: no chat, no write.
    const noopItem = {
      id: "x",
      title: "T",
      content: "b",
      source_name: "s",
      content_refined: { beginner: "b", interviewQuestions: [] },
    };
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      not: () => builder,
      limit: () => builder,
      single: async () => ({ data: noopItem, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve(queryQueue.shift()),
    });
    getClientMock.mockResolvedValue({
      from: () => builder,
    } as unknown as NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>);

    const promise = batchNormalizeContent();
    await vi.runAllTimersAsync();
    const res = await promise;
    vi.useRealTimers();

    expect(res.total).toBe(20);
    expect(res.normalized).toBe(20);
    expect(res.errors).toBe(0);
    expect(chatMock).not.toHaveBeenCalled();
  });
});
