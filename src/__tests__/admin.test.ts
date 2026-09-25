// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/* events.ts flushes to Supabase — stub the client so tests stay offline */
vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn().mockResolvedValue(null)
}));

import {
  BASE_LIMITS, aiEnabled, featureOn, getLimits, paywallOn, publishedFor,
  setAnnouncements, setPublishedQuestions, setRemoteConfig, markAnnouncementSeen, nextUnseenAnnouncement
} from "../services/remoteConfig";
import { addedLabel, adminSkillChips, bankItems, bankSkillChips, matchesAnySkill, matchesSkill, publishedMatchesSkill } from "../engine/bank";
import { statusFilterPasses } from "../services/admin/questions";
import type { QA } from "../types";
import { queueEvent } from "../services/events";
import { STORAGE_KEYS, storageGet } from "../services/storage";

beforeEach(() => {
  localStorage.clear();
});

describe("remote config", () => {
  it("defaults to everything on with baked-in limits", () => {
    expect(featureOn("roadmap")).toBe(true);
    expect(featureOn("playground")).toBe(true);
    expect(aiEnabled()).toBe(true);
    expect(paywallOn()).toBe(true); // CONFIG.features.paywall is on by default
    expect(getLimits()).toEqual(BASE_LIMITS);
  });

  it("merges admin overrides into the defaults", () => {
    setRemoteConfig({ features: { playground: false }, limits: { sessionsPerMonth: 10, aiPerDay: 20 }, ai: { enabled: false, model: "gpt-5" } });
    expect(featureOn("playground")).toBe(false);
    expect(featureOn("roadmap")).toBe(true); // untouched flag stays on
    expect(paywallOn()).toBe(true);          // untouched paywall stays on
    expect(getLimits()).toEqual({ sessionsPerMonth: 10, aiPerDay: 20 });
    expect(aiEnabled()).toBe(false);
  });

  it("can switch the paywall off remotely", () => {
    setRemoteConfig({ features: { paywall: false } });
    expect(paywallOn()).toBe(false);
  });
});

describe("announcements", () => {
  it("surfaces the newest unpublished announcement once", () => {
    setAnnouncements([
      { id: 1, title: "Old", body: "a", badge: null, published: true, createdAt: 1000 },
      { id: 2, title: "New", body: "b", badge: "NEW", published: true, createdAt: 2000 },
      { id: 3, title: "Draft", body: "c", badge: null, published: false, createdAt: 3000 }
    ]);
    expect(nextUnseenAnnouncement()?.id).toBe(2); // newest published, drafts skipped
    markAnnouncementSeen(2);
    expect(nextUnseenAnnouncement()?.id).toBe(1);
    markAnnouncementSeen(1);
    expect(nextUnseenAnnouncement()).toBeNull();
  });
});

describe("published questions", () => {
  it("filters by field, level and publish state", () => {
    setPublishedQuestions([
      { id: 1, fieldId: "backend", level: "senior", question: "Design a queue", answer: "…", keyPoints: ["durability"], published: true, updatedAt: null },
      { id: 2, fieldId: "backend", level: "senior", question: "Draft question", answer: "", keyPoints: [], published: false, updatedAt: null },
      { id: 3, fieldId: "frontend", level: "senior", question: "CSS question", answer: "…", keyPoints: [], published: true, updatedAt: null }
    ]);
    const out = publishedFor("backend", "senior");
    expect(out.map(q => q.q)).toEqual(["Design a queue"]);
    expect(out[0].kp).toEqual(["durability"]);
    expect(publishedFor("backend", "junior")).toEqual([]);
  });

  it("appears in the question bank", () => {
    setPublishedQuestions([
      { id: 1, fieldId: "backend", level: "senior", question: "Admin question", answer: "Model answer", keyPoints: ["k1"], published: true, updatedAt: null }
    ]);
    const { items } = bankItems("backend", "Admin question");
    expect(items.some(i => i.q === "Admin question")).toBe(true);
  });
});

describe("phase4 item A — added date, skills, status filter", () => {
  beforeEach(() => {
    setPublishedQuestions([
      { id: 10, fieldId: "frontend", level: "senior", question: "React reconciliation", answer: "Fiber diff", keyPoints: ["fiber"], published: true, updatedAt: null, addedAt: Date.parse("2026-09-01T10:00:00Z"), skills: ["React"] },
      { id: 11, fieldId: "frontend", level: "senior", question: "Draft JVM tuning", answer: "", keyPoints: [], published: false, updatedAt: null, addedAt: null, skills: ["Java"] }
    ]);
  });

  it("publishedFor carries addedAt and skills while staying QA-assignable", () => {
    const out = publishedFor("frontend", "senior");
    expect(out).toHaveLength(1); /* drafts stay out */
    expect(out[0].addedAt).toBe(Date.parse("2026-09-01T10:00:00Z"));
    expect(out[0].skills).toEqual(["React"]);
    const qa: QA[] = out; /* plain-QA pools (coach/compose) keep compiling */
    expect(qa[0].q).toBe("React reconciliation");
    expect(publishedFor("frontend", "junior")).toEqual([]);
  });

  it("matchesSkill — tag match wins, untagged items fall back to text", () => {
    expect(matchesSkill({ q: "x", a: "", kp: [], skills: ["React"] }, "react")).toBe(true);
    expect(matchesSkill({ q: "x", a: "", kp: [], skills: ["React"] }, "java")).toBe(false);
    /* static core-bank item (no skills) matches via question text */
    expect(matchesSkill({ q: "How does the JVM garbage collector work", a: "", kp: [] }, "jvm")).toBe(true);
    expect(matchesSkill({ q: "Explain CSS specificity", a: "", kp: [] }, "java")).toBe(false);
    expect(matchesSkill({ q: "x", a: "", kp: [], skills: [] }, "")).toBe(true);
  });

  it("bankItems filters by skill; drafts never surface", () => {
    expect(bankItems("frontend", "", "React").items.map(i => i.q)).toContain("React reconciliation");
    /* tagged React item has no Java tag and no Java text → filtered out */
    expect(bankItems("frontend", "", "Java").items.map(i => i.q)).not.toContain("React reconciliation");
    expect(bankItems("frontend", "", "Java").items.map(i => i.q)).not.toContain("Draft JVM tuning");
    const withDate = bankItems("frontend", "React reconciliation").items.find(i => i.q === "React reconciliation");
    expect(withDate?.addedAt).toBe(Date.parse("2026-09-01T10:00:00Z"));
  });

  it("bankSkillChips unions field skills with published tags, deduped case-insensitively", () => {
    expect(bankSkillChips(["React", "CSS"], [{ skills: ["react", "Vite"] }, { skills: [] }])).toEqual(["React", "CSS", "Vite"]);
    expect(bankSkillChips(undefined, [{ skills: ["Go"] }])).toEqual(["Go"]);
    expect(bankSkillChips(["React"], [{ skills: [""] }])).toEqual(["React"]);
  });

  it("statusFilterPasses implements all/draft/live", () => {
    expect(statusFilterPasses(true, "all")).toBe(true);
    expect(statusFilterPasses(false, "all")).toBe(true);
    expect(statusFilterPasses(true, "draft")).toBe(false);
    expect(statusFilterPasses(false, "draft")).toBe(true);
    expect(statusFilterPasses(true, "live")).toBe(true);
    expect(statusFilterPasses(false, "live")).toBe(false);
  });

  it("matchesAnySkill ORs the selected skills; empty selection matches all (owner decision 2026-09-25)", () => {
    const reactTs = { q: "How do React hooks interact with TypeScript generics", a: "", kp: [], skills: ["React", "TypeScript"] };
    expect(matchesAnySkill(reactTs, ["React"])).toBe(true);
    expect(matchesAnySkill(reactTs, ["react", "typescript"])).toBe(true); /* case-insensitive */
    expect(matchesAnySkill(reactTs, ["React", "Java"])).toBe(true); /* OR — one hit suffices */
    expect(matchesAnySkill(reactTs, ["Java", "Go"])).toBe(false); /* no hit at all */
    expect(matchesAnySkill(reactTs, [])).toBe(true);
    /* text fallback covers untagged items per-skill */
    expect(matchesAnySkill({ q: "How does the JVM garbage collector work", a: "", kp: [] }, ["jvm"])).toBe(true);
    expect(matchesAnySkill({ q: "How does the JVM garbage collector work", a: "", kp: [] }, ["jvm", "react"])).toBe(true);
    expect(matchesAnySkill({ q: "How does the JVM garbage collector work", a: "", kp: [] }, ["react", "go"])).toBe(false);
  });

  it("publishedMatchesSkill filters admin rows by tag with text fallback; empty = all", () => {
    const tagged = { question: "What is reconciliation?", answer: "Fiber diff", keyPoints: ["fiber"], skills: ["React"] };
    const untagged = { question: "Explain the JVM memory model", answer: "", keyPoints: [], skills: [] };
    expect(publishedMatchesSkill(tagged, "")).toBe(true); /* no filter */
    expect(publishedMatchesSkill(tagged, "react")).toBe(true); /* tag, case-insensitive */
    expect(publishedMatchesSkill(tagged, "fiber")).toBe(true); /* key-point text fallback */
    expect(publishedMatchesSkill(tagged, "java")).toBe(false);
    expect(publishedMatchesSkill(untagged, "jvm")).toBe(true); /* untagged text fallback */
    expect(publishedMatchesSkill(untagged, "react")).toBe(false);
  });

  it("adminSkillChips collects published-row tags deduped + sorted for the admin filter", () => {
    expect(adminSkillChips([{ skills: ["React", "CSS"] }, { skills: [] }, { skills: ["react", "Vite"] }])).toEqual(["CSS", "React", "Vite"]);
    expect(adminSkillChips([{ skills: undefined }, { skills: [] }])).toEqual([]);
    expect(adminSkillChips([{ skills: ["  "] }])).toEqual([]); /* blank tags dropped */
  });

  it("bankItems unions across multiple skills (OR); single-string skill arg stays compatible", () => {
    setPublishedQuestions([
      { id: 20, fieldId: "frontend", level: "senior", question: "React hooks with TS generics", answer: "", keyPoints: [], published: true, updatedAt: null, skills: ["React", "TypeScript"] },
      { id: 21, fieldId: "frontend", level: "senior", question: "React reconciliation", answer: "", keyPoints: [], published: true, updatedAt: null, skills: ["React"] }
    ]);
    const both = bankItems("frontend", "", "", ["React", "TypeScript"]).items.map(i => i.q);
    expect(both).toContain("React hooks with TS generics");
    expect(both).toContain("React reconciliation"); /* OR — React-tagged row still matches via its React tag */
    const one = bankItems("frontend", "", "", ["TypeScript"]).items.map(i => i.q);
    expect(one).toContain("React hooks with TS generics");
    expect(one).not.toContain("React reconciliation");
    expect(bankItems("frontend", "", "", []).items.length).toBeGreaterThan(one.length); /* no filter = all */
    expect(bankItems("frontend", "", "React").items.map(i => i.q)).toContain("React hooks with TS generics"); /* legacy arg */
  });

  it("addedLabel formats a date and hides missing/invalid timestamps", () => {
    expect(addedLabel(null)).toBeNull();
    expect(addedLabel(undefined)).toBeNull();
    expect(addedLabel(0)).toBeNull();
    expect(addedLabel(NaN)).toBeNull();
    expect(addedLabel(Date.parse("2026-09-01T10:00:00Z"))).toMatch(/2026/);
  });
});

describe("event outbox", () => {
  it("queues events and caps the queue", () => {
    for (let i = 0; i < 60; i++) queueEvent("app_open", { i });
    const outbox = storageGet<unknown[]>(STORAGE_KEYS.eventOutbox, []);
    expect(outbox.length).toBe(50);
    expect(outbox[0]).toMatchObject({ kind: "app_open" });
  });
});
