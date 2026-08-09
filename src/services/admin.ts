/* Admin + product-ops layer. Three jobs:
   1. Pull admin-published data (remote config, announcements, question-bank
      updates) into the client cache (remoteConfig.ts) for every user.
   2. Gate the Admin dashboard on Supabase's `is_admin` RPC (email allow-list).
   3. Expose the admin mutations: users/metrics reads, config publish,
      announcement CRUD, question-bank CRUD, admin grant/revoke.

   Reads are public (RLS allows select for all); every write is enforced
   server-side by RLS policies that call is_admin(). The client also hides
   the dashboard when the RPC says the user isn't an admin. */

import type { LevelId } from "../types";
import { getSupabaseClient } from "./cloud";
import {
  setAnnouncements, setPublishedQuestions, setRemoteConfig, type RemoteConfig
} from "./remoteConfig";
import { flushEvents, queueEvent, updateProfile } from "./events";

/* ------------------------------------------------------------------ */
/* Reactive admin state (who's allowed to see the dashboard)           */
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

let initPromise: Promise<void> | null = null;

/* ------------------------------------------------------------------ */
/* Bootstrap — run once at app start (main.tsx)                        */
/* ------------------------------------------------------------------ */

/** Fetches public product data + checks the admin role. Safe to call repeatedly. */
export function initAdmin(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const client = await getSupabaseClient();
      if (!client) { setState({ ready: true, isAdmin: false }); return; }
      try {
        /* public reads — every client caches these for offline use */
        await refreshRemoteData(client);
        setState({ ready: true });
        const { data } = await client.auth.getUser();
        const user = data?.user;
        if (user) {
          /* server-truth admin check */
          const { data: admin, error } = await client.rpc("is_admin");
          setState({ isAdmin: !!admin && !error });
          void updateProfile().catch(() => {});
          void queueEvent("app_open", {});
          await flushEvents().catch(() => {});
        } else {
          setState({ isAdmin: false });
        }
      } catch {
        /* offline or not configured — cached copies still serve */
        setState({ ready: true, isAdmin: false });
      }
    })();
  }
  return initPromise;
}

/* ------------------------------------------------------------------ */
/* Public data refresh                                                 */
/* ------------------------------------------------------------------ */

async function refreshRemoteData(client: NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>): Promise<void> {
  const [{ data: cfg }, { data: ann }, { data: qs }] = await Promise.all([
    client.from("app_config").select("key, value"),
    client.from("announcements").select("id, title, body, badge, published, created_at").order("created_at", { ascending: false }),
    client.from("published_questions").select("id, field_id, level, question, answer, key_points, published")
  ]);
  if (cfg) {
    const merged: RemoteConfig = { features: {}, ai: {}, limits: {} };
    for (const row of cfg as { key: string; value: unknown }[]) {
      if (row.key === "features" && row.value) merged.features = { ...merged.features, ...(row.value as object) };
      if (row.key === "ai" && row.value) merged.ai = { ...merged.ai, ...(row.value as object) };
      if (row.key === "limits" && row.value) merged.limits = { ...merged.limits, ...(row.value as object) };
    }
    setRemoteConfig(merged);
  }
  if (ann) {
    setAnnouncements((ann as unknown as { id: number; title: string; body: string; badge: string | null; published: boolean; created_at: string }[])
      .map(a => ({ id: a.id, title: a.title, body: a.body, badge: a.badge, published: a.published, createdAt: new Date(a.created_at).getTime() })));
  }
  if (qs) {
    setPublishedQuestions((qs as unknown as { id: number; field_id: string; level: string; question: string; answer: string; key_points: string[]; published: boolean }[])
      .map(q => ({ id: q.id, fieldId: q.field_id, level: q.level as LevelId, question: q.question, answer: q.answer, keyPoints: q.key_points ?? [], published: q.published })));
  }
}

/** Re-fetch remote data (e.g. after an admin publishes changes). */
export async function refreshAdminData(): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;
  await refreshRemoteData(client);
  setState({ ready: true });
  const { data } = await client.auth.getUser();
  if (data?.user) {
    const { data: admin } = await client.rpc("is_admin");
    setState({ isAdmin: !!admin });
  }
}

/* ------------------------------------------------------------------ */
/* Admin-only reads (RPCs — server enforces is_admin)                  */
/* ------------------------------------------------------------------ */

export interface AdminUserRow {
  id: string;
  email: string;
  created_at: string;
  last_seen: string | null;
  tier: string;
  streak: number;
  sessions_count: number;
  ai_calls: number;
}

export interface AdminMetrics {
  totalUsers: number;
  newThisWeek: number;
  activeToday: number;
  active7d: number;
  proUsers: number;
  totalSessions: number;
  sessions7d: number;
  aiCalls7d: number;
  events7d: number;
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_list_users");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserRow[];
}

export async function adminMetrics(): Promise<AdminMetrics> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_metrics");
  if (error) throw new Error(error.message);
  return (data ?? {}) as AdminMetrics;
}

/* ------------------------------------------------------------------ */
/* Admin writes (RLS enforces is_admin server-side)                    */
/* ------------------------------------------------------------------ */

export async function saveRemoteConfig(patch: Partial<RemoteConfig>): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const now = Date.now();
  const rows = Object.entries(patch)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ key, value, updated_at: now }));
  if (!rows.length) return;
  const { error } = await client.from("app_config").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

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

export async function createQuestion(q: { fieldId: string; level: LevelId; question: string; answer: string; keyPoints: string[]; published?: boolean }): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("published_questions").insert({
    field_id: q.fieldId, level: q.level, question: q.question, answer: q.answer,
    key_points: q.keyPoints, published: q.published ?? true
  });
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

export async function setQuestionPublished(id: number, published: boolean): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("published_questions").update({ published }).eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

export async function deleteQuestion(id: number): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("published_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

/** Edits an existing question (used by the review inbox to clean up drafts). */
export async function updateQuestion(id: number, patch: {
  fieldId?: string; level?: LevelId; question?: string; answer?: string; keyPoints?: string[];
}): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const row: Record<string, unknown> = {};
  if (patch.fieldId !== undefined) row.field_id = patch.fieldId;
  if (patch.level !== undefined) row.level = patch.level;
  if (patch.question !== undefined) row.question = patch.question;
  if (patch.answer !== undefined) row.answer = patch.answer;
  if (patch.keyPoints !== undefined) row.key_points = patch.keyPoints;
  const { error } = await client.from("published_questions").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

/** Batch publish/unpublish for the review inbox (single round-trip). */
export async function batchSetQuestionsPublished(ids: number[], published: boolean): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("published_questions").update({ published }).in("id", ids);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

/** Batch delete for the review inbox. */
export async function batchDeleteQuestions(ids: number[]): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("published_questions").delete().in("id", ids);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

/* ------------------------------------------------------------------ */
/* RAG knowledge base — indexed documents + vector search              */
/* ------------------------------------------------------------------ */

export interface PdfDocumentRow {
  id: number;
  title: string;
  source: string;
  char_count: number;
  chunk_count: number;
  created_at: string;
}

/** Indexed knowledge-base documents (public read — they feed every user's tutor). */
export async function listPdfDocuments(): Promise<PdfDocumentRow[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("pdf_documents")
    .select("id, title, source, char_count, chunk_count, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as PdfDocumentRow[];
}

/** Registers a document and returns its id (chunks are inserted after embedding). */
export async function createPdfDocument(input: { title: string; source?: string; charCount: number }): Promise<number> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.from("pdf_documents")
    .insert({ title: input.title, source: input.source ?? "", char_count: input.charCount, chunk_count: 0 })
    .select("id").single();
  if (error) throw new Error(error.message);
  return (data as { id: number }).id;
}

/** Stores embedded chunks for a document. */
export async function insertPdfChunks(rows: {
  documentId: number; index: number; content: string; tokens: number; embedding: number[];
}[]): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("pdf_chunks").insert(
    rows.map(r => ({ document_id: r.documentId, chunk_index: r.index, content: r.content, token_count: r.tokens, embedding: r.embedding }))
  );
  if (error) throw new Error(error.message);
}

/** Updates a document's chunk count after indexing. */
export async function setPdfChunkCount(id: number, count: number): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;
  await client.from("pdf_documents").update({ chunk_count: count }).eq("id", id);
}

/** Removes a document and its chunks (cascade). */
export async function deletePdfDocument(id: number): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("pdf_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface PdfHit {
  documentId: number;
  content: string;
  similarity: number;
}

/** Vector search over the knowledge base — the RAG retrieval step. */
export async function searchPdfChunks(embedding: number[], matchCount = 4): Promise<PdfHit[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("match_pdf_chunks", { query_embedding: embedding, match_count: matchCount });
  if (error || !data) return [];
  return (data as { document_id: number; content: string; similarity: number }[])
    .map(d => ({ documentId: d.document_id, content: d.content, similarity: d.similarity }));
}

export async function grantAdmin(email: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("app_admins").insert({ email: email.trim().toLowerCase() });
  if (error) throw new Error(error.message);
}

export async function revokeAdmin(email: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("app_admins").delete().eq("email", email.trim().toLowerCase());
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Harvesting + audit log                                              */
/* ------------------------------------------------------------------ */

export interface MissCandidate {
  question: string;
  field_id: string;
  level: string;
  attempts: number;
  misses: number;
  miss_rate: number;
  avg_score: number;
}

/** Questions real users score poorly on (score ≤ 2), aggregated server-side. */
export async function adminMissCandidates(): Promise<MissCandidate[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_miss_candidates");
  if (error) throw new Error(error.message);
  return (data ?? []) as MissCandidate[];
}

export interface AuditEntry {
  id: number;
  question_id: number | null;
  action: "create" | "update" | "delete";
  field_id: string | null;
  level: string | null;
  question: string | null;
  actor: string;
  diff: {
    before?: { field_id?: string; level?: string; question?: string; answer?: string; key_points?: string[]; published?: boolean };
    after?: { field_id?: string; level?: string; question?: string; answer?: string; key_points?: string[]; published?: boolean };
    row?: { field_id?: string; level?: string; question?: string; answer?: string; key_points?: string[]; published?: boolean };
    published?: boolean;
  };
  created_at: string;
}

/** Question-bank change history (newest first). */
export async function listQuestionAudit(limit = 100): Promise<AuditEntry[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("question_audit")
    .select("id, question_id, action, field_id, level, question, actor, diff, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as AuditEntry[];
}

/** Emails currently allowed to see the dashboard (admin-only read). */
export async function listAdmins(): Promise<string[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("app_admins").select("email");
  if (error) return [];
  return ((data ?? []) as { email: string }[]).map(r => r.email);
}
