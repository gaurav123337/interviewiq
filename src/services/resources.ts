/* resources — the client layer for the resource library (docs/resource-safety-guard.md).
   Submissions go through the submit-resource edge function, which runs the
   full safety guard before anything is stored. Reads:
     - own personal saves (owner-scoped RLS) + approved community library
     - cached in localStorage for offline-first display.
   Admin review goes through the admin_review_resource RPC (MFA-gated). */

import { CONFIG } from "../config";
import { cloudFnHeaders, getSupabaseClient } from "./cloud";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export type ResourceMode = "personal" | "community";
export type ResourceStatus = "personal" | "pending" | "approved" | "rejected" | "quarantined";

export interface GuardRecord {
  status: "ok" | "suspect" | "blocked" | "pending";
  reasons?: string[];
  finalUrl?: string | null;
  checkedAt?: string;
  reviewNote?: string;
}

export interface ResourceRow {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
  mode: ResourceMode;
  status: ResourceStatus;
  guard: GuardRecord | null;
  suggested_by?: string;
  flags: number;
  votes: number;
  created_at: string;
}

export interface SubmitInput {
  url: string;
  title: string;
  description: string;
  mode: ResourceMode;
  category?: string;
}

export async function submitResource(input: SubmitInput): Promise<{
  ok: boolean;
  resource?: ResourceRow;
  verdict?: GuardRecord;
  note?: string;
  error?: string;
}> {
  const headers = await cloudFnHeaders();
  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/submit-resource`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: input.url,
      title: input.title,
      description: input.description,
      mode: input.mode,
      category: input.category ?? "general"
    })
  });
  const data = await res.json().catch(() => ({})) as {
    ok?: boolean; resource?: ResourceRow; verdict?: GuardRecord; note?: string; error?: string;
  };
  if (!res.ok || data.ok === false) return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  /* cache the community rows we just saw so the library works offline */
  if (data.resource?.mode === "community" && data.resource?.status === "approved") {
    cacheApproved([data.resource]);
  }
  if (data.resource?.mode === "personal") cachePersonal([data.resource]);
  return { ok: true, resource: data.resource, verdict: data.verdict, note: data.note };
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

function cacheKey(kind: "personal" | "approved"): string {
  return kind === "personal" ? STORAGE_KEYS.resourcesPersonal : STORAGE_KEYS.resourcesApproved;
}

export function cachePersonal(rows: ResourceRow[]): void {
  const prev = storageGet<ResourceRow[]>(cacheKey("personal"), []);
  storageSet(cacheKey("personal"), [...rows, ...prev.filter(p => !rows.some(r => r.id === p.id))]);
}

export function cacheApproved(rows: ResourceRow[]): void {
  const prev = storageGet<ResourceRow[]>(cacheKey("approved"), []);
  storageSet(cacheKey("approved"), [...rows, ...prev.filter(p => !rows.some(r => r.id === p.id))]);
}

function dropFromCache(kind: "personal" | "approved", id: string): void {
  storageSet(cacheKey(kind), storageGet<ResourceRow[]>(cacheKey(kind), []).filter(r => r.id !== id));
}

/** The user's own saves — server truth when signed in, cached copy otherwise. */
export async function myResources(): Promise<ResourceRow[]> {
  const cached = storageGet<ResourceRow[]>(cacheKey("personal"), []);
  const client = await getSupabaseClient();
  if (!client) return cached;
  const { data, error } = await client.from("resources")
    .select("id, url, title, description, category, mode, status, guard, flags, votes, created_at")
    .eq("mode", "personal")
    .order("created_at", { ascending: false });
  if (error) return cached;
  const rows = (data ?? []) as ResourceRow[];
  storageSet(cacheKey("personal"), rows);
  return rows;
}

/** The approved community library (RLS: everyone can read these). */
export async function approvedResources(): Promise<ResourceRow[]> {
  const cached = storageGet<ResourceRow[]>(cacheKey("approved"), []);
  const client = await getSupabaseClient();
  if (!client) return cached;
  const { data, error } = await client.from("resources")
    .select("id, url, title, description, category, mode, status, guard, flags, votes, created_at")
    .eq("mode", "community")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) return cached;
  const rows = (data ?? []) as ResourceRow[];
  storageSet(cacheKey("approved"), rows);
  return rows;
}

/* ------------------------------------------------------------------ */
/* Admin review + reporting (RPCs — server enforces admin/MFA/owner)   */
/* ------------------------------------------------------------------ */

/** Pending community submissions for the admin queue (admin-only read via RLS). */
export async function pendingCommunityResources(): Promise<ResourceRow[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("resources")
    .select("id, url, title, description, category, mode, status, guard, suggested_by, flags, votes, created_at")
    .eq("mode", "community")
    .in("status", ["pending", "quarantined"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []) as ResourceRow[];
}

export async function reviewResource(id: string, decision: "approved" | "rejected" | "quarantined", note = ""): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Cloud not configured" };
  const { error } = await client.rpc("admin_review_resource", { p_id: id, p_decision: decision, p_note: note });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reportResource(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Cloud not configured" };
  const { error } = await client.rpc("report_resource", { p_id: id });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteMyResource(id: string): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Cloud not configured" };
  const { error } = await client.rpc("delete_my_resource", { p_id: id });
  if (error) return { ok: false, error: error.message };
  dropFromCache("personal", id);
  return { ok: true };
}

/** Community quality vote (one per user; re-vote replaces, never duplicates). */
export async function voteResource(id: string, direction: 1 | -1): Promise<{ ok: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, error: "Cloud not configured" };
  const { error } = await client.rpc("vote_resource", { p_id: id, p_direction: direction });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
