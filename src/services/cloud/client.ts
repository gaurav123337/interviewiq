/* Lazy Supabase client + accessor functions */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CONFIG } from "../../config";
import { getCloudState, setState } from "./state";

let clientPromise: Promise<SupabaseClient> | null = null;

export function isCloudConfigured(): boolean {
  return !!CONFIG.supabase.url && !!CONFIG.supabase.anonKey;
}

export async function getClient(): Promise<SupabaseClient> {
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
    NOTE: `configured` is only emitted when it actually changes to avoid
    triggering listener loops (refresh → getSupabaseClient → setState → listener → …). */
export async function resolveClient(): Promise<SupabaseClient | null> {
  if (clientPromise) {
    if (!getCloudState().configured) setState({ configured: true });
    return clientPromise;
  }
  if (!isCloudConfigured()) return null;
  setState({ configured: true });
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
