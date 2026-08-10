/* B2B teams — orgs, seats, and Pro entitlements, backed by Supabase RPCs
   (see the Teams section in supabase/admin.sql). The service is a thin,
   reactive wrapper: any auth change refreshes membership, and an active
   seat grants Pro via entitlements.setTeamPro() without touching the user's
   local license key. Everything is best-effort — no cloud, no team. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCloudState, getSupabaseClient, subscribeCloud } from "./cloud";
import { setTeamPro } from "./entitlements";

export interface TeamInfo {
  teamId: string;
  name: string;
  role: "owner" | "admin" | "member";
  seats: number;
  members: number;
}

export interface TeamMemberRow {
  userId: string | null;
  email: string | null;
  role: string;
  status: string;
  invitedEmail: string | null;
  createdAt: string;
}

export interface PendingInvite {
  teamId: string;
  teamName: string;
}

/* Raw rows straight from Postgres (snake_case) — mapped to the camelCase shapes above. */
interface RawTeam { team_id: string; team_name: string; role: TeamInfo["role"]; seats: number; members: number | string }
interface RawInvite { team_id: string; team_name: string }
interface RawRoster {
  user_id: string | null; email: string | null; role: string; status: string;
  invited_email: string | null; created_at: string
}

export interface TeamsState {
  teams: TeamInfo[];
  pending: PendingInvite[];
  roster: TeamMemberRow[];
  activeTeamId: string | null;
  loading: boolean;
  /** True when an active team seat is granting Pro right now. */
  proBySeat: boolean;
  error: string | null;
}

type TeamsListener = (s: TeamsState) => void;

const listeners = new Set<TeamsListener>();
let state: TeamsState = { teams: [], pending: [], roster: [], activeTeamId: null, loading: false, proBySeat: false, error: null };

function setState(patch: Partial<TeamsState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) {
    try { fn(state); } catch { /* listener errors must not break the service */ }
  }
}

export function getTeamsState(): TeamsState {
  return state;
}

export function subscribeTeams(fn: TeamsListener): () => void {
  listeners.add(fn);
  fn(state);
  return () => { listeners.delete(fn); };
}

/** Called once at startup (after initCloud) — reacts to every auth change. */
export function initTeams(): void {
  void refresh();
  subscribeCloud(() => void refresh());
}

/* ------------------------------------------------------------------ */
/* Refresh — the single source of truth for membership + entitlement    */
/* ------------------------------------------------------------------ */

export async function refresh(): Promise<void> {
  const client = await getSupabaseClient();
  const user = getCloudState().user;
  if (!client || !user) {
    setTeamPro(false);
    setState({ teams: [], pending: [], roster: [], activeTeamId: null, loading: false, proBySeat: false, error: null });
    return;
  }
  setState({ loading: true, error: null });
  try {
    const [rawTeams, rawPending, pro] = await Promise.all([
      rpc<RawTeam[]>(client, "my_teams"),
      rpc<RawInvite[]>(client, "my_pending_invites"),
      rpc<boolean>(client, "team_grants_pro")
    ]);
    const teams: TeamInfo[] = (rawTeams ?? []).map(t => ({
      teamId: t.team_id,
      name: t.team_name,
      role: t.role,
      seats: t.seats,
      members: Number(t.members)
    }));
    const pending: PendingInvite[] = (rawPending ?? []).map(p => ({ teamId: p.team_id, teamName: p.team_name }));
    const activeTeamId = state.activeTeamId && teams.some(t => t.teamId === state.activeTeamId)
      ? state.activeTeamId
      : (teams[0]?.teamId ?? null);
    setTeamPro(!!pro);
    setState({ teams, pending, activeTeamId, loading: false, proBySeat: !!pro, error: null });
    if (activeTeamId) await loadRoster(client, activeTeamId);
  } catch (e) {
    setTeamPro(false);
    setState({ loading: false, error: (e as Error).message });
  }
}

async function rpc<T>(client: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args ?? {});
  if (error) throw new Error(error.message);
  return data as T;
}

async function loadRoster(client: SupabaseClient, teamId: string): Promise<void> {
  try {
    const raw = await rpc<RawRoster[]>(client, "team_roster", { p_team_id: teamId });
    const roster: TeamMemberRow[] = (raw ?? []).map(m => ({
      userId: m.user_id,
      email: m.email,
      role: m.role,
      status: m.status,
      invitedEmail: m.invited_email,
      createdAt: m.created_at
    }));
    setState({ roster, error: null });
  } catch (e) {
    setState({ error: (e as Error).message });
  }
}

export function selectTeam(teamId: string): void {
  setState({ activeTeamId: teamId });
  void getSupabaseClient().then(c => { if (c) void loadRoster(c, teamId); });
}

/* ------------------------------------------------------------------ */
/* Team operations (RPCs)                                              */
/* ------------------------------------------------------------------ */

export async function createTeam(name: string, seats: number): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Sign in to create a team." };
  try {
    await rpc(client, "create_team", { p_name: name, p_seats: seats });
    await refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function inviteMember(email: string): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client || !state.activeTeamId) return { ok: false, error: "No team selected." };
  try {
    await rpc(client, "invite_member", { p_team_id: state.activeTeamId, p_email: email });
    await loadRoster(client, state.activeTeamId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function acceptInvite(teamId: string): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Sign in to accept." };
  try {
    await rpc(client, "accept_invite", { p_team_id: teamId });
    await refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeMember(userId: string): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client || !state.activeTeamId) return { ok: false, error: "No team selected." };
  try {
    await rpc(client, "remove_member", { p_team_id: state.activeTeamId, p_user_id: userId });
    await loadRoster(client, state.activeTeamId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function leaveTeam(teamId: string): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Sign in first." };
  try {
    await rpc(client, "leave_team", { p_team_id: teamId });
    await refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteTeam(teamId: string): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Sign in first." };
  try {
    await rpc(client, "delete_team", { p_team_id: teamId });
    await refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
