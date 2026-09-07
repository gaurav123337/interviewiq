/* Leaderboard — real, opt-in, Supabase-backed peer ranking (Phase 3, item 17).

   Replaces the former hardcoded fake peers in xp.ts. Data lives in the
   public.leaderboard table (see supabase/leaderboard.sql): a row exists only
   after the user opts in, so the public-read board exposes nothing but
   self-published display-name + derived stats. All calls no-op safely when
   cloud sync is off (client null) or the user is signed out.

   The stats are a client snapshot (XP is derived from the user's own session
   history), hence self-reported; RLS still guarantees a user can only write
   their OWN row, so entries can't be tampered with or impersonated. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./cloud";

/** One row rendered in the leaderboard UI. Moved here from xp.ts (item 17). */
export interface LeaderboardEntry {
  /** row primary key — a stable, unique React key (public; RLS gates writes). */
  user_id: string;
  rank: number;
  name: string;
  xp: number;
  level: number;
  streak: number;
  sessions: number;
  isYou?: boolean;
  /** true only for the self-row appended when the user ranks outside the top N. */
  appended?: boolean;
}

/** The signed-in user's self-reported stats, published on opt-in. */
export interface LeaderboardSnapshot {
  name: string;
  xp: number;
  level: number;
  streak: number;
  sessions: number;
}

/** Shape of a public.leaderboard row as selected below. */
interface LeaderboardRow {
  user_id: string;
  name: string;
  xp: number;
  level: number;
  streak: number;
  sessions: number;
}

const SELECT_COLS = "user_id, name, xp, level, streak, sessions";
const NAME_MAX = 24;

async function currentUid(client: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await client.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

function toEntry(row: LeaderboardRow, rank: number, uid: string | null, appended = false): LeaderboardEntry {
  return {
    user_id: row.user_id,
    rank,
    name: row.name,
    xp: row.xp,
    level: row.level,
    streak: row.streak,
    sessions: row.sessions,
    isYou: uid != null && row.user_id === uid,
    appended,
  };
}

/**
 * Fetches the top `limit` entries by XP. Returns [] when cloud is off/unreachable
 * (never fabricated peers). If the signed-in user has opted in but ranks OUTSIDE
 * the top N, their own row + true rank is appended so they always see themselves.
 */
export async function fetchLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const uid = await currentUid(client);

  const { data, error } = await client
    .from("leaderboard")
    .select(SELECT_COLS)
    .order("xp", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const rows = data as LeaderboardRow[];
  /* Competition ranking (ties share a rank; the next distinct XP skips accordingly)
     so the visible top-N ranks use the SAME scheme as the appended self-row below,
     which is count(xp > mine) + 1. With the old ordinal (i + 1) ranking, an
     out-of-top-N tie-loser's competition rank collided with a top-N row's ordinal
     rank — duplicating a React key and handing a podium medal to a non-podium user. */
  const entries: LeaderboardEntry[] = [];
  let rank = 0;
  let prevXp = Number.POSITIVE_INFINITY;
  rows.forEach((row, i) => {
    if (row.xp !== prevXp) { rank = i + 1; prevXp = row.xp; }
    entries.push(toEntry(row, rank, uid));
  });

  /* Signed in + opted in but not in the visible top N → append self honestly. */
  if (uid && !entries.some(e => e.isYou)) {
    const mineRes = await client.from("leaderboard").select(SELECT_COLS).eq("user_id", uid).maybeSingle();
    const mine = mineRes.data as LeaderboardRow | null;
    if (mine) {
      const ahead = await client
        .from("leaderboard")
        .select("user_id", { count: "exact", head: true })
        .gt("xp", mine.xp);
      const myRank = (ahead.count ?? entries.length) + 1;
      entries.push(toEntry(mine, myRank, uid, true));
    }
  }

  return entries;
}

/** Publishes (upserts) the signed-in user's row — called on opt-in and refresh. */
export async function uploadMyLeaderboardRow(
  snap: LeaderboardSnapshot,
  now: number = Date.now()
): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  const uid = await currentUid(client);
  if (!uid) return { ok: false, error: "Not signed in" };
  try {
    const { error } = await client.from("leaderboard").upsert(
      {
        user_id: uid,
        name: snap.name.trim().slice(0, NAME_MAX) || "Anonymous",
        xp: snap.xp,
        level: snap.level,
        streak: snap.streak,
        sessions: snap.sessions,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Removes the signed-in user's row — called on opt-out. */
export async function removeMyLeaderboardRow(): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  const uid = await currentUid(client);
  if (!uid) return { ok: false, error: "Not signed in" };
  try {
    const { error } = await client.from("leaderboard").delete().eq("user_id", uid);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
