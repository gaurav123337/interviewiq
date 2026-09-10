import { describe, expect, it, vi } from "vitest";

/* Item 20 (Phase 3) — load-bearing path: the content refiner's deterministic core.
   Every *exported* refiner fn was AI+Supabase bound, so its real logic
   (parseRefinedContent, calculateQualityFromRefined) had zero coverage. Per the
   owner-approved Option A we exported the two pure helpers and test them REAL
   (non-mocked) — parseRefinedContent runs through the real normalizeAiOutput.
   Note on scope: normalizeAiOutput's JSON strategies require ALL required keys
   present + non-empty (hasRequiredKeys), and its content-split last resort fills
   every key too — so parseRefinedContent's per-level fallback chains and its
   all-empty→null branch are defensive/unreachable via the real normalizer. We
   assert the REACHABLE behavior (the <50 guard, JSON/fenced parsing, array
   coercion, the estimatedReadMinutes formula) rather than contriving inputs that
   can't occur — testing dead branches would be theatre, not coverage.
   The single mocked path is refineContent's error mapping (a user-facing honesty
   surface), so ../ai is mocked; the pure helpers never touch it. */

vi.mock("../ai", () => ({ chat: vi.fn() }));

import { chat } from "../ai";
import {
  parseRefinedContent,
  calculateQualityFromRefined,
  refineContent,
} from "../services/contentRefiner";

const chatMock = vi.mocked(chat);

describe("parseRefinedContent — real parse through normalizeAiOutput", () => {
  it("short-circuits sub-50-char input to a null result with zero quality", () => {
    expect(parseRefinedContent("too short")).toEqual({ refined: null, qualityScore: 0 });
    expect(parseRefinedContent("")).toEqual({ refined: null, qualityScore: 0 });
  });

  it("parses a clean 3-level JSON object and coerces its arrays/glossary", () => {
    const raw = JSON.stringify({
      beginner: "Beginner level explanation of the topic in plain words.",
      intermediate: "Intermediate level with a code example and patterns.",
      advanced: "Advanced internals, performance notes and interview angles.",
      tableOfContents: ["Intro", "Deep dive"],
      keyTakeaways: ["One", "Two"],
      glossary: [{ term: "API", definition: "Application Programming Interface" }],
      estimatedReadMinutes: 7,
    });
    const { refined, qualityScore } = parseRefinedContent(raw);
    expect(refined).not.toBeNull();
    expect(refined!.beginner).toBe("Beginner level explanation of the topic in plain words.");
    expect(refined!.intermediate).toBe("Intermediate level with a code example and patterns.");
    expect(refined!.advanced).toBe("Advanced internals, performance notes and interview angles.");
    expect(refined!.tableOfContents).toEqual(["Intro", "Deep dive"]);
    expect(refined!.keyTakeaways).toEqual(["One", "Two"]);
    expect(refined!.glossary).toEqual([
      { term: "API", definition: "Application Programming Interface" },
    ]);
    expect(refined!.estimatedReadMinutes).toBe(7);
    expect(typeof qualityScore).toBe("number");
    expect(qualityScore).toBeGreaterThan(0);
  });

  it("extracts JSON from a ```json fenced block and derives read-time when absent", () => {
    // Pad the beginner level so the raw string lands solidly in the (4500, 6000]
    // char bucket → the derived read-time is a DISTINCT integer (4), not 1. This
    // is deliberate: a short raw makes ceil(len/1500) collapse to 1 for every
    // plausible divisor, so the assertion would pass even if the formula were
    // wrong. With ~5.8k chars, a broken divisor (/1000 → 6, /2000 → 3) or a
    // hardcoded return fails this — it pins the real ceil(len/1500) derivation.
    const inner = JSON.stringify({
      beginner: "Beginner level. " + "detail ".repeat(800),
      intermediate: "Intermediate level with a code example and patterns.",
      advanced: "Advanced internals, performance notes and interview angles.",
    });
    const raw = "```json\n" + inner + "\n```";
    expect(raw.length).toBeGreaterThan(4500);
    expect(raw.length).toBeLessThanOrEqual(6000);
    const { refined } = parseRefinedContent(raw);
    expect(refined).not.toBeNull();
    expect(refined!.beginner).toMatch(/^Beginner level/);
    // estimatedReadMinutes omitted → Number(undefined) is NaN (falsy) → ceil(len/1500).
    // len ∈ (4500, 6000] ⇒ ceil(len/1500) === 4 (a concrete, discriminating value).
    expect(refined!.estimatedReadMinutes).toBe(4);
    // Omitted arrays default to empty.
    expect(refined!.tableOfContents).toEqual([]);
    expect(refined!.keyTakeaways).toEqual([]);
    expect(refined!.glossary).toEqual([]);
  });

  it("coerces non-array fields to [] and numeric-strings via Number()", () => {
    const raw = JSON.stringify({
      beginner: "Beginner level explanation of the topic in plain words.",
      intermediate: "Intermediate level with a code example and patterns.",
      advanced: "Advanced internals, performance notes and interview angles.",
      tableOfContents: "not an array",
      keyTakeaways: "also not an array",
      glossary: "definitely not an array",
      estimatedReadMinutes: "5",
    });
    const { refined } = parseRefinedContent(raw);
    expect(refined).not.toBeNull();
    expect(refined!.tableOfContents).toEqual([]);
    expect(refined!.keyTakeaways).toEqual([]);
    expect(refined!.glossary).toEqual([]);
    expect(refined!.estimatedReadMinutes).toBe(5);
  });

  it("fills missing term/definition on glossary entries with empty strings", () => {
    const raw = JSON.stringify({
      beginner: "Beginner level explanation of the topic in plain words.",
      intermediate: "Intermediate level with a code example and patterns.",
      advanced: "Advanced internals, performance notes and interview angles.",
      glossary: [{ term: "X" }, { definition: "Y only" }, {}],
    });
    const { refined } = parseRefinedContent(raw);
    expect(refined!.glossary).toEqual([
      { term: "X", definition: "" },
      { term: "", definition: "Y only" },
      { term: "", definition: "" },
    ]);
  });
});

describe("calculateQualityFromRefined — pure 0–100 rubric", () => {
  const words = (n: number, lead: string) =>
    lead + " " + Array.from({ length: n - 1 }, (_, i) => `word${i}`).join(" ");

  it("awards a perfect 100 for three present, substantial, distinct levels", () => {
    const score = calculateQualityFromRefined({
      beginner: words(25, "Alpha"),
      intermediate: words(25, "Bravo"),
      advanced: words(25, "Charlie"),
    });
    // 20*3 presence + 10*3 word-count + 10 (all 3 slices distinct) = 100.
    expect(score).toBe(100);
  });

  it("gives +5 (not +10) differentiation when two levels are identical", () => {
    const shared = words(25, "Same");
    const score = calculateQualityFromRefined({
      beginner: shared,
      intermediate: shared,
      advanced: words(25, "Different"),
    });
    // 60 presence + 30 word-count + 5 (2 unique slices) = 95.
    expect(score).toBe(95);
  });

  it("gives +0 differentiation when all three levels are identical", () => {
    const shared = words(25, "Same");
    const score = calculateQualityFromRefined({
      beginner: shared,
      intermediate: shared,
      advanced: shared,
    });
    // 60 presence + 30 word-count + 0 (1 unique slice) = 90.
    expect(score).toBe(90);
  });

  it("withholds word-count points when a level is under 20 words", () => {
    const score = calculateQualityFromRefined({
      beginner: "short one",
      intermediate: "short two",
      advanced: "short three",
    });
    // 60 presence + 0 word-count + 10 (3 distinct slices) = 70.
    expect(score).toBe(70);
  });

  it("scores a single short level low, and an empty object zero", () => {
    // beginner present (20) + <20 words (0) + slices {b,'',''} → 2 unique (+5) = 25.
    expect(calculateQualityFromRefined({ beginner: "only a little text here" })).toBe(25);
    expect(calculateQualityFromRefined({})).toBe(0);
  });
});

describe("refineContent — user-facing error mapping (mocked chat)", () => {
  it("maps missing-key / sign-in errors to a friendly configuration hint", async () => {
    chatMock.mockRejectedValueOnce(new Error("No API key configured"));
    const res = await refineContent({ title: "T", content: "C", sourceName: "S" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/AI not configured/);
  });

  it("passes through an unrecognized error message verbatim", async () => {
    chatMock.mockRejectedValueOnce(new Error("upstream 503"));
    const res = await refineContent({ title: "T", content: "C", sourceName: "S" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("upstream 503");
  });
});
