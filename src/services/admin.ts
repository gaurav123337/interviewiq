/* Admin + product-ops layer. Three jobs:
   1. Pull admin-published data (remote config, announcements, question-bank
      updates) into the client cache (remoteConfig.ts) for every user.
   2. Gate the Admin dashboard on Supabase's `is_admin` RPC (email allow-list).
   3. Expose the admin mutations: users/metrics reads, config publish,
      announcement CRUD, question-bank CRUD, admin grant/revoke.

   Reads are public (RLS allows select for all); every write is enforced
   server-side by RLS policies that call is_admin(). The client also hides
   the dashboard when the RPC says the user isn't an admin. */

import type { LevelId } from "../types";
import { getSupabaseClient } from "./cloud";
import {
  setAnnouncements, setPublishedQuestions, setRemoteConfig, type RemoteConfig
} from "./remoteConfig";
import { flushEvents, queueEvent, updateProfile } from "./events";

/* ------------------------------------------------------------------ */
/* Reactive admin state (who's allowed to see the dashboard)           */
/* ------------------------------------------------------------------ */

export interface AdminState {
  ready: boolean;
  isAdmin: boolean;
}

type AdminListener = (s: AdminState) => void;
const listeners = new Set<AdminListener>();
let state: AdminState = { ready: false, isAdmin: false };

function setState(patch: Partial<AdminState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) {
    try { fn(state); } catch { /* listener errors must not break the service */ }
  }
}

export function getAdminState(): AdminState {
  return state;
}

export function subscribeAdmin(fn: AdminListener): () => void {
  listeners.add(fn);
  fn(state);
  return () => { listeners.delete(fn); };
}

let initPromise: Promise<void> | null = null;

/* ------------------------------------------------------------------ */
/* Bootstrap — run once at app start (main.tsx)                        */
/* ------------------------------------------------------------------ */

/** Fetches public product data + checks the admin role. Safe to call repeatedly. */
export function initAdmin(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const client = await getSupabaseClient();
      if (!client) { setState({ ready: true, isAdmin: false }); return; }
      try {
        /* public reads — every client caches these for offline use */
        await refreshRemoteData(client);
        setState({ ready: true });
        const { data } = await client.auth.getUser();
        const user = data?.user;
        if (user) {
          /* server-truth admin check */
          const { data: admin, error } = await client.rpc("is_admin");
          setState({ isAdmin: !!admin && !error });
          void updateProfile().catch(() => {});
          void queueEvent("app_open", {});
          await flushEvents().catch(() => {});
        } else {
          setState({ isAdmin: false });
        }
      } catch {
        /* offline or not configured — cached copies still serve */
        setState({ ready: true, isAdmin: false });
      }
    })();
  }
  return initPromise;
}

/* ------------------------------------------------------------------ */
/* Public data refresh                                                 */
/* ------------------------------------------------------------------ */

async function refreshRemoteData(client: NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>): Promise<void> {
  const [{ data: cfg }, { data: ann }, { data: qs }] = await Promise.all([
    client.from("app_config").select("key, value"),
    client.from("announcements").select("id, title, body, badge, published, created_at").order("created_at", { ascending: false }),
    client.from("published_questions").select("id, field_id, level, question, answer, key_points, published")
  ]);
  if (cfg) {
    const merged: RemoteConfig = { features: {}, ai: {}, limits: {} };
    for (const row of cfg as { key: string; value: unknown }[]) {
      if (row.key === "features" && row.value) merged.features = { ...merged.features, ...(row.value as object) };
      if (row.key === "ai" && row.value) merged.ai = { ...merged.ai, ...(row.value as object) };
      if (row.key === "limits" && row.value) merged.limits = { ...merged.limits, ...(row.value as object) };
    }
    setRemoteConfig(merged);
  }
  if (ann) {
    setAnnouncements((ann as unknown as { id: number; title: string; body: string; badge: string | null; published: boolean; created_at: string }[])
      .map(a => ({ id: a.id, title: a.title, body: a.body, badge: a.badge, published: a.published, createdAt: new Date(a.created_at).getTime() })));
  }
  if (qs) {
    setPublishedQuestions((qs as unknown as { id: number; field_id: string; level: string; question: string; answer: string; key_points: string[]; published: boolean }[])
      .map(q => ({ id: q.id, fieldId: q.field_id, level: q.level as LevelId, question: q.question, answer: q.answer, keyPoints: q.key_points ?? [], published: q.published })));
  }
}

/** Re-fetch remote data (e.g. after an admin publishes changes). */
export async function refreshAdminData(): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;
  await refreshRemoteData(client);
  setState({ ready: true });
  const { data } = await client.auth.getUser();
  if (data?.user) {
    const { data: admin } = await client.rpc("is_admin");
    setState({ isAdmin: !!admin });
  }
}

/* ------------------------------------------------------------------ */
/* Admin-only reads (RPCs — server enforces is_admin)                  */
/* ------------------------------------------------------------------ */

export interface AdminUserRow {
  id: string;
  email: string;
  created_at: string;
  last_seen: string | null;
  tier: string;
  streak: number;
  sessions_count: number;
  ai_calls: number;
}

export interface AdminMetrics {
  totalUsers: number;
  newThisWeek: number;
  activeToday: number;
  active7d: number;
  proUsers: number;
  totalSessions: number;
  sessions7d: number;
  aiCalls7d: number;
  events7d: number;
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_list_users");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserRow[];
}

export async function adminMetrics(): Promise<AdminMetrics> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_metrics");
  if (error) throw new Error(error.message);
  return (data ?? {}) as AdminMetrics;
}

/* ------------------------------------------------------------------ */
/* Admin writes (RLS enforces is_admin server-side)                    */
/* ------------------------------------------------------------------ */

export async function saveRemoteConfig(patch: Partial<RemoteConfig>): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const now = Date.now();
  const rows = Object.entries(patch)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ key, value, updated_at: now }));
  if (!rows.length) return;
  const { error } = await client.from("app_config").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

export async function createAnnouncement(a: { title: string; body: string; badge?: string; published?: boolean }): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("announcements").insert({ ...a, published: a.published ?? true });
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

export async function setAnnouncementPublished(id: number, published: boolean): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("announcements").update({ published }).eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

export async function deleteAnnouncement(id: number): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("announcements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

export async function createQuestion(q: { fieldId: string; level: LevelId; question: string; answer: string; keyPoints: string[]; published?: boolean }): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("published_questions").insert({
    field_id: q.fieldId, level: q.level, question: q.question, answer: q.answer,
    key_points: q.keyPoints, published: q.published ?? true
  });
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

export async function setQuestionPublished(id: number, published: boolean): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("published_questions").update({ published }).eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

export async function deleteQuestion(id: number): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("published_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

export async function grantAdmin(email: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("app_admins").insert({ email: email.trim().toLowerCase() });
  if (error) throw new Error(error.message);
}

export async function revokeAdmin(email: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("app_admins").delete().eq("email", email.trim().toLowerCase());
  if (error) throw new Error(error.message);
}

/** Emails currently allowed to see the dashboard (admin-only read). */
export async function listAdmins(): Promise<string[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("app_admins").select("email");
  if (error) return [];
  return ((data ?? []) as { email: string }[]).map(r => r.email);
}
