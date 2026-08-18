/* Per-module AI model wiring (docs/deep-dive-system-design-plan.md §2) —
   resolution precedence + save/delete behavior. */

import { beforeEach, describe, expect, it, vi } from "vitest";
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
