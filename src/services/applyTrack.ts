/* Apply Kit Phase 4 — application tracker.
   Per-job statuses (saved → applied → interview → offer/rejected), optional
   follow-up dates, and due-reminder detection. Pure + persisted so it works
   offline and survives re-opens. */

import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export type ApplyStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

/** One interview round for a tracked application — a per-round checklist. */
export interface InterviewRound {
  id: string;
  label: string;
  /** Epoch ms the round happened (or is scheduled). */
  at: number;
  /** What was asked / what to review before the next round. */
  questions: string;
  /** How it went (1-5). */
  went: number | null;
  outcome: "pending" | "passed" | "failed";
}

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
  /** Interview rounds for this application (empty unless status is interview). */
  rounds: InterviewRound[];
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
    rounds: prev?.rounds ?? [],
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
    rounds: prev?.rounds ?? [],
    updatedAt: Date.now()
  };
  saveTrack(t);
  return t;
}

/** Upsert one interview round (by id) on a job's track. Pure + testable. */
export function saveRound(jobId: string, round: InterviewRound): ApplyTrack {
  const prev = getTrack(jobId);
  const rounds = [...(prev?.rounds ?? [])];
  const idx = rounds.findIndex(r => r.id === round.id);
  if (idx >= 0) rounds[idx] = round;
  else rounds.push(round);
  rounds.sort((a, b) => b.at - a.at);
  const t: ApplyTrack = {
    jobId,
    status: prev?.status ?? "saved",
    appliedAt: prev?.appliedAt ?? null,
    followUpAt: prev?.followUpAt ?? null,
    followUpNotified: prev?.followUpNotified ?? false,
    notes: prev?.notes ?? "",
    rounds,
    updatedAt: Date.now()
  };
  saveTrack(t);
  return t;
}

export function removeRound(jobId: string, roundId: string): ApplyTrack | null {
  const prev = getTrack(jobId);
  if (!prev) return null;
  const t: ApplyTrack = { ...prev, rounds: prev.rounds.filter(r => r.id !== roundId), updatedAt: Date.now() };
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

/* ------------------------------------------------------------------ */
/* Weekly report                                                       */
/* ------------------------------------------------------------------ */

const WEEK_MS = 7 * 24 * 3_600_000;

/** Aggregated tracker activity over the trailing window — for the weekly
    application report. Pure + testable. */
export function weeklyReport(now = Date.now()): {
  windowDays: number;
  applied: number;
  interviews: number;
  offers: number;
  rejections: number;
  /** interviews + offers ÷ applications in the window (0 when none). */
  responseRate: number;
  /** follow-ups due in the window that haven't been actioned (still applied). */
  followUpsDue: number;
  /** follow-ups due in the window that were actioned (moved past applied). */
  followUpsDone: number;
  byWeek: { label: string; applied: number; interviews: number; offers: number }[];
} {
  const tracks = listTracks();
  const cutoff = now - 7 * WEEK_MS;
  const inWindow = tracks.filter(t => (t.appliedAt ?? 0) >= cutoff);
  const applied = inWindow.length;
  const interviews = inWindow.filter(t => t.status === "interview" || t.status === "offer").length;
  const offers = inWindow.filter(t => t.status === "offer").length;
  const rejections = inWindow.filter(t => t.status === "rejected").length;

  /* follow-up completion: any track with a due follow-up in the window */
  const hadFollowUp = tracks.filter(t => t.followUpAt !== null && t.followUpAt >= cutoff && t.followUpAt <= now);
  const followUpsDone = hadFollowUp.filter(t => t.status !== "applied" && t.status !== "saved").length;
  const followUpsDue = hadFollowUp.length - followUpsDone;

  /* per-week buckets (last 4 weeks, oldest first) */
  const byWeek: { label: string; applied: number; interviews: number; offers: number }[] = [];
  for (let w = 3; w >= 0; w--) {
    const start = now - (w + 1) * WEEK_MS;
    const end = now - w * WEEK_MS;
    const wk = tracks.filter(t => (t.appliedAt ?? 0) >= start && (t.appliedAt ?? 0) < end);
    const label = new Date(end).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    byWeek.push({
      label,
      applied: wk.length,
      interviews: wk.filter(t => t.status === "interview" || t.status === "offer").length,
      offers: wk.filter(t => t.status === "offer").length
    });
  }

  return {
    windowDays: 7,
    applied,
    interviews,
    offers,
    rejections,
    responseRate: applied ? Math.round((interviews / applied) * 100) : 0,
    followUpsDue,
    followUpsDone,
    byWeek
  };
}

/* ------------------------------------------------------------------ */
/* Follow-up message drafts                                            */
/* ------------------------------------------------------------------ */

/** A short, professional follow-up message for a given stage. Pure + testable. */
export function followUpDraft(status: ApplyStatus, jobTitle: string, company: string, daysSince: number): string {
  const role = `${jobTitle} at ${company}`;
  if (status === "interview") {
    return [
      `Hi there,`,
      ``,
      `Thank you again for the opportunity to interview for the ${role} role. I really enjoyed learning more about the team and the problems you're solving.`,
      ``,
      `I wanted to follow up on the next steps — I remain very interested in the position and would be glad to provide anything further that would help with the decision.`,
      ``,
      `Best regards,`
    ].join("\n");
  }
  if (status === "offer") {
    return [
      `Hi there,`,
      ``,
      `Thank you for the offer for the ${role} role — I'm genuinely excited about the opportunity.`,
      ``,
      `I'm reviewing the details and will get back to you by [date]. Please let me know if there's anything else you need from my side in the meantime.`,
      ``,
      `Best regards,`
    ].join("\n");
  }
  /* applied — a gentle nudge after a week or two */
  const time = daysSince >= 14 ? "a couple of weeks" : "a week or so";
  return [
    `Hi there,`,
    ``,
    `I applied for the ${role} role about ${time} ago and wanted to check in on the status of my application.`,
    ``,
    `I'm very excited about the opportunity to join ${company} and would welcome the chance to discuss how my background could contribute to the team.`,
    ``,
    `Best regards,`
  ].join("\n");
}
