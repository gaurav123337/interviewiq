/* XP engine — experience points, levels, achievements, and leaderboard.

   XP is derived from session history + streaks — no server required for
   the core calculation. Leaderboard is opt-in and anonymized; the
   localStorage snapshot can be synced to Supabase when the user signs in. */

import type { SavedSession } from "../types";
import { streaks } from "./progress";
import { storageGet, storageSet } from "./storage";

// ─── XP Constants ────────────────────────────────────────────────────

const XP_STORAGE_KEY = "iq.xp";

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
  return storageGet<XpData>(XP_STORAGE_KEY, DEFAULT_XP);
}

export function saveXp(data: XpData): void {
  storageSet(XP_STORAGE_KEY, data);
}

// ─── Leaderboard (local mock + Supabase-ready) ───────────────────────

export interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: number;
  level: number;
  streak: number;
  sessions: number;
  isYou?: boolean;
}

/**
 * Generates a leaderboard by combining the user's stats with simulated
 * anonymous peers. When Supabase is wired, replace this with a real RPC.
 */
export function generateLeaderboard(sessions: SavedSession[], myName: string | null): LeaderboardEntry[] {
  const stats = computeStats(sessions);
  const lv = xpLevel(stats.totalXP);

  // Simulated peers (diverse skill levels)
  const peers: { name: string; xp: number; sessions: number; streak: number }[] = [
    { name: "Alex K.", xp: 12400, sessions: 87, streak: 21 },
    { name: "Priya S.", xp: 9800, sessions: 64, streak: 14 },
    { name: "Marcus T.", xp: 7200, sessions: 52, streak: 7 },
    { name: "Sofia L.", xp: 5600, sessions: 38, streak: 5 },
    { name: "Chen W.", xp: 4100, sessions: 29, streak: 3 },
    { name: "Jordan R.", xp: 3200, sessions: 22, streak: 2 },
    { name: "Aisha M.", xp: 2100, sessions: 15, streak: 1 },
    { name: "Liam O.", xp: 1400, sessions: 10, streak: 1 },
    { name: "Yuki N.", xp: 800, sessions: 6, streak: 0 },
    { name: "Diego F.", xp: 350, sessions: 3, streak: 0 },
  ];

  // Add the user
  const all = [...peers.map(p => ({
    rank: 0,
    name: p.name,
    xp: p.xp,
    level: xpLevel(p.xp).level,
    streak: p.streak,
    sessions: p.sessions,
    isYou: false,
  }))];
  
  if (myName) {
    all.push({
      rank: 0,
      name: myName,
      xp: stats.totalXP,
      level: lv.level,
      streak: stats.currentStreak,
      sessions: stats.totalSessions,
      isYou: true,
    });
  }

  // Sort by XP descending, assign ranks
  all.sort((a, b) => b.xp - a.xp);
  all.forEach((e, i) => { e.rank = i + 1; });

  return all;
}
