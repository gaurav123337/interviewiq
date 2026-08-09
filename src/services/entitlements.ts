/* Freemium entitlements. The paywall is dormant until CONFIG.features.paywall
   flips on; usage is still metered so quotas work the moment it's enabled. */

import { CONFIG } from "../config";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export type Tier = "free" | "pro";

export interface Usage {
  month: string;
  sessions: number;
  day: string;
  aiToday: number;
}

export const FREE_LIMITS = { sessionsPerMonth: 3, aiPerDay: 5 };

export function isPaywallEnabled(): boolean {
  return CONFIG.features.paywall;
}

export function getTier(): Tier {
  return storageGet<Tier>(STORAGE_KEYS.tier, "free");
}

export function setTier(t: Tier): void {
  storageSet(STORAGE_KEYS.tier, t);
}

const monthKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}`;
const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Returns usage for the current month/day, rolling counters over automatically. */
export function getUsage(): Usage {
  const u = storageGet<{ month?: string; sessions?: number; day?: string; aiToday?: number }>(STORAGE_KEYS.usage, {});
  const m = monthKey();
  const d = dayKey();
  return {
    month: m,
    sessions: u.month === m ? (u.sessions ?? 0) : 0,
    day: d,
    aiToday: u.day === d ? (u.aiToday ?? 0) : 0
  };
}

export function recordSession(): void {
  const u = getUsage();
  storageSet(STORAGE_KEYS.usage, { month: u.month, sessions: u.sessions + 1, day: u.day, aiToday: u.aiToday });
}

export function recordAiCall(): void {
  const u = getUsage();
  storageSet(STORAGE_KEYS.usage, { month: u.month, sessions: u.sessions, day: u.day, aiToday: u.aiToday + 1 });
}

/** Free sessions left this month (Infinity for Pro). */
export function sessionsLeft(): number {
  if (getTier() === "pro") return Infinity;
  return Math.max(0, FREE_LIMITS.sessionsPerMonth - getUsage().sessions);
}

/** Free AI calls left today (Infinity for Pro). */
export function aiCallsLeft(): number {
  if (getTier() === "pro") return Infinity;
  return Math.max(0, FREE_LIMITS.aiPerDay - getUsage().aiToday);
}
