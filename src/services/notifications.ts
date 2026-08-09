/* Notification service — daily practice reminder + streak alerts via the PWA Notification API.
   No backend: the reminder is checked while the app runs (timer + on-open + on-focus), and
   delivery goes through the service worker so it shows even when the tab isn't focused. */

import type { SavedSession } from "../types";
import { streaks } from "./progress";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export interface ReminderPrefs {
  enabled: boolean;
  /** Local time "HH:MM" at which the daily reminder may fire. */
  time: string;
}

export const DEFAULT_PREFS: ReminderPrefs = { enabled: false, time: "19:00" };

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
