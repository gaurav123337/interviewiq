/* Cloud reactive state — tiny pub/sub for auth/sync status */

import type { User } from "@supabase/supabase-js";

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

export function setState(patch: Partial<CloudState>): void {
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
