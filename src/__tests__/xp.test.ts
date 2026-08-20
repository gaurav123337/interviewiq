import { describe, it, expect } from "vitest";
import { xpLevel, xpFromSession, totalXPFromSessions, computeStats, ACHIEVEMENTS, generateLeaderboard } from "../services/xp";
import type { SavedSession } from "../types";

const mkQ = (overrides: Record<string, unknown> = {}) => ({
  q: "q", a: "a", kp: ["k1", "k2"], cat: "field" as const, catLabel: "Technical", catColor: "#22d3ee", level: "mid" as const, src: "test", ...overrides,
});

function mkSession(overrides: Partial<SavedSession> = {}): SavedSession {
  return {
    id: "test",
    date: Date.now(),
    meta: { level: "mid", field: "frontend", fieldId: "fe", company: "general", companyId: "general", levelId: "mid", mode: "standard" },
    config: { count: 3, mode: "standard", timing: "none", voice: false },
    agg: { score: 4, pct: 80, grade: "B+" },
    answers: [
      { q: mkQ({ q: "q1", a: "a1" }), user: "ans", score: 4, pct: 80 },
      { q: mkQ({ q: "q2", a: "a2", cat: "behavioral", catLabel: "Behavioral", catColor: "#34d399" }), user: "ans", score: 3, pct: 60 },
      { q: mkQ({ q: "q3", a: "a3" }), user: "ans", score: 5, pct: 100 },
    ],
    ...overrides,
  };
}

describe("xpLevel", () => {
  it("starts at level 1 with 0 XP", () => {
    const lv = xpLevel(0);
    expect(lv.level).toBe(1);
    expect(lv.currentXP).toBe(0);
    expect(lv.progress).toBe(0);
  });

  it("levels up after enough XP", () => {
    const lv = xpLevel(100); // level 1 costs 100 XP
    expect(lv.level).toBe(2);
    expect(lv.currentXP).toBe(0);
  });

  it("shows partial progress within a level", () => {
    const lv = xpLevel(150); // level 1 costs 100, so 50 into level 2 (which costs 150)
    expect(lv.level).toBe(2);
    expect(lv.currentXP).toBe(50);
    expect(lv.progress).toBeCloseTo(50 / 150, 2);
  });
});

describe("xpFromSession", () => {
  it("awards XP proportional to score", () => {
    const s = mkSession();
    const xp = xpFromSession(s);
    expect(xp).toBeGreaterThan(0);
  });

  it("awards more XP for higher scores", () => {
    const high = mkSession({ answers: [{ q: mkQ(), user: "a", score: 5, pct: 100 }] });
    const low = mkSession({ answers: [{ q: mkQ(), user: "a", score: 1, pct: 20 }] });
    expect(xpFromSession(high)).toBeGreaterThan(xpFromSession(low));
  });

  it("awards completion bonus when all questions answered", () => {
    const complete = mkSession({ config: { count: 3, mode: "standard", timing: "none", voice: false } });
    const partial = mkSession({ config: { count: 5, mode: "standard", timing: "none", voice: false }, answers: [complete.answers[0]] });
    expect(xpFromSession(complete)).toBeGreaterThan(xpFromSession(partial));
  });

  it("mock mode gives more XP than standard", () => {
    const mock = mkSession({ config: { count: 3, mode: "mock", timing: "none", voice: false } });
    const standard = mkSession({ config: { count: 3, mode: "standard", timing: "none", voice: false } });
    expect(xpFromSession(mock)).toBeGreaterThan(xpFromSession(standard));
  });
});

describe("totalXPFromSessions", () => {
  it("sums XP from multiple sessions", () => {
    const sessions = [mkSession(), mkSession(), mkSession()];
    expect(totalXPFromSessions(sessions)).toBeGreaterThan(0);
    expect(totalXPFromSessions(sessions)).toBe(xpFromSession(sessions[0]) * 3);
  });
});

describe("computeStats", () => {
  it("computes all stats from sessions", () => {
    const sessions = [mkSession(), mkSession()];
    const stats = computeStats(sessions);
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalQuestions).toBe(6);
    expect(stats.totalXP).toBeGreaterThan(0);
    expect(stats.avgScore).toBe(4); // avgScore returns 0-5 scale
    expect(stats.bestScore).toBe(80);
    expect(stats.modesUsed.has("standard")).toBe(true);
  });

  it("detects first_session achievement", () => {
    const stats = computeStats([mkSession()]);
    expect(stats.unlockedAchievements).toContain("first_session");
  });
});

describe("achievements", () => {
  it("first_session unlocks with 1 session", () => {
    const a = ACHIEVEMENTS.find(a => a.id === "first_session")!;
    expect(a.condition(computeStats([mkSession()]))).toBe(true);
    expect(a.condition(computeStats([]))).toBe(false);
  });

  it("streak_7 requires 7-day streak", () => {
    const a = ACHIEVEMENTS.find(a => a.id === "streak_7")!;
    expect(a.condition({ ...computeStats([]), longestStreak: 7 })).toBe(true);
    expect(a.condition({ ...computeStats([]), longestStreak: 3 })).toBe(false);
  });
});

describe("generateLeaderboard", () => {
  it("returns sorted entries with user included", () => {
    const lb = generateLeaderboard([mkSession()], "Test User");
    expect(lb.length).toBeGreaterThan(5);
    expect(lb[0].rank).toBe(1);
    // XP should be descending
    for (let i = 1; i < lb.length; i++) {
      expect(lb[i - 1].xp).toBeGreaterThanOrEqual(lb[i].xp);
    }
  });

  it("marks user entry", () => {
    const lb = generateLeaderboard([mkSession()], "Test User");
    const you = lb.find(e => e.isYou);
    expect(you).toBeDefined();
    expect(you!.name).toBe("Test User");
  });
});
