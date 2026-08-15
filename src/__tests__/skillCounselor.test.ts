/* Skill Counselor engine corpus (docs/skill-counselor.md §8) — band mapping,
   gap analysis, level-up deltas and plan text against the curated catalog. */

import { describe, it, expect } from "vitest";
import { BAND_ORDER, FIELDS, SKILLS } from "../../src/data/skillCatalog";
import { bandForYears, build90DayPlan, buildPlan, gapAnalysis, levelUpDelta, suggestTrack } from "../../src/services/skillCounselor";

const profile = (years: number, skills: string[]) => ({ years, skills });

describe("bandForYears", () => {
  it("maps years to the seniority ladder", () => {
    expect(bandForYears(1)).toBe("junior");
    expect(bandForYears(3)).toBe("mid");
    expect(bandForYears(5)).toBe("senior");
    expect(bandForYears(8)).toBe("staff");
    expect(bandForYears(12)).toBe("principal");
  });
});

describe("gapAnalysis", () => {
  it("splits the path into owned and missing", () => {
    const g = gapAnalysis(profile(5, ["typescript", "react", "css"]), "frontend", "ui-engineer");
    expect(g).not.toBeNull();
    expect(g!.owned.map(s => s.id)).toEqual(expect.arrayContaining(["typescript", "react", "css"]));
    expect(g!.missing.map(s => s.id)).not.toContain("typescript");
    expect(g!.currentBand).toBe("senior");
    expect(g!.next).not.toBeNull();
    /* the first missing skill in path order is the next step */
    expect(g!.missing[0].id).toBe("html");
    expect(g!.next!.id).toBe("html");
  });

  it("returns null for an unknown track", () => {
    expect(gapAnalysis(profile(3, []), "frontend", "nope")).toBeNull();
  });

  it("a fresh junior profile has no foundation", () => {
    const g = gapAnalysis(profile(0, []), "frontend", "ui-engineer");
    expect(g!.foundation.length).toBe(0);
    expect(g!.next!.id).toBe("html");
  });
});

describe("levelUpDelta", () => {
  it("shows only the delta between current band and target", () => {
    const d = levelUpDelta(profile(1, ["html", "css"]), "frontend", "ui-engineer", "senior");
    expect(d).not.toBeNull();
    expect(d!.currentBand).toBe("junior");
    expect(d!.targetBand).toBe("senior");
    /* junior-band skills the user owns should not appear as new */
    expect(d!.newSkills.map(s => s.id)).not.toContain("html");
    expect(d!.newSkills.map(s => s.id)).not.toContain("css");
    /* staff+ skills are beyond the target → later */
    expect(d!.later.map(s => s.id)).toEqual(expect.arrayContaining(["systems-thinking"]));
    expect(d!.changes.length).toBeGreaterThan(0);
  });

  it("an already-at-target profile has an empty delta", () => {
    const d = levelUpDelta(profile(6, []), "frontend", "ui-engineer", "senior");
    expect(d!.newSkills.filter(s => BAND_ORDER[s.band] > BAND_ORDER.senior).length).toBe(0);
  });

  it("targets beyond the track max are trimmed by the UI, engine stays safe", () => {
    const d = levelUpDelta(profile(3, []), "backend", "api-engineer", "cto");
    expect(d).not.toBeNull();
  });
});

describe("buildPlan", () => {
  it("produces a digest-style plan", () => {
    const plan = buildPlan(profile(5, ["react", "typescript"]), "frontend", "react-specialist", "staff");
    expect(plan.length).toBeGreaterThanOrEqual(4);
    expect(plan[0]).toMatch(/Staff React Developer/);
    expect(plan.some(l => l.includes("Learn next"))).toBe(true);
    expect(plan.some(l => l.includes("To reach Staff"))).toBe(true);
  });

  it("returns empty for unknown tracks", () => {
    expect(buildPlan(profile(3, []), "frontend", "nope", "senior")).toEqual([]);
  });
});

describe("catalog integrity", () => {
  it("every track's skill ids exist in the shared pool", () => {
    for (const f of FIELDS) {
      for (const t of f.tracks) {
        for (const id of t.skillIds) expect(SKILLS[id], `${f.id}/${t.id} → ${id}`).toBeDefined();
      }
    }
  });

  it("ordered paths are band-ascending within each band group", () => {
    for (const f of FIELDS) {
      for (const t of f.tracks) {
        let last = -1;
        for (const id of t.skillIds) {
          const b = BAND_ORDER[SKILLS[id].band];
          expect(b, `${id} band ascends`).toBeGreaterThanOrEqual(last);
          last = b;
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Auto-track pick + 90-day plan                                       */
/* ------------------------------------------------------------------ */

describe("suggestTrack", () => {
  it("picks the track with the most owned-skill overlap", () => {
    const s = suggestTrack(profile(5, ["react", "typescript", "html", "css", "javascript", "git", "state-management", "performance-basics"]));
    expect(s.trackId).toBe("react-specialist");
    expect(s.owned).toBeGreaterThan(0);
    expect(s.reason).toMatch(/React Specialist/);
  });

  it("falls back to the first path when there is no profile", () => {
    const s = suggestTrack(null);
    expect(s.trackId).toBe("ui-engineer");
    expect(s.reason).toMatch(/No skill profile yet/);
  });
});

describe("build90DayPlan", () => {
  it("schedules the gap into ≤12 weekly milestones", () => {
    const p = build90DayPlan(profile(1, ["html", "css"]), "frontend", "ui-engineer", "senior", 4);
    expect(p).not.toBeNull();
    expect(p!.milestones.length).toBeGreaterThan(0);
    expect(p!.milestones.length).toBeLessThanOrEqual(12);
    expect(p!.milestones[0].week).toBe(1);
    expect(p!.totalHours).toBeGreaterThan(0);
  });

  it("respects availability (more hours/week → fewer weeks)", () => {
    const slow = build90DayPlan(profile(1, []), "frontend", "ui-engineer", "staff", 2)!;
    const fast = build90DayPlan(profile(1, []), "frontend", "ui-engineer", "staff", 8)!;
    expect(fast.milestones.length).toBeLessThanOrEqual(slow.milestones.length);
  });

  it("produces an empty (or null) plan when nothing is missing", () => {
    const p = build90DayPlan(profile(6, ["html", "css", "javascript", "typescript", "react", "state-management", "git", "http", "testing-basics", "performance-basics"]), "frontend", "react-specialist", "mid", 4);
    expect(p).not.toBeNull();
    expect(p!.totalHours).toBe(0);
  });

  it("path order is preserved across milestones (prereqs first)", () => {
    const p = build90DayPlan(profile(0, []), "frontend", "ui-engineer", "senior", 4)!;
    const flat = p.milestones.flatMap(m => m.skillIds);
    expect(flat[0]).toBe("html");
    expect(flat.indexOf("react")).toBeGreaterThan(flat.indexOf("javascript"));
  });
});
