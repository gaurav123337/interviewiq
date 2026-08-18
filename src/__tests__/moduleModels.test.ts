// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearModuleModel,
  getModuleModelConfig,
  getModuleOverride,
  hasModuleOverride,
  listModuleOverrides,
  resolveModuleModel,
  setModuleModel,
  type ModuleId,
  type ModuleModelConfig
} from "../services/moduleModels";
import { saveSettings } from "../ai";
import { STORAGE_KEYS, storageGet } from "../services/storage";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const KEY = "sk-test-123";
const BASE = "https://api.openai.com/v1";
const MODEL = "gpt-4o";

function setupGlobalKey() {
  saveSettings({ key: KEY, base: BASE, model: MODEL });
}

function setupOverride(id: ModuleId, model: string, key = KEY, base = BASE) {
  setModuleModel(id, { key, base, model });
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("moduleModels", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /* --- storage --- */

  describe("getModuleModelConfig", () => {
    it("returns empty overrides and global defaults when nothing is stored", () => {
      const cfg = getModuleModelConfig();
      expect(cfg.overrides).toEqual({});
      /* default falls back to hardcoded (no key saved) */
      expect(cfg.default.model).toBeTruthy();
    });

    it("persists overrides via setModuleModel", () => {
      setupOverride("tutor", "claude-3.5-sonnet");
      const cfg = getModuleModelConfig();
      expect(cfg.overrides.tutor).toEqual({ key: KEY, base: BASE, model: "claude-3.5-sonnet" });
    });
  });

  /* --- resolution priority chain --- */

  describe("resolveModuleModel", () => {
    it("returns hardcoded fallback when no global key and no override", () => {
      const s = resolveModuleModel("tutor");
      expect(s.key).toBe("");  /* no key configured */
      expect(s.model).toBeTruthy(); /* fallback model exists */
    });

    it("returns global default when no module override is set", () => {
      setupGlobalKey();
      const s = resolveModuleModel("tutor");
      expect(s.key).toBe(KEY);
      expect(s.base).toBe(BASE);
      expect(s.model).toBe(MODEL);
    });

    it("returns module override when one is set", () => {
      setupGlobalKey();
      setupOverride("tutor", "claude-3.5-sonnet");
      const s = resolveModuleModel("tutor");
      expect(s.key).toBe(KEY);
      expect(s.model).toBe("claude-3.5-sonnet");
    });

    it("falls back to global for modules without overrides", () => {
      setupGlobalKey();
      setupOverride("tutor", "claude-3.5-sonnet");
      const s = resolveModuleModel("hint");
      expect(s.key).toBe(KEY);
      expect(s.model).toBe(MODEL); /* global, not tutor's model */
    });

    it("supports different keys per module (multi-provider)", () => {
      setupGlobalKey();
      setupOverride("tutor", "claude-3.5-sonnet", "sk-claude-key", "https://api.anthropic.com/v1");
      const s = resolveModuleModel("tutor");
      expect(s.key).toBe("sk-claude-key");
      expect(s.base).toBe("https://api.anthropic.com/v1");
      expect(s.model).toBe("claude-3.5-sonnet");
    });

    it("uses override's model even when global key is empty", () => {
      setupOverride("code", "codestral-latest", "sk-mistral", "https://api.mistral.ai/v1");
      const s = resolveModuleModel("code");
      expect(s.key).toBe("sk-mistral");
      expect(s.model).toBe("codestral-latest");
    });

    it("falls back to hardcoded when override has no model", () => {
      setupOverride("coach", "", KEY, BASE);
      const s = resolveModuleModel("coach");
      expect(s.key).toBe(KEY);
      expect(s.model).toBeTruthy(); /* hardcoded fallback */
    });
  });

  /* --- CRUD operations --- */

  describe("setModuleModel / clearModuleModel", () => {
    it("sets an override", () => {
      setupOverride("feedback", "gpt-4o-mini");
      expect(hasModuleOverride("feedback")).toBe(true);
      expect(resolveModuleModel("feedback").model).toBe("gpt-4o-mini");
    });

    it("clears a specific override", () => {
      setupOverride("tutor", "claude-3.5-sonnet");
      setupOverride("code", "codestral-latest");
      clearModuleModel("tutor");
      expect(hasModuleOverride("tutor")).toBe(false);
      expect(hasModuleOverride("code")).toBe(true);
    });

    it("clearing a non-existent override is a no-op", () => {
      clearModuleModel("hint");
      expect(hasModuleOverride("hint")).toBe(false);
    });
  });

  describe("listModuleOverrides", () => {
    it("returns empty when no overrides", () => {
      expect(listModuleOverrides()).toEqual([]);
    });

    it("returns only modules with key set", () => {
      setupOverride("tutor", "claude-3.5-sonnet");
      setupOverride("code", "codestral-latest");
      setupOverride("hint", ""); /* empty key → should be filtered out */
      const list = listModuleOverrides();
      expect(list).toHaveLength(2);
      expect(list.map(l => l.moduleId)).toEqual(expect.arrayContaining(["tutor", "code"]));
    });
  });

  describe("getModuleOverride", () => {
    it("returns null when no override", () => {
      expect(getModuleOverride("tutor")).toBeNull();
    });

    it("returns the override when set", () => {
      setupOverride("tutor", "claude-3.5-sonnet");
      expect(getModuleOverride("tutor")).toEqual({ key: KEY, base: BASE, model: "claude-3.5-sonnet" });
    });
  });

  /* --- storage key --- */

  describe("storage", () => {
    it("persists under iq.moduleModels", () => {
      setupOverride("tutor", "claude-3.5-sonnet");
      const raw = storageGet<ModuleModelConfig>(STORAGE_KEYS.moduleModels, { default: { key: "", base: "", model: "" }, overrides: {} });
      expect(raw.overrides.tutor?.model).toBe("claude-3.5-sonnet");
    });

    it("multiple overrides are independent", () => {
      setupOverride("tutor", "claude-3.5-sonnet");
      setupOverride("code", "codestral-latest");
      const cfg = getModuleModelConfig();
      expect(Object.keys(cfg.overrides)).toHaveLength(2);
      expect(cfg.overrides.tutor?.model).toBe("claude-3.5-sonnet");
      expect(cfg.overrides.code?.model).toBe("codestral-latest");
    });
  });
});
