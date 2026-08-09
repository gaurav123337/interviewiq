import { afterEach, describe, expect, it, vi } from "vitest";
import type { CareerGoal } from "../types";
import { explainTopic, tutorChat } from "../services/tutor";
import { STORAGE_KEYS, storageRemove, storageSet } from "../services/storage";

const goal: CareerGoal = {
  currentLevel: "mid", targetLevel: "senior", fieldId: "backend", companyId: "general",
  targetDate: "2099-01-01", hoursPerWeek: 5, createdAt: 1
};

function stubChat(reply: string): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: reply } }] })
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  storageRemove(STORAGE_KEYS.apiKey);
});

describe("tutorChat", () => {
  it("requires an API key", async () => {
    await expect(tutorChat("APIs & services", goal, [])).rejects.toThrow("No API key");
  });

  it("continues the conversation with full history", async () => {
    storageSet(STORAGE_KEYS.apiKey, "test-key");
    const fn = stubChat("Follow-up answer");
    const reply = await tutorChat("APIs & services", goal, [
      { role: "assistant", content: "First explanation" },
      { role: "user", content: "What about idempotency?" }
    ]);
    expect(reply.text).toBe("Follow-up answer");
    expect(reply.citations).toEqual([]); /* no signed-in user → no grounding */
    const body = JSON.parse(String(fn.mock.calls[0][1]?.body)) as { messages: { role: string; content: string }[] };
    expect(body.messages.map(m => m.role)).toEqual(["system", "assistant", "user"]);
    expect(body.messages[0].content).toContain("APIs & services");
  });

  it("is metered: each reply counts as an AI call", async () => {
    storageSet(STORAGE_KEYS.apiKey, "test-key");
    stubChat("ok");
    const { getUsage } = await import("../services/entitlements");
    const before = getUsage().aiToday;
    await tutorChat("APIs & services", goal, []);
    expect(getUsage().aiToday).toBe(before + 1);
  });
});

describe("explainTopic", () => {
  it("still works as a one-shot explanation", async () => {
    storageSet(STORAGE_KEYS.apiKey, "test-key");
    stubChat("Topic explained for a senior");
    await expect(explainTopic("APIs & services", goal)).resolves.toBe("Topic explained for a senior");
  });
});
