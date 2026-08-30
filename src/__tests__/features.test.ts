import { describe, expect, it, vi } from "vitest";
import { analyzeJd } from "../services/jd";
import { buildJdSession, buildWeakTopicSession } from "../services/session";
import { composeRelevantSession, composeSession, pickRelevant, verdict } from "../engine";
import { getSrs, isDue, learnedCount, makeDeck, rate, resetSrs } from "../services/drill";
import { aiCallsLeft, recordAiCall, recordSession, sessionsLeft, setTier } from "../services/entitlements";
import type { Config } from "../types";

/* entitlements.getTier() treats Pro as an ACCOUNT property: it honors a stored
   "pro" tier only for a signed-in user (a guest's forgeable local tier is
   ignored and fails closed to "free"). The dormant-paywall test below sets tier
   "pro" and expects unlimited quota, so stub the cloud session as signed-in.
   entitlements is the only module in this file's graph that imports cloud, and
   it only calls getCloudState — the rest are harmless stubs. */
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  getSupabaseClient: () => Promise.resolve(null),
  isCloudConfigured: () => false,
}));

const CFG: Config = { count: 8, mode: "standard", timing: "none", voice: false };

describe("job-description analysis", () => {
  it("detects level, field, company and keywords from a real JD", () => {
    const r = analyzeJd(
      "Senior Backend Engineer at Stripe. We use Go, PostgreSQL, Kubernetes and AWS. 5+ years experience building distributed systems. Lead design of microservices and APIs with strong reliability and performance requirements."
    );
    expect(r.levelId).toBe("senior");
    expect(r.fieldId).toBe("backend");
    expect(r.companyId).toBe("stripe");
    expect(r.keywords.length).toBeGreaterThan(5);
  });

  it("detects executive and principal levels", () => {
    expect(analyzeJd("We are hiring a Chief Technology Officer who owns engineering strategy across the platform.").levelId).toBe("cto");
    expect(analyzeJd("Principal Engineer, platform infrastructure, leading org-wide reliability.").levelId).toBe("principal");
    expect(analyzeJd("The CEO of our startup is looking for a technical co-founder.").levelId).toBe("ceo");
  });

  it("defaults sensibly when nothing matches", () => {
    const r = analyzeJd("We are looking for a nice person to join our team and help us with stuff.");
    expect(r.levelId).toBe("mid");
    expect(r.companyId).toBeNull();
    expect(r.keywords.length).toBeGreaterThan(0);
  });
});

describe("relevance picking", () => {
  const qs = [
    { q: "Explain database indexing and when it helps.", a: "Indexes speed lookups but slow writes.", kp: ["B-tree", "write amplification", "explain plans"] },
    { q: "Tell me about yourself and your experience.", a: "I have built web apps.", kp: ["experience", "projects"] }
  ];

  it("ranks keyword-matching questions first", () => {
    const picked = pickRelevant(qs, ["database", "index"], 1);
    expect(picked[0].q).toContain("indexing");
  });

  it("falls back to random selection without keywords", () => {
    const picked = pickRelevant(qs, [], 1);
    expect(picked).toHaveLength(1);
  });
});

describe("keyword-driven sessions", () => {
  it("composes a relevant session with correct meta", () => {
    const s = composeRelevantSession({ fieldId: "backend", companyId: "stripe", levelId: "senior", keywords: ["postgresql", "distributed", "microservices"], count: 8 });
    expect(s.questions.length).toBeGreaterThanOrEqual(5);
    expect(s.meta.levelId).toBe("senior");
    expect(s.meta.company).toBe("Stripe");
  });

  it("builds a JD-tailored session from analysis", () => {
    const jd = analyzeJd("Senior Frontend Engineer at Netflix. React, TypeScript, web performance, accessibility, 6+ years.");
    const s = buildJdSession(jd, CFG);
    expect(s.questions.length).toBeGreaterThanOrEqual(5);
    expect(s.meta.fieldId).toBe("frontend");
    expect(s.meta.company).toBe("Netflix");
  });

  it("preserves mock mode through the JD path", () => {
    const jd = analyzeJd("Staff Backend Engineer at Stripe. Distributed systems, PostgreSQL, Kafka, 8+ years.");
    const s = buildJdSession(jd, { ...CFG, mode: "mock" });
    expect(s.meta.mode).toBe("mock");
  });

  it("builds a weak-topic follow-up session tagged as such", () => {
    const s = buildWeakTopicSession("backend", "senior", ["indexing", "connection pool", "cache"], { ...CFG, count: 6 });
    expect(s.meta.company).toBe("Weak Topics");
    expect(s.meta.companyId).toBe("weak");
    expect(s.questions.length).toBeGreaterThanOrEqual(5);
  });
});

describe("mock-interview mode", () => {
  it("composes a longer session and tags meta as mock", () => {
    const s = composeSession({ fieldId: "frontend", companyId: "google", levelId: "senior", count: 10, mode: "mock" });
    expect(s.questions.length).toBeGreaterThanOrEqual(8);
    expect(s.meta.mode).toBe("mock");
  });

  it("produces hire / lean-hire / no-hire verdicts by score", () => {
    expect(verdict({ score: 4.5, pct: 0.9, grade: "A", cats: [] }).label).toBe("HIRE");
    expect(verdict({ score: 3.2, pct: 0.64, grade: "C", cats: [] }).label).toBe("LEAN HIRE");
    expect(verdict({ score: 1.8, pct: 0.36, grade: "F", cats: [] }).label).toBe("NO HIRE");
  });
});

describe("drill spaced repetition", () => {
  it("schedules cards by rating and excludes future-due cards from decks", () => {
    resetSrs();
    const t0 = Date.now();
    const deck = makeDeck("frontend", "all", 5);
    expect(deck.length).toBeGreaterThan(0);
    const q = deck[0].q;

    rate(q, "good", t0);
    expect(isDue(q, getSrs(), t0 + 1000)).toBe(false);
    expect(getSrs()[q].due).toBe(t0 + DAY_LONG); /* first "good" schedules +1 day */

    const deck2 = makeDeck("frontend", "all", 50);
    expect(deck2.some(c => c.q === q)).toBe(false);
  });

  it("keeps 'again' cards due almost immediately", () => {
    resetSrs();
    const t0 = Date.now();
    rate("q1", "again", t0);
    const srs = getSrs();
    expect(isDue("q1", srs, t0 + 30_000)).toBe(false); /* due at +1min */
    expect(isDue("q1", srs, t0 + 61_000)).toBe(true);
  });

  it("counts cards as learned after repeated good ratings", () => {
    resetSrs();
    const t0 = Date.now();
    rate("q2", "good", t0);
    rate("q2", "good", t0 + 1000);
    rate("q2", "good", t0 + 2000);
    expect(learnedCount(getSrs())).toBe(1);
    resetSrs();
  });
});

describe("entitlements (dormant paywall)", () => {
  it("meters sessions and AI calls with monthly/daily rollover", () => {
    setTier("free");
    recordSession();
    recordSession();
    expect(sessionsLeft()).toBe(1); /* 3 per month limit */
    recordAiCall();
    recordAiCall();
    recordAiCall();
    recordAiCall();
    recordAiCall();
    expect(aiCallsLeft()).toBe(0); /* 5 per day limit */
    setTier("pro");
    expect(sessionsLeft()).toBe(Infinity);
    expect(aiCallsLeft()).toBe(Infinity);
    setTier("free");
  });
});

const DAY_LONG = 86_400_000;
