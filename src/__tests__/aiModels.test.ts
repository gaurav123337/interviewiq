/* Regression tests for the "Couldn't list models" bug (2026-09-26): the old
   wrapper swallowed every failure into [] — CORS-blocked responses, edge
   errors and signed-out sessions all looked like "the provider lists zero
   models". These pin the throw-with-reason contract. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { email: "owner@example.com" } as { email?: string } | null,
  sessionToken: "tok-123" as string | null
}));

vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn(async () => ({
    auth: {
      getSession: async () => ({
        data: { session: mocks.sessionToken ? { access_token: mocks.sessionToken } : null }
      })
    }
  })),
  getCloudState: () => ({ user: mocks.user ? { email: mocks.user.email } : null })
}));

import { clearModelCache, fetchAvailableModels } from "../services/aiModels";

beforeEach(() => {
  clearModelCache();
  mocks.user = { email: "owner@example.com" };
  mocks.sessionToken = "tok-123";
});

afterEach(() => {
  clearModelCache();
  vi.unstubAllGlobals();
});

describe("fetchAvailableModels", () => {
  it("throws the edge function's error message instead of resolving []", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: "Provider not configured" }), { status: 503 })
    ));
    await expect(fetchAvailableModels(true)).rejects.toThrow(/Provider not configured/);
  });

  it("surfaces network/CORS failures instead of swallowing them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(fetchAvailableModels(true)).rejects.toThrow(/network or CORS/i);
  });

  it("throws when signed out instead of silently returning []", async () => {
    mocks.user = null;
    await expect(fetchAvailableModels(true)).rejects.toThrow(/Sign in/);
  });

  it("throws when the session has no access token", async () => {
    mocks.sessionToken = null;
    await expect(fetchAvailableModels(true)).rejects.toThrow(/Sign in/);
  });

  it("returns the mapped model list on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({
        models: [{ id: "deepseek/deepseek-v4-flash", name: "deepseek/deepseek-v4-flash", owner: "openrouter", isThinking: false, tags: ["fast"] }]
      }), { status: 200 })
    ));
    const models = await fetchAvailableModels(true);
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("deepseek/deepseek-v4-flash");
  });

  it("does NOT cache an empty list — the next call refetches", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        models: [{ id: "m1", name: "m1", owner: "x", isThinking: false, tags: [] }]
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAvailableModels(true)).resolves.toEqual([]);
    const second = await fetchAvailableModels(false); // within TTL — must still refetch
    expect(second).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("feeds scanProviderModels' thrown reason through to the scan card", async () => {
    /* the picker imports fetchAvailableModels statically — same module instance,
       so the edge error must propagate end-to-end (scan card shows the reason) */
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: "Provider /models returned HTTP 401" }), { status: 502 })
    ));
    const { scanProviderModels } = await import("../services/aiModelPicker");
    await expect(scanProviderModels(true)).rejects.toThrow(/HTTP 401/);
  });

  it("serves the cache within TTL for non-empty lists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      models: [{ id: "m1", name: "m1", owner: "x", isThinking: false, tags: [] }]
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAvailableModels(true);
    await fetchAvailableModels(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
