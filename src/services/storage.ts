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
  ragAlertWeek: "iq.ragAlertWeek",
  ragDigestWeek: "iq.ragDigestWeek",
  ragGapNotif: "iq.ragGapNotif",
  /* NOTE: the former admin email secrets (iq.ragEmailSecret, iq.ragEmailKey,
     iq.applyEmailSecret, iq.recsEmailSecret) were removed — secrets now live
     only as edge-function env vars (docs/app-security.md G3). */
  code: "iq.code",
  uiCode: "iq.uiCode",
  codingTrack: "iq.codingTrack",
  remoteConfig: "iq.remoteConfig",
  career: "iq.career",
  resume: "iq.resume",
  shortlist: "iq.shortlist",
  jobs: "iq.jobs",
  jobsRefreshedAt: "iq.jobsRefreshedAt",
  gapPlans: "iq.gapPlans",
  applyKit: "iq.applyKit",
  lastKit: "iq.lastKit",
  lastCompare: "iq.lastCompare",
  applyTrack: "iq.applyTrack",
  questionBank: "iq.questionBank",
  announcements: "iq.announcements",
  publishedQ: "iq.publishedQ",
  announceSeen: "iq.announceSeen",
  eventOutbox: "iq.eventOutbox",
  profileStats: "iq.profileStats",
  feedbackVotes: "iq.feedbackVotes",
  coachTopics: "iq.coachTopics",
  playgroundFocus: "iq.playgroundFocus",
  feedPageSize: "iq.feedPageSize",
  resumeStrictBanner: "iq.resumeStrictBanner",
  displayCurrency: "iq.displayCurrency",
  resourcesPersonal: "iq.resources.personal",
  resourcesApproved: "iq.resources.approved",
  externalApplyHint: "iq.externalApplyHint"
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
