import { describe, expect, it } from "vitest";
import type { Answer, CareerGoal } from "../types";
import { buildFeedback } from "../engine";
import { composeDiagnostic, persistDiagnostic, scoreDiagnostic } from "../services/diagnostic";
import { clearGoal, getProfile, saveProfile } from "../services/goal";

const answer = (user: string, q: ReturnType<typeof composeDiagnostic>["questions"][number]): Answer => ({
  q, user,
  fb: buildFeedback(user, q)
});

describe("composeDiagnostic", () => {
  it("ramps from junior up to the target level", () => {
    const s = composeDiagnostic("backend", "senior");
    expect(s.meta.mode).toBe("diagnostic");
    expect(s.meta.companyId).toBe("diagnostic");
    expect(s.questions.length).toBeGreaterThanOrEqual(6);
    const levels = new Set(s.questions.map(q => q.level));
    expect(levels.has("junior")).toBe(true);
    expect(levels.has("senior")).toBe(true);
  });

  it("includes executive pools for CTO/CEO targets", () => {
    expect(composeDiagnostic("backend", "cto").questions.some(q => q.cat === "cto")).toBe(true);
    expect(composeDiagnostic("backend", "ceo").questions.some(q => q.cat === "ceo")).toBe(true);
  });

  it("caps the quiz at 10 questions", () => {
    expect(composeDiagnostic("backend", "ceo").questions.length).toBeLessThanOrEqual(10);
  });
});

describe("scoreDiagnostic", () => {
  it("measures the highest level averaging ≥ 60% coverage", () => {
    const s = composeDiagnostic("backend", "senior");
    const answers = s.questions.map(q =>
      answer(q.level === "senior" ? "no idea" : q.kp.join(" "), q)
    );
    const res = scoreDiagnostic(answers, "backend");
    expect(res.level).toBe("mid"); // junior + mid pass, senior fails
  });

  it("an all-fail diagnostic measures below junior", () => {
    const s = composeDiagnostic("backend", "mid");
    const answers = s.questions.map(q => answer("", q));
    expect(scoreDiagnostic(answers, "backend").level).toBe("junior");
  });

  it("an all-pass diagnostic measures at or above the target", () => {
    const s = composeDiagnostic("backend", "senior");
    const answers = s.questions.map(q => answer(q.kp.join(" "), q));
    const res = scoreDiagnostic(answers, "backend");
    expect({ junior: 0, mid: 1, senior: 2, staff: 3, principal: 4, cto: 5, ceo: 6 }[res.level]).toBeGreaterThanOrEqual(2);
    expect(res.pct).toBeGreaterThan(0.5);
  });

  it("computes per-skill coverage from related answers", () => {
    const s = composeDiagnostic("backend", "senior");
    const answers = s.questions.map(q => answer(q.kp.join(" "), q));
    const res = scoreDiagnostic(answers, "backend");
    expect(Object.keys(res.perSkill).length).toBeGreaterThan(0);
    for (const v of Object.values(res.perSkill)) expect(v).toBeGreaterThanOrEqual(0.5);
  });
});

describe("persistDiagnostic", () => {
  const goal: CareerGoal = {
    currentLevel: "mid", targetLevel: "senior",
    fieldId: "backend", companyId: "general",
    targetDate: "2099-01-01", hoursPerWeek: 5, createdAt: 1
  };

  it("merges the result into the profile and clears the skip flag", () => {
    saveProfile({ goal, skills: [{ skill: "APIs & services", self: 2 }], skippedAt: 123 });
    const s = composeDiagnostic("backend", "senior");
    const answers = s.questions.map(q => answer(q.kp.join(" "), q));
    const res = persistDiagnostic(answers, "backend");
    const p = getProfile();
    expect(p?.diagnostic?.level).toBe(res.level);
    expect(p?.diagnostic?.perSkill).toBeDefined();
    expect(p?.skippedAt).toBeUndefined();
    clearGoal();
    expect(getProfile()).toBeNull();
  });
});
