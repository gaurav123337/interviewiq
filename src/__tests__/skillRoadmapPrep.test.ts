// @vitest-environment jsdom
/* Item 14 — the SkillDetail prep-loop adapters. SkillDetail's actions are thin
   glue over two pure helpers (roadmapPrepSel, skillRoadmapShareText) plus the
   shared mergeGapKeywords write-back, so this test pins the logic without
   rendering the component (the sibling style of counselorFeed.test.ts). It
   locks: (a) how an admin roadmap resolves to a field/level/keyword selection,
   (b) that keywords always lead with the skill name (so composeRelevantSession
   never hits pickRelevant's empty-keyword random fallback), (c) the share text
   is complete, and (d) "Add to Roadmap" obeys the Item 12 invariant — the skill
   becomes a P0 "Job description fit" topic, the goal fingerprint is preserved,
   and the skill graph is never touched. */

import { beforeEach, describe, expect, it } from "vitest";
import type { CareerGoal, CareerProfile, LevelId } from "../types";
import {
  roadmapPrepSel,
  skillRoadmapShareText,
  type SkillRoadmap,
} from "../services/skillRoadmapService";
import { getGoal, goalFingerprint, saveGoal } from "../services/goal";
import { ingestCareerProfile, toCareerProfile } from "../services/profileStore";
import { buildPhases } from "../services/roadmap/phases";
import { prioritize } from "../services/roadmap/prioritize";
import { mergeGapKeywords } from "../services/gapPlan";

/** A SkillRoadmap fixture with sensible defaults (the React roadmap), overridable
    per test. Mirrors how the DEFAULT_ROADMAPS entries are shaped. */
function roadmap(over: Partial<SkillRoadmap> = {}): SkillRoadmap {
  return {
    id: "react", skillId: "react", name: "React", icon: "⚛️", band: "mid", difficulty: 2,
    description: "The most popular UI library.",
    why: "React's component model, hooks and virtual DOM are the frontend standard.",
    slug: "react", tags: ["frontend", "ui", "components"], aliases: [],
    prerequisites: [], learningPath: ["components", "hooks", "state"],
    resources: [
      { title: "React docs", url: "https://react.dev/learn", kind: "docs", free: true, publishedYear: 2025, qualityScore: 98 },
    ],
    estimatedHours: 30, qualityStatus: "published", tier: "free", published: true, sortOrder: 0,
    views: 0, starts: 0, completions: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function goal(over: Partial<CareerGoal> = {}): CareerGoal {
  return {
    currentLevel: "mid", targetLevel: "senior", fieldId: "backend", companyId: "general",
    targetDate: "2026-12-01", hoursPerWeek: 6, createdAt: 1000, ...over,
  };
}

const NO_OB: { field: string | null; level: LevelId | null } = { field: null, level: null };

describe("roadmapPrepSel — field resolution", () => {
  it("takes the first tag that names a real interview field", () => {
    expect(roadmapPrepSel(roadmap({ tags: ["frontend", "ui"] }), null, NO_OB).fieldId).toBe("frontend");
    expect(roadmapPrepSel(roadmap({ tags: ["backend", "enterprise", "android"] }), null, NO_OB).fieldId).toBe("backend");
    expect(roadmapPrepSel(roadmap({ tags: ["devops", "infrastructure", "containers"] }), null, NO_OB).fieldId).toBe("devops");
  });

  it("falls back to the goal field when no tag names a field", () => {
    // System Design's tags (architecture/distributed/scale) match no interview field.
    const sel = roadmapPrepSel(roadmap({ tags: ["architecture", "distributed", "scale"] }), goal({ fieldId: "backend" }), NO_OB);
    expect(sel.fieldId).toBe("backend");
  });

  it("falls back to onboarding field, then to 'frontend'", () => {
    expect(roadmapPrepSel(roadmap({ tags: ["architecture"] }), null, { field: "data", level: null }).fieldId).toBe("data");
    expect(roadmapPrepSel(roadmap({ tags: ["architecture"] }), null, NO_OB).fieldId).toBe("frontend");
  });
});

describe("roadmapPrepSel — level resolution", () => {
  it("prefers the user's target level over the skill's band", () => {
    expect(roadmapPrepSel(roadmap({ band: "mid" }), goal({ targetLevel: "senior" }), NO_OB).levelId).toBe("senior");
  });

  it("falls back to onboarding level, then to the skill's band", () => {
    expect(roadmapPrepSel(roadmap({ band: "mid" }), null, { field: null, level: "staff" }).levelId).toBe("staff");
    expect(roadmapPrepSel(roadmap({ band: "senior" }), null, NO_OB).levelId).toBe("senior");
  });
});

describe("roadmapPrepSel — keywords", () => {
  it("leads with the skill name; a step is a secondary keyword", () => {
    expect(roadmapPrepSel(roadmap({ name: "React" }), null, NO_OB).keywords).toEqual(["React"]);
    expect(roadmapPrepSel(roadmap({ name: "React" }), null, NO_OB, "hooks").keywords).toEqual(["React", "hooks"]);
  });

  it("never yields an empty keyword set (guards pickRelevant's random fallback)", () => {
    // An empty keyword set would make composeRelevantSession serve random cards;
    // roadmap.name is a real, tokenizable word, so keywords[0] always anchors it.
    const sel = roadmapPrepSel(roadmap({ name: "Kubernetes" }), null, NO_OB);
    expect(sel.keywords.length).toBeGreaterThan(0);
    expect(sel.keywords[0]).toBe("Kubernetes");
  });
});

describe("skillRoadmapShareText", () => {
  it("includes the name, why, hours, and every learning-path step", () => {
    const txt = skillRoadmapShareText(roadmap({
      name: "React", why: "WHY_MARKER_TEXT", learningPath: ["components", "hooks"], estimatedHours: 30,
    }));
    expect(txt).toContain("React");
    expect(txt).toContain("WHY_MARKER_TEXT");
    expect(txt).toContain("components");
    expect(txt).toContain("hooks");
    expect(txt).toContain("30h");
  });

  it("omits the learning-path section when there are no steps", () => {
    expect(skillRoadmapShareText(roadmap({ learningPath: [] }))).not.toContain("Learning path:");
  });
});

describe("Add to Roadmap write-back (Item 12 invariant)", () => {
  /* A profile that owns Docker but not React — so the graph side of the invariant
     is non-vacuous (a genuinely-owned skill is present, the fed one is absent). */
  const OWNS_DOCKER: CareerProfile = {
    headline: "Dev", years: 4, location: "", remote: false, workAuth: "",
    targetTitles: [], skills: ["Docker"], summary: "", updatedAt: 1000,
  };

  beforeEach(() => {
    localStorage.clear();
    saveGoal(goal());
    ingestCareerProfile(OWNS_DOCKER);
  });

  /** Simulate SkillDetail.addToRoadmap: fold [roadmap.name] into goal.jdKeywords
      through the same seam the component uses. */
  function feed(name: string): void {
    const g = getGoal()!;
    saveGoal({ ...g, jdKeywords: mergeGapKeywords(g.jdKeywords ?? [], [name]).next });
  }

  it("files the skill as a P0 'Job description fit' topic", () => {
    feed("React");
    const jd = buildPhases(getGoal()!).find(p => p.id === "jd");
    expect(jd).toBeDefined();
    expect(jd!.topics.map(t => t.label)).toContain("React");

    const react = prioritize(getGoal()!, null, []).topics.find(t => t.label === "React");
    expect(react).toBeDefined();
    expect(react!.phase).toBe("jd");
    expect(react!.priority).toBe("P0");
  });

  it("preserves goalFingerprint — the write-back never resets roadmap progress", () => {
    const before = goalFingerprint(getGoal()!);
    feed("React");
    expect(goalFingerprint(getGoal()!)).toBe(before);
  });

  it("writes to jdKeywords, NOT the skill graph (can't fake mastery)", () => {
    feed("React");
    expect(getGoal()!.jdKeywords ?? []).toContain("React");
    const skills = toCareerProfile().skills; // derived from the skill graph
    expect(skills).toContain("Docker");     // genuinely owned
    expect(skills).not.toContain("React");  // fed skill is NOT owned
  });
});
