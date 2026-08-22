/* Supabase RemoteStore — implements the backend-agnostic sync contract */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RemoteStore, SyncEntry } from "../sync";

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
