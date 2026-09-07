import { beforeEach, describe, expect, it } from "vitest";
import type { CareerGoal } from "../types";
import type { StudyPlan } from "../services/skillCounselor";
import { roadmapCompletion, counselorCompletion } from "../services/completion";
import { saveGoal, saveProfile, toggleTopicProgress } from "../services/goal";
import { saveStudyPlan, planProgressKey, setWeekDone } from "../services/studyPlan";
import { storageSet, STORAGE_KEYS } from "../services/storage";

/* date helpers + goal fixture mirror roadmap.test.ts so buildRoadmap sees a
   real, in-horizon goal */
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inWeeks = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n * 7);
  return fmt(d);
};
const goal = (patch: Partial<CareerGoal> = {}): CareerGoal => ({
  currentLevel: "mid", targetLevel: "senior", fieldId: "backend", companyId: "stripe",
  targetDate: inWeeks(8), hoursPerWeek: 5, createdAt: 1, ...patch,
});

const studyPlan = (patch: Partial<StudyPlan> = {}): StudyPlan => ({
  fieldId: "backend", trackId: "api-engineer", targetBand: "senior",
  milestones: [
    { week: 1, title: "Week 1", skillIds: ["a"], hours: 4 },
    { week: 2, title: "Week 2", skillIds: ["b"], hours: 4 },
    { week: 3, title: "Week 3", skillIds: ["c"], hours: 4 },
  ],
  totalHours: 12, perWeekHours: 4, createdAt: 1, ...patch,
});

beforeEach(() => localStorage.clear());

describe("roadmapCompletion", () => {
  it("returns null when there's no goal", () => {
    expect(roadmapCompletion([])).toBeNull();
  });

  it("returns null when a goal exists but no skill profile was ever saved", () => {
    /* saveGoal sets origins.goal but not origins.skills, so getProfile() stays
       null — exercises the !profile branch specifically */
    saveGoal(goal());
    expect(roadmapCompletion([])).toBeNull();
  });

  it("counts topics and weeks once a goal + profile exist", () => {
    saveProfile({ goal: goal(), skills: [{ skill: "APIs & services", self: 3 }] });
    const c = roadmapCompletion([]);
    expect(c).not.toBeNull();
    expect(c!.topicsTotal).toBeGreaterThan(0);
    expect(c!.weeksTotal).toBeGreaterThan(0);
    expect(c!.topicsDone).toBe(0); // nothing checked off yet
    expect(c!.weeksDone).toBeLessThanOrEqual(c!.weeksTotal);
  });

  it("reflects a checked-off topic in topicsDone", () => {
    const g = goal();
    saveProfile({ goal: g, skills: [{ skill: "APIs & services", self: 3 }] });
    toggleTopicProgress(g, "field-0");
    expect(roadmapCompletion([])!.topicsDone).toBeGreaterThanOrEqual(1);
  });
});

describe("counselorCompletion", () => {
  it("returns null when no study plan is saved", () => {
    expect(counselorCompletion()).toBeNull();
  });

  it("counts total milestones with none done initially", () => {
    saveStudyPlan(studyPlan());
    expect(counselorCompletion()).toEqual({ weeksDone: 0, weeksTotal: 3 });
  });

  it("counts checked-off weeks and ignores those toggled back off", () => {
    const plan = studyPlan();
    saveStudyPlan(plan);
    const key = planProgressKey(plan);
    setWeekDone(key, 1, true);
    setWeekDone(key, 2, true);
    expect(counselorCompletion()!.weeksDone).toBe(2);
    setWeekDone(key, 2, false);
    expect(counselorCompletion()!.weeksDone).toBe(1);
  });

  it("ignores stale progress for weeks outside the current (rebuilt) plan", () => {
    /* The per-plan progress map is keyed by field/track/band alone and is never
       pruned; a plan rebuilt with fewer milestones must not count leftover
       higher-week ticks, or weeksDone would exceed weeksTotal and paint a fresh
       plan as complete (adversarial finding). */
    const plan = studyPlan(); // milestones weeks 1-3
    saveStudyPlan(plan);
    const key = planProgressKey(plan);
    setWeekDone(key, 5, true);
    setWeekDone(key, 6, true);
    setWeekDone(key, 7, true);
    const c = counselorCompletion()!;
    expect(c.weeksTotal).toBe(3);
    expect(c.weeksDone).toBe(0); // weeks 5-7 aren't in this plan
    expect(c.weeksDone).toBeLessThanOrEqual(c.weeksTotal);
  });

  it("fails soft (returns null) for a malformed plan blob with no milestones array", () => {
    /* A cross-version or corrupted iq.counselorPlan synced verbatim (lww, no shape
       validation) can be a valid-JSON object without milestones[]; the helper must
       not throw inside Progress's render (fail-soft / no-crash invariant). */
    storageSet(STORAGE_KEYS.counselorPlan, { fieldId: "backend", trackId: "api-engineer", targetBand: "senior" });
    expect(() => counselorCompletion()).not.toThrow();
    expect(counselorCompletion()).toBeNull();
  });
});
