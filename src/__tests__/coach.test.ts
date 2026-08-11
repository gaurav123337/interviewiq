// @vitest-environment jsdom
/* Robust offline coach — concept matching, coverage, intents, misconceptions,
   dialogue memory, and grading aligned with the session engine. */

import { describe, expect, it } from "vitest";
import { scoreAnswer } from "../engine";
import {
  analyzeCoverage, classifyIntent, conceptOverlap, conceptSet,
  detectMisconception, structuralSignals, textMatches
} from "../coach/concepts";
import { coachReply, localCoachReply } from "../coach/reply";

const CTX = {
  prompt: "Explain how closures work in JavaScript.",
  answer: "A closure is a function that remembers its lexical scope even when executed outside it.",
  kp: ["lexical scope", "state preservation", "memory implications"],
  fieldId: "frontend",
  levelId: "mid" as const
};

const msg = (role: "user" | "assistant", text: string) => ({ role, text });

/* ------------------------------------------------------------------ */
/* Concept-aware matching                                              */
/* ------------------------------------------------------------------ */

describe("concept-aware matching", () => {
  it("matches synonyms across families: memoize ≈ caching", () => {
    expect(textMatches("memoization keeps it fast", "caching strategy")).toBe(true);
    expect(textMatches("I'd cache the result", "memoize the expensive call")).toBe(true);
  });

  it("matches phrases: big O ≈ complexity, router ≈ navigation", () => {
    expect(textMatches("big O analysis", "complexity is O(n)")).toBe(true);
    expect(textMatches("I'll use a router library", "routing and deep linking")).toBe(true);
    expect(textMatches("navigation should reflect the URL", "routing")).toBe(true);
  });

  it("matches related-but-different words: state ≈ store", () => {
    expect(textMatches("keep it in the store", "global state management")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(textMatches("I like pizza on weekends", "database indexing")).toBe(false);
    expect(textMatches("closures", "caching")).toBe(false);
  });

  it("conceptSet collapses vocabulary onto families", () => {
    expect(conceptSet("router navigation deep-link url").has("routing")).toBe(true);
    expect(conceptSet("memoize cache ttl").has("caching")).toBe(true);
    expect(conceptSet("pizza weekend").size).toBe(0);
  });

  it("conceptOverlap counts shared families", () => {
    expect(conceptOverlap("use a hash map", "hash tables and arrays")).toBeGreaterThan(0);
    expect(conceptOverlap("pizza", "databases")).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Coverage states                                                     */
/* ------------------------------------------------------------------ */

describe("analyzeCoverage", () => {
  it("marks covered / partial / missing per key point", () => {
    const cov = analyzeCoverage(
      "the closure keeps the outer scope alive so state is preserved",
      CTX.kp,
      CTX.prompt
    );
    /* lexical scope via "scope", state preservation via "state"; memory is
       discussed in the question's domain → partial */
    expect(cov.covered).toContain("lexical scope");
    expect(cov.covered).toContain("state preservation");
    expect(cov.partial).toContain("memory implications");
    expect(cov.missing).toEqual([]);
    expect(cov.pct).toBeCloseTo((2 + 0.5) / 3, 5);
  });

  it("an answer in the question's domain is partial, not missing", () => {
    const cov = analyzeCoverage("I'd use closures", CTX.kp, CTX.prompt);
    /* naming the concept directly covers the single-concept key point */
    expect(cov.covered).toEqual(["lexical scope"]);
    expect(cov.partial).toEqual(["state preservation", "memory implications"]);
    expect(cov.missing).toEqual([]);
  });

  it("precision guard: an incidental family word does not over-cover a key point", () => {
    const kp = ["URL as source of truth", "route-based code splitting", "lazy loading screens", "route guards for auth", "deep link to route mapping"];
    const cov = analyzeCoverage("I'll use router library to handle it. Or I can use framework like nextjs for this.", kp, "How do you handle state and navigation in an app with dozens of routes and deep linking?");
    /* router genuinely addresses URL-as-truth and deep-link mapping… */
    expect(cov.covered).toEqual(["URL as source of truth", "deep link to route mapping"]);
    /* …but not the code-splitting / guard / lazy-loading substance → touched only */
    expect(cov.partial).toEqual(["route-based code splitting", "lazy loading screens", "route guards for auth"]);
    expect(cov.missing).toEqual([]);
  });

  it("unrelated text is missing everywhere", () => {
    const cov = analyzeCoverage("pizza is delicious", CTX.kp, CTX.prompt);
    expect(cov.covered).toEqual([]);
    expect(cov.partial).toEqual([]);
    expect(cov.missing.length).toBe(3);
    expect(cov.pct).toBe(0);
  });

  it("empty key points never divide by zero", () => {
    const cov = analyzeCoverage("anything", [], "");
    expect(cov.pct).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Intent classifier                                                   */
/* ------------------------------------------------------------------ */

describe("classifyIntent", () => {
  it("detects grading requests", () => {
    expect(classifyIntent("Grade my answer")).toBe("grade");
    expect(classifyIntent("How did I do on this?")).toBe("grade");
    expect(classifyIntent("what score would this get")).toBe("grade");
  });

  it("detects hints, explanations and comparisons", () => {
    expect(classifyIntent("Give me a hint")).toBe("hint");
    expect(classifyIntent("I'm stuck, help me start")).toBe("hint");
    expect(classifyIntent("Explain how the event loop works")).toBe("explain");
    expect(classifyIntent("How does memoization work?")).toBe("explain");
    expect(classifyIntent("Compare this with caching")).toBe("compare");
  });

  it("detects debate, approach and next-step requests", () => {
    expect(classifyIntent("I disagree, that's wrong")).toBe("debate");
    expect(classifyIntent("I would use a hash map first")).toBe("approach");
    expect(classifyIntent("I'll use a router library")).toBe("approach");
    expect(classifyIntent("What should I study next?")).toBe("next");
  });

  it("detects greetings and thanks", () => {
    expect(classifyIntent("hi")).toBe("greeting");
    expect(classifyIntent("hello!")).toBe("greeting");
    expect(classifyIntent("thanks!")).toBe("thanks");
  });

  it("substantive text without intent keywords is 'other'", () => {
    expect(classifyIntent("caching responses would speed up the whole system")).toBe("other");
  });
});

/* ------------------------------------------------------------------ */
/* Misconception guard                                                 */
/* ------------------------------------------------------------------ */

describe("misconception guard", () => {
  it("catches closures ≈ hoisting and corrects it", () => {
    const fix = detectMisconception("I think closures are about hoisting");
    expect(fix).not.toBeNull();
    expect(fix!).toContain("lexical scope");
  });

  it("catches microtask ordering and timer/promise mix-ups", () => {
    expect(detectMisconception("microtasks run after timers")).not.toBeNull();
    expect(detectMisconception("setTimeout is basically a promise")).not.toBeNull();
  });

  it("leaves correct claims alone", () => {
    expect(detectMisconception("closures capture lexical scope")).toBeNull();
    expect(detectMisconception("microtasks drain before the next macrotask")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Structure signals                                                   */
/* ------------------------------------------------------------------ */

describe("structuralSignals", () => {
  it("detects example, tradeoffs and structure markers", () => {
    const s = structuralSignals("First, I'd cache the results. For example, Redis — however it costs memory.", "senior");
    expect(s.structured).toBe(true);
    expect(s.example).toBe(true);
    expect(s.tradeoffs).toBe(true);
    expect(s.words).toBeGreaterThan(0);
    expect(s.expected).toBe(80);
  });

  it("flags short unstructured answers", () => {
    const s = structuralSignals("ok sure", "senior");
    expect(s.structured).toBe(false);
    expect(s.example).toBe(false);
    expect(s.tradeoffs).toBe(false);
    expect(s.words).toBeLessThan(10);
  });

  it("level expectation scales with seniority", () => {
    expect(structuralSignals("x", "junior").expected).toBe(40);
    expect(structuralSignals("x", "principal").expected).toBe(120);
  });
});

/* ------------------------------------------------------------------ */
/* Stateful replies + dialogue memory                                  */
/* ------------------------------------------------------------------ */

describe("coachReply dialogue memory", () => {
  it("turn 1 stress-tests an approach and probes the first missing point", () => {
    const r = localCoachReply("I'd just return the inner function", CTX);
    expect(r).toContain("thinking about");
    expect(r).toContain("Don't miss: lexical scope");
    expect(r).toContain("What would “lexical scope” look like");
  });

  it("turn 2 never repeats an already-covered point — the probe moves on", () => {
    const hist = [
      msg("user", "I'd just return the inner function"),
      msg("assistant", "probe…"),
      msg("user", "the function closes over the outer scope so the variables stay remembered")
    ];
    const r = coachReply(hist[2].text, CTX, hist);
    /* lexical scope is now covered → not re-listed, probe advances */
    expect(r).not.toContain("Don't miss: lexical scope");
    expect(r).toContain("What would “state preservation” look like");
  });

  it("a hint still lists the full checklist with state marks", () => {
    const hist = [msg("user", "the closure captures the outer scope"), msg("assistant", "ok")];
    const r = coachReply("Give me a hint", CTX, [...hist, msg("user", "Give me a hint")]);
    expect(r).toContain("lexical scope");
    expect(r).toContain("you've got this");
  });
});

/* ------------------------------------------------------------------ */
/* In-chat grading (aligned with the session engine)                   */
/* ------------------------------------------------------------------ */

describe("coachReply grading", () => {
  it("grades the latest real answer with the same number as the session engine", () => {
    const answer = "I'd just return the inner function";
    const sq = { q: CTX.prompt, a: CTX.answer, kp: CTX.kp, cat: "field" as const, catLabel: "Technical", catColor: "#22d3ee", level: CTX.levelId, src: "coach" };
    const expected = scoreAnswer(answer, sq).score;

    const hist = [msg("user", answer), msg("assistant", "ok"), msg("user", "Grade my answer")];
    const r = coachReply("Grade my answer", CTX, hist);
    expect(r).toContain("session engine scores it");
    expect(r).toContain(`${expected}/5`);
    expect(r).toContain("Coverage per key point");
    expect(r).toContain("To reach a 4+, add");
  });

  it("a strong answer gets a higher grade and no 'add' list", () => {
    const answer = "a closure captures the lexical scope, preserves state, and has memory implications";
    const hist = [msg("user", answer), msg("assistant", "ok"), msg("user", "Grade my answer")];
    const r = coachReply("Grade my answer", CTX, hist);
    expect(r).toMatch(/\d\/5/);
    expect(r).toContain("You're covering everything");
  });

  it("shows structure signals in the grade breakdown", () => {
    const hist = [msg("user", "I'd return the inner function"), msg("assistant", "ok"), msg("user", "Grade my answer")];
    const r = coachReply("Grade my answer", CTX, hist);
    expect(r).toContain("Signals:");
    expect(r).toContain("structure");
  });
});

/* ------------------------------------------------------------------ */
/* The session grader is now concept-aware too (coach ↔ score agree)   */
/* ------------------------------------------------------------------ */

describe("scoreAnswer concept-awareness", () => {
  const q = {
    q: "How do you make a page load faster?",
    a: "…",
    kp: ["caching strategy", "code splitting"],
    cat: "field" as const,
    catLabel: "Technical",
    catColor: "#22d3ee",
    level: "mid" as const,
    src: "test"
  };

  it("a synonym answer counts as covering the key point", () => {
    const r = scoreAnswer("I'd memoize the expensive calls", q);
    expect(r.covered).toContain("caching strategy");
  });

  it("literal phrasing still works", () => {
    const r = scoreAnswer("I would split the code by route", q);
    expect(r.covered).toContain("code splitting");
  });

  it("irrelevant answers stay low", () => {
    const r = scoreAnswer("pizza is my favorite", q);
    expect(r.score).toBeLessThanOrEqual(2);
    expect(r.missed.length).toBe(2);
  });
});
