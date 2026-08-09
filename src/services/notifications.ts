/* Notification service — daily practice reminder + streak alerts via the PWA Notification API.
   No backend: the reminder is checked while the app runs (timer + on-open + on-focus), and
   delivery goes through the service worker so it shows even when the tab isn't focused. */

import type { SavedSession } from "../types";
import { applyProgress, buildRoadmap } from "./roadmap";
import { getGoal, getProfile, getProgress } from "./goal";
import { streaks } from "./progress";
import { FREE_LIMITS } from "./entitlements";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export interface ReminderPrefs {
  enabled: boolean;
  /** Local time "HH:MM" at which the daily reminder may fire. */
  time: string;
  /** Sunday-evening weekly digest summarizing progress and what's next. */
  weekly: boolean;
}

export const DEFAULT_PREFS: ReminderPrefs = { enabled: false, time: "19:00", weekly: false };

export function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission(): NotificationPermission {
  return isSupported() ? Notification.permission : "denied";
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function getPrefs(): ReminderPrefs {
  return { ...DEFAULT_PREFS, ...storageGet<Partial<ReminderPrefs>>(STORAGE_KEYS.notifPrefs, {}) };
}

export function savePrefs(p: ReminderPrefs): void {
  storageSet(STORAGE_KEYS.notifPrefs, p);
}

/* local calendar date (yyyy-mm-dd) — consistent across timezones */
const dayOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function practicedToday(sessions: SavedSession[], now = new Date()): boolean {
  const today = dayOf(now.getTime());
  return sessions.some(s => dayOf(s.date) === today);
}

/** Shows a notification through the service worker (works unfocused); falls back to a plain Notification. */
export async function fire(title: string, body: string): Promise<boolean> {
  if (!isSupported() || Notification.permission !== "granted") return false;
  const opts: NotificationOptions = {
    body,
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: "interviewiq",
    data: { url: "./" }
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return true;
    }
  } catch { /* fall through to plain Notification */ }
  try {
    new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}

export interface ReminderResult { fired: boolean; reason: string }

/** The daily-reminder decision: enabled + permission + not practiced today + past the set time + not already fired today. */
export function checkReminder(input: {
  sessions: SavedSession[];
  now?: Date;
  permission?: NotificationPermission;
}): ReminderResult {
  const now = input.now ?? new Date();
  if (!getPrefs().enabled) return { fired: false, reason: "disabled" };
  const permission = input.permission ?? getPermission();
  if (permission !== "granted") return { fired: false, reason: "permission:" + permission };
  if (practicedToday(input.sessions, now)) return { fired: false, reason: "practiced" };

  const [h, m] = getPrefs().time.split(":").map(Number);
  const at = new Date(now);
  at.setHours(h, m, 0, 0);
  if (now.getTime() < at.getTime()) return { fired: false, reason: "too-early" };

  const today = dayOf(now.getTime());
  if (storageGet<string>(STORAGE_KEYS.notifLast, "") === today) return { fired: false, reason: "already-notified" };

  storageSet(STORAGE_KEYS.notifLast, today);
  const streak = streaks(input.sessions, now).current;
  void fire(
    "🗓️ Daily reminder",
    streak > 0
      ? `You haven't practiced today — your ${streak}-day streak is on the line. One session keeps it alive.`
      : "You haven't practiced today. A quick session keeps the momentum going."
  );
  return { fired: true, reason: "fired" };
}

/* ------------------------------------------------------------------ */
/* Weekly digest                                                       */
/* ------------------------------------------------------------------ */

/** Monday-based calendar week key (yyyy-w#), so the digest fires once per week. */
const weekKey = (d = new Date()) => {
  const c = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (c.getUTCDay() + 6) % 7; // Mon = 0
  c.setUTCDate(c.getUTCDate() - day + 3);
  const week = Math.ceil(((c.getTime() - Date.UTC(c.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return `${c.getUTCFullYear()}-w${week}`;
};

/** Sessions completed in the trailing 7 days. */
export function practicedThisWeek(sessions: SavedSession[], now = new Date()): SavedSession[] {
  const cutoff = now.getTime() - 7 * 86400000;
  return sessions.filter(s => s.date >= cutoff);
}

/** Renders the weekly digest body from real state: this week's practice, streak,
    and (when a roadmap exists) what's still to do. Pure — no side effects. */
export function digestSummary(input: {
  sessions: SavedSession[];
  now?: Date;
}): { title: string; body: string } | null {
  const now = input.now ?? new Date();
  const week = practicedThisWeek(input.sessions, now);
  const streak = streaks(input.sessions, now).current;

  let extra = "";
  const goal = getGoal();
  const profile = getProfile();
  if (goal && profile) {
    try {
      const roadmap = applyProgress(buildRoadmap(goal, profile, input.sessions), getProgress());
      const all = roadmap.weeks.flatMap(w => w.topics);
      const done = all.filter(t => t.done).length;
      const p0 = all.filter(t => t.priority === "P0" && !t.done).length;
      const next = roadmap.weeks.find(w => w.status === "current") ?? roadmap.weeks[0];
      if (next) {
        const up = next.topics.slice(0, 3).map(t => t.label).join(", ");
        extra = ` · ${done}/${all.length} roadmap topics done, ${p0} P0 left — this week: ${up}.`;
      }
    } catch { /* roadmap is optional */ }
  }

  if (week.length === 0) {
    return {
      title: "📊 Weekly digest",
      body: `No sessions this week — your ${FREE_LIMITS.sessionsPerMonth}-session monthly budget is still waiting. A fresh week is a fresh start.${extra}`
    };
  }
  const avg = Math.round(week.reduce((s, x) => s + x.agg.pct, 0) / week.length);
  const days = new Set(week.map(s => dayOf(s.date))).size;
  return {
    title: "📊 Weekly digest",
    body: `${week.length} session${week.length === 1 ? "" : "s"} over ${days} day${days === 1 ? "" : "s"} this week · avg ${avg}% · ${streak > 0 ? `${streak}-day streak alive` : "streak reset"}.${extra}`
  };
}

/** Once-per-week digest: enabled + permission + not already fired this week. */
export function checkWeeklyDigest(input: {
  sessions: SavedSession[];
  now?: Date;
  permission?: NotificationPermission;
}): { fired: boolean; reason: string } {
  const now = input.now ?? new Date();
  if (!getPrefs().weekly) return { fired: false, reason: "disabled" };
  const permission = input.permission ?? getPermission();
  if (permission !== "granted") return { fired: false, reason: "permission:" + permission };

  const wk = weekKey(now);
  if (storageGet<string>(STORAGE_KEYS.notifLastWeekly, "") === wk) return { fired: false, reason: "already-notified" };

  const summary = digestSummary({ sessions: input.sessions, now });
  if (!summary) return { fired: false, reason: "no-data" };
  storageSet(STORAGE_KEYS.notifLastWeekly, wk);
  void fire(summary.title, summary.body);
  return { fired: true, reason: "fired" };
}

/** Returns a streak notification message on milestone streaks, else null (no spam). */
export function streakMilestoneMsg(streak: number): string | null {
  switch (streak) {
    case 2: return "🔥 2-day streak! Two days in a row — keep it rolling.";
    case 3: return "🔥 3-day streak! You're building a real habit.";
    case 5: return "🔥 5-day streak! Halfway to a full week.";
    case 7: return "🏆 7-day streak! A full week of daily practice.";
    case 14: return "🏆 14-day streak! Two weeks straight — unstoppable.";
    case 21: return "🏆 21-day streak! Three weeks — the habit is set.";
    case 30: return "👑 30-day streak! A month of daily practice.";
    default:
      return streak > 30 && streak % 7 === 0 ? `👑 ${streak}-day streak! Keep the run alive.` : null;
  }
}

/** Fires a streak notification when the new streak hits a milestone. */
export function notifyStreak(streak: number): void {
  const msg = streakMilestoneMsg(streak);
  if (msg) void fire("🔥 Streak!", msg);
}
