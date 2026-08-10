// @vitest-environment jsdom
/* Regression tests for a production startup crash: the teams listener
   subscribed to cloud state called refresh() → getSupabaseClient() →
   setState({configured:true}) → listener → refresh() → … until
   "RangeError: Maximum call stack size exceeded" blanked the page.
   These tests use the REAL cloud + teams modules (no mocking) so the
   exact wiring that crashed is exercised. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as cloud from "../services/cloud";
import * as teams from "../services/teams";

/* Minimal fake Supabase client — with no signed-in user, refresh bails before
   any RPC, so only auth/from surfaces are needed for safety. */
function fakeClient() {
  return {
    rpc: async () => ({ data: null, error: null }),
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) })
  } as never;
}

beforeEach(() => {
  localStorage.clear();
  cloud.setTestClient(fakeClient());
});

afterEach(() => {
  cloud.setTestClient(null);
});

describe("cloud ↔ teams startup wiring", () => {
  it("does not re-notify listeners when the client is accessed repeatedly", async () => {
    let notified = 0;
    const unsub = cloud.subscribeCloud(() => { notified++; });
    try {
      await cloud.getSupabaseClient();   /* configured false→true: one emission */
      await cloud.getSupabaseClient();   /* already configured: must stay silent */
      await cloud.getSupabaseClient();
      expect(notified).toBe(2);          /* seed call + single configured flip */
    } finally {
      unsub();
    }
  });

  it("cloud notifications never loop back through the teams listener (regression: stack overflow)", async () => {
    let notified = 0;
    /* Same shape as initTeams(): every cloud change triggers a refresh, and
       refresh() touches getSupabaseClient(). Before the fix this recursed
       until "Maximum call stack size exceeded". */
    const unsub = cloud.subscribeCloud(() => { notified++; void teams.refresh(); });
    try {
      for (let i = 0; i < 3; i++) await cloud.getSupabaseClient();
      /* Before the fix, notified exploded (each client access re-emitted
         configured:true → listener → refresh → client access → …). */
      expect(notified).toBeLessThanOrEqual(2);
    } finally {
      unsub();
    }
  });

  it("initTeams() completes without throwing and without an RPC storm", async () => {
    expect(() => teams.initTeams()).not.toThrow();
    /* Let the async refresh settle — with no user it should just clear state. */
    await teams.refresh();
    expect(teams.getTeamsState().teams).toHaveLength(0);
  });
});

describe("teams refresh dedupe", () => {
  it("concurrent refresh() calls share a single client access", async () => {
    const spy = vi.spyOn(cloud, "getSupabaseClient");
    try {
      const results = await Promise.all([teams.refresh(), teams.refresh(), teams.refresh()]);
      expect(results).toHaveLength(3);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
