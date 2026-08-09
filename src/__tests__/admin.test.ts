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
import { bankItems } from "../engine/bank";
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
      { id: 1, fieldId: "backend", level: "senior", question: "Design a queue", answer: "…", keyPoints: ["durability"], published: true },
      { id: 2, fieldId: "backend", level: "senior", question: "Draft question", answer: "", keyPoints: [], published: false },
      { id: 3, fieldId: "frontend", level: "senior", question: "CSS question", answer: "…", keyPoints: [], published: true }
    ]);
    const out = publishedFor("backend", "senior");
    expect(out.map(q => q.q)).toEqual(["Design a queue"]);
    expect(out[0].kp).toEqual(["durability"]);
    expect(publishedFor("backend", "junior")).toEqual([]);
  });

  it("appears in the question bank", () => {
    setPublishedQuestions([
      { id: 1, fieldId: "backend", level: "senior", question: "Admin question", answer: "Model answer", keyPoints: ["k1"], published: true }
    ]);
    const { items } = bankItems("backend", "Admin question");
    expect(items.some(i => i.q === "Admin question")).toBe(true);
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
