/* AI tutor for the career roadmap — explains topics and gaps through the same
   OpenAI-compatible endpoint as feedback/hints, metered against the free tier. */

import { chat } from "../ai";
import type { CareerGoal } from "../types";
import { fieldById, levelById } from "../data";
import { aiCallsLeft, isPaywallEnabled, recordAiCall } from "./entitlements";
import { documentTitles, groundingPrompt, notifyKnowledgeGap, retrieveContext, type RagContext } from "./rag";

async function guard(): Promise<void> {
  if (isPaywallEnabled() && aiCallsLeft() <= 0) {
    throw new Error("You've used your free AI coaching for today — upgrade to Pro for unlimited.");
  }
}

/** A retrieved knowledge-base excerpt the tutor answer was grounded on.
    `grounded` is false when the hit was too weak to cite — the answer then
    comes from general knowledge and says so. */
export interface Citation {
  documentId: number;
  title: string;
  content: string;
  similarity: number;
  grounded: boolean;
}

/** Appends the grounded context + instructions to a system prompt when the
    knowledge base is relevant. Exported so the AI-coach API mode grounds its
    replies through the same pipeline (and shows the same citation chips). */
export async function withGrounding(
  sys: string,
  query: string,
  ragCtx?: RagContext
): Promise<{ sys: string; citations: Citation[]; grounded: boolean; checked: boolean }> {
  const { hits, checked } = await retrieveContext(query, ragCtx);
  if (!hits.length) {
    /* checked + nothing grounded → the user's question wasn't in the KB;
       surface a rate-limited notification so they know the answer is from
       general knowledge and can suggest adding the topic */
    if (checked) notifyKnowledgeGap(query);
    return { sys: checked ? groundingPrompt(sys, false, "") : sys, citations: [], grounded: false, checked };
  }
  const titles = await documentTitles();
  const citations: Citation[] = hits.map(h => ({
    documentId: h.documentId,
    title: titles.get(h.documentId) ?? "Knowledge base",
    content: h.content,
    similarity: h.similarity,
    grounded: h.grounded
  }));
  const grounded = hits.some(h => h.grounded);
  const ctx = hits.map(c => c.content).join("\n\n---\n\n").slice(0, 6000);
  return { sys: groundingPrompt(sys, grounded, ctx), citations, grounded, checked };
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
  const { sys: sysGrounded } = await withGrounding(sys, topic, { field: goal.fieldId, level: goal.targetLevel });
  const out = await chat([{ role: "system", content: sysGrounded }, { role: "user", content: usr }], { maxTokens: 650 });
  recordAiCall();
  return out;
}

export interface TutorMsg {
  role: "user" | "assistant";
  content: string;
  /** Knowledge-base excerpts this assistant reply was grounded on. */
  citations?: Citation[];
  /** True when the reply cited knowledge-base sources. */
  grounded?: boolean;
  /** True when retrieval was attempted (signed in + key) but found nothing. */
  checked?: boolean;
}

export interface TutorReply {
  text: string;
  citations: Citation[];
  /** True when the reply cited knowledge-base sources. */
  grounded: boolean;
  /** True when retrieval was attempted (signed in + key). */
  checked: boolean;
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
  const { sys: sysGrounded, citations, grounded, checked } = await withGrounding(sys, lastUser || topic, { field: goal.fieldId, level: goal.targetLevel });
  const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: sysGrounded },
    ...history.map(m => ({ role: m.role, content: m.content }))
  ];
  const out = await chat(msgs, { maxTokens: 500 });
  recordAiCall();
  return { text: out, citations, grounded, checked };
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
