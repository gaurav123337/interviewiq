/* Optional AI feedback via any OpenAI-compatible endpoint.
   Works fully offline without a key (curated engine); with a key, adds
   real generative feedback on top. Key stays in localStorage only. */

import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "./services/storage";
import { aiCallsLeft, isPaywallEnabled, recordAiCall } from "./services/entitlements";
import { aiEnabled, getAiDefaults } from "./services/remoteConfig";
import { queueEvent } from "./services/events";
import { getCloudState, getSupabaseClient } from "./services/cloud";
import { CONFIG } from "./config";
import type { AiModuleId } from "./services/aiProvider";
import { resolveModuleModel, type ModuleId } from "./services/moduleModels";
import { cacheLookup, cacheStore, logAiCost, checkRateLimit, checkUserQuota } from "./services/aiCache";
import { getTier } from "./services/entitlements";

export interface AISettings {
  key: string;
  base: string;
  model: string;
}

const DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

/** The product team can push a suggested model remotely (used until the user picks one). */
export function aiDefaultModel(): string {
  return getAiDefaults().model || DEFAULT_MODEL;
}

export function getSettings(): AISettings {
  return {
    key: storageGet(STORAGE_KEYS.apiKey, ""),
    base: storageGet(STORAGE_KEYS.apiBase, DEFAULT_BASE),
    model: storageGet(STORAGE_KEYS.apiModel, aiDefaultModel())
  };
}

export function saveSettings(s: AISettings) {
  storageSet(STORAGE_KEYS.apiKey, s.key.trim());
  storageSet(STORAGE_KEYS.apiBase, s.base.trim().replace(/\/+$/, ""));
  storageSet(STORAGE_KEYS.apiModel, s.model.trim() || DEFAULT_MODEL);
}

export function clearKey() {
  storageRemove(STORAGE_KEYS.apiKey);
}

export function aiAvailable(): boolean {
  return !!getSettings().key;
}

/** True when generative AI is reachable: the user's own key, or a signed-in
    session (the ai-chat proxy serves the admin-configured provider, with
    per-module model wiring). Guests without a key keep the offline engine. */
export function aiReachable(): boolean {
  return aiAvailable() || !!getCloudState().user;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Route through the ai-chat proxy which resolves this module's model
      (module:<id> override → configured provider). Only used when the user
      has no local key — their own key always wins (BYOK). */
  module?: AiModuleId;
}

/* ── Smart Model Routing + Fallback Chain ──────────────────────────────── */

/** Module-specific token caps — prevents runaway output costs. */
const MODULE_MAX_TOKENS: Record<string, number> = {
  hint: 120,
  feedback: 500,
  coach: 1200,
  deepdive: 600,
  rag: 500,
  contentRefine: 4000,
  articleNormalize: 8000,
};

/** Fallback chains per provider — only models the provider actually serves. */
const FALLBACK_CHAINS: Record<string, string[]> = {
  // OpenAI direct
  openai: ["gpt-4o-mini", "gpt-4.1-nano"],
  // Google Gemini
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
  // OpenRouter / OrcaRouter / any OpenAI-compatible router
  default: [], // Don't fall back to other providers — retry the same model
};

function getFallbackChain(base: string, model: string): string[] {
  const lower = base.toLowerCase();
  if (lower.includes("openai.com")) return FALLBACK_CHAINS.openai;
  if (lower.includes("gemini") || lower.includes("google")) return FALLBACK_CHAINS.gemini;
  // For OrcaRouter, OpenRouter, etc — only retry the same model (no cross-provider fallback)
  return [];
}



/** Core fetch — separated so both chat() and chatForModule() share it.
    Now includes: semantic caching, token caps, cost logging, and fallback. */
async function chatWithSettings(
  s: AISettings,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal; module?: string } = {}
): Promise<string> {
  if (!s.key) throw new Error("No API key configured");

  const moduleId = opts.module ?? "general";
  const sysPrompt = messages.find((m) => m.role === "system")?.content ?? "";
  const usrPrompt = messages.find((m) => m.role === "user")?.content ?? "";
  const maxTokens = Math.min(
    opts.maxTokens ?? getAiDefaults().maxTokens ?? 700,
    MODULE_MAX_TOKENS[moduleId] ?? 700,
  );
  const temperature = opts.temperature ?? getAiDefaults().temperature ?? 0.6;

  /* ── Step 0: Rate limit + quota (BYOK users are exempt — they pay their own API) */
  const cloudUser = getCloudState().user;
  if (cloudUser) {
    // Check per-user quota (daily/monthly limits set by admin)
    const quota = await checkUserQuota(cloudUser.id);
    if (!quota.allowed) {
      throw new Error(quota.reason ?? "AI quota exceeded.");
    }
    const tier = getTier();
    const rl = await checkRateLimit(cloudUser.id, moduleId, tier);
    if (!rl.allowed) {
      throw new Error(`Rate limit exceeded for ${moduleId}. Please wait a moment and try again.`);
    }
  }

  /* ── Step 1: Check semantic cache ───────────────────────────────────── */
  const start = Date.now();
  const cached = await cacheLookup(sysPrompt, usrPrompt, s.model);
  if (cached) {
    void logAiCost({
      module: moduleId,
      model: cached.model,
      inputTokens: 0,
      outputTokens: 0,
      cached: true,
      latencyMs: Date.now() - start,
    });
    return cached.response;
  }

  /* ── Step 2: Call API with fallback chain on failure ─────────────────── */
  const fallbackModels = getFallbackChain(s.base, s.model);
  const models = [s.model, ...fallbackModels.filter((m) => m !== s.model)];
  let lastError: string = "";

  for (const model of models) {
    try {
      const res = await fetch(s.base + "/chat/completions", {
        method: "POST",
        signal: opts.signal,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.key },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        // Rate limited or server error — try next model in chain
        try { const j = await res.json(); lastError = j.error?.message || `HTTP ${res.status}`; } catch { lastError = `HTTP ${res.status}`; }
        continue;
      }

      if (!res.ok) {
        let msg = "AI request failed (" + res.status + ")";
        try { const j = await res.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }

      const j = await res.json();
      const text = (j.choices?.[0]?.message?.content || "").trim();
      const usage = j.usage ?? {};
      const inputTokens = usage.prompt_tokens ?? Math.ceil((sysPrompt.length + usrPrompt.length) / 4);
      const outputTokens = usage.completion_tokens ?? Math.ceil(text.length / 4);

      /* ── Step 3: Cache the response + log cost ───────────────────────── */
      void cacheStore(sysPrompt, usrPrompt, model, text, inputTokens, outputTokens, moduleId);
      void logAiCost({
        module: moduleId,
        model,
        inputTokens,
        outputTokens,
        cached: false,
        latencyMs: Date.now() - start,
      });

      return text;
    } catch (e) {
      lastError = (e as Error).message;
      // Only continue fallback on network/abort errors, not on user errors
      if (opts.signal?.aborted) throw e;
      continue;
    }
  }

  throw new Error(`AI request failed after ${models.length} attempt${models.length > 1 ? "s" : ""}: ${lastError}` + (models.length === 1 ? `\nTip: The provider may not support this model. Try a different model in Settings → AI.` : ""));
}

export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const s = getSettings();
  /* BYOK (user's own key) always wins */
  if (s.key) return chatWithSettings(s, messages, opts);
  /* No local key — try the admin's cloud proxy (requires sign-in) */
  const user = getCloudState().user;
  if (user) return cloudChat(messages, opts);
  /* Neither BYOK nor signed in */
  throw new Error("Sign in to use AI, or add your own API key in Settings → AI.");
}

/** Server-side module-routed chat: the ai-chat edge function resolves the
    module's model (per-module override → provider default) so the configured
    provider key never reaches the client. Signed-in only. */
async function cloudChat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in or add your own API key to use AI.");
  const { data: session } = await client.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("Sign in or add your own API key to use AI.");
  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/ai-chat`, {
    method: "POST",
    signal: opts.signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      module: opts.module,
      messages,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "AI request failed");
  /* Log cost for cloud proxy calls */
  const userId = getCloudState().user?.id;
  const moduleId = opts.module ?? "coach";
  const text = (body as { text?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string }).text ?? "";
  const usage = (body as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
  const model = (body as { model?: string }).model ?? "unknown";
  if (userId) {
    void logAiCost({
      userId,
      module: moduleId,
      model,
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      cached: false,
    });
  }
  return text;
}

/** Module-aware chat — resolves the AI settings for the given module,
    then makes the same OpenAI-compatible request. Falls back to the
    global settings when no module override exists. */
export async function chatForModule(
  moduleId: ModuleId,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}
): Promise<string> {
  const s = resolveModuleModel(moduleId);
  return chatWithSettings(s, messages, opts);
}

export interface FeedbackContext {
  question: string;
  userAnswer: string;
  levelName: string;
  fieldName: string;
  companyName: string;
}

export async function getFeedback(ctx: FeedbackContext): Promise<string> {
  if (!aiEnabled()) {
    throw new Error("AI coaching is temporarily disabled — the offline engine still scores your answers.");
  }
  if (isPaywallEnabled() && aiCallsLeft() <= 0) {
    throw new Error("You've used your free AI feedback for today — upgrade to Pro for unlimited coaching.");
  }
  const sys =
    "Senior interviewer at " + (ctx.companyName || "a top tech company") +
    " for " + ctx.levelName + " " + ctx.fieldName + ". " +
    "Give concise actionable feedback. ~200 words max. Score /10, strongest parts, key gaps, one tip.";
  const usr =
    "Q: " + ctx.question + "\nA: " + (ctx.userAnswer || "(empty)") +
    "\nEvaluate score, strengths, gaps for this level, one improvement tip.";
  const out = await chat([{ role: "system", content: sys }, { role: "user", content: usr }], { maxTokens: 500, module: "feedback" });
  recordAiCall();
  void queueEvent("ai_call", { pct: ctx.userAnswer.length });
  return out;
}

export async function getHint(question: string, levelName: string): Promise<string> {
  if (!aiEnabled()) {
    throw new Error("AI coaching is temporarily disabled.");
  }
  if (isPaywallEnabled() && aiCallsLeft() <= 0) {
    throw new Error("You've used your free AI hints for today — upgrade to Pro for unlimited coaching.");
  }
  const sys = "Interview coach. ONE hint under 60 words for " + levelName + " candidate. Do not give the full answer.";
  const out = await chat([{ role: "system", content: sys }, { role: "user", content: "Q: " + question }], { maxTokens: 120, temperature: 0.8, module: "hint" });
  recordAiCall();
  void queueEvent("ai_call", { hint: true });
  return out;
}
