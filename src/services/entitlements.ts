/* Freemium entitlements. The paywall is dormant until CONFIG.features.paywall
   flips on; usage is still metered so quotas work the moment it's enabled. */

import { STORAGE_KEYS, storageGet, storageSet } from "./storage";
import { BASE_LIMITS, getLimits, paywallOn } from "./remoteConfig";

export type Tier = "free" | "pro";

/* A team seat (B2B) grants Pro without touching the local license. This flag
   lives in-memory and is driven by services/teams.ts after each refresh. */
let teamPro = false;

export function setTeamPro(v: boolean): void {
  teamPro = v;
}

export function teamProActive(): boolean {
  return teamPro;
}

export interface Usage {
  month: string;
  sessions: number;
  day: string;
  aiToday: number;
}

export const FREE_LIMITS = { ...BASE_LIMITS };

export function isPaywallEnabled(): boolean {
  return paywallOn();
}

export function getTier(): Tier {
  if (teamPro) return "pro";
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

/** Free sessions left this month (Infinity for Pro). Quotas can be tuned remotely. */
export function sessionsLeft(): number {
  if (getTier() === "pro") return Infinity;
  return Math.max(0, getLimits().sessionsPerMonth - getUsage().sessions);
}

/** Free AI calls left today (Infinity for Pro). Quotas can be tuned remotely. */
export function aiCallsLeft(): number {
  if (getTier() === "pro") return Infinity;
  return Math.max(0, getLimits().aiPerDay - getUsage().aiToday);
}
