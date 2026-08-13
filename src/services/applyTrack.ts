/* Apply Kit Phase 4 — application tracker.
   Per-job statuses (saved → applied → interview → offer/rejected), optional
   follow-up dates, and due-reminder detection. Pure + persisted so it works
   offline and survives re-opens. */

import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export type ApplyStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

export interface ApplyTrack {
  jobId: string;
  status: ApplyStatus;
  /** Epoch ms when the application was first marked applied (or later). */
  appliedAt: number | null;
  /** Epoch ms when the user should follow up. */
  followUpAt: number | null;
  /** True once a due follow-up has been surfaced, to avoid re-notifying. */
  followUpNotified: boolean;
  notes: string;
  updatedAt: number;
}

export const STATUS_META: Record<ApplyStatus, { label: string; emoji: string; tone: "ok" | "co" | "warn" | "bad" | "default" }> = {
  saved: { label: "Saved", emoji: "🔖", tone: "default" },
  applied: { label: "Applied", emoji: "📤", tone: "co" },
  interview: { label: "Interview", emoji: "🎤", tone: "ok" },
  offer: { label: "Offer", emoji: "🎉", tone: "ok" },
  rejected: { label: "Rejected", emoji: "💔", tone: "bad" }
};

/** All statuses in the pipeline order (for the dropdown). */
export const STATUS_ORDER: ApplyStatus[] = ["saved", "applied", "interview", "offer", "rejected"];

type TrackMap = Record<string, ApplyTrack>;

export function listTracks(): ApplyTrack[] {
  return Object.values(storageGet<TrackMap>(STORAGE_KEYS.applyTrack, {}));
}

export function getTrack(jobId: string): ApplyTrack | null {
  return storageGet<TrackMap>(STORAGE_KEYS.applyTrack, {})[jobId] ?? null;
}

export function saveTrack(t: ApplyTrack): void {
  const map = storageGet<TrackMap>(STORAGE_KEYS.applyTrack, {});
  map[t.jobId] = t;
  storageSet(STORAGE_KEYS.applyTrack, map);
}

/** Set (or create) the status for a job. Returns the new track. */
export function setStatus(jobId: string, status: ApplyStatus): ApplyTrack {
  const prev = getTrack(jobId);
  const t: ApplyTrack = {
    jobId,
    status,
    appliedAt: status === "applied" || status === "interview" || status === "offer"
      ? (prev?.appliedAt ?? Date.now())
      : (prev?.appliedAt ?? null),
    followUpAt: prev?.followUpAt ?? null,
    followUpNotified: prev?.followUpNotified ?? false,
    notes: prev?.notes ?? "",
    updatedAt: Date.now()
  };
  saveTrack(t);
  return t;
}

export function setFollowUp(jobId: string, followUpAt: number | null): ApplyTrack {
  const prev = getTrack(jobId);
  const t: ApplyTrack = {
    jobId,
    status: prev?.status ?? "saved",
    appliedAt: prev?.appliedAt ?? null,
    followUpAt,
    followUpNotified: false,
    notes: prev?.notes ?? "",
    updatedAt: Date.now()
  };
  saveTrack(t);
  return t;
}

/** Jobs whose follow-up date has passed and hasn't been surfaced yet. */
export function dueFollowUps(now = Date.now()): ApplyTrack[] {
  return listTracks().filter(t => t.followUpAt !== null && t.followUpAt <= now && !t.followUpNotified && t.status !== "rejected" && t.status !== "offer");
}

export function markFollowUpNotified(jobId: string): void {
  const prev = getTrack(jobId);
  if (!prev) return;
  saveTrack({ ...prev, followUpNotified: true, updatedAt: Date.now() });
}

/** Counts by status — for the tracker summary strip. */
export function trackSummary(): Record<ApplyStatus, number> {
  const s: Record<ApplyStatus, number> = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
  for (const t of listTracks()) s[t.status] += 1;
  return s;
}
