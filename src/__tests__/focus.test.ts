// @vitest-environment jsdom
/* Personalized focus + remote frequency override + session-heat tests. */

import { describe, expect, it, beforeEach } from "vitest";
import { CODING_PROBLEMS } from "../data/coding";
import { coachDiscussionTopics, companyFrequency, focusSignals, freqForProblem, hasPersonalSignals, missedSessionTopics, personalFocusForCompany, personalPlan, qaCategoryHeat, suggestNextProblem } from "../data/codingCompanies";
import { codingDrillCards } from "../services/codingTrack";
import { citationSourceLabel, coachWeekStats, getCoachDiscussions, localCoachReply, saveCoachDiscussion } from "../components/CoachChat";
import { STORAGE_KEYS, storageRemove, storageSet } from "../services/storage";

const sessionWithMissed = (missed: string[]) => ({
  meta: { field: "Frontend Engineer", fieldId: "frontend", company: "Google", companyId: "google", level: "Mid-Level", levelId: "mid", mode: "standard" },
  answers: [{ q: { q: "Explain closures", a: "…", kp: ["lexical scope"], cat: "field", catLabel: "Technical", catColor: "#22d3ee", level: "mid", src: "field" }, user: "…", score: 1, pct: 20, missed }]
});

beforeEach(() => {
  storageRemove(STORAGE_KEYS.codingTrack);
  storageRemove(STORAGE_KEYS.skills);
  /* getProfile() now derives from the canonical aggregate (Item 11 PR6); clear it
     too, else a v2 profile written by one test's migration short-circuits the
     re-seeded iq.skills in the next. */
  storageRemove(STORAGE_KEYS.profile);
  storageRemove(STORAGE_KEYS.remoteConfig);
  storageRemove(STORAGE_KEYS.sessions);
  storageRemove(STORAGE_KEYS.coachTopics);
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
    /* getProfile() is a derived view now (Item 11 PR6): toSkillProfile returns
       null without a goal, so the fixture carries one. */
    storageSet(STORAGE_KEYS.skills, { goal: { currentLevel: "mid", targetLevel: "senior", fieldId: "frontend", companyId: "general", targetDate: "2026-12-01", hoursPerWeek: 6, createdAt: 1 }, skills: [{ skill: "Data Structures", self: 1 }] });
    /* two-sum lives in "Arrays & hashing", matched by the data-structures hint */
    expect(focusSignals(CODING_PROBLEMS.find(p => p.id === "two-sum")!).weakSkill).toBe(true);
    /* a classes problem is outside the data-structures hints and stays unflagged */
    const classes = CODING_PROBLEMS.find(p => p.kind === "fn" && p.category === "classes")!;
    expect(focusSignals(classes).weakSkill).toBe(false);
  });

  it("no profile and no track means no signals", () => {
    expect(focusSignals(CODING_PROBLEMS.find(p => p.id === "two-sum")!)).toEqual({ misses: 0, weakSkill: false, weakSrc: null });
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

describe("learning from session answers", () => {
  it("missed key points map to coding topics", () => {
    expect(missedSessionTopics().size).toBe(0);
    storageSet(STORAGE_KEYS.sessions, [sessionWithMissed(["time complexity", "edge cases"])]);
    const topics = missedSessionTopics();
    expect(topics.has("Arrays & hashing")).toBe(true);
    expect(topics.has("Search & sorting")).toBe(true);
    expect(topics.has("Language basics")).toBe(true);
  });

  it("a missed session key point flags problems in the matching topic as a session signal", () => {
    storageSet(STORAGE_KEYS.sessions, [sessionWithMissed(["time complexity"])]);
    const sig = focusSignals(CODING_PROBLEMS.find(p => p.id === "two-sum")!);
    expect(sig.weakSkill).toBe(true);
    expect(sig.weakSrc).toBe("session");
    expect(hasPersonalSignals()).toBe(true);
  });

  it("coding drill cards carry their problem id for company heat", () => {
    storageSet(STORAGE_KEYS.codingTrack, { "fn-range": { fails: 2, solved: false } });
    const cards = codingDrillCards();
    expect(cards[0].codeId).toBe("fn-range");
  });
});

describe("coach discussions feed the weakness profile", () => {
  it("saved discussions derive the same topics as missed key points", () => {
    expect(coachDiscussionTopics().size).toBe(0);
    saveCoachDiscussion({ prompt: "Two Sum", mode: "local", text: "We debated time complexity and edge cases for the two-sum solution" });
    const topics = coachDiscussionTopics();
    expect(topics.has("Arrays & hashing")).toBe(true);
    expect(topics.has("Search & sorting")).toBe(true);
  });

  it("a coach discussion flags matching problems with weakSrc 'coach'", () => {
    saveCoachDiscussion({ prompt: "Two Sum", mode: "local", text: "I keep missing time complexity analysis" });
    const sig = focusSignals(CODING_PROBLEMS.find(p => p.id === "two-sum")!);
    expect(sig.weakSkill).toBe(true);
    expect(sig.weakSrc).toBe("coach");
    expect(hasPersonalSignals()).toBe(true);
  });

  it("save dedupes identical discussions and keeps prompt + mode for history", () => {
    const text = "debate about memoization and caching";
    expect(saveCoachDiscussion({ prompt: "Memoize", mode: "api", text })).toBe(true);
    expect(saveCoachDiscussion({ prompt: "Memoize", mode: "api", text })).toBe(true);
    expect(getCoachDiscussions().length).toBe(1);
    expect(getCoachDiscussions()[0].prompt).toBe("Memoize");
    expect(getCoachDiscussions()[0].mode).toBe("api");
    for (let i = 0; i < 60; i++) saveCoachDiscussion({ prompt: "P" + i, mode: "local", text: "discussion number " + i + " about async performance" });
    expect(getCoachDiscussions().length).toBeLessThanOrEqual(50);
  });

  it("suggestNextProblem ranks a problem in the discussed topic first, unsolved preferred", () => {
    storageSet(STORAGE_KEYS.codingTrack, { "fn-range": { fails: 0, solved: true } });
    const p = suggestNextProblem("google", "we debated time complexity and hash maps for this approach");
    expect(p).not.toBeNull();
    /* two-sum: Arrays & hashing, company heat 3, unsolved → top scorer */
    expect(p!.id).toBe("two-sum");
    expect(suggestNextProblem("google", "hi there")).toBeNull();
  });
});

describe("citation source labels", () => {
  it("distinguishes semantic (vector) from keyless (lexical) grounding", () => {
    expect(citationSourceLabel(1, "vector")).toContain("semantic");
    expect(citationSourceLabel(2, "lexical")).toContain("term match (no key)");
    expect(citationSourceLabel(3)).toContain("3 sources");
    expect(citationSourceLabel(3)).not.toContain("term match");
  });
});

describe("coach week stats", () => {
  const WEEK = 7 * 86_400_000;
  const now = Date.now();

  it("counts discussions this week and derives topics", () => {
    const s = coachWeekStats([
      { at: now, text: "we debated time complexity" },
      { at: now - 60_000, text: "edge cases again" }
    ]);
    expect(s.thisWeek).toBe(2);
    expect(s.topics).toBeGreaterThan(0);
    expect(s.cur).toBe(1);
  });

  it("a streak of consecutive weeks counts back from this week", () => {
    const s = coachWeekStats([
      { at: now, text: "one" },
      { at: now - WEEK, text: "two" },
      { at: now - 2 * WEEK, text: "three" }
    ]);
    expect(s.cur).toBe(3);
    expect(s.longest).toBe(3);
  });

  it("a gap breaks the current streak but longest survives", () => {
    const s = coachWeekStats([
      { at: now, text: "one" },
      { at: now - 3 * WEEK, text: "old" },
      { at: now - 4 * WEEK, text: "older" }
    ]);
    expect(s.cur).toBe(1);
    expect(s.longest).toBe(2);
  });

  it("no recent activity means no current streak", () => {
    const s = coachWeekStats([{ at: now - 5 * WEEK, text: "old" }]);
    expect(s.cur).toBe(0);
    expect(s.longest).toBe(1);
  });
});

describe("local coach replies", () => {
  const ctx = {
    prompt: "Explain how closures work in JavaScript.",
    answer: "A closure is a function that remembers its lexical scope even when executed outside it.",
    kp: ["lexical scope", "state preservation", "memory implications"],
    fieldId: "frontend",
    levelId: "mid" as const
  };

  it("hint requests surface the key points as a checklist", () => {
    const r = localCoachReply("I'm stuck, give me a hint", ctx);
    expect(r).toContain("lexical scope");
    expect(r).toContain("state preservation");
    expect(r).toContain("memory implications");
  });

  it("sharing an approach highlights what's missing", () => {
    const r = localCoachReply("I would just return the inner function", ctx);
    expect(r).toContain("Don't miss");
    expect(r).toContain("lexical scope");
  });

  it("debating gets the model answer's position", () => {
    const r = localCoachReply("I disagree, closures are about hoisting", ctx);
    expect(r).toContain("model answer's position");
    expect(r).toContain("lexical scope");
  });

  it("generic messages fall back to an invitation + reference outline", () => {
    const r = localCoachReply("hello", ctx);
    expect(r).toContain("Tell me your approach");
    expect(r).toContain("closure");
  });

  it("an approach phrased as 'I'll use X' is detected and stress-tested, not dismissed", () => {
    const r = localCoachReply("I'll use a router library to handle it", ctx);
    expect(r).toContain("thinking about");
    expect(r).toContain("Don't miss: lexical scope");
    expect(r).not.toContain("Tell me your approach");
  });

  it("any substantive message is investigated even without approach keywords", () => {
    const r = localCoachReply("caching responses would speed up the whole system", ctx);
    expect(r).toContain("thinking about");
    expect(r).toContain("Don't miss");
  });

  it("retrieves related practice from the deep-dive knowledge base even without a field", () => {
    const r = localCoachReply("how does debounce actually work", { prompt: ctx.prompt, answer: ctx.answer, kp: ctx.kp, fieldId: null, levelId: null });
    expect(r).toContain("Related practice");
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
