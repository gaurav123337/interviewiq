// @vitest-environment jsdom
/* profileStore — the canonical profile aggregate (roadmap Item 11).

   Locks the invariants the whole unification rests on:
   1. Migration builds iq.profile from the legacy iq.skills / iq.goal /
      iq.career / iq.resume keys, LOSING NOTHING, then DELETES them — iq.profile
      is the single physical store as of PR6.
   2. The derived views reproduce the legacy shapes — toSkillProfile round-trips
      the roadmap SkillRating[] byte-exact (composite labels, self=2 default,
      measured 0..1 all verbatim); toCareerProfile keeps non-skill fields verbatim
      while DERIVING skills from the unified graph; toUploadedResume too.
   3. Migration is idempotent, and a pre-existing v2 aggregate is NEVER rebuilt
      from the (now-empty) legacy keys — a cloud-synced device must not be wiped.
   4. The goal double-store is reconciled to the copy that matches roadmap
      progress, so progress is never reset.
   5. The merge-writers are additive: they never overwrite a stronger self/
      measured signal and never drop career/resume-origin skills.
   6. clear*FromCanonical are graph teardowns: they strip one provenance source,
      keep nodes that other sources still reference, and drop source-only nodes. */

import { beforeEach, describe, expect, it } from "vitest";
import type { CareerGoal, CareerProfile, SkillProfile, UploadedResume } from "../types";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
import {
  buildCanonicalFromLegacy, getCanonicalProfile,
  toSkillProfile, toCareerProfile, toUploadedResume,
  ingestSkillProfile, ingestCareerProfile,
  clearRoadmapFromCanonical, clearResumeFromCanonical,
  type CanonicalProfile
} from "../services/profileStore";

const GOAL_A: CareerGoal = {
  currentLevel: "mid", targetLevel: "senior", fieldId: "frontend", companyId: "general",
  targetDate: "2026-12-01", hoursPerWeek: 6, createdAt: 1000
};
// same identity (fingerprint) but a newer copy — the double-store case.
const GOAL_A2: CareerGoal = { ...GOAL_A, createdAt: 2000, hoursPerWeek: 8 };
// a DIFFERENT goal identity (would reset progress if wrongly chosen).
const GOAL_B: CareerGoal = { ...GOAL_A, fieldId: "backend", createdAt: 3000 };

const skillProfile = (goal: CareerGoal): SkillProfile => ({
  goal,
  skills: [
    { skill: "React · Vue · Angular", self: 3, measured: 0.8 },
    { skill: "JavaScript / TypeScript", self: 2 },            // self=2 default, no measured
    { skill: "Node.js", self: 4, measured: 0.5 },
    { skill: "CI/CD", self: 1 }
  ],
  diagnostic: { date: 5000, level: "mid", pct: 0.7, perSkill: { "React · Vue · Angular": 0.8, "Node.js": 0.5 } },
  skippedAt: undefined
});

const careerProfile: CareerProfile = {
  headline: "Senior FE", years: 5, location: "Berlin", remote: true, workAuth: "EU",
  targetTitles: ["Senior Frontend Engineer"], skills: ["GraphQL", "Elasticsearch"],
  summary: "builds things", updatedAt: 4000
};

const uploadedResume: UploadedResume = {
  fileName: "cv.pdf", text: "…resume text…", extractedAt: 4500,
  profile: { ...careerProfile, skills: ["Docker", "Kubernetes"] }
};

/** Seed the legacy keys as if the app had been used pre-migration. */
function seedLegacy(opts: { embeddedGoal?: CareerGoal; standaloneGoal?: CareerGoal | null; progFp?: string } = {}) {
  const sp = skillProfile(opts.embeddedGoal ?? GOAL_A);
  storageSet(STORAGE_KEYS.skills, sp);
  if (opts.standaloneGoal !== null) storageSet(STORAGE_KEYS.goal, opts.standaloneGoal ?? GOAL_A);
  storageSet(STORAGE_KEYS.career, careerProfile);
  storageSet(STORAGE_KEYS.resume, uploadedResume);
  if (opts.progFp) storageSet(STORAGE_KEYS.roadmapProg, { fingerprint: opts.progFp, completed: [], completedAt: {}, updatedAt: 0 });
  return sp;
}

beforeEach(() => localStorage.clear());

describe("migration — builds iq.profile, RETIRES the legacy keys, loses nothing", () => {
  it("writes a v2 aggregate and deletes every legacy key (single physical store)", () => {
    seedLegacy();
    const p = getCanonicalProfile();
    expect(p.version).toBe(2);
    expect(storageGet(STORAGE_KEYS.profile, null)).not.toBeNull();
    // legacy keys migrated then DELETED — iq.profile is the one store now (PR6)
    expect(storageGet(STORAGE_KEYS.skills, null)).toBeNull();
    expect(storageGet(STORAGE_KEYS.goal, null)).toBeNull();
    expect(storageGet(STORAGE_KEYS.career, null)).toBeNull();
    expect(storageGet(STORAGE_KEYS.resume, null)).toBeNull();
  });

  it("no-loss: every skill from all three models appears in the unified graph", () => {
    seedLegacy();
    const slugs = Object.keys(getCanonicalProfile().skills);
    // roadmap atoms
    expect(slugs).toEqual(expect.arrayContaining(["react", "vue", "angular", "javascript", "typescript", "node", "ci-cd"]));
    // career skills
    expect(slugs).toEqual(expect.arrayContaining(["graphql", "elasticsearch"]));
    // resume skills
    expect(slugs).toEqual(expect.arrayContaining(["docker", "kubernetes"]));
  });

  it("cloud-safe: a pre-existing v2 aggregate is returned as-is, never rebuilt from empty legacy keys", () => {
    /* Models a device that pulled iq.profile via cloud sync: the aggregate is
       present and rich, but the legacy keys were never written (they're retired).
       getCanonicalProfile must NOT rebuild from the empty legacy keys, which
       would wipe the synced skills. */
    seedLegacy();
    const synced = getCanonicalProfile();               // migrate-and-delete → legacy gone
    expect(storageGet(STORAGE_KEYS.skills, null)).toBeNull();
    const again = getCanonicalProfile();
    expect(again).toEqual(synced);                       // unchanged, not rebuilt-from-empty
    expect(Object.keys(again.skills).length).toBeGreaterThan(0);
    expect(again.goal).not.toBeNull();
  });
});

describe("toSkillProfile — byte-exact roadmap round-trip", () => {
  it("reproduces the original SkillProfile (composite labels, self=2, measured 0..1)", () => {
    const sp = seedLegacy({ progFp: `${GOAL_A.currentLevel}|${GOAL_A.targetLevel}|${GOAL_A.fieldId}|${GOAL_A.companyId}` });
    const view = toSkillProfile(getCanonicalProfile());
    expect(view).toEqual(sp);
    // the verbatim composite labels survived
    expect(view!.skills.map(s => s.skill)).toEqual([
      "React · Vue · Angular", "JavaScript / TypeScript", "Node.js", "CI/CD"
    ]);
    expect(view!.skills[1]).toEqual({ skill: "JavaScript / TypeScript", self: 2 });
    expect(view!.skills[0].measured).toBe(0.8);
  });

  it("returns null when no SkillProfile ever existed", () => {
    storageSet(STORAGE_KEYS.goal, GOAL_A); // goal only, no iq.skills
    expect(toSkillProfile(getCanonicalProfile())).toBeNull();
  });
});

describe("toCareerProfile — non-skill fields verbatim, skills derived", () => {
  it("keeps the career fields and derives skills from the graph", () => {
    seedLegacy();
    const cp = toCareerProfile(getCanonicalProfile());
    expect(cp.headline).toBe("Senior FE");
    expect(cp.years).toBe(5);
    expect(cp.location).toBe("Berlin");
    expect(cp.targetTitles).toEqual(["Senior Frontend Engineer"]);
    // updatedAt is verbatim from the career record (4000), NOT the aggregate
    // max (which is 5000 here via the diagnostic date) — matches getCareerProfile().
    expect(cp.updatedAt).toBe(4000);
    expect(getCanonicalProfile().updatedAt).toBe(5000);
    // career + resume claimed skills always surface (display names)
    expect(cp.skills).toEqual(expect.arrayContaining(["GraphQL", "Elasticsearch", "Docker", "Kubernetes"]));
    // Roadmap-origin skills obey the preserved (measured ?? self) >= 2 quirk:
    // JavaScript/TypeScript (self 2, no measured) qualify…
    expect(cp.skills).toEqual(expect.arrayContaining(["JavaScript", "TypeScript"]));
    // …but React (measured 0.8) and Node.js (measured 0.5) do NOT — measured is
    // 0..1 so it never clears the >=2 bar (verbatim legacy quirk), and CI/CD
    // (self 1) is below the bar too.
    expect(cp.skills).not.toContain("React");
    expect(cp.skills).not.toContain("Node.js");
    expect(cp.skills).not.toContain("CI/CD");
  });
});

describe("toUploadedResume — payload verbatim, profile derived", () => {
  it("keeps fileName/text/extractedAt and nests the derived career profile", () => {
    seedLegacy();
    const p = getCanonicalProfile();
    const r = toUploadedResume(p);
    expect(r!.fileName).toBe("cv.pdf");
    expect(r!.text).toBe("…resume text…");
    expect(r!.extractedAt).toBe(4500);
    expect(r!.profile).toEqual(toCareerProfile(p));
  });

  it("returns null when no resume was uploaded", () => {
    storageSet(STORAGE_KEYS.skills, skillProfile(GOAL_A));
    expect(toUploadedResume(getCanonicalProfile())).toBeNull();
  });
});

describe("idempotency — pure over storage state", () => {
  it("buildCanonicalFromLegacy run twice is identical", () => {
    seedLegacy();
    expect(buildCanonicalFromLegacy()).toEqual(buildCanonicalFromLegacy());
  });

  it("getCanonicalProfile does not re-migrate on the second call", () => {
    seedLegacy();
    const first = getCanonicalProfile();
    // mutate a legacy key AFTER migration — the stored v2 aggregate must win.
    storageSet(STORAGE_KEYS.career, { ...careerProfile, headline: "CHANGED" });
    const second = getCanonicalProfile();
    expect(second).toEqual(first);
    expect(second.headline).toBe("Senior FE");
  });
});

describe("goal reconciliation — never resets roadmap progress", () => {
  it("prefers the copy whose fingerprint matches roadmap progress", () => {
    // embedded goal is GOAL_B (backend), standalone is GOAL_A (frontend);
    // progress fingerprint matches GOAL_A → the standalone must win.
    const fpA = `${GOAL_A.currentLevel}|${GOAL_A.targetLevel}|${GOAL_A.fieldId}|${GOAL_A.companyId}`;
    seedLegacy({ embeddedGoal: GOAL_B, standaloneGoal: GOAL_A, progFp: fpA });
    expect(getCanonicalProfile().goal).toEqual(GOAL_A);
  });

  it("falls back to the newer createdAt when neither matches progress", () => {
    seedLegacy({ embeddedGoal: GOAL_A, standaloneGoal: GOAL_A2 }); // same fp, no prog
    expect(getCanonicalProfile().goal!.createdAt).toBe(2000);
  });
});

describe("merge-writers — additive, non-clobbering", () => {
  it("ingestSkillProfile updates roadmapSkills verbatim and folds atoms", () => {
    seedLegacy();
    getCanonicalProfile();
    const next = skillProfile(GOAL_A);
    next.skills = [{ skill: "Rust", self: 5 }];
    ingestSkillProfile(next);
    const p: CanonicalProfile = storageGet(STORAGE_KEYS.profile, null)!;
    expect(p.roadmapSkills).toEqual([{ skill: "Rust", self: 5 }]);
    expect(Object.keys(p.skills)).toContain("rust");
    // career/resume-origin skills are NOT dropped by a roadmap save.
    expect(Object.keys(p.skills)).toEqual(expect.arrayContaining(["graphql", "docker"]));
  });

  it("never overwrites a stronger self/measured signal", () => {
    seedLegacy();
    getCanonicalProfile();
    // "node" already has self 4, measured 0.5. Re-ingest with weaker numbers.
    ingestSkillProfile({ goal: GOAL_A, skills: [{ skill: "Node.js", self: 1, measured: 0.1 }] });
    const p: CanonicalProfile = storageGet(STORAGE_KEYS.profile, null)!;
    expect(p.skills["node"].self).toBe(4);
    expect(p.skills["node"].measured).toBe(0.5);
  });

  it("ingestCareerProfile folds new claimed skills without losing roadmap atoms", () => {
    seedLegacy();
    getCanonicalProfile();
    ingestCareerProfile({ ...careerProfile, skills: ["Terraform"] });
    const p: CanonicalProfile = storageGet(STORAGE_KEYS.profile, null)!;
    // Terraform aliases to ci-cd in the vocab; roadmap atoms remain.
    expect(Object.keys(p.skills)).toEqual(expect.arrayContaining(["ci-cd", "react", "graphql"]));
  });
});

describe("clear*FromCanonical — provenance-aware graph teardowns (PR6)", () => {
  it("clearRoadmapFromCanonical strips roadmap-only nodes, keeps shared/claimed ones, clears the goal", () => {
    seedLegacy();
    getCanonicalProfile();                                  // migrate-and-delete
    // make "react" a SHARED node (roadmap + manual): claim it on the career side.
    ingestCareerProfile({ ...careerProfile, skills: ["React"] });
    const before = getCanonicalProfile();
    expect(before.skills["react"].sources).toEqual(expect.arrayContaining(["roadmap", "manual"]));

    const after = clearRoadmapFromCanonical();

    // roadmap-only atoms disappear …
    for (const slug of ["vue", "angular", "javascript", "typescript", "node", "ci-cd"]) {
      expect(after.skills[slug]).toBeUndefined();
    }
    // … the shared node survives, minus its roadmap-only self/measured …
    expect(after.skills["react"]).toBeDefined();
    expect(after.skills["react"].sources).toEqual(["manual"]);
    expect(after.skills["react"].self).toBeUndefined();
    expect(after.skills["react"].measured).toBeUndefined();
    // … career/resume nodes are untouched …
    expect(Object.keys(after.skills)).toEqual(expect.arrayContaining(["graphql", "elasticsearch", "docker", "kubernetes"]));
    // … the roadmap view collapses to null, the goal and ratings are gone …
    expect(after.goal).toBeNull();
    expect(after.roadmapSkills).toEqual([]);
    expect(after.diagnostic).toBeUndefined();
    expect(toSkillProfile(after)).toBeNull();
    // … but the career profile still exists with its claimed skills.
    expect(toCareerProfile(after).skills).toEqual(expect.arrayContaining(["React", "GraphQL", "Docker"]));
    // the teardown restamps (LWW: a stale remote copy can't resurrect it).
    expect(after.updatedAt).toBeGreaterThan(0);
  });

  it("clearResumeFromCanonical strips resume-only nodes and the resume payload, keeps the rest", () => {
    seedLegacy();
    getCanonicalProfile();
    const after = clearResumeFromCanonical();
    // resume-only atoms gone; resume view null …
    expect(after.skills["docker"]).toBeUndefined();
    expect(after.skills["kubernetes"]).toBeUndefined();
    expect(after.resume).toBeUndefined();
    expect(toUploadedResume(after)).toBeNull();
    // … roadmap + career nodes survive; the roadmap view still round-trips.
    expect(Object.keys(after.skills)).toEqual(expect.arrayContaining(["react", "node", "graphql", "elasticsearch"]));
    expect(toSkillProfile(after)).not.toBeNull();
  });
});
