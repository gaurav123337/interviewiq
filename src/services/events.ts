/* Lightweight server-side analytics + profile heartbeat.
   Events are queued to localStorage (offline-first) and flushed to Supabase
   when a signed-in session exists. Profile counters keep the admin dashboard's
   per-user stats accurate without expensive aggregation. Everything here is
   fire-and-forget — failures never break the app. */

import { getSupabaseClient } from "./cloud";
import { getTier } from "./entitlements";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export type EventKind = "app_open" | "session" | "session_answers" | "ai_call" | "tier" | "coding_attempt" | "coach_discussion" | "rag_event" | "topic_suggestion";

export interface UsageEvent {
  kind: EventKind;
  meta: Record<string, unknown>;
  ts: number;
}

const OUTBOX_MAX = 50;

function getOutbox(): UsageEvent[] {
  return storageGet<UsageEvent[]>(STORAGE_KEYS.eventOutbox, []);
}

function setOutbox(evs: UsageEvent[]): void {
  storageSet(STORAGE_KEYS.eventOutbox, evs);
}

/** Queue an event (and try to flush it right away if we're signed in). */
export function queueEvent(kind: EventKind, meta: Record<string, unknown> = {}): void {
  const outbox = [...getOutbox(), { kind, meta, ts: Date.now() }].slice(-OUTBOX_MAX);
  setOutbox(outbox);
  void flushEvents().catch(() => { /* stays queued for next flush */ });
}

/** Push queued events to Supabase. No-op when not configured or signed out. */
export async function flushEvents(): Promise<void> {
  const outbox = getOutbox();
  if (!outbox.length) return;
  const client = await getSupabaseClient();
  if (!client) return;
  const { data } = await client.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return;
  const rows = outbox.map(e => ({ user_id: uid, kind: e.kind, meta: e.meta, created_at: new Date(e.ts).toISOString() }));
  const { error } = await client.from("usage_events").insert(rows);
  if (!error) setOutbox([]);
}

/* ------------------------------------------------------------------ */
/* Profile counters + heartbeat (drives the admin user table)          */
/* ------------------------------------------------------------------ */

export interface ProfileStats {
  sessions: number;
  aiCalls: number;
}

export function getProfileStats(): ProfileStats {
  return storageGet<ProfileStats>(STORAGE_KEYS.profileStats, { sessions: 0, aiCalls: 0 });
}

function bump(stats: ProfileStats): void {
  storageSet(STORAGE_KEYS.profileStats, stats);
}

/** Call after a completed practice session. */
export function recordProfileSession(): void {
  const s = getProfileStats();
  bump({ ...s, sessions: s.sessions + 1 });
  void updateProfile({ sessions_count: s.sessions + 1 }).catch(() => {});
}

/** Call after a generative AI call. */
export function recordProfileAiCall(): void {
  const s = getProfileStats();
  bump({ ...s, aiCalls: s.aiCalls + 1 });
  void updateProfile({ ai_calls: s.aiCalls + 1 }).catch(() => {});
}

/** Upsert the signed-in user's profile row (heartbeat: last seen, tier, counters). */
export async function updateProfile(partial: Record<string, unknown> = {}): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;
  const { data } = await client.auth.getUser();
  const user = data?.user;
  if (!user) return;
  const row = {
    id: user.id,
    email: user.email ?? "",
    last_seen: new Date().toISOString(),
    tier: getTier(),
    ...partial
  };
  await client.from("profiles").upsert(row, { onConflict: "id" });
}
