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
import {
  SupabaseRemoteStore, cloudOAuthSignIn, cloudSignIn, getCloudState, isCloudConfigured,
  oauthProvidersFromSettings, refreshOAuthProviders, setTestClient
} from "../services/cloud";

/* the fake-client seam must not leak between tests */
afterEach(() => setTestClient(null));

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
    expect(getCloudState()).toMatchObject({ configured: false, user: null, oauth: [] });
  });

  it("rejects sign-in before Supabase is configured, without touching the SDK", async () => {
    const r = await cloudSignIn("a@b.com", "secret123");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("isn't configured");
  });
});

describe("OAuth sign-in (gated on provider config)", () => {
  it("maps auth-settings external flags to enabled providers", () => {
    expect(oauthProvidersFromSettings({ google: true, github: false })).toEqual(["google"]);
    expect(oauthProvidersFromSettings({ github: true, email: true })).toEqual(["github"]);
    expect(oauthProvidersFromSettings({ email: true })).toEqual([]);
    expect(oauthProvidersFromSettings(undefined)).toEqual([]);
  });

  it("refreshes the provider list from the project's auth settings endpoint", async () => {
    const { client } = makeClient([]);
    (client as Record<string, unknown>).supabaseUrl = "https://demo.supabase.co";
    (client as Record<string, unknown>).supabaseKey = "anon-key";
    setTestClient(client as unknown as SupabaseClient);
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ external: { google: true, github: true } }) }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const providers = await refreshOAuthProviders();
      expect(providers).toEqual(["google", "github"]);
      expect(getCloudState().oauth).toEqual(["google", "github"]);
      expect(fetchMock).toHaveBeenCalledWith("https://demo.supabase.co/auth/v1/settings", { headers: { apikey: "anon-key" } });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("hides providers the project has not enabled", async () => {
    const { client } = makeClient([]);
    (client as Record<string, unknown>).supabaseUrl = "https://demo.supabase.co";
    (client as Record<string, unknown>).supabaseKey = "anon-key";
    setTestClient(client as unknown as SupabaseClient);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ external: { google: false, github: false } }) })));
    try {
      expect(await refreshOAuthProviders()).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("starts an OAuth redirect back to the app", async () => {
    const captured: { provider?: string; redirectTo?: string } = {};
    const { client } = makeClient([]);
    (client.auth as Record<string, unknown>).signInWithOAuth = async (opts: { provider: string; options: { redirectTo: string } }) => {
      captured.provider = opts.provider;
      captured.redirectTo = opts.options.redirectTo;
      return { error: null };
    };
    setTestClient(client as unknown as SupabaseClient);
    const r = await cloudOAuthSignIn("google");
    expect(r.ok).toBe(true);
    expect(captured.provider).toBe("google");
    expect(captured.redirectTo).toBe(window.location.origin + window.location.pathname);
  });

  it("rejects OAuth when cloud sync is not configured", async () => {
    const r = await cloudOAuthSignIn("github");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("isn't configured");
  });
});
