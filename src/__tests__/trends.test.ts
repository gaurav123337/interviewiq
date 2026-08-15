/* Shared trend-engine corpus (docs/skill-counselor.md §4) — the SAME pure
   math runs server-side in trends-refresh, so these tests are the client↔
   server parity gate. */

import { describe, it, expect } from "vitest";
import {
  classifyStage,
  computeTrendScore,
  mentionsIn,
  proposalsFromSignals,
  SKILL_KEYWORDS
} from "../../supabase/functions/_shared/trends";

describe("mentionsIn", () => {
  it("counts rows matching any keyword in description or skills", () => {
    const rows = [
      { description: "We love React and TypeScript", skills: [] },
      { description: "backend only", skills: ["node", "sql"] },
      { description: "no matches here", skills: [] },
      { description: "", skills: ["react"] }
    ];
    expect(mentionsIn(rows, SKILL_KEYWORDS.react)).toBe(2);
    expect(mentionsIn(rows, SKILL_KEYWORDS.node)).toBe(1);
    expect(mentionsIn(rows, SKILL_KEYWORDS.graphql)).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(mentionsIn([{ description: "REACT IS GREAT" }], SKILL_KEYWORDS.react)).toBe(1);
  });
});

describe("computeTrendScore", () => {
  it("neutral baseline when flat with no signals", () => {
    expect(computeTrendScore({ skillId: "x", job30: 10, job90: 10 })).toBe(45);
  });

  it("growing job mentions push the score up", () => {
    const up = computeTrendScore({ skillId: "x", job30: 90, job90: 10 });
    const down = computeTrendScore({ skillId: "x", job30: 5, job90: 50 });
    expect(up).toBeGreaterThan(60);
    expect(down).toBeLessThan(35);
  });

  it("share and npm deltas contribute but stay bounded", () => {
    const a = computeTrendScore({ skillId: "x", job30: 10, job90: 10, share: 0.5, npmDelta: 2, githubRecent: true });
    expect(a).toBeGreaterThan(60);
    expect(a).toBeLessThanOrEqual(100);
    /* even extreme signals can't blow past the bounds */
    expect(computeTrendScore({ skillId: "x", job30: 10, job90: 10, share: 5, npmDelta: 50, githubRecent: true })).toBeLessThanOrEqual(100);
  });
});

describe("classifyStage", () => {
  it("maps scores to the five stages", () => {
    expect(classifyStage(25)).toBe("declining");
    expect(classifyStage(40)).toBe("nascent");
    expect(classifyStage(55)).toBe("emerging");
    expect(classifyStage(70)).toBe("growing");
    expect(classifyStage(90)).toBe("mainstream");
  });
});

describe("proposalsFromSignals", () => {
  it("proposes demote when a skill crosses into declining", () => {
    const p = proposalsFromSignals(
      [{ skillId: "css", job30: 2, job90: 40 }],
      { css: "growing" }
    );
    expect(p).toHaveLength(1);
    expect(p[0].kind).toBe("demote");
  });

  it("proposes promote on a nascent → growing crossing", () => {
    const p = proposalsFromSignals(
      [{ skillId: "ai-ml", job30: 80, job90: 5, share: 0.2, npmDelta: 0.5 }],
      { "ai-ml": "nascent" }
    );
    expect(p.some(x => x.kind === "promote")).toBe(true);
  });

  it("emits nothing when the stage is unchanged", () => {
    const p = proposalsFromSignals([{ skillId: "react", job30: 50, job90: 40 }], { react: "growing" });
    expect(p).toHaveLength(0);
  });

  it("emits nothing on first sight (no previous stage)", () => {
    const p = proposalsFromSignals([{ skillId: "react", job30: 50, job90: 40 }], {});
    expect(p).toHaveLength(0);
  });
});
