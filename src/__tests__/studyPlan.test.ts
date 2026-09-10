import { beforeEach, describe, expect, it } from "vitest";
import {
  getSavedStudyPlan,
  saveStudyPlan,
  clearStudyPlan,
  planProgressKey,
  getPlanProgress,
  setWeekDone,
} from "../services/studyPlan";
import { suggestTrack, build90DayPlan } from "../services/skillCounselor";

/* Item 20 (Phase 3) — load-bearing path: 90-day study-plan persistence.
   Pure + localStorage, fully real-testable. Before now only counselorCompletion
   exercised it transitively; clearStudyPlan, the planProgressKey format, and
   setWeekDone's toggle/key-isolation semantics were never asserted directly.
   Storage suite: relies on the in-memory Storage shim from src/__tests__/setup.ts;
   no vi.mock of storage — seeding goes through the real writers. */

beforeEach(() => localStorage.clear());

describe("planProgressKey", () => {
  it("formats as fieldId/trackId/targetBand", () => {
    expect(
      planProgressKey({ fieldId: "frontend", trackId: "react", targetBand: "senior" })
    ).toBe("frontend/react/senior");
  });

  it("is distinct for distinct coordinates", () => {
    const a = planProgressKey({ fieldId: "frontend", trackId: "react", targetBand: "senior" });
    const b = planProgressKey({ fieldId: "frontend", trackId: "react", targetBand: "staff" });
    const c = planProgressKey({ fieldId: "backend", trackId: "react", targetBand: "senior" });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("study-plan persistence", () => {
  it("returns null when no plan is saved", () => {
    expect(getSavedStudyPlan()).toBeNull();
  });

  it("round-trips a real build90DayPlan output", () => {
    const profile = { years: 3, skills: [] };
    const sug = suggestTrack(profile);
    const plan = build90DayPlan(profile, sug.fieldId, sug.trackId, "senior");
    expect(plan).not.toBeNull();

    saveStudyPlan(plan!);
    expect(getSavedStudyPlan()).toEqual(plan);
  });

  it("clearStudyPlan resets back to null", () => {
    const profile = { years: 3, skills: [] };
    const sug = suggestTrack(profile);
    saveStudyPlan(build90DayPlan(profile, sug.fieldId, sug.trackId, "senior")!);
    expect(getSavedStudyPlan()).not.toBeNull();

    clearStudyPlan();
    expect(getSavedStudyPlan()).toBeNull();
  });
});

describe("week-level progress", () => {
  const key = "frontend/react/senior";

  it("returns an empty map for an unknown key", () => {
    expect(getPlanProgress(key)).toEqual({});
    expect(getPlanProgress("never/seen/before")).toEqual({});
  });

  it("marks a week done and reads it back through storage", () => {
    setWeekDone(key, 1, true);
    expect(getPlanProgress(key)).toEqual({ 1: true });
  });

  it("toggling false keeps the week present (false, not deleted)", () => {
    setWeekDone(key, 1, true);
    setWeekDone(key, 1, false);
    const progress = getPlanProgress(key);
    expect(progress).toEqual({ 1: false });
    expect(Object.keys(progress)).toContain("1");
  });

  it("accumulates multiple weeks under the same key", () => {
    setWeekDone(key, 1, true);
    setWeekDone(key, 3, true);
    expect(getPlanProgress(key)).toEqual({ 1: true, 3: true });
  });

  it("isolates progress between distinct plan keys", () => {
    const other = "backend/node/staff";
    setWeekDone(key, 1, true);
    setWeekDone(other, 2, true);
    expect(getPlanProgress(key)).toEqual({ 1: true });
    expect(getPlanProgress(other)).toEqual({ 2: true });
  });
});
