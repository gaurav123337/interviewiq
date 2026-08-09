import type { SavedSession } from "../types";
import { getSrs } from "./drill";

const DAY = 86_400_000;

/* local calendar date (yyyy-mm-dd) — keeps streak math consistent regardless of timezone */
const dayOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export interface Streak { current: number; longest: number }

/** Consecutive-day streaks from session history (a session today keeps the current streak alive). */
export function streaks(sessions: SavedSession[], today = new Date()): Streak {
  const days = new Set(sessions.map(s => dayOf(s.date)));
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let current = 0;
  if (!days.has(dayOf(cursor.getTime()))) cursor.setTime(cursor.getTime() - DAY);
  while (days.has(dayOf(cursor.getTime()))) {
    current++;
    cursor.setTime(cursor.getTime() - DAY);
  }

  const sorted = [...days].map(d => parseDate(d)).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev = -Infinity;
  for (const t of sorted) {
    run = t === prev + DAY ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  return { current, longest };
}

function parseDate(s: string): number {
  return new Date(s + "T00:00:00").getTime();
}

/** Score trend for the last `n` sessions, oldest first. */
export function scoresOverTime(sessions: SavedSession[], n = 12): { date: string; pct: number }[] {
  return sessions.slice(-n).map(s => ({ date: dayOf(s.date), pct: s.agg.pct }));
}

/** Weighted average coverage per category across all history. */
export function categoryMastery(sessions: SavedSession[]): { label: string; pct: number }[] {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const s of sessions) {
    for (const a of s.answers) {
      const cur = acc.get(a.q.catLabel) ?? { sum: 0, n: 0 };
      cur.sum += a.pct;
      cur.n++;
      acc.set(a.q.catLabel, cur);
    }
  }
  return [...acc.entries()]
    .map(([label, v]) => ({ label, pct: v.sum / v.n }))
    .sort((a, b) => b.pct - a.pct);
}

/** Number of drill cards currently due for review. */
export function cardsDueToday(now = Date.now()): number {
  return Object.values(getSrs()).filter(e => e.due <= now).length;
}

export function avgScore(sessions: SavedSession[]): number {
  if (!sessions.length) return 0;
  return sessions.reduce((a, s) => a + s.agg.score, 0) / sessions.length;
}
