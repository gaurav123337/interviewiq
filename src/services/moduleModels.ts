/* Per-module AI model routing — lets users wire different AI models to
   different features (tutor, coach, feedback, hint, code, embeddings).

   Resolution priority:
     1. User override (localStorage iq.moduleModels)
     2. Admin-pushed module default (remote config ai.moduleDefaults)
     3. Global user default (localStorage iq.apiKey / iq.apiModel)
     4. Hardcoded fallback (gpt-4o-mini)

   All AI callers should migrate from chat() to chatForModule(moduleId, ...)
   over time. The old chat() remains for backward compatibility. */

import { STORAGE_KEYS, storageGet, storageSet } from "./storage";
import { getSettings, type AISettings } from "../ai";
import { getAiDefaults } from "./remoteConfig";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Module identifiers for per-model routing. */
export type ModuleId =
  | "tutor"         // Roadmap topic explanations + follow-up chat
  | "coach"         // Interview question coaching (CoachChat)
  | "feedback"      // Post-answer generative feedback
  | "hint"          // One-shot hints
  | "code"          // Code playground assistance
  | "embeddings"    // RAG embedding generation
  | "contentRefine" // Content refinement (raw → progressive difficulty)
  | "contentQuality"; // Content quality scoring (LLM-as-Judge)

/** Per-module model override — stored in localStorage. */
export interface ModuleModelOverride {
  key: string;       // API key (same provider or different)
  base: string;      // Base URL
  model: string;     // Model name
}

/** The full module-model config: per-module overrides + a global default. */
export interface ModuleModelConfig {
  /** Global fallback (mirrors the existing AISettings). */
  default: AISettings;
  /** Per-module overrides. Absent = use default. */
  overrides: Partial<Record<ModuleId, ModuleModelOverride>>;
}

/** Reference info so the UI can explain what each module needs. */
export interface ModuleInfo {
  id: ModuleId;
  label: string;
  description: string;
  suggestedModel: string;
}

/* ------------------------------------------------------------------ */
/* Module metadata                                                     */
/* ------------------------------------------------------------------ */

export const MODULE_LIST: ModuleInfo[] = [
  { id: "tutor",       label: "Tutor / Explanations",  description: "Needs clear, structured prose and patient explanations.",   suggestedModel: "claude-3.5-sonnet" },
  { id: "coach",       label: "Interview Coach",       description: "Needs concise, specific feedback with good judgment.",     suggestedModel: "gpt-4o" },
  { id: "feedback",    label: "Post-Answer Feedback",   description: "Needs brief, actionable evaluation.",                      suggestedModel: "gpt-4o-mini" },
  { id: "hint",        label: "Hints",                  description: "Needs one short, targeted hint.",                          suggestedModel: "gpt-4o-mini" },
  { id: "code",        label: "Code Assistant",         description: "Needs strong code generation and explanation.",            suggestedModel: "codestral-latest" },
  { id: "embeddings",  label: "Embeddings",             description: "Must return 1536-dim vectors for pgvector.",              suggestedModel: "text-embedding-3-small" }
];

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const MODULE_KEY = STORAGE_KEYS.moduleModels;

/** Read the stored module-model config. */
export function getModuleModelConfig(): ModuleModelConfig {
  const stored = storageGet<Partial<ModuleModelConfig>>(MODULE_KEY, {});
  return {
    default: stored.default ?? getSettings(),
    overrides: stored.overrides ?? {}
  };
}

/** Save the module-model config. */
export function saveModuleModelConfig(cfg: ModuleModelConfig): void {
  storageSet(MODULE_KEY, cfg);
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/** Compute the global default from the user's AI settings + remote config. */
function globalDefault(): AISettings {
  const user = getSettings();
  if (user.key) return user;
  const remote = getAiDefaults();
  return {
    key: "",
    base: "https://api.openai.com/v1",
    model: remote.model || "gpt-4o-mini"
  };
}

/**
 * Resolve the effective AI settings for a given module.
 * Priority: user override → admin remote default → global user default → hardcoded.
 */
export function resolveModuleModel(moduleId: ModuleId): AISettings {
  const cfg = getModuleModelConfig();

  /* 1. User override */
  const userOverride = cfg.overrides[moduleId];
  if (userOverride?.key) {
    return {
      key: userOverride.key,
      base: userOverride.base || "https://api.openai.com/v1",
      model: userOverride.model || cfg.default.model || "gpt-4o-mini"
    };
  }

  /* 2. Admin remote config module default */
  const remote = getAiDefaults();
  const adminDefault = remote.moduleDefaults?.[moduleId];
  if (adminDefault?.model && cfg.default.key) {
    return {
      key: cfg.default.key,
      base: adminDefault.base || cfg.default.base || "https://api.openai.com/v1",
      model: adminDefault.model
    };
  }

  /* 3. Global user default */
  if (cfg.default.key) {
    return cfg.default;
  }

  /* 4. Hardcoded fallback */
  return globalDefault();
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

/** Set a specific module override. */
export function setModuleModel(moduleId: ModuleId, override: ModuleModelOverride): void {
  const cfg = getModuleModelConfig();
  cfg.overrides[moduleId] = override;
  saveModuleModelConfig(cfg);
}

/** Clear a specific module override (revert to default). */
export function clearModuleModel(moduleId: ModuleId): void {
  const cfg = getModuleModelConfig();
  delete cfg.overrides[moduleId];
  saveModuleModelConfig(cfg);
}

/** List which modules have active overrides (for the Settings UI). */
export function listModuleOverrides(): { moduleId: ModuleId; model: string; base: string }[] {
  const cfg = getModuleModelConfig();
  return (Object.entries(cfg.overrides) as [ModuleId, ModuleModelOverride][])
    .filter(([, v]) => !!v.key && !!v.model)
    .map(([id, v]) => ({ moduleId: id, model: v.model, base: v.base }));
}

/** Get the override for a specific module (or null if none). */
export function getModuleOverride(moduleId: ModuleId): ModuleModelOverride | null {
  const cfg = getModuleModelConfig();
  return cfg.overrides[moduleId] ?? null;
}

/** Check whether a specific module has a user override (vs using the default). */
export function hasModuleOverride(moduleId: ModuleId): boolean {
  const cfg = getModuleModelConfig();
  return !!cfg.overrides[moduleId]?.key;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** Validate that a key+base+model combination works by hitting /models. */
export async function testModuleModel(cfg: {
  key: string;
  base: string;
  model?: string;
}): Promise<{ ok: boolean; note: string }> {
  const base = (cfg.base.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!cfg.key.trim()) return { ok: false, note: "Enter a key first" };

  try {
    const res = await fetch(`${base}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cfg.key.trim()}` }
    });
    if (res.ok) {
      /* If a model name was given, verify it exists in the provider's list */
      if (cfg.model?.trim()) {
        try {
          const data = await res.json();
          const models: string[] = (data?.data ?? []).map((m: { id: string }) => m.id);
          const target = cfg.model.trim().toLowerCase();
          const found = models.some(m => m.toLowerCase() === target);
          if (!found) {
            return { ok: false, note: `Key accepted, but model "${cfg.model}" not found. Available: ${models.slice(0, 5).join(", ")}${models.length > 5 ? "…" : ""}` };
          }
        } catch { /* model list check is best-effort */ }
      }
      return { ok: true, note: "Key accepted — provider reachable" };
    }
    if (res.status === 401) return { ok: false, note: "HTTP 401 — key rejected by the provider" };
    if (res.status === 402) return { ok: false, note: "HTTP 402 — provider account out of credits" };
    if (res.status === 429) return { ok: false, note: "HTTP 429 — rate limited, try again shortly" };
    return { ok: false, note: `HTTP ${res.status} from ${base}` };
  } catch (e) {
    return { ok: false, note: `Couldn't reach ${base} — ${(e as Error).message}` };
  }
}
