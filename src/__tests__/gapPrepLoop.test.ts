// @vitest-environment jsdom
/* Item 12 — the gap prep-loop invariant. When a JD scan's missing skills are
   written back, they must:
     (a) become real P0 Roadmap topics under the "Job description fit" phase, and
     (b) NOT be silently marked as owned — they stay gaps in the Skill Counselor
         until genuinely earned.
   The write-back touches only goal.jdKeywords (never the skill graph), so (b)
   holds by construction; this test makes it non-regressable. The fixture uses
   the backend/api-engineer catalog path, which lists "node" as a required skill
   the un-owning profile is missing. */

import { beforeEach, describe, expect, it } from "vitest";
import type { CareerGoal, CareerProfile } from "../types";
import { canonicalize } from "../data/skillVocab";
import { getGoal, saveGoal } from "../services/goal";
import { ingestCareerProfile, toCareerProfile } from "../services/profileStore";
import { gapAnalysis } from "../services/skillCounselor";
import { buildPhases } from "../services/roadmap/phases";
import { prioritize } from "../services/roadmap/prioritize";
import { mergeGapKeywords } from "../services/gapPlan";

const GOAL: CareerGoal = {
  currentLevel: "mid", targetLevel: "senior", fieldId: "backend", companyId: "general",
  targetDate: "2026-12-01", hoursPerWeek: 6, createdAt: 1000
};

/** A profile that owns Docker but NOT Node.js — so "Node.js" is a real gap on
    the backend/api-engineer path. */
const OWNS_DOCKER: CareerProfile = {
  headline: "Backend dev", years: 4, location: "", remote: false, workAuth: "",
  targetTitles: [], skills: ["Docker"], summary: "", updatedAt: 1000
};

/** The one skill under test, expressed once as the display label the write-back
    stores and once as the canonical slug the Counselor tracks the gap under. The
    two are provably the same skill (asserted below), so the "topic" half and the
    "gap" half can't quietly drift onto different skills. */
const MISSING_LABEL = "Node.js";
const MISSING_SLUG = canonicalize(MISSING_LABEL).slug; // "node"

beforeEach(() => localStorage.clear());

/** Simulate the modal's Roadmap write-back for a set of missing-skill labels. */
function addToRoadmap(missing: string[]) {
  const goal = getGoal()!;
  const { next } = mergeGapKeywords(goal.jdKeywords ?? [], missing);
  saveGoal({ ...goal, jdKeywords: next });
}

describe("gap prep-loop write-back", () => {
  beforeEach(() => {
    saveGoal(GOAL);
    ingestCareerProfile(OWNS_DOCKER);
    addToRoadmap([MISSING_LABEL]);
  });

  it("fixture: the stored label and the open gap are the same canonical skill", () => {
    // Anchors the two halves together — without this the topic assertions (on
    // the label "Node.js") and the gap assertions (on the id "node") are just
    // independent hardcoded strings that nothing forces to be one skill.
    expect(MISSING_SLUG).toBe("node");
  });

  it("makes the missing skill a real 'Job description fit' phase topic", () => {
    const phases = buildPhases(getGoal()!);
    const jd = phases.find(p => p.id === "jd");
    expect(jd).toBeDefined();
    expect(jd!.topics.map(t => t.label)).toContain(MISSING_LABEL);
  });

  it("prioritizes the written-back skill as P0", () => {
    const { topics } = prioritize(getGoal()!, null, []);
    const node = topics.find(t => t.label === MISSING_LABEL);
    expect(node).toBeDefined();
    expect(node!.phase).toBe("jd");
    expect(node!.priority).toBe("P0");
  });

  it("writes to jdKeywords, NOT the skill graph (so it can't fake mastery)", () => {
    // The invariant is precisely "the write-back lands in goal.jdKeywords and
    // leaves the skill graph untouched". Asserting the jdKeywords side makes this
    // test causally depend on the write-back — drop addToRoadmap from beforeEach
    // and it fails — so it can't pass merely because a Docker-only profile never
    // owns node in the first place.
    expect(getGoal()!.jdKeywords ?? []).toContain(MISSING_LABEL);
    const skills = toCareerProfile().skills; // derived from the graph
    expect(skills).toContain("Docker");         // the genuinely-owned skill is present
    expect(skills).not.toContain(MISSING_LABEL); // the written-back skill is NOT
  });

  it("leaves the skill in the Counselor's gap list (still a gap, not owned)", () => {
    const gap = gapAnalysis(toCareerProfile(), "backend", "api-engineer");
    expect(gap).not.toBeNull();
    expect(gap!.missing.map(s => s.id)).toContain(MISSING_SLUG);
    expect(gap!.owned.map(s => s.id)).not.toContain(MISSING_SLUG);
  });
});
