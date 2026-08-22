/* Data rights — download my data + delete my account (security.sql) */

import { getSupabaseClient } from "./client";
import { cloudSignOut } from "./auth";

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
    billing rows retained with identity removed). */
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
