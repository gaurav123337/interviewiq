// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTier, teamProActive } from "../services/entitlements";

/* Fake Supabase client — every RPC the service calls, keyed by name. */
function fakeClient(overrides: Record<string, unknown> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      calls.push({ fn, args });
      const table: Record<string, unknown> = {
        my_teams: () => ({
          data: [
            { team_id: "t1", team_name: "Acme", role: "owner", seats: 5, members: 2 },
            { team_id: "t2", team_name: "Beta", role: "member", seats: 3, members: 1 }
          ],
          error: null
        }),
        my_pending_invites: () => ({ data: [{ team_id: "t9", team_name: "Pending Corp" }], error: null }),
        team_grants_pro: () => ({ data: true, error: null }),
        team_roster: () => ({
          data: [
            { user_id: "u1", email: "boss@acme.com", role: "owner", status: "active", invited_email: null, created_at: "2026-08-01T00:00:00Z" },
            { user_id: null, email: null, role: "member", status: "invited", invited_email: "new@acme.com", created_at: "2026-08-02T00:00:00Z" }
          ],
          error: null
        }),
        create_team: () => ({ data: "t3", error: null }),
        invite_member: () => ({ data: null, error: null }),
        accept_invite: () => ({ data: null, error: null }),
        remove_member: () => ({ data: null, error: null }),
        leave_team: () => ({ data: null, error: null }),
        delete_team: () => ({ data: null, error: null }),
        ...overrides
      };
      const hit = table[fn];
      return typeof hit === "function" ? hit() : { data: null, error: { message: `no stub for ${fn}` } };
    }
  };
  return { client, calls };
}

vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "boss@acme.com" }, configured: true, syncing: false, error: null, oauth: [] }),
  getSupabaseClient: vi.fn(),
  subscribeCloud: () => () => {}
}));

import { getSupabaseClient } from "../services/cloud";
import * as teams from "../services/teams";

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSupabaseClient).mockReset();
});

describe("teams service", () => {
  it("refreshes membership, roster and grants Pro by seat", async () => {
    const { client } = fakeClient();
    vi.mocked(getSupabaseClient).mockResolvedValue(client as never);

    await teams.refresh();

    const s = teams.getTeamsState();
    expect(s.teams).toHaveLength(2);
    expect(s.teams[0].name).toBe("Acme");
    expect(s.pending[0].teamName).toBe("Pending Corp");
    expect(s.proBySeat).toBe(true);
    expect(teamProActive()).toBe(true);
    expect(getTier()).toBe("pro"); /* seat overrides the local free tier */

    /* roster auto-loads for the active team */
    expect(s.roster).toHaveLength(2);
    expect(s.roster[1].invitedEmail).toBe("new@acme.com");
  });

  it("releases the Pro entitlement when the user has no teams", async () => {
    const { client } = fakeClient({
      my_teams: () => ({ data: [], error: null }),
      my_pending_invites: () => ({ data: [], error: null }),
      team_grants_pro: () => ({ data: false, error: null })
    });
    vi.mocked(getSupabaseClient).mockResolvedValue(client as never);

    await teams.refresh();

    expect(teamProActive()).toBe(false);
    expect(getTier()).toBe("free");
    expect(teams.getTeamsState().activeTeamId).toBeNull();
  });

  it("creates a team, invites a member, accepts, removes and leaves", async () => {
    const { client, calls } = fakeClient();
    vi.mocked(getSupabaseClient).mockResolvedValue(client as never);

    const created = await teams.createTeam("Acme", 10);
    expect(created.ok).toBe(true);
    expect(calls).toContainEqual({ fn: "create_team", args: { p_name: "Acme", p_seats: 10 } });

    const invited = await teams.inviteMember("new@acme.com");
    expect(invited.ok).toBe(true);
    expect(calls).toContainEqual({ fn: "invite_member", args: { p_team_id: "t1", p_email: "new@acme.com" } });

    const accepted = await teams.acceptInvite("t9");
    expect(accepted.ok).toBe(true);
    expect(calls).toContainEqual({ fn: "accept_invite", args: { p_team_id: "t9" } });

    const removed = await teams.removeMember("u2");
    expect(removed.ok).toBe(true);
    expect(calls).toContainEqual({ fn: "remove_member", args: { p_team_id: "t1", p_user_id: "u2" } });

    const left = await teams.leaveTeam("t2");
    expect(left.ok).toBe(true);
    expect(calls).toContainEqual({ fn: "leave_team", args: { p_team_id: "t2" } });

    const deleted = await teams.deleteTeam("t1");
    expect(deleted.ok).toBe(true);
    expect(calls).toContainEqual({ fn: "delete_team", args: { p_team_id: "t1" } });
  });

  it("surfaces RPC errors instead of throwing", async () => {
    const { client } = fakeClient({
      create_team: () => ({ data: null, error: { message: "name required" } })
    });
    vi.mocked(getSupabaseClient).mockResolvedValue(client as never);

    const r = await teams.createTeam("", 5);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("name required");
  });

  it("clears everything when there is no cloud client", async () => {
    const { client } = fakeClient();
    vi.mocked(getSupabaseClient).mockResolvedValue(client as never);
    await teams.refresh();
    expect(teamProActive()).toBe(true);

    /* signed-out path: no client → membership + seat entitlement cleared */
    vi.mocked(getSupabaseClient).mockResolvedValue(null as never);
    await teams.refresh();
    expect(teams.getTeamsState().teams).toHaveLength(0);
    expect(teams.getTeamsState().pending).toHaveLength(0);
    expect(teamProActive()).toBe(false);
    expect(getTier()).toBe("free");
  });
});
