/* Admin state — reactive state, bootstrap, and shared data refresh.
   Other admin modules import refreshAdminData from here after mutations. */

import type { LevelId } from "../../types";
import { CONFIG } from "../../config";
import { getCloudState, getSupabaseClient } from "../cloud";
import { applyCoachVocab } from "../../coach/concepts";
import {
  getRemoteConfig, setAnnouncements, setPublishedQuestions, setRemoteConfig, type RemoteConfig
} from "../remoteConfig";
import { flushEvents, queueEvent, updateProfile } from "../events";

/* ------------------------------------------------------------------ */
/* Reactive admin state                                                */
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

/* ------------------------------------------------------------------ */
/* Remote data refresh (shared by bootstrap + all mutation modules)    */
/* ------------------------------------------------------------------ */

async function refreshRemoteData(client: NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>): Promise<void> {
  const [{ data: cfg }, { data: ann }, { data: qs }] = await Promise.all([
    client.from("app_config").select("key, value"),
    client.from("announcements").select("id, title, body, badge, published, created_at").order("created_at", { ascending: false }),
    client.from("published_questions").select("id, field_id, level, question, answer, key_points, published, updated_at")
  ]);
  if (cfg) {
    const merged: RemoteConfig = { features: {}, ai: {}, limits: {} };
    for (const row of cfg as { key: string; value: unknown }[]) {
      if (row.key === "features" && row.value) merged.features = { ...merged.features, ...(row.value as object) };
      if (row.key === "ai" && row.value) merged.ai = { ...merged.ai, ...(row.value as object) };
      if (row.key === "limits" && row.value) merged.limits = { ...merged.limits, ...(row.value as object) };
      if (row.key === "company_freq" && row.value) merged.companyFreq = { ...merged.companyFreq, ...(row.value as object) };
      if (row.key === "coach_vocab" && row.value) merged.coachVocab = row.value as RemoteConfig["coachVocab"];
      if (row.key === "rag" && row.value) merged.rag = { ...merged.rag, ...(row.value as object) };
      if (row.key === "policies" && row.value) merged.policies = { ...(merged.policies ?? {}), ...(row.value as object) };
      if (row.key === "menuVisibility" && row.value) merged.menuVisibility = row.value as Record<string, boolean>;
    }
    setRemoteConfig(merged);
  }
  if (ann) {
    setAnnouncements((ann as unknown as { id: number; title: string; body: string; badge: string | null; published: boolean; created_at: string }[])
      .map(a => ({ id: a.id, title: a.title, body: a.body, badge: a.badge, published: a.published, createdAt: new Date(a.created_at).getTime() })));
  }
  if (qs) {
    setPublishedQuestions((qs as unknown as { id: number; field_id: string; level: string; question: string; answer: string; key_points: string[]; published: boolean; updated_at: string | null }[])
      .map(q => ({ id: q.id, fieldId: q.field_id, level: q.level as LevelId, question: q.question, answer: q.answer, keyPoints: q.key_points ?? [], published: q.published, updatedAt: q.updated_at ?? null })));
  }
}

/** Re-fetch remote data + re-check admin role. Called by all mutation modules. */
export async function refreshAdminData(): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;
  await refreshRemoteData(client);
  applyCoachVocab(getRemoteConfig().coachVocab);
  setState({ ready: true });
  const { data } = await client.auth.getUser();
  if (data?.user) {
    const { data: admin } = await client.rpc("is_admin");
    setState({ isAdmin: !!admin });
  } else {
    setState({ isAdmin: false });
  }
}

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */

let initPromise: Promise<void> | null = null;

/** Fetches public product data + checks the admin role. Safe to call repeatedly. */
export function initAdmin(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const client = await getSupabaseClient();
      if (!client) { setState({ ready: true, isAdmin: false }); return; }
      try {
        await refreshRemoteData(client);
        applyCoachVocab(getRemoteConfig().coachVocab);
        setState({ ready: true });
        const { data } = await client.auth.getUser();
        const user = data?.user;
        if (user) {
          const { data: admin, error } = await client.rpc("is_admin");
          setState({ isAdmin: !!admin && !error });
          void updateProfile().catch(() => {});
          void queueEvent("app_open", {});
          await flushEvents().catch(() => {});
        } else {
          setState({ isAdmin: false });
        }
      } catch {
        setState({ ready: true, isAdmin: false });
      }
    })();
  }
  return initPromise;
}

/* ------------------------------------------------------------------ */
/* Ownership                                                           */
/* ------------------------------------------------------------------ */

/** True when the signed-in user is the product owner. */
export function amOwner(): boolean {
  const email = getCloudState().user?.email?.trim().toLowerCase();
  return !!email && !!CONFIG.ownerEmail && email === CONFIG.ownerEmail.trim().toLowerCase();
}
