/* Auth API — sign-in, sign-up, sign-out, OAuth providers */

import { CONFIG } from "../../config";
import { setState, type OAuthProvider } from "./state";
import { getClient, isCloudConfigured, resolveClient } from "./client";
import { startEngine, stopEngine } from "./engine";

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

/** Refreshes which OAuth providers the project has enabled (gates the buttons). */
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
    if (isCloudConfigured()) await (await getClient()).auth.signOut();
  } finally {
    await stopEngine();
    setState({ user: null, error: null });
  }
}
