/* P4 AI-draft pipeline — unit tests for the pure lib (scripts/ai-draft-lib.js).
   No network: the judge, the JSON contract and the emitter are all local. */

import { describe, expect, it } from "vitest";
import {
  PATTERNS, PATTERN_TOPIC as LIB_PATTERN_TOPIC, buildCandidates, canonicalPattern,
  emitProblemsFile, existingAiIds, gateProblem, matchesExpected, normalizeProblem,
  normalizeTitle, parseDraftJson, parseGeneratedProblems, patternFromTitle, runJudge,
  slugify, validateProblem
} from "../../scripts/ai-draft-lib.js";
import { PATTERN_LABELS, PATTERN_TOPIC } from "../data/patterns";

const CAND = { title: "Merge Intervals", slug: "merge-intervals", companies: new Set(["google", "amazon"]), difficulties: new Set([2]), urls: new Set(["https://example.com/merge-intervals"]) };

const GOOD_PARSED = {
  prompt: "Given a list of intervals, merge any that overlap and return the merged list.",
  io: "Line 1: n · next n lines: \"start end\" pairs. Output: merged \"start end\" pairs.",
  tests: [
    { stdin: "4\n1 3\n2 6\n8 10\n15 18\n", expect: "1 6\n8 10\n15 18" },
    { stdin: "2\n1 4\n4 5\n", expect: "1 5" }
  ],
  hidden: [
    { stdin: "1\n5 5\n", expect: "5 5" },
    { stdin: "3\n1 2\n3 4\n5 6\n", expect: "1 2\n3 4\n5 6" }
  ],
  reference: `function solve(lines) {
  const n = Number(lines[0] || 0);
  const iv = lines.slice(1, 1 + n).map(l => (l || "").split(" ").map(Number));
  const out = [];
  for (const [s, e] of iv) {
    if (out.length && s <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], e);
    else out.push([s, e]);
  }
  return out.map(p => p.join(" "));
}`,
  hint: "Sort by start, then extend the last interval while the next start overlaps it.",
  pattern: "interval",
  difficulty: 2
};

describe("title + id helpers", () => {
  it("slugifies titles deterministically", () => {
    expect(slugify("Two Sum")).toBe("two-sum");
    expect(slugify("LRU Cache")).toBe("lru-cache");
    expect(slugify("  N-Queens  ")).toBe("n-queens");
    expect(slugify("!!!")).toBe("problem");
  });

  it("normalizes markdown links and leading numbers", () => {
    expect(normalizeTitle("[1. Two Sum](https://x.com/p)")).toBe("Two Sum");
    expect(normalizeTitle("Two Sum")).toBe("Two Sum");
  });

  it("infers a pattern from a title", () => {
    expect(patternFromTitle("Merge Intervals")).toBe("interval");
    expect(patternFromTitle("Climbing Stairs")).toBe("dynamic-programming");
    expect(patternFromTitle("Something Totally Unique")).toBe("mixed");
  });

  it("canonicalizes model-written pattern labels", () => {
    expect(canonicalPattern("hash table")).toBe("hash-map");
    expect(canonicalPattern("Hash Table")).toBe("hash-map");
    expect(canonicalPattern("two pointers")).toBe("two-pointer");
    expect(canonicalPattern("dp")).toBe("dynamic-programming");
    expect(canonicalPattern("priority queue")).toBe("heap");
    expect(canonicalPattern("sliding-window")).toBe("sliding-window");
    expect(canonicalPattern("binary-search")).toBe("binary-search");
    expect(canonicalPattern("some nonsense label")).toBeNull();
    expect(canonicalPattern("")).toBeNull();
  });

  it("accepts a canonicalized pattern in a draft", () => {
    expect(validateProblem(CAND, { ...GOOD_PARSED, pattern: "Hash Table" }).ok).toBe(true);
    expect(normalizeProblem(CAND, { ...GOOD_PARSED, pattern: "two pointers" }).pattern).toBe("two-pointer");
  });
});

describe("candidate building", () => {
  it("dedupes titles across companies and maps names to ids", () => {
    const items = [
      { question: "Two Sum", meta: { group: "Google", difficulty: 1 } },
      { question: "Two Sum", meta: { group: "Facebook", difficulty: 1 } },
      { question: "LRU Cache", meta: { group: "Amazon", difficulty: 3 } },
      { question: "Mystery Co Thing", meta: { group: "SomeUnknownCo", difficulty: 2 } }
    ];
    const cands = buildCandidates(items);
    expect(cands).toHaveLength(2);
    const twoSum = cands.find(c => c.slug === "two-sum")!;
    expect([...twoSum.companies].sort()).toEqual(["google", "meta"]);
    expect(twoSum.difficulties.has(1)).toBe(true);
    /* unknown companies drop the candidate entirely */
    expect(cands.some(c => c.slug === "mystery-co-thing")).toBe(false);
    /* ranked by company count */
    expect(cands[0].companies.size).toBeGreaterThanOrEqual(cands[1].companies.size);
  });

  it("skips titles already in the bank (by slug)", () => {
    const items = [
      { question: "Two Sum", meta: { group: "Google" } },
      { question: "Number of Islands", meta: { group: "Amazon" } }
    ];
    const cands = buildCandidates(items, new Set(["two-sum"]));
    expect(cands.map(c => c.slug)).toEqual(["number-of-islands"]);
  });
});

describe("AI JSON contract", () => {
  it("extracts strict JSON from a fenced reply", () => {
    const parsed = parseDraftJson("```json\n" + JSON.stringify(GOOD_PARSED) + "\n```");
    expect(parsed?.pattern).toBe("interval");
  });

  it("rejects garbage", () => {
    expect(parseDraftJson("no json here")).toBeNull();
    expect(parseDraftJson("")).toBeNull();
  });

  it("validates a well-formed draft", () => {
    expect(validateProblem(CAND, GOOD_PARSED).ok).toBe(true);
  });

  it("rejects drafts with missing pieces", () => {
    expect(validateProblem(CAND, { ...GOOD_PARSED, reference: "const x = 1;" }).ok).toBe(false);
    expect(validateProblem(CAND, { ...GOOD_PARSED, tests: [{ stdin: "1" }] }).ok).toBe(false);
    expect(validateProblem(CAND, { ...GOOD_PARSED, hidden: [] }).ok).toBe(false);
    expect(validateProblem(CAND, { ...GOOD_PARSED, hidden: [{ ...GOOD_PARSED.hidden[0], stdin: GOOD_PARSED.tests[0].stdin }] }).ok).toBe(false);
    expect(validateProblem(CAND, { ...GOOD_PARSED, pattern: "not-a-pattern" }).ok).toBe(false);
    expect(validateProblem(CAND, { ...GOOD_PARSED, difficulty: 7 }).ok).toBe(false);
    expect(validateProblem(CAND, null).ok).toBe(false);
  });

  it("normalizes into a full problem with all 6 starters", () => {
    const p = normalizeProblem(CAND, GOOD_PARSED);
    expect(p.kind).toBe("cli");
    expect(p.id).toBe("merge-intervals");
    expect(Object.keys(p.starters).sort()).toEqual(["cpp", "go", "java", "javascript", "python", "typescript"]);
    expect(p.pattern).toBe("interval");
    expect(p.reference).toContain("function solve");
  });
});

describe("local judge (gate)", () => {
  it("runs a correct reference and matches the app output semantics", () => {
    const ref = `function solve(lines) {
  return [(lines[0] || "").split("").reverse().join("")];
}`;
    const r = runJudge(ref, "hello\n");
    expect(r.ok).toBe(true);
    expect(matchesExpected(r.stdout, "olleh")).toBe(true);
    expect(matchesExpected("  olleh  \n\n", "olleh")).toBe(true);
  });

  it("reports runtime errors instead of throwing", () => {
    const r = runJudge("function solve(lines) { throw new Error('boom'); }", "x\n");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("boom");
  });

  it("gates a problem: passes green, catches a wrong reference", () => {
    const good = normalizeProblem(CAND, GOOD_PARSED);
    expect(gateProblem(good).pass).toBe(true);

    const bad = normalizeProblem(CAND, { ...GOOD_PARSED, reference: `function solve(lines) { return ["0"]; }` });
    const gate = gateProblem(bad);
    expect(gate.pass).toBe(false);
    expect(gate.results.some(r => !r.pass)).toBe(true);
  });
});

describe("aiGenerated.ts emission + merge", () => {
  it("round-trips problems + side-tables and exposes their ids", () => {
    const p = normalizeProblem(CAND, GOOD_PARSED);
    const src = emitProblemsFile({
      problems: [p],
      companies: { "merge-intervals": ["google", "amazon"] },
      topics: { "merge-intervals": "Arrays & hashing" },
      generatedAt: "2026-01-01T00:00:00.000Z"
    });
    expect(src).toContain("AI_GENERATED_PROBLEMS");
    expect(src).toContain('"merge-intervals"');
    expect(src).toContain("AI_PROBLEM_COMPANIES");
    expect(src).toContain("AI_CLI_TOPICS");
    expect(src).toContain("do not edit by hand");
    expect(existingAiIds(src).has("merge-intervals")).toBe(true);
    /* the emitted file must be syntactically loadable: strip imports/exports and eval */
    const js = src
      .replace(/^import .*$/m, "")
      .replace(/^export const /gm, "const ")
      .replace(": CliProblem[]", "")
      .replace(": Record<string, string[]>", "")
      .replace(": Record<string, string>", "");
    // eslint-disable-next-line no-eval
    const mod = new Function(`${js}\nreturn { AI_GENERATED_PROBLEMS, AI_PROBLEM_COMPANIES, AI_CLI_TOPICS };`)();
    expect(mod.AI_GENERATED_PROBLEMS).toHaveLength(1);
    expect(mod.AI_GENERATED_PROBLEMS[0].id).toBe("merge-intervals");
    expect(mod.AI_PROBLEM_COMPANIES["merge-intervals"]).toEqual(["google", "amazon"]);
  });

  it("parses an emitted file back into problems + side-tables (accumulation)", () => {
    const p = normalizeProblem(CAND, GOOD_PARSED);
    const src = emitProblemsFile({
      problems: [p],
      companies: { "merge-intervals": ["google"] },
      topics: { "merge-intervals": "Arrays & hashing" },
      generatedAt: "2026-01-01T00:00:00.000Z"
    });
    const parsed = parseGeneratedProblems(src);
    expect(parsed.problems.map(x => x.id)).toEqual(["merge-intervals"]);
    expect(parsed.problems[0].prompt).toBe(p.prompt);
    expect(parsed.companies["merge-intervals"]).toEqual(["google"]);
    expect(parsed.topics["merge-intervals"]).toBe("Arrays & hashing");
    /* garbage input degrades to an empty bank, never a crash */
    expect(parseGeneratedProblems("not a ts file")).toEqual({ problems: [], companies: {}, topics: {} });
  });
});

describe("pattern catalog contract", () => {
  it("every lib pattern id exists in the app catalog with a label", () => {
    for (const p of PATTERNS) {
      expect(PATTERN_LABELS[p.id], `missing label for ${p.id}`).toBeDefined();
    }
  });

  it("the lib pattern→topic map matches the app's", () => {
    expect(LIB_PATTERN_TOPIC).toEqual(PATTERN_TOPIC);
  });
});
