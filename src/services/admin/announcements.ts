/* Announcement CRUD — RLS enforces is_admin server-side. */

import { getSupabaseClient } from "../cloud";
import { refreshAdminData } from "./state";

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
