/* Question bank CRUD — RLS enforces is_admin server-side. */

import type { LevelId } from "../../types";
import { getSupabaseClient } from "../cloud";
import { refreshAdminData } from "./state";

export async function createQuestion(q: { fieldId: string; level: LevelId; question: string; answer: string; keyPoints: string[]; skills?: string[]; published?: boolean }): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  /* `skills` is only sent when set — pre-migration databases lack the column and
     an unknown key would fail the whole insert. */
  const { error } = await client.from("published_questions").insert({
    field_id: q.fieldId, level: q.level, question: q.question, answer: q.answer,
    key_points: q.keyPoints, published: q.published ?? true,
    ...(q.skills?.length ? { skills: q.skills } : {})
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

/* ------------------------------------------------------------------ */
/* Takedown engine (Phase 4 Item D3)                                   */
/* ------------------------------------------------------------------ */

/**
 * Soft-delete: marks the question taken down. The DB trigger records the
 * takedown audit row + suppression automatically (discovery.sql), so one
 * update is the whole transaction. The row stays for restore/purge and for
 * the admin badge; every public read filters it out.
 */
export async function takeDownQuestion(id: number, question: string, reason: string, note = ""): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.from("takedowns").insert({
    target_kind: "question",
    target_id: String(id),
    question_text: question,
    reason,
    note,
    action: "soft"
  }).select("id");
  if (error) throw new Error(error.message);
  /* suppressions are best-effort pre-migration (missing table → the row still
     lands and the status update below still filters the question out) */
  const { error: stErr } = await client.from("published_questions")
    .update({ status: "taken_down", published: false })
    .eq("id", id);
  if (stErr) {
    /* pre-migration DB: no status column — fall back to unpublish so the
       content still disappears from public reads (graceful degradation) */
    const { error: fbErr } = await client.from("published_questions").update({ published: false }).eq("id", id);
    if (fbErr) throw new Error(fbErr.message);
  }
  await refreshAdminData();
}

/** Restores a taken-down question: clears status, unpins the suppression. */
export async function restoreQuestion(id: number, question: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("published_questions")
    .update({ status: "active", taken_down_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  /* clearing the suppression requires an update on the matching takedown row
     (the DB trigger deletes the suppression when restored_at is set) */
  await client.from("takedowns")
    .update({ restored_at: new Date().toISOString() })
    .eq("target_kind", "question")
    .eq("target_id", String(id))
    .is("restored_at", null);
  await refreshAdminData();
}

/** Hard purge — explicit second step. The question_audit trigger logs the delete. */
export async function purgeQuestion(id: number): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("published_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

/** Takedown audit rows (newest first) for the admin UI. */
export async function listTakedowns(limit = 50): Promise<TakedownRow[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("takedowns")
    .select("id, target_kind, target_id, question_text, reason, note, actor, action, restored_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return []; /* pre-migration → empty (graceful degradation) */
  return (data ?? []) as unknown as TakedownRow[];
}

export interface TakedownRow {
  id: number;
  target_kind: string;
  target_id: string;
  question_text: string | null;
  reason: string;
  note: string;
  actor: string;
  action: string;
  restored_at: string | null;
  created_at: string;
}

/** Edits an existing question (used by the review inbox to clean up drafts). */
export async function updateQuestion(id: number, patch: {
  fieldId?: string; level?: LevelId; question?: string; answer?: string; keyPoints?: string[]; skills?: string[];
}): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const row: Record<string, unknown> = {};
  if (patch.fieldId !== undefined) row.field_id = patch.fieldId;
  if (patch.level !== undefined) row.level = patch.level;
  if (patch.question !== undefined) row.question = patch.question;
  if (patch.answer !== undefined) row.answer = patch.answer;
  if (patch.keyPoints !== undefined) row.key_points = patch.keyPoints;
  if (patch.skills !== undefined) row.skills = patch.skills;
  const { error } = await client.from("published_questions").update(row).eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

/** Batch publish/unpublish for the review inbox. */
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
/* Status filter (Phase 4 Item A — pure, client-side)                  */
/* ------------------------------------------------------------------ */

export type QuestionStatusFilter = "all" | "draft" | "live";

/** Admin → Questions status predicate: the `published` boolean already exists,
    so draft/live filtering needs no server change. */
export function statusFilterPasses(published: boolean, filter: QuestionStatusFilter): boolean {
  if (filter === "draft") return !published;
  if (filter === "live") return published;
  return true;
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

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
