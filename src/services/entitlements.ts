/* Freemium entitlements. The paywall is dormant until CONFIG.features.paywall
   flips on; usage is still metered so quotas work the moment it's enabled. */

import { STORAGE_KEYS, storageGet, storageSet } from "./storage";
import { BASE_LIMITS, getLimits, paywallOn } from "./remoteConfig";
import { getCloudState } from "./cloud";

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

/* Admins have ALL restrictions lifted — the paywall, session quotas and AI
   limits don't apply to them. This is independent of the Pro tier: a Pro
   user is NOT an admin and an admin is NOT automatically Pro (server-verified
   via is_admin()). Driven by services/admin.ts state through App.tsx. */
let adminUnlocked = false;

export function setAdminUnlocked(v: boolean): void {
  adminUnlocked = v;
}

export function adminUnlockedActive(): boolean {
  return adminUnlocked;
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
  if (adminUnlocked || teamPro) return "pro";
  /* Pro is an ACCOUNT property, never a device property. A signed-out visitor
     cannot legitimately hold Pro, so we ignore the locally-stored `iq.tier`
     for guests and fail closed to "free" — otherwise anyone could unlock Pro
     by writing `localStorage["iq.tier"]="pro"`. A signed-in user keeps Pro
     even offline: Supabase persists the session, so getCloudState().user stays
     truthy, and refreshEntitlement() has already mirrored the server tier into
     `iq.tier` (downgrading forgers on reconnect). During the brief window
     before initCloud() populates the session, a real Pro user reads as "free"
     — a safe, self-correcting degradation. */
  if (!getCloudState().user) return "free";
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
