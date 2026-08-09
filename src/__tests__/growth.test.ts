import { describe, expect, it } from "vitest";
import { adaptPlan, buildPlan } from "../services/planner";
import { avgScore, cardsDueToday, categoryMastery, scoresOverTime, streaks } from "../services/progress";
import { activatePro, deactivatePro, generateProKey, isValidProKey } from "../services/license";
import { getTier } from "../services/entitlements";
import { getSrs, rate, resetSrs } from "../services/drill";
import type { Config, SavedSession, SessionQuestion } from "../types";

const CFG: Config = { count: 8, mode: "standard", timing: "none", voice: false };

const sess = (date: number, pct = 0.7): SavedSession => ({
  id: String(date),
  date,
  meta: { field: "Backend", fieldId: "backend", company: "Stripe", companyId: "stripe", level: "Senior", levelId: "senior", mode: "standard" },
  config: CFG,
  agg: { score: pct * 5, pct, grade: "B" },
  answers: []
});

describe("study planner", () => {
  it("builds a day-by-day plan ending with a mock interview", () => {
    const plan = buildPlan({ levelId: "senior", fieldId: "backend", companyId: "stripe", targetDate: "2026-08-23", today: "2026-08-09" });
    expect(plan).toHaveLength(15);
    expect(plan[0].date).toBe("2026-08-09");
    expect(plan[plan.length - 1].date).toBe("2026-08-23");
    expect(plan[plan.length - 1].kind).toBe("mock");
    expect(plan.some(d => d.kind === "company")).toBe(true);
    expect(plan.some(d => d.kind === "foundations")).toBe(true);
    for (const d of plan) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.focus.length).toBeGreaterThan(0);
    }
  });

  it("clamps the plan to 3–28 days", () => {
    const long = buildPlan({ levelId: "mid", fieldId: "frontend", companyId: "general", targetDate: "2026-10-01", today: "2026-08-09" });
    expect(long).toHaveLength(28);
    const short = buildPlan({ levelId: "mid", fieldId: "frontend", companyId: "general", targetDate: "2026-08-09", today: "2026-08-09" });
    expect(short).toHaveLength(3);
  });
});

describe("adaptive study planner", () => {
  const input = { levelId: "senior" as const, fieldId: "backend", companyId: "stripe", targetDate: "2026-08-23", today: "2026-08-09" };

  const q = (catLabel: string, kp: string[]): SessionQuestion => ({
    q: "?", a: "a", kp, cat: "field" as const, catLabel, catColor: "#fff", level: "senior" as const, src: "x"
  });

  const withAnswers = (date: number, answers: { pct: number; catLabel: string; kp: string[]; missed?: string[] }[]): SavedSession => ({
    ...sess(date),
    answers: answers.map(a => ({ q: q(a.catLabel, a.kp), user: "", score: Math.round(a.pct * 5), pct: a.pct, missed: a.missed }))
  });

  it("marks days with a completed session as done", () => {
    const sessions = [withAnswers(new Date("2026-08-09T12:00:00").getTime(), [{ pct: 0.7, catLabel: "Technical", kp: ["x"] }])];
    const plan = adaptPlan({ ...input, sessions });
    expect(plan.find(d => d.date === "2026-08-09")?.status).toBe("done");
  });

  it("skips a mastered phase and repurposes the slot into a weak-topic drill", () => {
    /* Technical answers are strong (mastery 90%) but a Behavioral answer flopped with missed key points */
    const sessions = [withAnswers(new Date("2026-08-08T12:00:00").getTime(), [
      { pct: 0.9, catLabel: "Technical", kp: ["indexes"] },
      { pct: 0.3, catLabel: "Behavioral", kp: ["STAR"], missed: ["STAR", "leadership example"] }
    ])];
    const plan = adaptPlan({ ...input, sessions });
    const weak = plan.filter(d => d.weak);
    expect(weak.length).toBeGreaterThan(0);
    expect(weak.length).toBeLessThanOrEqual(2);
    expect(weak[0].title).toBe("Weak topics drill");
    expect(weak[0].topics).toContain("STAR");
    expect(weak[0].status).toBe("upcoming");
    /* the mastered Technical slot was skipped (or repurposed), never left as plain upcoming */
    const techUpcoming = plan.filter(d => d.status === "upcoming" && !d.weak && d.kind !== "mock");
    expect(techUpcoming.length).toBeLessThan(plan.filter(d => d.kind !== "mock").length);
  });

  it("falls back to question key points when missed details are missing (old sessions)", () => {
    const sessions = [withAnswers(new Date("2026-08-08T12:00:00").getTime(), [
      { pct: 0.9, catLabel: "Technical", kp: ["indexes"] },
      { pct: 0.4, catLabel: "Behavioral", kp: ["STAR", "situation", "result"] }
    ])];
    const plan = adaptPlan({ ...input, sessions });
    const weak = plan.filter(d => d.weak);
    expect(weak.length).toBeGreaterThan(0);
    expect(weak[0].topics).toContain("STAR");
  });

  it("stays static when there is no history", () => {
    const plan = adaptPlan(input);
    expect(plan.every(d => !d.weak)).toBe(true);
    expect(plan.every(d => d.status === "upcoming" || d.status === "today")).toBe(true);
  });
});

describe("progress analytics", () => {
  it("computes current and longest streaks from consecutive days", () => {
    const today = new Date("2026-08-09T12:00:00");
    const d = (offset: number) => today.getTime() - offset * 86_400_000;
    const sessions = [sess(d(0)), sess(d(1)), sess(d(2)), sess(d(5)), sess(d(6))];
    const st = streaks(sessions, today);
    expect(st.current).toBe(3);
    expect(st.longest).toBe(3);
  });

  it("does not break a streak when today has no session but yesterday did", () => {
    const today = new Date("2026-08-09T12:00:00");
    const d = (offset: number) => today.getTime() - offset * 86_400_000;
    expect(streaks([sess(d(1)), sess(d(2))], today).current).toBe(2);
    expect(streaks([sess(d(3))], today).current).toBe(0);
  });

  it("returns the score trend and averages", () => {
    const sessions = [sess(1, 0.6), sess(2, 0.8), sess(3, 0.9)];
    expect(scoresOverTime(sessions, 2)).toHaveLength(2);
    expect(avgScore(sessions)).toBeCloseTo(3.83, 1);
  });

  it("aggregates category mastery across sessions", () => {
    const q = { q: "?", a: "a", kp: ["k"], cat: "field" as const, catLabel: "Technical", catColor: "#fff", level: "senior" as const, src: "x" } as SessionQuestion;
    const a = (pct: number): SavedSession => ({ ...sess(1), answers: [{ q, user: "", score: 4, pct }] });
    const mastery = categoryMastery([a(0.8), a(0.6)]);
    expect(mastery).toHaveLength(1);
    expect(mastery[0].pct).toBeCloseTo(0.7, 1);
  });

  it("counts drill cards due today from the SRS schedule", () => {
    resetSrs();
    const t0 = Date.now();
    rate("a", "again", t0); /* due in 1 min */
    rate("b", "good", t0); /* due in 1 day */
    expect(cardsDueToday(t0)).toBe(0);
    expect(cardsDueToday(t0 + 61_000)).toBe(1);
    expect(Object.keys(getSrs()).length).toBe(2);
    resetSrs();
  });
});

describe("pro license keys", () => {
  it("accepts generated keys and rejects garbage", () => {
    expect(isValidProKey(generateProKey())).toBe(true);
    expect(isValidProKey("IQPRO-ABCD-EFGH-1234")).toBe(false);
    expect(isValidProKey("hello")).toBe(false);
    expect(isValidProKey("")).toBe(false);
  });

  it("activates and deactivates the pro tier", () => {
    deactivatePro();
    expect(getTier()).toBe("free");
    const key = generateProKey();
    const r = activatePro(key);
    expect(r.ok).toBe(true);
    expect(getTier()).toBe("pro");
    const bad = activatePro("IQPRO-NOPE-NOPE-0000");
    expect(bad.ok).toBe(false);
    expect(getTier()).toBe("pro");
    deactivatePro();
    expect(getTier()).toBe("free");
  });
});
