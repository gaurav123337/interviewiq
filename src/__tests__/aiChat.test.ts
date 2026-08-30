/* AI reachability + per-module cloud routing (docs/deep-dive-system-design-plan.md §2).
   chat() uses the user's local key (BYOK) when present; otherwise, when a module
   is requested, it routes through the ai-chat edge function which resolves the
   module's model from the configured provider. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: cloudUser, configured: true, syncing: false, error: null, oauth: [] }),
  isCloudConfigured: () => true,
  getSupabaseClient: vi.fn().mockResolvedValue({ auth: { getSession } })
}));

let cloudUser: { id: string } | null = { id: "u1" };

import { STORAGE_KEYS, storageRemove, storageSet } from "../services/storage";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  cloudUser = { id: "u1" };
  getSession.mockResolvedValue({ data: { session: { access_token: "tok-1" } }, error: null });
  storageRemove(STORAGE_KEYS.apiKey);
  storageRemove(STORAGE_KEYS.apiBase);
  storageRemove(STORAGE_KEYS.apiModel);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("aiReachable", () => {
  it("true with the user's own key", async () => {
    storageSet(STORAGE_KEYS.apiKey, "sk-user");
    const { aiReachable } = await import("../ai");
    expect(aiReachable()).toBe(true);
  });

  it("true when signed in (cloud provider serves AI), false for guests without a key", async () => {
    const { aiReachable } = await import("../ai");
    expect(aiReachable()).toBe(true);
    cloudUser = null;
    expect(aiReachable()).toBe(false);
  });
});

describe("chat() module routing", () => {
  it("routes through the ai-chat proxy with the module id when no local key", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, text: "coached reply", resolvedModel: "coach-model", source: "provider" })
    });
    const { chat } = await import("../ai");
    const out = await chat([{ role: "user", content: "hi" }], { module: "coach", maxTokens: 450 });
    expect(out).toBe("coached reply");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/functions/v1/ai-chat");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ module: "coach", messages: [{ role: "user", content: "hi" }] });
    /* resolveMaxTokens raises the caller's maxTokens up to the module's floor
       (coach → 1200) to prevent mid-reply truncation, so the value that reaches
       the wire is >= what the caller passed. */
    expect(body.maxTokens).toBeGreaterThanOrEqual(450);
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok-1" });
  });

  it("uses the user's own local key (BYOK) even when a module is requested", async () => {
    storageSet(STORAGE_KEYS.apiKey, "sk-user");
    storageSet(STORAGE_KEYS.apiBase, "https://local.example/v1");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "local reply" } }] })
    });
    const { chat } = await import("../ai");
    const out = await chat([{ role: "user", content: "hi" }], { module: "rag" });
    expect(out).toBe("local reply");
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("local.example/v1/chat/completions");
  });

  it("throws a clear error for guests without a key or module", async () => {
    cloudUser = null;
    const { chat } = await import("../ai");
    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow("Sign in to use AI, or add your own API key in Settings → AI.");
  });
});

/* chatForModule() is the ladder the system-design tutor rides (systemDesignTutor.ts
   calls chatForModule("tutor", …)). It mirrors chat()'s three rungs but resolves a
   per-module model first. Covered directly here because the earlier suite only
   exercised the sibling chat()/tutorChat(), so a regression that reverted the
   signed-in cloud-fallback rung to a throw would have slipped past unnoticed. */
describe("chatForModule() ladder", () => {
  it("routes a signed-in, keyless user through the cloud proxy with the module id", async () => {
    /* the documented P0 fix: signed in + no local key → cloudChat(module),
       NOT a throw. cloudUser is set in beforeEach. */
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, text: "tutor reply", model: "tutor-model" })
    });
    const { chatForModule } = await import("../ai");
    const out = await chatForModule("tutor", [{ role: "user", content: "explain CAP" }]);
    expect(out).toBe("tutor reply");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/functions/v1/ai-chat");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ module: "tutor", messages: [{ role: "user", content: "explain CAP" }] });
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok-1" });
  });

  it("uses the user's own local key (BYOK) instead of the cloud proxy", async () => {
    storageSet(STORAGE_KEYS.apiKey, "sk-user");
    storageSet(STORAGE_KEYS.apiBase, "https://local.example/v1");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "local reply" } }] })
    });
    const { chatForModule } = await import("../ai");
    const out = await chatForModule("tutor", [{ role: "user", content: "explain CAP" }]);
    expect(out).toBe("local reply");
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("local.example/v1/chat/completions");
    expect(url).not.toContain("/functions/v1/ai-chat");
  });

  it("throws the same clear error for a keyless guest", async () => {
    cloudUser = null;
    const { chatForModule } = await import("../ai");
    await expect(chatForModule("tutor", [{ role: "user", content: "hi" }]))
      .rejects.toThrow("Sign in to use AI, or add your own API key in Settings → AI.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
