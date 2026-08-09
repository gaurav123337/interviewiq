/* AI tutor for the career roadmap — explains topics and gaps through the same
   OpenAI-compatible endpoint as feedback/hints, metered against the free tier. */

import { chat } from "../ai";
import type { CareerGoal } from "../types";
import { fieldById, levelById } from "../data";
import { aiCallsLeft, isPaywallEnabled, recordAiCall } from "./entitlements";
import { embed } from "./embeddings";
import { getSupabaseClient, getCloudState } from "./cloud";
import { listPdfDocuments, searchPdfChunks } from "./admin";

async function guard(): Promise<void> {
  if (isPaywallEnabled() && aiCallsLeft() <= 0) {
    throw new Error("You've used your free AI coaching for today — upgrade to Pro for unlimited.");
  }
}

/** A retrieved knowledge-base excerpt the tutor answer was grounded on. */
export interface Citation {
  documentId: number;
  title: string;
  content: string;
  similarity: number;
}

/** Retrieves the most relevant chunks of the RAG knowledge base for a query.
    Best-effort: any failure (no key, not signed in, empty index) returns []. */
async function ragContext(query: string): Promise<Citation[]> {
  try {
    const client = await getSupabaseClient();
    if (!client || !getCloudState().user) return [];
    const qv = await embed([query]);
    if (!qv[0]?.length) return [];
    const hits = await searchPdfChunks(qv[0], 4);
    if (!hits.length) return [];
    const titles = new Map((await listPdfDocuments()).map(d => [d.id, d.title]));
    return hits.map(h => ({
      documentId: h.documentId,
      title: titles.get(h.documentId) ?? "Knowledge base",
      content: h.content,
      similarity: h.similarity
    }));
  } catch {
    return []; /* grounding must never break the tutor */
  }
}

/** Appends the grounded context instructions to a system prompt when retrieved. */
async function withGrounding(sys: string, query: string): Promise<{ sys: string; citations: Citation[] }> {
  const citations = await ragContext(query);
  if (!citations.length) return { sys, citations: [] };
  const ctx = citations.map(c => c.content).join("\n\n---\n\n").slice(0, 6000);
  return {
    sys:
      sys +
      "\n\nReference material from the product knowledge base (use it only when it helps; " +
      "answer from your own knowledge otherwise, and never claim the reference says what it doesn't):\n" +
      ctx,
    citations
  };
}

/** Plain-language explanation of a roadmap topic for the user's target level. */
export async function explainTopic(topic: string, goal: CareerGoal): Promise<string> {
  await guard();
  const field = fieldById(goal.fieldId);
  const lvl = levelById(goal.targetLevel);
  const sys =
    "You are a patient interview coach. Teach one topic in a way a candidate can turn into interview answers. " +
    "Use plain language, short sections, and concrete examples. Do not pad — every sentence should teach something.";
  const usr =
    `Teach the topic "${topic}" to someone preparing for a ${lvl.name} ${field?.name ?? ""} interview. Include:\n` +
    `1) A plain-language explanation of what it is.\n` +
    `2) Why interviewers ask about it at ${lvl.name} level.\n` +
    `3) The 3 most common traps or misunderstandings.\n` +
    `4) A model-answer skeleton they could use in an interview.\n` +
    `Keep it under ~220 words.`;
  const { sys: sysGrounded } = await withGrounding(sys, topic);
  const out = await chat([{ role: "system", content: sysGrounded }, { role: "user", content: usr }], { maxTokens: 650 });
  recordAiCall();
  return out;
}

export interface TutorMsg {
  role: "user" | "assistant";
  content: string;
  /** Knowledge-base excerpts this assistant reply was grounded on. */
  citations?: Citation[];
}

export interface TutorReply {
  text: string;
  citations: Citation[];
}

/** Continues a tutor conversation about one topic — follow-ups keep full context. */
export async function tutorChat(topic: string, goal: CareerGoal, history: TutorMsg[]): Promise<TutorReply> {
  await guard();
  const field = fieldById(goal.fieldId);
  const lvl = levelById(goal.targetLevel);
  const sys =
    `You are a patient interview coach helping a ${lvl.name} ${field?.name ?? ""} candidate master "${topic}". ` +
    `Answer the user's questions about this topic concisely and plainly. Tie answers back to how they'd ` +
    `speak about it in an interview at ${lvl.name} level. If they ask something off-topic, gently steer back. ` +
    `Under ~180 words per reply.`;
  const lastUser = [...history].reverse().find(m => m.role === "user")?.content ?? "";
  const { sys: sysGrounded, citations } = await withGrounding(sys, lastUser || topic);
  const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: sysGrounded },
    ...history.map(m => ({ role: m.role, content: m.content }))
  ];
  const out = await chat(msgs, { maxTokens: 500 });
  recordAiCall();
  return { text: out, citations };
}

/** Explains why a specific weak skill matters for the target role (the "gap explainer"). */
export async function explainGap(skill: string, goal: CareerGoal): Promise<string> {
  await guard();
  const lvl = levelById(goal.targetLevel);
  const field = fieldById(goal.fieldId);
  const sys =
    "You are a senior engineering leader giving career coaching. Be specific, honest and encouraging. Under ~150 words.";
  const usr =
    `A candidate targeting a ${lvl.name} ${field?.name ?? ""} role has a gap in "${skill}". ` +
    `Explain: (1) why this skill matters at that level and what happens if it's weak, ` +
    `(2) what "good" looks like in an interview, and (3) one concrete 30-minute exercise to start closing the gap.`;
  const out = await chat([{ role: "system", content: sys }, { role: "user", content: usr }], { maxTokens: 420 });
  recordAiCall();
  return out;
}
