/* Server-side application digest composer (Apply Kit) — mirrors the client's
   applyTrack.applyDigest so the weekly cron emails users the SAME numbers the
   app's report modal shows. Pure + Deno-free so the client test-suite can
   exercise the exact code the cron runs. */

export type TrackStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

export type Track = {
  jobId: string;
  status: TrackStatus;
  appliedAt: number | null;
  followUpAt: number | null;
  followUpNotified?: boolean;
  notes?: string;
  rounds?: { id: string; label: string; at: number; questions?: string; went?: number | null; outcome?: string }[];
  updatedAt?: number;
};

const WEEK_MS = 7 * 24 * 3_600_000;

/** Compose the weekly digest from a user's tracked jobs. Returns null when the
    user has no tracked activity (nothing to email). */
export function composeDigest(tracks: Track[], now = Date.now()): string | null {
  if (!tracks.length) return null;
  const summary: Record<TrackStatus, number> = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
  for (const t of tracks) summary[t.status] += 1;
  const cutoff = now - 7 * WEEK_MS;
  const inWindow = tracks.filter(t => (t.appliedAt ?? 0) >= cutoff);
  const applied = inWindow.length;
  const interviews = inWindow.filter(t => t.status === "interview" || t.status === "offer").length;
  const offers = inWindow.filter(t => t.status === "offer").length;
  const responseRate = applied ? Math.round((interviews / applied) * 100) : 0;
  const due = tracks.filter(t => t.followUpAt !== null && t.followUpAt <= now && t.status !== "rejected" && t.status !== "offer");
  const active = tracks.filter(t => t.status === "interview").length;
  const lines = [
    `InterviewIQ — Weekly application digest (${new Date(now).toLocaleDateString()})`,
    "",
    `Portfolio: ${tracks.length} tracked · ${summary.applied} applied · ${summary.interview} interviewing · ${summary.offer} offers · ${summary.rejected} rejected`,
    `This week: ${applied} applied, ${interviews} interviews, ${offers} offers · response rate ${responseRate}%`
  ];
  if (due.length) lines.push("", `Follow-up due now (${due.length}):`, ...due.map(d => `  - ${d.jobId}`));
  if (active) lines.push("", `${active} application${active === 1 ? " is" : "s are"} in the interview stage — keep the round checklists current.`);
  return lines.join("\n");
}
