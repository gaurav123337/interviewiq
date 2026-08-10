/* 👍/👎/🚩 feedback on model answers. Best-effort and anonymous-friendly:
   the question_feedback table's RLS allows inserts from anyone (signed in or
   not), so feedback works for the app's no-account users too. A per-question
   vote is remembered locally so the same user can't double-count. */

import { getSupabaseClient } from "./cloud";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export type FeedbackKind = "up" | "down" | "flag";

export interface FeedbackInput {
  question: string;
  fieldId?: string;
  level?: string;
  kind: FeedbackKind;
  reason?: string;
}

function getVotes(): Record<string, FeedbackKind> {
  return storageGet<Record<string, FeedbackKind>>(STORAGE_KEYS.feedbackVotes, {});
}

/** Has this user already voted on this question (any kind)? */
export function hasVoted(question: string, kind?: FeedbackKind): boolean {
  const v = getVotes()[question];
  return kind ? v === kind : !!v;
}

export function voteCount(): number {
  return Object.keys(getVotes()).length;
}

/** Send feedback. Returns true when it reached the server. */
export async function sendFeedback(input: FeedbackInput): Promise<boolean> {
  const client = await getSupabaseClient();
  if (!client) return false; /* cloud not configured — nothing to do */
  const { data } = await client.auth.getUser();
  const uid = data?.user?.id ?? null;
  const { error } = await client.from("question_feedback").insert({
    user_id: uid,
    question: input.question,
    field_id: input.fieldId ?? null,
    level: input.level ?? null,
    kind: input.kind,
    reason: input.reason ?? null
  });
  if (error) return false;
  const votes = getVotes();
  votes[input.question] = input.kind;
  storageSet(STORAGE_KEYS.feedbackVotes, votes);
  return true;
}
