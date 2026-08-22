/* Engine lifecycle — initCloud, start/stop engine, manual sync */

import { SyncEngine } from "../sync";
import { setState } from "./state";
import { getClient, isCloudConfigured } from "./client";
import { SupabaseRemoteStore } from "./remoteStore";

let engine: SyncEngine | null = null;

import type { SupabaseClient } from "@supabase/supabase-js";

/** Starts the sync engine for the signed-in user (idempotent). */
export async function startEngine(client: SupabaseClient): Promise<void> {
  if (!engine) engine = new SyncEngine();
  if (engine.signedIn) return;
  setState({ syncing: true, error: null });
  try {
    await engine.signIn(new SupabaseRemoteStore(client));
    engine.startAutoSync();
  } finally {
    setState({ syncing: false });
  }
}

export async function stopEngine(): Promise<void> {
  if (engine?.signedIn) await engine.signOut();
}

/** Restores a persisted session on app load and reacts to auth changes. */
export async function initCloud(): Promise<void> {
  if (!isCloudConfigured()) return;
  setState({ configured: true });
  const client = await getClient();
  const { data } = await client.auth.getSession();
  if (data.session?.user) {
    setState({ user: data.session.user });
    await startEngine(client).catch(err => setState({ error: err.message }));
  }
  /* reactive auth: sign-in/out from anywhere (this tab or another) drives the engine */
  client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    setState({ user });
    if (user) void startEngine(client).catch(err => setState({ error: err.message }));
    else void stopEngine();
  });
}

/** Manual "Sync now" — pulls remote changes immediately. */
export async function cloudSyncNow(): Promise<void> {
  if (engine?.signedIn) {
    setState({ syncing: true });
    try { await engine.pull(); } finally { setState({ syncing: false }); }
  }
}
