/* The "AI agent" that turns raw documents (PDF extracts, web dumps) into
   structured, reviewable question drafts. Uses the user's configured AI key
   (OpenAI-compatible). Output is strict JSON; anything unparsable is rejected
   so garbage never reaches the review queue. */

import { chat } from "../ai";
import type { ImportedQuestion } from "./import";
import { FIELDS, LEVELS } from "../data";

const fieldIds = new Set<string>(FIELDS.map(f => f.id));
const levelIds = new Set<string>(LEVELS.map(l => l.id));

const PROMPT = `You are a senior interview question curator. Convert the raw material below into a
JSON array of interview questions. Each item MUST be exactly:
{ "fieldId": <one of: ${FIELDS.map(f => f.id).join(", ")}>, "level": <one of: ${LEVELS.map(l => l.id).join(", ")}>, "question": "<a single, realistic interview question>", "answer": "<a concise model answer, 2-5 sentences>", "keyPoints": ["<1-4 scoring key points>"] }
Rules:
- Only extract content that is genuinely useful as an interview question. Skip ads, navigation, and noise.
- Infer fieldId and level from the content; default to ${FIELDS[0]?.id ?? "general"} / "mid" when unclear.
- Aim for 5-12 high-quality questions.
- Reply with ONLY the JSON array — no markdown fences, no commentary.

RAW MATERIAL:
"""`;

/** Runs the cleaning agent and parses the result into validated drafts. */
export async function cleanTextToQuestions(raw: string, opts: { maxTokens?: number } = {}): Promise<ImportedQuestion[]> {
  const out = await chat(
    [
      { role: "system", content: "You produce strict JSON only." },
      { role: "user", content: PROMPT + raw.slice(0, 24_000) + "\n\"\"\"" }
    ],
    { temperature: 0.2, maxTokens: opts.maxTokens ?? 2000 }
  );
  const cleaned = out.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("AI response was not a JSON array");
  const data: unknown = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(data)) throw new Error("AI response was not an array");
  return data
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map(r => ({
      fieldId: String(r.fieldId ?? r.field ?? "").trim(),
      level: String(r.level ?? r.levelId ?? "").trim().toLowerCase() as ImportedQuestion["level"],
      question: String(r.question ?? r.q ?? "").trim(),
      answer: String(r.answer ?? r.a ?? "").trim(),
      keyPoints: Array.isArray(r.keyPoints)
        ? r.keyPoints.map(k => String(k).trim()).filter(Boolean)
        : String(r.keyPoints ?? "").split(",").map(k => k.trim()).filter(Boolean)
    }))
    .filter(r => r.question && fieldIds.has(r.fieldId) && levelIds.has(r.level));
}
