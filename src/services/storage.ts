/* Storage repository — the only module allowed to touch localStorage.
   Centralizes the stringly-typed keys and JSON serialization.

   This is also the sync seam: every write funnels through storageSet /
   storageRemove, which notify subscribers. The sync engine (services/sync.ts)
   subscribes here to push changes to a remote — the feature layer never
   changes. Cross-tab writes are additionally observable via the browser's
   native "storage" event. */

export const STORAGE_KEYS = {
  onboard: "iq.onboard",
  settings: "iq.settings",
  sessions: "iq.sessions",
  apiKey: "iq.apiKey",
  apiBase: "iq.apiBase",
  apiModel: "iq.apiModel",
  tier: "iq.tier",
  usage: "iq.usage",
  licenseKey: "iq.licenseKey",
  notifPrefs: "iq.notifPrefs",
  notifLast: "iq.notifLast",
  drillSrs: "iq.drillSrs",
  syncMeta: "iq.syncMeta",
  goal: "iq.goal",
  skills: "iq.skills",
  roadmapProg: "iq.roadmapProg",
  theme: "iq.theme",
  notifLastWeekly: "iq.notifLastWeekly",
  code: "iq.code",
  uiCode: "iq.uiCode",
  codingTrack: "iq.codingTrack",
  remoteConfig: "iq.remoteConfig",
  announcements: "iq.announcements",
  publishedQ: "iq.publishedQ",
  announceSeen: "iq.announceSeen",
  eventOutbox: "iq.eventOutbox",
  profileStats: "iq.profileStats",
  feedbackVotes: "iq.feedbackVotes",
  coachTopics: "iq.coachTopics"
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
  emit(key);
}

export function storageRemove(key: string): void {
  localStorage.removeItem(key);
  emit(key);
}

/* ---------- change notifications (sync seam) ---------- */

type ChangeListener = (key: string) => void;
const listeners = new Set<ChangeListener>();

/** Subscribes to local writes/removals. Returns an unsubscribe function. */
export function subscribeStorage(fn: ChangeListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function emit(key: string): void {
  for (const fn of listeners) {
    try { fn(key); } catch { /* a listener must never break storage */ }
  }
}
