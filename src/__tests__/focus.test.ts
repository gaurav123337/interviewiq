// @vitest-environment jsdom
/* Personalized focus + remote frequency override + session-heat tests. */

import { describe, expect, it, beforeEach } from "vitest";
import { CODING_PROBLEMS } from "../data/coding";
import { companyFrequency, focusSignals, freqForProblem, hasPersonalSignals, personalFocusForCompany, personalPlan, qaCategoryHeat } from "../data/codingCompanies";
import { STORAGE_KEYS, storageRemove, storageSet } from "../services/storage";

beforeEach(() => {
  storageRemove(STORAGE_KEYS.codingTrack);
  storageRemove(STORAGE_KEYS.skills);
  storageRemove(STORAGE_KEYS.remoteConfig);
});

describe("remote frequency overrides", () => {
  it("admin-published companyFreq overrides the baked-in table", () => {
    /* baked-in two-sum@google = 3 */
    expect(freqForProblem("google", "two-sum")).toBe(3);
    storageSet(STORAGE_KEYS.remoteConfig, { companyFreq: { google: { "two-sum": 1 } } });
    expect(freqForProblem("google", "two-sum")).toBe(1);
    /* untouched entries still resolve from the baked-in table */
    expect(freqForProblem("google", "fn-debounce")).toBe(3);
  });

  it("a partial override does not leak to other companies", () => {
    storageSet(STORAGE_KEYS.remoteConfig, { companyFreq: { meta: { "two-sum": 1 } } });
    expect(freqForProblem("google", "two-sum")).toBe(3);
  });
});

describe("focusSignals", () => {
  it("reads playground misses per problem", () => {
    storageSet(STORAGE_KEYS.codingTrack, { "fn-range": { fails: 2, solved: false } });
    expect(focusSignals(CODING_PROBLEMS.find(p => p.id === "fn-range")!).misses).toBe(2);
    expect(focusSignals(CODING_PROBLEMS.find(p => p.id === "two-sum")!).misses).toBe(0);
  });

  it("flags a problem when a weak skill maps to its topic", () => {
    storageSet(STORAGE_KEYS.skills, { skills: [{ skill: "Data Structures", self: 1 }] });
    /* two-sum lives in "Arrays & hashing", matched by the data-structures hint */
    expect(focusSignals(CODING_PROBLEMS.find(p => p.id === "two-sum")!).weakSkill).toBe(true);
    /* a classes problem is outside the data-structures hints and stays unflagged */
    const classes = CODING_PROBLEMS.find(p => p.kind === "fn" && p.category === "classes")!;
    expect(focusSignals(classes).weakSkill).toBe(false);
  });

  it("no profile and no track means no signals", () => {
    expect(focusSignals(CODING_PROBLEMS.find(p => p.id === "two-sum")!)).toEqual({ misses: 0, weakSkill: false });
    expect(hasPersonalSignals()).toBe(false);
  });

  it("hasPersonalSignals flips once a problem was missed", () => {
    expect(hasPersonalSignals()).toBe(false);
    storageSet(STORAGE_KEYS.codingTrack, { "two-sum": { fails: 1, solved: false } });
    expect(hasPersonalSignals()).toBe(true);
  });
});

describe("personalized focus", () => {
  it("misses lift a niche problem above an equally-rated one", () => {
    storageSet(STORAGE_KEYS.codingTrack, { "fn-range": { fails: 2, solved: false } });
    const ranked = personalFocusForCompany("google");
    const range = ranked.find(r => r.problem.id === "fn-range")!;
    const uniq = ranked.find(r => r.problem.id === "fn-uniq")!;
    expect(range.misses).toBe(2);
    expect(range.score).toBeGreaterThan(uniq.score);
    expect(ranked.indexOf(range)).toBeLessThan(ranked.indexOf(uniq));
  });

  it("company heat still dominates — a very-common problem outranks a missed niche one", () => {
    storageSet(STORAGE_KEYS.codingTrack, { "fn-range": { fails: 2, solved: false } });
    const ranked = personalFocusForCompany("google");
    /* freq-3 problems all score 9; the missed freq-1 problem scores 5 */
    const top = ranked.filter(r => r.freq === 3);
    expect(top.length).toBeGreaterThanOrEqual(2);
    expect(ranked[0].freq).toBe(3);
    const range = ranked.find(r => r.problem.id === "fn-range")!;
    expect(range.score).toBe(5);
    /* the missed niche problem still ranks below every very-common problem */
    expect(ranked.indexOf(range)).toBeGreaterThan(ranked.indexOf(top[0]));
  });

  it("personalPlan returns at most one pick per difficulty", () => {
    storageSet(STORAGE_KEYS.codingTrack, { "fn-range": { fails: 2, solved: false } });
    const plan = personalPlan("google");
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan.length).toBeLessThanOrEqual(3);
    const diffs = plan.map(r => r.problem.difficulty);
    expect(new Set(diffs).size).toBe(diffs.length);
    expect(plan.every(r => r.problem.kind === "cli" || r.problem.kind === "fn")).toBe(true);
  });

  it("is deterministic for identical state", () => {
    const a = personalFocusForCompany("meta").map(r => r.problem.id);
    const b = personalFocusForCompany("meta").map(r => r.problem.id);
    expect(a).toEqual(b);
  });
});

describe("session question heat", () => {
  it("Technical questions carry the company's overall heat", () => {
    const f = companyFrequency("google");
    const h = qaCategoryHeat("Technical", "google");
    expect(h?.heat).toBe(f.heat);
    expect(h?.focus).toBe(f.byTopic[0]?.topic);
  });

  it("System Design carries the company's hottest topic", () => {
    const f = companyFrequency("google");
    const h = qaCategoryHeat("System Design", "google");
    expect(h?.heat).toBe(f.byTopic[0]?.heat);
    expect(h?.focus).toBe(f.byTopic[0]?.topic);
  });

  it("unweighted categories and sentinel companies yield nothing", () => {
    expect(qaCategoryHeat("Behavioral", "google")).toBeNull();
    expect(qaCategoryHeat("Leadership", "google")).toBeNull();
    expect(qaCategoryHeat("Technical", "general")).toBeNull();
    expect(qaCategoryHeat("Technical", null)).toBeNull();
    expect(qaCategoryHeat("Technical", "bank")).toBeNull();
  });
});
