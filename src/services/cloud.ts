/* Cloud sync — concrete Supabase adapter + auth wiring for the storage-sync seam.
   Dormant until CONFIG.supabase.url / anonKey are set (like the paywall flag).
   The @supabase/supabase-js SDK is lazy-loaded so non-cloud users pay nothing.

   Setup (one-time, ~5 min):
     1. Create a free Supabase project.
     2. Run the `user_sync` table + RLS SQL from the README in the SQL editor.
     3. Paste the project URL + anon key into src/config.ts (Settings → API).
   Auth: email + password works out of the box; OAuth providers can be enabled
   in the Supabase dashboard without code changes. */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { CONFIG } from "../config";
import { SyncEngine, type RemoteStore, type SyncEntry } from "./sync";

/* ------------------------------------------------------------------ */
/* Reactive state (tiny pub/sub — no state library needed)              */
/* ------------------------------------------------------------------ */

export type OAuthProvider = "google" | "github";

export interface CloudState {
  configured: boolean;
  user: User | null;
  syncing: boolean;
  error: string | null;
  /** OAuth providers enabled on the Supabase project (from auth settings). */
  oauth: OAuthProvider[];
}

type CloudListener = (s: CloudState) => void;
const listeners = new Set<CloudListener>();
let state: CloudState = { configured: false, user: null, syncing: false, error: null, oauth: [] };

function setState(patch: Partial<CloudState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) {
    try { fn(state); } catch { /* listener errors must not break the service */ }
  }
}

export function getCloudState(): CloudState {
  return state;
}

export function subscribeCloud(fn: CloudListener): () => void {
  listeners.add(fn);
  fn(state);
  return () => { listeners.delete(fn); };
}

/* ------------------------------------------------------------------ */
/* Lazy Supabase client + engine singleton                              */
/* ------------------------------------------------------------------ */

let clientPromise: Promise<SupabaseClient> | null = null;
let engine: SyncEngine | null = null;

export function isCloudConfigured(): boolean {
  return !!CONFIG.supabase.url && !!CONFIG.supabase.anonKey;
}

async function getClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    const { createClient } = await import("@supabase/supabase-js");
    clientPromise = Promise.resolve(createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
      auth: { persistSession: true }
    }));
  }
  return clientPromise;
}

/** Test seam — injects a fake supabase client so configured paths are testable without credentials. */
export function setTestClient(c: SupabaseClient | null): void {
  clientPromise = c ? Promise.resolve(c) : null;
}

/** Returns the client when cloud sync is available (configured, or a test client is injected).
    NOTE: `configured` is only emitted when it actually changes. Emitting it on every access
    re-triggered the teams listener (refresh → getSupabaseClient → setState → listener → …),
    which recursed until "Maximum call stack size exceeded" at startup. */
async function resolveClient(): Promise<SupabaseClient | null> {
  if (clientPromise) {
    if (!state.configured) setState({ configured: true });
    return clientPromise;
  }
  if (!isCloudConfigured()) return null;
  if (!state.configured) setState({ configured: true });
  return getClient();
}

/** Public accessor for the Supabase client (used by admin + analytics services). */
export function getSupabaseClient(): Promise<SupabaseClient | null> {
  return resolveClient();
}

/** Headers for calling an Edge Function as the signed-in user — the JWT is
    verified server-side, and no secrets ever live in the client bundle
    (docs/app-security.md G3/G6). Include the publishable apikey for the
    Supabase gateway, exactly like the rest of the app does. */
export async function cloudFnHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const client = await getSupabaseClient();
  const session = await client?.auth.getSession().catch(() => null);
  const token = session?.data?.session?.access_token;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: CONFIG.supabase.anonKey
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  if (extra) Object.assign(h, extra);
  return h;
}

/** Starts the sync engine for the signed-in user (idempotent). */
async function startEngine(client: SupabaseClient): Promise<void> {
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

async function stopEngine(): Promise<void> {
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

/* ------------------------------------------------------------------ */
/* Auth API (used by the Settings UI)                                  */
/* ------------------------------------------------------------------ */

export async function cloudSignIn(email: string, password: string): Promise<{ ok: boolean; mfaRequired?: boolean; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured — add your Supabase URL and anon key in src/config.ts." };
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    /* account has MFA enabled: no session yet — the caller must present a
       TOTP code (cloudMfaVerify) to finish the sign-in */
    if (data.user && !data.session) return { ok: true, mfaRequired: true };
    await startEngine(client);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* MFA (TOTP) — enroll/verify/unenroll + challenge sign-in            */
/* ------------------------------------------------------------------ */

export interface TotpFactor {
  id: string;
  status: string; /* "verified" | "unverified" */
}

export async function cloudMfaFactors(): Promise<{ ok: boolean; factors: TotpFactor[]; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, factors: [], error: "Cloud sync isn't configured" };
  try {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) return { ok: false, factors: [], error: error.message };
    return { ok: true, factors: (data?.totp ?? []).map(f => ({ id: f.id, status: f.status })) };
  } catch (e) {
    return { ok: false, factors: [], error: (e as Error).message };
  }
}

export interface EnrolledTotp {
  id: string;
  qrCode: string; /* data: URL for the QR image */
  secret: string;
}

export async function cloudMfaEnroll(): Promise<{ ok: boolean; totp?: EnrolledTotp; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  try {
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) return { ok: false, error: error?.message ?? "enroll failed" };
    return { ok: true, totp: { id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Verifies a TOTP code against a factor. When `factorId` is given (a freshly
    enrolled factor), it is used directly — no factor re-list, which is more
    robust right after enrollment. Otherwise (MFA-challenged sign-in) the
    verified/first TOTP factor is looked up. */
export async function cloudMfaVerify(code: string, factorId?: string): Promise<{ ok: boolean; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  try {
    let fid = factorId?.trim();
    if (!fid) {
      const { data: factors, error: listErr } = await client.auth.mfa.listFactors();
      if (listErr) return { ok: false, error: listErr.message };
      const totp = factors?.totp ?? [];
      fid = totp.find(f => f.status === "verified")?.id ?? totp[0]?.id;
      if (!fid) return { ok: false, error: "no TOTP factor found — set one up first" };
    }
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: fid, code: (code ?? "").trim() });
    if (error) return { ok: false, error: error.message };
    /* sign-in or re-auth completed — the session is live now */
    await startEngine(client).catch(err => setState({ error: err.message }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cloudMfaUnenroll(factorId: string): Promise<{ ok: boolean; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  try {
    const { error } = await client.auth.mfa.unenroll({ factorId });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Redeems a one-time recovery code via the mfa-recovery edge function. No
    session is required (the caller is stuck at the MFA challenge); the edge
    function rate-limits by IP/email and, on success, removes the TOTP factor
    so a fresh sign-in completes without a challenge. */
export async function cloudMfaRecover(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${CONFIG.supabase.url}/functions/v1/mfa-recovery`, {
      method: "POST",
      headers: await cloudFnHeaders(),
      body: JSON.stringify({ email, code })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) return { ok: false, error: body.error ?? `recovery failed (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Stores (replaces) the signed-in user's recovery-code hashes. */
export async function cloudSaveRecoveryCodes(hashes: string[]): Promise<{ ok: boolean; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  try {
    const { error } = await client.rpc("save_recovery_codes", { p_hashes: hashes });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cloudSignUp(email: string, password: string): Promise<{ ok: boolean; needsConfirmation?: boolean; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured — add your Supabase URL and anon key in src/config.ts." };
  try {
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };
    if (data.session?.user) {
      await startEngine(client);
      return { ok: true };
    }
    /* email confirmation required — the account exists once they confirm */
    return { ok: true, needsConfirmation: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Maps a Supabase auth-settings `external` map to the providers this app supports. */
export function oauthProvidersFromSettings(external: Record<string, boolean> | undefined): OAuthProvider[] {
  const out: OAuthProvider[] = [];
  if (external?.google) out.push("google");
  if (external?.github) out.push("github");
  return out;
}

interface ClientWithEndpoints { supabaseUrl?: string; supabaseKey?: string }

/** Refreshes which OAuth providers the project has enabled (gates the buttons).
    Reads the public GoTrue `settings` endpoint — no SDK method needed, and it
    works on every supabase-js version. */
export async function refreshOAuthProviders(): Promise<OAuthProvider[]> {
  const client = await resolveClient();
  if (!client) { setState({ oauth: [] }); return []; }
  try {
    const c = client as unknown as ClientWithEndpoints;
    const url = c.supabaseUrl ?? CONFIG.supabase.url;
    const key = c.supabaseKey ?? CONFIG.supabase.anonKey;
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    const j = (await res.json()) as { external?: Record<string, boolean> };
    const providers = oauthProvidersFromSettings(j?.external);
    setState({ oauth: providers });
    return providers;
  } catch {
    setState({ oauth: [] });
    return [];
  }
}

/** Starts the OAuth redirect flow; the session is restored by initCloud on return. */
export async function cloudOAuthSignIn(provider: OAuthProvider): Promise<{ ok: boolean; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured — add your Supabase URL and anon key in src/config.ts." };
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cloudSignOut(): Promise<void> {
  try {
    if (clientPromise) await (await clientPromise).auth.signOut();
  } finally {
    await stopEngine();
    setState({ user: null, error: null });
  }
}

/** Manual "Sync now" — pulls remote changes immediately. */
export async function cloudSyncNow(): Promise<void> {
  if (engine?.signedIn) {
    setState({ syncing: true });
    try { await engine.pull(); } finally { setState({ syncing: false }); }
  }
}

/* ------------------------------------------------------------------ */
/* Supabase RemoteStore — implements the backend-agnostic contract      */
/* ------------------------------------------------------------------ */

/**
 * Reads/writes the `user_sync` table (see README for the exact SQL + RLS).
 * Rows: (user_id, key, value jsonb, updated_at bigint), PK (user_id, key).
 */
export class SupabaseRemoteStore implements RemoteStore {
  private uid: string | null = null;

  constructor(private readonly client: SupabaseClient) {}

  private async userId(): Promise<string> {
    if (this.uid) return this.uid;
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new Error("Not signed in");
    this.uid = data.user.id;
    return this.uid;
  }

  async pull(): Promise<Record<string, SyncEntry>> {
    const uid = await this.userId();
    const { data, error } = await this.client.from("user_sync")
      .select("key, value, updated_at")
      .eq("user_id", uid);
    if (error) throw new Error(error.message);
    const out: Record<string, SyncEntry> = {};
    for (const row of data ?? []) out[row.key] = { value: row.value, updatedAt: row.updated_at };
    return out;
  }

  async push(entries: Record<string, SyncEntry>): Promise<void> {
    const uid = await this.userId();
    const rows = Object.entries(entries).map(([key, e]) => ({
      user_id: uid, key, value: e.value, updated_at: e.updatedAt
    }));
    if (!rows.length) return;
    const { error } = await this.client.from("user_sync").upsert(rows, { onConflict: "user_id,key" });
    if (error) throw new Error(error.message);
  }

  async remove(keys: string[]): Promise<void> {
    if (!keys.length) return;
    const uid = await this.userId();
    const { error } = await this.client.from("user_sync").delete().eq("user_id", uid).in("key", keys);
    if (error) throw new Error(error.message);
  }
}

/* ------------------------------------------------------------------ */
/* Data rights — download my data + delete my account (security.sql)   */
/* ------------------------------------------------------------------ */

/** Server-side copy of the signed-in user's rows (RPC is owner-scoped). */
export async function cloudDownloadMyData(): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  try {
    const { data, error } = await client.rpc("download_my_data");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Permanently deletes the signed-in user's account (RPC is owner-scoped,
    billing rows retained with identity removed). Caller signs out + clears
    local data afterwards. */
export async function cloudDeleteMyAccount(): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  try {
    const { error } = await client.rpc("delete_my_account");
    if (error) return { ok: false, error: error.message };
    await cloudSignOut();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
