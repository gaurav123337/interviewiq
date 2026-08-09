import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseRemoteStore, cloudSignIn, getCloudState, isCloudConfigured } from "../services/cloud";

interface Calls {
  select?: string;
  eq?: [string, unknown];
  upsert?: { payload: unknown[]; opts: unknown };
  del?: { col: string; val: unknown; col2: string; keys: unknown[] };
}

/** Minimal fake of the supabase-js chain API used by the adapter. */
function makeClient(rows: Record<string, unknown>[], error: { message: string } | null = null) {
  const calls: Calls = {};
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null })
    },
    from: (_table: string) => ({
      select: (cols: string) => ({
        eq: async (col: string, val: unknown) => {
          calls.select = cols;
          calls.eq = [col, val];
          return { data: rows, error };
        }
      }),
      upsert: async (payload: unknown[], opts: unknown) => {
        calls.upsert = { payload, opts };
        return { error };
      },
      delete: () => ({
        eq: (col: string, val: unknown) => ({
          in: async (col2: string, keys: unknown[]) => {
            calls.del = { col, val, col2, keys };
            return { data: null, error };
          }
        })
      })
    })
  };
  return { client, calls };
}

const store = (client: ReturnType<typeof makeClient>["client"]) =>
  new SupabaseRemoteStore(client as unknown as SupabaseClient);

describe("SupabaseRemoteStore", () => {
  it("pulls rows into the SyncEntry wire format, scoped to the user", async () => {
    const { client, calls } = makeClient([
      { key: "iq.sessions", value: [{ id: "a" }], updated_at: 123 },
      { key: "iq.settings", value: { count: 8 }, updated_at: 456 }
    ]);
    const snap = await store(client).pull();
    expect(snap["iq.sessions"]).toEqual({ value: [{ id: "a" }], updatedAt: 123 });
    expect(snap["iq.settings"]).toEqual({ value: { count: 8 }, updatedAt: 456 });
    expect(calls.select).toBe("key, value, updated_at");
    expect(calls.eq).toEqual(["user_id", "user-1"]);
  });

  it("pushes entries as upsert rows keyed by (user_id, key)", async () => {
    const { client, calls } = makeClient([]);
    await store(client).push({ "iq.settings": { value: { count: 8 }, updatedAt: 42 } });
    expect(calls.upsert).toEqual({
      payload: [{ user_id: "user-1", key: "iq.settings", value: { count: 8 }, updated_at: 42 }],
      opts: { onConflict: "user_id,key" }
    });
  });

  it("deletes removed keys for the user", async () => {
    const { client, calls } = makeClient([]);
    await store(client).remove(["iq.settings", "iq.sessions"]);
    expect(calls.del).toEqual({ col: "user_id", val: "user-1", col2: "key", keys: ["iq.settings", "iq.sessions"] });
  });

  it("surfaces backend errors", async () => {
    const { client } = makeClient([], { message: "permission denied" });
    await expect(store(client).pull()).rejects.toThrow("permission denied");
  });
});

describe("cloud service (unconfigured)", () => {
  it("reports the unconfigured state", () => {
    expect(isCloudConfigured()).toBe(false);
    expect(getCloudState()).toMatchObject({ configured: false, user: null });
  });

  it("rejects sign-in before Supabase is configured, without touching the SDK", async () => {
    const r = await cloudSignIn("a@b.com", "secret123");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("isn't configured");
  });
});
