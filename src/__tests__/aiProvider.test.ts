/* Per-module AI model wiring (docs/deep-dive-system-design-plan.md §2) —
   resolution precedence + save/delete behavior. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveModulePreview } from "../services/aiProvider";

const from = vi.hoisted(() => vi.fn());
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  isCloudConfigured: () => true,
  getSupabaseClient: vi.fn().mockResolvedValue({ from })
}));

const PROVIDER = { keyHint: "sk-or…aaed", model: "deepseek/deepseek-chat" };

describe("resolveModulePreview — precedence: module → provider → none", () => {
  it("module override wins when it has its own model", () => {
    const r = resolveModulePreview({ model: "expert-explainer", key: "sk-mod", base: "https://x/v1" }, PROVIDER);
    expect(r).toEqual({ model: "expert-explainer", source: "module", keyHint: "••••-mod" });
  });

  it("model-only module row inherits the provider model hint display", () => {
    const r = resolveModulePreview({ model: "rag-model", key: "", base: "" }, PROVIDER);
    expect(r).toEqual({ model: "rag-model", source: "module", keyHint: "sk-or…aaed" });
  });

  it("absent module row falls back to the provider", () => {
    const r = resolveModulePreview(undefined, PROVIDER);
    expect(r).toEqual({ model: "deepseek/deepseek-chat", source: "provider", keyHint: "sk-or…aaed" });
  });

  it("blank module row behaves like absent", () => {
    const r = resolveModulePreview({ model: "", key: "", base: "" }, PROVIDER);
    expect(r.source).toBe("provider");
  });

  it("no provider configured → none", () => {
    const r = resolveModulePreview(null, null);
    expect(r).toEqual({ model: "", source: "none", keyHint: "" });
  });
});

describe("saveModuleModel — upsert vs delete", () => {
  let upsert: ReturnType<typeof vi.fn>;
  let del: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    upsert = vi.fn().mockResolvedValue({ error: null });
    del = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({
      delete: () => ({ eq: del }),
      upsert
    });
  });

  it("saves a module override row when model is set", async () => {
    const { saveModuleModel } = await import("../services/aiProvider");
    await saveModuleModel("rag", { model: "rag-model", key: "" });
    expect(upsert).toHaveBeenCalledWith(
      { key: "module:rag", value: { model: "rag-model", key: "", base: "" }, updated_at: expect.any(Number) },
      { onConflict: "key" }
    );
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes the override (back to default) when model + key are blank", async () => {
    const { saveModuleModel } = await import("../services/aiProvider");
    await saveModuleModel("coach", { model: "", key: "" });
    expect(del).toHaveBeenCalledWith("key", "module:coach");
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("testAiProvider — loopback guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects localhost/127.0.0.1/[::1] bases up-front with the tunnel fix", async () => {
    const { testAiProvider } = await import("../services/aiProvider");
    for (const base of ["http://localhost:20128/v1", "http://127.0.0.1:8080", "http://[::1]:9000/v1"]) {
      const r = await testAiProvider({ key: "sk-test", base });
      expect(r.ok).toBe(false);
      expect(r.note).toMatch(/localhost providers can't power the app/i);
      expect(r.note).toMatch(/cloudflared tunnel/i);
    }
  });

  it("never reaches the network for loopback bases", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { testAiProvider } = await import("../services/aiProvider");
    await testAiProvider({ key: "sk-test", base: "http://localhost:20128/v1" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
