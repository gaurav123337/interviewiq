/* Optional AI feedback via any OpenAI-compatible endpoint.
   Works fully offline without a key (curated engine); with a key, adds
   real generative feedback on top. Key stays in localStorage only.

   Architecture: This file is a FACADE that composes:
   - ai/settings.ts: API key, base URL, model management
   - ai/tokenEstimator.ts: Dynamic output token estimation
   - ai/fallbackChain.ts: Model fallback strategies
   - aiCache: Semantic caching and rate limiting
   - moduleModels: Per-module model resolution
   */

import { aiCallsLeft, isPaywallEnabled, recordAiCall } from "./services/entitlements";
import { aiEnabled } from "./services/remoteConfig";
import { queueEvent } from "./services/events";
import { getCloudState, getSupabaseClient } from "./services/cloud";
import { CONFIG } from "./config";
import type { AiModuleId } from "./services/aiProvider";
import { resolveModuleModel, type ModuleId } from "./services/moduleModels";
import { cacheLookup, cacheStore, logAiCost, checkRateLimit, checkUserQuota } from "./services/aiCache";
import { getTier } from "./services/entitlements";

// Re-export from extracted modules for backward compatibility
export { getSettings, saveSettings, clearKey, aiAvailable, aiDefaultModel } from "./services/ai/settings";
export type { AISettings } from "./services/ai/settings";
import { getSettings, aiAvailable, type AISettings } from "./services/ai/settings";
import { resolveMaxTokens } from "./services/ai/tokenEstimator";
import { getFallbackModels } from "./services/ai/fallbackChain";
import { getAiDefaults } from "./services/remoteConfig";

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

/* ── Core Chat Function ───────────────────────────────────────────────── */

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
  
  // Delegate token estimation to extracted module
  const maxTokens = resolveMaxTokens(messages, moduleId, opts.maxTokens);
  console.log(`[ai] module="${moduleId}" inputChars=${sysPrompt.length + usrPrompt.length} callerMax=${opts.maxTokens ?? 'none'} final=${maxTokens}`);
  const temperature = opts.temperature ?? getAiDefaults().temperature ?? 0.6;

  /* ── Step 0: Rate limit + quota (BYOK users are exempt — they pay their own API) */
  const cloudUser = getCloudState().user;
  if (cloudUser) {
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
  // Delegate fallback chain to extracted module
  const models = getFallbackModels(s.base, s.model);
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
  // Delegate token estimation to extracted module
  const moduleId = opts.module ?? "general";
  const resolvedMaxTokens = resolveMaxTokens(messages, moduleId, opts.maxTokens);
  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/ai-chat`, {
    method: "POST",
    signal: opts.signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      module: opts.module,
      messages,
      temperature: opts.temperature,
      maxTokens: resolvedMaxTokens
    })
  });
  const body = await res.json().catch(() => ({}));
  console.log(`[cloudChat] Edge function response: status=${res.status}, body keys=${Object.keys(body).join(',')}`);
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "AI request failed");
  /* Log cost for cloud proxy calls */
  const userId = getCloudState().user?.id;
  const logModuleId = opts.module ?? "coach";
  const text = (body as { text?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string }).text ?? "";
  console.log(`[cloudChat] text length=${text.length}, model=${(body as { model?: string }).model}, usage=${JSON.stringify((body as { usage?: unknown }).usage)}`);
  if (!text) console.warn(`[cloudChat] EMPTY response from edge function! Full body:`, JSON.stringify(body).slice(0, 500));
  const usage = (body as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
  const model = (body as { model?: string }).model ?? "unknown";
  if (userId) {
    void logAiCost({
      userId,
      module: logModuleId,
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
  /* BYOK (user's own key, possibly a per-module override) always wins */
  if (s.key) return chatWithSettings(s, messages, { ...opts, module: moduleId });
  /* No local key — route through the admin's cloud proxy (requires sign-in),
     passing the module so the edge function resolves its per-module model.
     Mirrors chat()'s ladder so module-routed features (e.g. the system-design
     tutor) work for signed-in users without a key instead of throwing. */
  if (getCloudState().user) return cloudChat(messages, { ...opts, module: moduleId as AiModuleId });
  /* Neither BYOK nor signed in */
  throw new Error("Sign in to use AI, or add your own API key in Settings → AI.");
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
