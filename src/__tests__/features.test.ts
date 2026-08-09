import { describe, expect, it } from "vitest";
import { analyzeJd } from "../services/jd";
import { buildJdSession, buildWeakTopicSession } from "../services/session";
import { composeRelevantSession, pickRelevant } from "../engine";
import { getLearned, makeDeck, markLearned, resetLearned } from "../services/drill";
import type { Config } from "../types";

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

  it("builds a weak-topic follow-up session tagged as such", () => {
    const s = buildWeakTopicSession("backend", "senior", ["indexing", "connection pool", "cache"], { ...CFG, count: 6 });
    expect(s.meta.company).toBe("Weak Topics");
    expect(s.meta.companyId).toBe("weak");
    expect(s.questions.length).toBeGreaterThanOrEqual(5);
  });
});

describe("drill decks", () => {
  it("builds a deck and persists learned questions", () => {
    resetLearned();
    const deck = makeDeck("frontend", "all", new Set(), 5);
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.length).toBeLessThanOrEqual(5);
    const first = deck[0].q;
    markLearned(first);
    expect(getLearned().has(first)).toBe(true);
    const deck2 = makeDeck("frontend", "all", getLearned(), 5);
    expect(deck2.some(c => c.q === first)).toBe(false);
    resetLearned();
  });

  it("honors the level filter", () => {
    resetLearned();
    const deck = makeDeck("frontend", "junior", new Set(), 50);
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every(c => c.lvl === "junior")).toBe(true);
  });
});
