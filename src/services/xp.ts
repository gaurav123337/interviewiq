/* XP engine — experience points, levels, and achievements.

   XP is derived from session history + streaks — no server required. The only
   persisted state is XpData (claimed achievements + the leaderboard opt-in flag
   and display name), synced as a whole-blob lww key. The opt-in leaderboard
   itself lives in services/leaderboard.ts (real, Supabase-backed). */

import type { SavedSession } from "../types";
import { streaks } from "./progress";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

// ─── XP Constants ────────────────────────────────────────────────────

/** Base XP per question answered, scaled by score */
const BASE_XP_PER_Q = 10;

/** Bonus XP multiplier by session mode */
const MODE_MULTIPLIER: Record<string, number> = {
  standard: 1,
  journey: 1.2,
  mock: 1.5,
  diagnostic: 1.3,
  behavioral: 1.1,
};

/** Bonus XP for session completion (all questions answered) */
const COMPLETION_BONUS = 25;

/** Achievement definitions */
export interface Achievement {
  id: string;
  label: string;
  icon: string;
  description: string;
  condition: (stats: UserStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_session", label: "First Steps", icon: "🎯", description: "Complete your first interview session", condition: s => s.totalSessions >= 1 },
  { id: "ten_sessions", label: "Getting Serious", icon: "💪", description: "Complete 10 interview sessions", condition: s => s.totalSessions >= 10 },
  { id: "fifty_sessions", label: "Dedicated", icon: "🔥", description: "Complete 50 interview sessions", condition: s => s.totalSessions >= 50 },
  { id: "hundred_sessions", label: "Centurion", icon: "🏆", description: "Complete 100 interview sessions", condition: s => s.totalSessions >= 100 },
  { id: "streak_3", label: "Hat Trick", icon: "⚡", description: "Maintain a 3-day streak", condition: s => s.longestStreak >= 3 },
  { id: "streak_7", label: "Week Warrior", icon: "🗓️", description: "Maintain a 7-day streak", condition: s => s.longestStreak >= 7 },
  { id: "streak_14", label: "Fortnight Fighter", icon: "🛡️", description: "Maintain a 14-day streak", condition: s => s.longestStreak >= 14 },
  { id: "streak_30", label: "Monthly Master", icon: "👑", description: "Maintain a 30-day streak", condition: s => s.longestStreak >= 30 },
  { id: "perfect_score", label: "Flawless", icon: "💎", description: "Score 100% on any session", condition: s => s.bestScore >= 100 },
  { id: "avg_80", label: "High Performer", icon: "🌟", description: "Reach 80% average score across all sessions", condition: s => s.avgScore >= 80 },
  { id: "total_questions_100", label: "Century of Questions", icon: "📚", description: "Answer 100 questions total", condition: s => s.totalQuestions >= 100 },
  { id: "total_questions_500", label: "Question Veteran", icon: "🎓", description: "Answer 500 questions total", condition: s => s.totalQuestions >= 500 },
  { id: "xp_1000", label: "XP Hunter", icon: "🏹", description: "Earn 1,000 XP", condition: s => s.totalXP >= 1000 },
  { id: "xp_5000", label: "XP Legend", icon: "🐉", description: "Earn 5,000 XP", condition: s => s.totalXP >= 5000 },
  { id: "xp_10000", label: "XP Mythic", icon: "🌋", description: "Earn 10,000 XP", condition: s => s.totalXP >= 10000 },
  { id: "all_modes", label: "Versatile", icon: "🎭", description: "Try all session modes", condition: s => s.modesUsed.size >= 5 },
];

// ─── XP Calculation ──────────────────────────────────────────────────

/** XP level thresholds (geometric progression) */
const LEVEL_XP = (level: number): number => Math.floor(100 * Math.pow(1.5, level - 1));

/** Current level given total XP */
export function xpLevel(totalXP: number): { level: number; currentXP: number; nextXP: number; progress: number } {
  let level = 1;
  let remaining = totalXP;
  while (remaining >= LEVEL_XP(level)) {
    remaining -= LEVEL_XP(level);
    level++;
  }
  const nextXP = LEVEL_XP(level);
  return { level, currentXP: remaining, nextXP, progress: nextXP > 0 ? remaining / nextXP : 0 };
}

/** Calculate XP earned from a single completed session */
export function xpFromSession(session: SavedSession): number {
  let xp = 0;

  // XP per question (scaled by score)
  for (const a of session.answers) {
    const base = BASE_XP_PER_Q;
    const scoreMultiplier = 0.5 + (a.pct / 100) * 0.5; // 0.5x–1.0x based on score
    xp += Math.round(base * scoreMultiplier);
  }

  // Mode multiplier
  const modeMult = MODE_MULTIPLIER[session.config.mode] ?? 1;
  xp = Math.round(xp * modeMult);

  // Completion bonus
  if (session.config.count > 0 && session.answers.length >= session.config.count) {
    xp += COMPLETION_BONUS;
  }

  return xp;
}

/** Total XP from all sessions */
export function totalXPFromSessions(sessions: SavedSession[]): number {
  return sessions.reduce((sum, s) => sum + xpFromSession(s), 0);
}

// ─── User Stats ──────────────────────────────────────────────────────

export interface UserStats {
  totalSessions: number;
  totalQuestions: number;
  totalXP: number;
  avgScore: number;
  bestScore: number;
  longestStreak: number;
  currentStreak: number;
  modesUsed: Set<string>;
  unlockedAchievements: string[];
}

/** Compute full user stats from session history */
export function computeStats(sessions: SavedSession[]): UserStats {
  const st = streaks(sessions);
  const totalQ = sessions.reduce((sum, s) => sum + s.answers.length, 0);
  const totalPoints = sessions.reduce((sum, s) => sum + s.agg.score, 0);
  const avgScore = sessions.length > 0 ? Math.round(totalPoints / sessions.length) : 0;
  const bestScore = sessions.length > 0 ? Math.max(...sessions.map(s => s.agg.pct)) : 0;
  const modesUsed = new Set(sessions.map(s => s.config.mode));
  const xp = totalXPFromSessions(sessions);

  const stats: UserStats = {
    totalSessions: sessions.length,
    totalQuestions: totalQ,
    totalXP: xp,
    avgScore,
    bestScore,
    longestStreak: st.longest,
    currentStreak: st.current,
    modesUsed,
    unlockedAchievements: [],
  };

  stats.unlockedAchievements = ACHIEVEMENTS.filter(a => a.condition(stats)).map(a => a.id);
  return stats;
}

// ─── Persistent XP Data ──────────────────────────────────────────────

export interface XpData {
  /** Manually claimed achievements (auto-detected are derived from sessions) */
  claimedAchievements: string[];
  /** Opt-in leaderboard name */
  leaderboardName: string | null;
  /** Whether opted into leaderboard */
  leaderboardOptIn: boolean;
}

const DEFAULT_XP: XpData = { claimedAchievements: [], leaderboardName: null, leaderboardOptIn: false };

export function loadXp(): XpData {
  return storageGet<XpData>(STORAGE_KEYS.xp, DEFAULT_XP);
}

export function saveXp(data: XpData): void {
  storageSet(STORAGE_KEYS.xp, data);
}

/**
 * Marks a newly-earned achievement as claimed (dismisses its "New!" badge).
 * Idempotent and validated: unknown ids and already-claimed ids are no-ops
 * that return the current blob unchanged. Persists + syncs via saveXp.
 */
export function claimAchievement(id: string): XpData {
  const data = loadXp();
  const known = ACHIEVEMENTS.some(a => a.id === id);
  if (!known || data.claimedAchievements.includes(id)) return data;
  const next: XpData = { ...data, claimedAchievements: [...data.claimedAchievements, id] };
  saveXp(next);
  return next;
}

