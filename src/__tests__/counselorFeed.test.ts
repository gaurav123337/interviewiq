// @vitest-environment jsdom
/* Item 13 PR1 — the Counselor 90-day plan → Roadmap feed invariant, the
   counselor analogue of gapPrepLoop.test.ts (Item 12). When the Skill
   Counselor's 90-day plan is "Added to Roadmap", the plan's milestone skills
   must:
     (a) become real P0 Roadmap topics under the "Job description fit" phase, and
     (b) NOT be marked as owned — they stay gaps in the Counselor until earned.
   The write-back flattens build90DayPlan(...).milestones → skill NAMES, folds
   them through mergeGapKeywords, and saves only goal.jdKeywords (never the skill
   graph), so (b) holds by construction; this test makes it non-regressable and
   pins the shared behaviour to the real counselor engine (not a hand-rolled gap
   list). The fixture uses the backend/api-engineer path, which lists "node" as a
   required skill the Docker-only profile is missing. */

import { beforeEach, describe, expect, it } from "vitest";
import type { Band } from "../data/skillCatalog";
import type { CareerGoal, CareerProfile } from "../types";
import { SKILLS } from "../data/skillCatalog";
import { canonicalize } from "../data/skillVocab";
import { getGoal, goalFingerprint, saveGoal } from "../services/goal";
import { ingestCareerProfile, toCareerProfile } from "../services/profileStore";
import { build90DayPlan, gapAnalysis } from "../services/skillCounselor";
import { buildPhases, JD_KEYWORD_LIMIT } from "../services/roadmap/phases";
import { prioritize } from "../services/roadmap/prioritize";
import { mergeGapKeywords } from "../services/gapPlan";

const FIELD_ID = "backend";
const TRACK_ID = "api-engineer";

const GOAL: CareerGoal = {
  currentLevel: "mid", targetLevel: "senior", fieldId: FIELD_ID, companyId: "general",
  targetDate: "2026-12-01", hoursPerWeek: 6, createdAt: 1000
};

/** A profile that owns Docker but NOT Node.js (nor the other path skills) — so
    the 90-day plan for the api-engineer track surfaces "node" as a real gap. */
const OWNS_DOCKER: CareerProfile = {
  headline: "Backend dev", years: 4, location: "", remote: false, workAuth: "",
  targetTitles: [], skills: ["Docker"], summary: "", updatedAt: 1000
};

/** The one skill under test, sourced from the catalog exactly as the write-back
    sources it: the plan emits SKILLS[id].name, so the label that reaches
    jdKeywords is this name, and the slug the Counselor tracks the gap under is
    its canonicalization. The fixture test below proves the two are one skill, so
    the "topic" half (on the name) and the "gap" half (on the slug) can't drift. */
const MISSING_NAME = SKILLS["node"].name;           // "Node.js"
const MISSING_SLUG = canonicalize(MISSING_NAME).slug; // "node"

beforeEach(() => localStorage.clear());

/** Simulate Counselor.addToRoadmap: build the real 90-day plan, flatten its
    milestone skill ids to display names (SKILLS[id]?.name ?? id), then fold them
    into goal.jdKeywords through the same mergeGapKeywords seam the component
    uses. Returns the intermediate values so tests can assert the cap math. */
function feedCounselorPlan(targetBand: Band = "senior") {
  const plan = build90DayPlan(toCareerProfile(), FIELD_ID, TRACK_ID, targetBand, GOAL.hoursPerWeek)!;
  const names = plan.milestones.flatMap(m => m.skillIds).map(id => SKILLS[id]?.name ?? id);
  const g = getGoal()!;
  const { next, added, dropped } = mergeGapKeywords(g.jdKeywords ?? [], names);
  saveGoal({ ...g, jdKeywords: next });
  return { plan, names, next, added, dropped };
}

describe("counselor 90-day plan → Roadmap feed", () => {
  beforeEach(() => {
    saveGoal(GOAL);
    ingestCareerProfile(OWNS_DOCKER);
  });

  it("fixture: the plan's emitted label and the open gap are the same skill", () => {
    // Anchors the two halves together — the write-back stores SKILLS["node"].name
    // ("Node.js"), while the Counselor tracks the gap under the slug "node".
    // Without this, the topic assertions (on the name) and the gap assertions (on
    // the slug) are independent hardcoded strings nothing forces to be one skill.
    expect(MISSING_SLUG).toBe("node");
    // ...and the Docker-only profile genuinely lacks node on this track, so it is
    // a real gap the plan should surface (not a vacuous pass).
    const gap = gapAnalysis(toCareerProfile(), FIELD_ID, TRACK_ID);
    expect(gap!.missing.map(s => s.id)).toContain(MISSING_SLUG);
  });

  it("feeds the plan's skills in as 'Job description fit' phase topics", () => {
    const { next } = feedCounselorPlan();
    const jd = buildPhases(getGoal()!).find(p => p.id === "jd");
    expect(jd).toBeDefined();
    // Every keyword that landed is rendered as a jd topic (the phase shows the
    // whole capped set, so the topic labels equal the stored keywords exactly).
    expect(jd!.topics.map(t => t.label)).toEqual(next);
    expect(jd!.topics.map(t => t.label)).toContain(MISSING_NAME);
  });

  it("prioritizes a fed skill as P0", () => {
    feedCounselorPlan();
    const { topics } = prioritize(getGoal()!, null, []);
    const node = topics.find(t => t.label === MISSING_NAME);
    expect(node).toBeDefined();
    expect(node!.phase).toBe("jd");
    expect(node!.priority).toBe("P0");
  });

  it("writes to jdKeywords, NOT the skill graph (so it can't fake mastery)", () => {
    feedCounselorPlan();
    // Asserting the jdKeywords side makes this test causally depend on the feed —
    // drop feedCounselorPlan() above and it fails — so it can't pass merely
    // because a Docker-only profile never owns node in the first place.
    expect(getGoal()!.jdKeywords ?? []).toContain(MISSING_NAME);
    const skills = toCareerProfile().skills; // derived from the skill graph
    expect(skills).toContain("Docker");         // the genuinely-owned skill is present
    expect(skills).not.toContain(MISSING_NAME); // the fed skill is NOT
  });

  it("leaves the fed skill in the Counselor's gap list (still a gap, not owned)", () => {
    feedCounselorPlan();
    const gap = gapAnalysis(toCareerProfile(), FIELD_ID, TRACK_ID);
    expect(gap).not.toBeNull();
    expect(gap!.missing.map(s => s.id)).toContain(MISSING_SLUG);
    expect(gap!.owned.map(s => s.id)).not.toContain(MISSING_SLUG);
  });

  it("preserves goalFingerprint — the feed never resets roadmap progress", () => {
    // jdKeywords is outside goalFingerprint (currentLevel|targetLevel|fieldId|
    // companyId), so appending fed skills must not change the fingerprint that
    // keys iq.roadmapProg. If the write-back ever mutated an identity field, this
    // fails and progress would silently reset.
    const before = goalFingerprint(getGoal()!);
    feedCounselorPlan();
    expect(goalFingerprint(getGoal()!)).toBe(before);
  });

  it("respects the JD_KEYWORD_LIMIT cap when the plan exceeds it", () => {
    // The senior-target plan for a Docker-only profile has >10 distinct missing
    // skills, so the feed must cap jdKeywords at the limit and report the tail as
    // dropped (never silently overflow the array the Roadmap renders).
    const { names, next, dropped } = feedCounselorPlan("senior");
    const distinct = new Set(names.map(n => canonicalize(n).slug));
    expect(distinct.size).toBeGreaterThan(JD_KEYWORD_LIMIT);
    expect(next).toHaveLength(JD_KEYWORD_LIMIT);
    expect(dropped.length).toBeGreaterThan(0);
    // node is the 8th path skill (7 unowned foundationals precede it), so it
    // survives the cap — the invariant tests above are not silently vacuous.
    expect(next.map(k => canonicalize(k).slug)).toContain(MISSING_SLUG);
  });
});
