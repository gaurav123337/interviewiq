import { describe, expect, it } from "vitest";
import type { CareerGoal, SavedSession, SessionQuestion, SkillProfile } from "../types";
import { allocateWeeks, buildPhases, buildRoadmap, prioritize } from "../services/roadmap";
import { clearGoal, getProfile, saveProfile } from "../services/goal";

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const inWeeks = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n * 7);
  return fmt(d);
};

const goal = (patch: Partial<CareerGoal> = {}): CareerGoal => ({
  currentLevel: "mid", targetLevel: "senior", fieldId: "backend", companyId: "stripe",
  targetDate: inWeeks(8), hoursPerWeek: 5, createdAt: 1, ...patch
});

const Q = (kp: string[]): SessionQuestion => ({
  q: "q", a: "a", kp,
  cat: "field", catLabel: "Technical", catColor: "#000", level: "senior", src: "field"
});

const weakSession = (missed: string): SavedSession => ({
  id: "w1", date: Date.now(),
  meta: { field: "Backend Engineer", fieldId: "backend", company: "X", companyId: "general", level: "Senior", levelId: "senior", mode: "standard" },
  config: { count: 1, mode: "standard", timing: "none", voice: false },
  agg: { score: 1, pct: 0.2, grade: "D" },
  answers: [{ q: Q([missed]), user: "weak", score: 1, pct: 0.2, missed: [missed] }]
});

describe("buildPhases", () => {
  it("mid → senior includes foundations, field, company and behavioral", () => {
    const ids = buildPhases(goal()).map(p => p.id);
    expect(ids).toContain("foundations");
    expect(ids).toContain("field");
    expect(ids).toContain("company");
    expect(ids).toContain("behavioral");
    expect(ids).not.toContain("sysdesign");
  });

  it("staff+ targets add system design; cto/ceo add the exec phase", () => {
    expect(buildPhases(goal({ targetLevel: "staff" })).some(p => p.id === "sysdesign")).toBe(true);
    const cto = buildPhases(goal({ targetLevel: "cto" }));
    expect(cto.some(p => p.id === "exec")).toBe(true);
    expect(cto.some(p => p.id === "sysdesign")).toBe(true);
  });

  it("company phase is omitted for the general company", () => {
    expect(buildPhases(goal({ companyId: "general" })).some(p => p.id === "company")).toBe(false);
  });
});

describe("prioritize", () => {
  it("ranks unknown/weak skills P0 and self-rated strong skills P1", () => {
    const profile: SkillProfile = {
      goal: goal(),
      skills: [
        { skill: "Distributed systems", self: 2 },
        { skill: "Databases & caching", self: 5 }
      ]
    };
    const { topics } = prioritize(goal(), profile, []);
    const find = (label: string) => topics.find(t => t.label === label)!;
    expect(find("Distributed systems").priority).toBe("P0");
    expect(find("Databases & caching").priority).toBe("P1");
    expect(find("Distributed systems").progress).toBe("learning");
  });

  it("demotes skills the diagnostic measured ≥ 80% to P2/mastered", () => {
    const profile: SkillProfile = {
      goal: goal(),
      skills: [{ skill: "APIs & services", self: 2 }],
      diagnostic: { date: 1, level: "mid", pct: 0.8, perSkill: { "APIs & services": 0.9 } }
    };
    const { topics } = prioritize(goal(), profile, []);
    const t = topics.find(x => x.label === "APIs & services")!;
    expect(t.priority).toBe("P2");
    expect(t.progress).toBe("mastered");
    expect(t.statusNote).toContain("review only");
  });

  it("promotes recently-missed topics from session history", () => {
    const profile: SkillProfile = {
      goal: goal(),
      skills: [{ skill: "Distributed systems", self: 5 }]
    };
    const without = prioritize(goal(), profile, []).topics.find(t => t.label === "Distributed systems")!;
    expect(without.priority).toBe("P1");
    const withWeak = prioritize(goal(), profile, [weakSession("distributed shared counter store")])
      .topics.find(t => t.label === "Distributed systems")!;
    expect(withWeak.priority).toBe("P0");
    expect(withWeak.statusNote).toContain("Missed recently");
  });
});

describe("buildRoadmap", () => {
  it("produces the requested number of weeks with balanced topics", () => {
    const r = buildRoadmap(goal(), null, []);
    expect(r.weeks.length).toBe(8);
    expect(r.weeks.every(w => w.topics.length > 0)).toBe(true);
    expect(r.weeks[0].status).toBe("current");
    expect(r.weeks.every(w => w.totalHours === 5)).toBe(true);
    expect(r.source).toBe("self");
    expect(r.gapLevels).toBe(1); // mid → senior
    expect(r.summary).toContain("Senior");
  });

  it("uses the diagnostic level for the gap when available", () => {
    const profile: SkillProfile = {
      goal: goal(),
      skills: [{ skill: "APIs & services", self: 3 }],
      diagnostic: { date: 1, level: "junior", pct: 0.4, perSkill: {} }
    };
    const r = buildRoadmap(goal(), profile, []);
    expect(r.source).toBe("diagnostic");
    expect(r.measuredLevel).toBe("junior");
    expect(r.gapLevels).toBe(2); // junior → senior
  });

  it("clamps very long durations to 26 weeks", () => {
    const r = buildRoadmap(goal({ targetDate: inWeeks(200) }), null, []);
    expect(r.weeks.length).toBeLessThanOrEqual(26);
  });

  it("allocateWeeks never loses or gains weeks, for any phase mix", () => {
    const phases = buildPhases(goal({ targetLevel: "staff" })); // includes system design
    for (const total of [2, 3, 5, 8, 13, 26]) {
      const alloc = allocateWeeks(total, phases);
      expect(alloc.reduce((s, n) => s + n, 0), `total ${total}`).toBe(total);
      /* every phase gets a week whenever the total allows it */
      if (total >= phases.length) expect(alloc.every(n => n >= 1), `total ${total}`).toBe(true);
    }
  });

  it("a short duration still gives every phase at least one week", () => {
    const r = buildRoadmap(goal({ targetDate: inWeeks(2) }), null, []);
    expect(r.weeks.length).toBeGreaterThanOrEqual(buildPhases(goal({ targetLevel: "senior" })).length);
    expect(r.weeks.every(w => w.topics.length > 0)).toBe(true);
  });

  it("carries resources and practice questions on topics", () => {
    const r = buildRoadmap(goal(), null, []);
    const sysTopic = r.weeks.flatMap(w => w.topics).find(t => t.practice) ;
    const anyTopic = r.weeks.flatMap(w => w.topics)[0];
    expect(anyTopic.info.primer.length).toBeGreaterThan(10);
    expect(anyTopic.info.links.length).toBeGreaterThan(0);
    expect(sysTopic).toBeTruthy();
  });
});

describe("goal persistence", () => {
  it("round-trips through storage", () => {
    const g = goal();
    const p: SkillProfile = { goal: g, skills: [{ skill: "APIs & services", self: 3 }] };
    saveProfile(p);
    expect(getProfile()?.goal.fieldId).toBe("backend");
    clearGoal();
    expect(getProfile()).toBeNull();
  });
});
