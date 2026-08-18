/* Optional AI feedback via any OpenAI-compatible endpoint.
   Works fully offline without a key (curated engine); with a key, adds
   real generative feedback on top. Key stays in localStorage only. */

import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "./services/storage";
import { aiCallsLeft, isPaywallEnabled, recordAiCall } from "./services/entitlements";
import { aiEnabled, getAiDefaults } from "./services/remoteConfig";
import { queueEvent } from "./services/events";
import { resolveModuleModel, type ModuleId } from "./services/moduleModels";

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

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}): Promise<string> {
  const s = getSettings();
  if (!s.key) throw new Error("No API key configured");
  return chatWithSettings(s, messages, opts);
}

/** Core fetch — separated so both chat() and chatForModule() share it. */
async function chatWithSettings(
  s: AISettings,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}
): Promise<string> {
  if (!s.key) throw new Error("No API key configured");
  const res = await fetch(s.base + "/chat/completions", {
    method: "POST",
    signal: opts.signal,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.key },
    body: JSON.stringify({
      model: s.model,
      messages,
      temperature: opts.temperature ?? getAiDefaults().temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? getAiDefaults().maxTokens ?? 700
    })
  });
  if (!res.ok) {
    let msg = "AI request failed (" + res.status + ")";
    try { const j = await res.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const j = await res.json();
  return (j.choices?.[0]?.message?.content || "").trim();
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
    "You are a senior technical interviewer at " + (ctx.companyName || "a top tech company") +
    " conducting an interview for a " + ctx.levelName + " role in " + ctx.fieldName + ". " +
    "Give concise, specific, actionable feedback on the candidate's answer. " +
    "Respond with at most ~200 words, using plain prose with short sections. Do not invent quotes from the candidate.";
  const usr =
    "INTERVIEW QUESTION:\n" + ctx.question + "\n\n" +
    "CANDIDATE'S ANSWER:\n" + (ctx.userAnswer || "(no answer given)") + "\n\n" +
    "Evaluate: (1) Overall quality score /10 and why, (2) the strongest parts, " +
    "(3) the most important gaps for this level, (4) one concrete tip to improve. " +
    "If the answer is empty or off-topic, say so directly and coach them on how to approach it.";
  const out = await chat([{ role: "system", content: sys }, { role: "user", content: usr }], { maxTokens: 500 });
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
  const sys = "You are a helpful interview coach. Give ONE short hint (under 60 words) to help a " +
    levelName + " candidate start answering this interview question. Do not give the full answer.";
  const out = await chat([{ role: "system", content: sys }, { role: "user", content: "Question: " + question }], { maxTokens: 120, temperature: 0.8 });
  recordAiCall();
  void queueEvent("ai_call", { hint: true });
  return out;
}
