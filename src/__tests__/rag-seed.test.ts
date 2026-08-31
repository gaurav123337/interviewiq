import { afterEach, describe, expect, it, vi } from "vitest";

// Hoisted holder so the vi.mock factory can reference the mock before imports run.
const cloud = vi.hoisted(() => ({ cloudFnHeaders: vi.fn() }));
vi.mock("../services/cloud", () => ({
  cloudFnHeaders: cloud.cloudFnHeaders,
}));
vi.mock("../config", () => ({
  CONFIG: { supabase: { url: "https://proj.supabase.co", anonKey: "anon" } },
}));

import { seedKnowledgeBase } from "../services/admin/ragSeed";

afterEach(() => {
  vi.restoreAllMocks();
  cloud.cloudFnHeaders.mockReset();
});

describe("seedKnowledgeBase", () => {
  it("POSTs {} to /functions/v1/seed-rag with the caller's auth headers and returns the result", async () => {
    cloud.cloudFnHeaders.mockResolvedValue({
      "Content-Type": "application/json",
      apikey: "anon",
      Authorization: "Bearer tok",
    });
    const result = {
      seeded: 12,
      chunks: 34,
      errors: 0,
      errorDetails: [],
      model: "openai/text-embedding-3-small",
      provider: "api.orcarouter.ai",
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => result });
    vi.stubGlobal("fetch", fetchMock);

    const out = await seedKnowledgeBase();

    expect(out).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://proj.supabase.co/functions/v1/seed-rag");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("throws the function's message on a non-2xx (e.g. 503 not configured)", async () => {
    cloud.cloudFnHeaders.mockResolvedValue({ "Content-Type": "application/json" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          error: "Embeddings not configured — set the embeddings provider in Secrets → Embeddings provider.",
        }),
      }),
    );
    await expect(seedKnowledgeBase()).rejects.toThrow("Embeddings not configured");
  });

  it("falls back to a status message when the error body carries no message", async () => {
    cloud.cloudFnHeaders.mockResolvedValue({});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    await expect(seedKnowledgeBase()).rejects.toThrow("Seed failed (500)");
  });
});
