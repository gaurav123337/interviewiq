import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/* tests must not depend on the deployed credentials in src/config.ts */
vi.mock("../config", () => ({
  CONFIG: {
    productName: "InterviewIQ",
    features: { paywall: false },
    supabase: { url: "", anonKey: "" }
  }
}));

import { fetchLeaderboard, uploadMyLeaderboardRow, removeMyLeaderboardRow } from "../services/leaderboard";
import { setTestClient } from "../services/cloud";

/* the fake-client seam must not leak between tests (incl. the cloud-off cases) */
afterEach(() => setTestClient(null));

interface Row {
  user_id: string;
  name: string;
  xp: number;
  level: number;
  streak: number;
  sessions: number;
}

interface Calls {
  upsert?: { row: Row & { updated_at: number }; opts: unknown };
  del?: { col: string; val: unknown };
}

interface FakeOpts {
  uid?: string | null;
  rows?: Row[];
  mineRow?: Row | null;
  aheadCount?: number;
  error?: { message: string } | null;
}

/** Minimal fake of the supabase-js chain API used by leaderboard.ts. */
function makeClient(opts: FakeOpts) {
  const calls: Calls = {};
  const error = opts.error ?? null;
  const client = {
    auth: {
      getUser: async () =>
        opts.uid === null
          ? { data: { user: null }, error: null }
          : { data: { user: { id: opts.uid ?? "user-1" } }, error: null }
    },
    from: (_table: string) => ({
      select: (_cols: string, _selOpts?: unknown) => ({
        order: (_col: string, _o: unknown) => ({
          limit: async (_n: number) => ({ data: error ? null : opts.rows ?? [], error })
        }),
        eq: (_col: string, _val: unknown) => ({
          maybeSingle: async () => ({ data: opts.mineRow ?? null, error })
        }),
        gt: async (_col: string, _val: unknown) => ({ count: opts.aheadCount ?? 0, error })
      }),
      upsert: async (row: Row & { updated_at: number }, opts2: unknown) => {
        calls.upsert = { row, opts: opts2 };
        return { error };
      },
      delete: () => ({
        eq: async (col: string, val: unknown) => {
          calls.del = { col, val };
          return { error };
        }
      })
    })
  };
  return { client, calls };
}

const inject = (client: ReturnType<typeof makeClient>["client"]) =>
  setTestClient(client as unknown as SupabaseClient);

describe("fetchLeaderboard", () => {
  it("returns [] when cloud sync is not configured", async () => {
    expect(await fetchLeaderboard()).toEqual([]);
  });

  it("maps rows to ranked entries and tags the signed-in user", async () => {
    const rows: Row[] = [
      { user_id: "u1", name: "Ann", xp: 500, level: 3, streak: 4, sessions: 20 },
      { user_id: "user-1", name: "Me", xp: 300, level: 2, streak: 2, sessions: 10 },
      { user_id: "u3", name: "Cy", xp: 100, level: 1, streak: 0, sessions: 3 }
    ];
    const { client } = makeClient({ uid: "user-1", rows });
    inject(client);
    const board = await fetchLeaderboard(10);
    expect(board.map(e => e.rank)).toEqual([1, 2, 3]);
    expect(board[0].isYou).toBe(false);
    expect(board[1].isYou).toBe(true);
    expect(board[1].name).toBe("Me");
  });

  it("does not append a duplicate when the user is already in the top N", async () => {
    const rows: Row[] = [
      { user_id: "user-1", name: "Me", xp: 500, level: 3, streak: 4, sessions: 20 },
      { user_id: "u2", name: "Bo", xp: 400, level: 3, streak: 1, sessions: 15 }
    ];
    const { client } = makeClient({ uid: "user-1", rows });
    inject(client);
    const board = await fetchLeaderboard(10);
    expect(board).toHaveLength(2);
    expect(board.filter(e => e.isYou)).toHaveLength(1);
  });

  it("appends the signed-in user's own row + true rank when outside the top N", async () => {
    const rows: Row[] = [
      { user_id: "u1", name: "Ann", xp: 500, level: 3, streak: 4, sessions: 20 },
      { user_id: "u2", name: "Bo", xp: 400, level: 3, streak: 1, sessions: 15 }
    ];
    const mineRow: Row = { user_id: "user-1", name: "Me", xp: 50, level: 1, streak: 0, sessions: 2 };
    const { client } = makeClient({ uid: "user-1", rows, mineRow, aheadCount: 7 });
    inject(client);
    const board = await fetchLeaderboard(2);
    expect(board).toHaveLength(3);
    const you = board.find(e => e.isYou);
    expect(you?.name).toBe("Me");
    expect(you?.rank).toBe(8); // aheadCount 7 + 1
  });

  it("returns [] when the query errors (no fabricated peers)", async () => {
    const { client } = makeClient({ uid: "user-1", error: { message: "permission denied" } });
    inject(client);
    expect(await fetchLeaderboard()).toEqual([]);
  });

  it("uses competition ranking so tied users share a rank (matches the appended-self scheme)", async () => {
    const rows: Row[] = [
      { user_id: "u1", name: "Ann", xp: 500, level: 3, streak: 4, sessions: 20 },
      { user_id: "u2", name: "Bo", xp: 500, level: 3, streak: 1, sessions: 15 },
      { user_id: "u3", name: "Cy", xp: 300, level: 2, streak: 0, sessions: 8 }
    ];
    const { client } = makeClient({ uid: "user-1", rows });
    inject(client);
    const board = await fetchLeaderboard(10);
    /* tie for 1st, then the next distinct XP skips to rank 3 — same scheme as
       count(xp > mine) + 1, so an appended self-row can never collide with a
       top-N rank (dup React key + wrong medal). */
    expect(board.map(e => e.rank)).toEqual([1, 1, 3]);
    expect(board.every(e => !e.appended)).toBe(true);
    expect(board.map(e => e.user_id)).toEqual(["u1", "u2", "u3"]);
  });

  it("flags only the appended out-of-top-N self row, never a top-N row", async () => {
    const rows: Row[] = [
      { user_id: "u1", name: "Ann", xp: 500, level: 3, streak: 4, sessions: 20 },
      { user_id: "u2", name: "Bo", xp: 400, level: 3, streak: 1, sessions: 15 }
    ];
    const mineRow: Row = { user_id: "user-1", name: "Me", xp: 50, level: 1, streak: 0, sessions: 2 };
    const { client } = makeClient({ uid: "user-1", rows, mineRow, aheadCount: 7 });
    inject(client);
    const board = await fetchLeaderboard(2);
    expect(board.slice(0, 2).every(e => !e.appended)).toBe(true);
    const you = board.find(e => e.isYou);
    expect(you?.appended).toBe(true);
    expect(you?.user_id).toBe("user-1");
    expect(you?.rank).toBe(8);
  });
});

describe("uploadMyLeaderboardRow", () => {
  it("upserts my row with a trimmed, clamped name and the given timestamp", async () => {
    const { client, calls } = makeClient({ uid: "user-1" });
    inject(client);
    const res = await uploadMyLeaderboardRow(
      { name: "  A very long display name that exceeds the cap  ", xp: 120, level: 2, streak: 3, sessions: 8 },
      999
    );
    expect(res.ok).toBe(true);
    expect(calls.upsert?.opts).toEqual({ onConflict: "user_id" });
    expect(calls.upsert?.row.user_id).toBe("user-1");
    expect(calls.upsert?.row.name).toBe("A very long display name"); // trim + slice(0,24)
    expect(calls.upsert?.row.updated_at).toBe(999);
    expect(calls.upsert?.row.xp).toBe(120);
  });

  it("falls back to Anonymous when the name is blank", async () => {
    const { client, calls } = makeClient({ uid: "user-1" });
    inject(client);
    await uploadMyLeaderboardRow({ name: "   ", xp: 0, level: 1, streak: 0, sessions: 0 }, 1);
    expect(calls.upsert?.row.name).toBe("Anonymous");
  });

  it("refuses to upload when signed out", async () => {
    const { client, calls } = makeClient({ uid: null });
    inject(client);
    const res = await uploadMyLeaderboardRow({ name: "Me", xp: 1, level: 1, streak: 0, sessions: 1 });
    expect(res.ok).toBe(false);
    expect(calls.upsert).toBeUndefined();
  });

  it("refuses to upload when cloud is not configured", async () => {
    const res = await uploadMyLeaderboardRow({ name: "Me", xp: 1, level: 1, streak: 0, sessions: 1 });
    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
  });
});

describe("removeMyLeaderboardRow", () => {
  it("deletes my own row on opt-out", async () => {
    const { client, calls } = makeClient({ uid: "user-1" });
    inject(client);
    const res = await removeMyLeaderboardRow();
    expect(res.ok).toBe(true);
    expect(calls.del).toEqual({ col: "user_id", val: "user-1" });
  });

  it("refuses to remove when signed out", async () => {
    const { client, calls } = makeClient({ uid: null });
    inject(client);
    const res = await removeMyLeaderboardRow();
    expect(res.ok).toBe(false);
    expect(calls.del).toBeUndefined();
  });
});
