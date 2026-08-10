import { describe, expect, it } from "vitest";
import { scoreStar } from "../engine/star";
import { composeSession } from "../engine/compose";
import { CODING_PROBLEMS, type CliProblem, type FnProblem } from "../data/coding";

describe("scoreStar", () => {
  it("scores an empty answer as 0", () => {
    const r = scoreStar("");
    expect(r.score).toBe(0);
    expect(r.missing).toHaveLength(4);
  });

  it("detects all four STAR elements in a full story", () => {
    const story =
      "In my last role at Acme, I was the backend lead on the payments rewrite. " +
      "My task was to cut processing failures below 0.5%. " +
      "I implemented an idempotency layer and automated retries with backoff. " +
      "As a result, failures dropped from 2.1% to 0.3% and the on-call page load halved.";
    const r = scoreStar(story);
    expect(r.present.sort()).toEqual(["A", "R", "S", "T"]);
    expect(r.missing).toEqual([]);
    expect(r.score).toBeGreaterThanOrEqual(4);
  });

  it("penalizes answers that skip action and result", () => {
    const r = scoreStar("I was working on a project where the deadline was tight and it was stressful.");
    expect(r.missing).toContain("A");
    expect(r.missing).toContain("R");
    expect(r.score).toBeLessThanOrEqual(2);
  });

  it("coaches first-person actions when they're missing", () => {
    const r = scoreStar("Situation: sprint was behind. Task: ship the release. We worked hard and it shipped.");
    expect(r.missing).toContain("A");
  });
});

describe("behavioral mode", () => {
  it("composes a session of only behavioral questions", () => {
    const s = composeSession({ fieldId: "backend", companyId: "general", levelId: "senior", count: 5, mode: "behavioral" });
    expect(s.questions).toHaveLength(5);
    expect(s.questions.every(q => q.cat === "behavioral")).toBe(true);
    expect(s.meta.mode).toBe("behavioral");
  });

  it("caps the count at the pool size", () => {
    const s = composeSession({ fieldId: "backend", companyId: "general", levelId: "senior", count: 999, mode: "behavioral" });
    expect(s.questions.length).toBeGreaterThanOrEqual(10);
    expect(s.questions.length).toBeLessThanOrEqual(12);
  });
});

describe("coding judge", () => {
  it("every problem has at least one visible test and hidden cases exist for the main set", () => {
    for (const p of CODING_PROBLEMS) {
      expect(p.tests.length).toBeGreaterThan(0);
      if (p.kind === "cli") {
        expect(p.tests.every(t => typeof t.stdin === "string" && typeof t.expect === "string")).toBe(true);
      } else {
        expect(p.tests.every(t => Array.isArray(t.args) && "expect" in t)).toBe(true);
      }
    }
    const cliWithHidden = CODING_PROBLEMS.filter((p): p is CliProblem => p.kind === "cli" && (p.hidden?.length ?? 0) > 0);
    const fnWithHidden = CODING_PROBLEMS.filter((p): p is FnProblem => p.kind === "fn" && (p.hidden?.length ?? 0) > 0);
    expect(cliWithHidden.length).toBeGreaterThanOrEqual(4);
    expect(fnWithHidden.length).toBeGreaterThanOrEqual(4);
    /* hidden cases never collide with visible ones (no accidental leaks) */
    for (const p of cliWithHidden) {
      const visible = new Set(p.tests.map(t => t.stdin));
      for (const h of p.hidden!) {
        expect(visible.has(h.stdin)).toBe(false);
      }
    }
    for (const p of fnWithHidden) {
      /* drive-based tests all use args: [], so the key includes the drive source */
      const key = (t: { args: unknown[]; drive?: (fn: unknown) => unknown | Promise<unknown> }) =>
        JSON.stringify(t.args) + "|" + (t.drive?.toString() ?? "");
      const visibleKeys = new Set(p.tests.map(key));
      for (const h of p.hidden!) {
        expect(visibleKeys.has(key(h))).toBe(false);
      }
    }
  });
});
