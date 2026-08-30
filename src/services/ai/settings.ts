/**
 * AI Settings — manages API key, base URL, and model selection.
 * 
 * SRP: Only responsible for reading/writing AI settings to storage.
 * No business logic, no API calls, no token estimation.
 */

import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "../storage";
import { getAiDefaults } from "../remoteConfig";

export const DEFAULT_BASE = "https://api.openai.com/v1";
export const DEFAULT_MODEL = "gpt-4o-mini";

export interface AISettings {
  key: string;
  base: string;
  model: string;
}

/** Get the default model from remote config or fallback */
export function aiDefaultModel(): string {
  return getAiDefaults().model || DEFAULT_MODEL;
}

/** Read current AI settings from storage */
export function getSettings(): AISettings {
  return {
    key: storageGet(STORAGE_KEYS.apiKey, ""),
    base: storageGet(STORAGE_KEYS.apiBase, DEFAULT_BASE),
    model: storageGet(STORAGE_KEYS.apiModel, aiDefaultModel())
  };
}

/** Save AI settings to storage */
export function saveSettings(s: AISettings): void {
  storageSet(STORAGE_KEYS.apiKey, s.key.trim());
  storageSet(STORAGE_KEYS.apiBase, s.base.trim().replace(/\/+$/, ""));
  storageSet(STORAGE_KEYS.apiModel, s.model.trim() || DEFAULT_MODEL);
}

/** Remove the API key from storage */
export function clearKey(): void {
  storageRemove(STORAGE_KEYS.apiKey);
}

/** Check if an API key is configured */
export function aiAvailable(): boolean {
  return !!getSettings().key;
}
