/* Storage repository — the only module allowed to touch localStorage.
   Centralizes the stringly-typed keys and JSON serialization. */

export const STORAGE_KEYS = {
  onboard: "iq.onboard",
  settings: "iq.settings",
  sessions: "iq.sessions",
  apiKey: "iq.apiKey",
  apiBase: "iq.apiBase",
  apiModel: "iq.apiModel",
  tier: "iq.tier",
  usage: "iq.usage",
  licenseKey: "iq.licenseKey"
} as const;

export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function storageSet(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function storageRemove(key: string): void {
  localStorage.removeItem(key);
}
