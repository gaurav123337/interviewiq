/* Pure helpers for the AI draft-cleaner — kept separate so vitest can test
   them without network. The prompt enforces the legal posture: never reproduce
   source text verbatim; everything stored is AI-original writing. */

/** Builds the chat prompt for one draft item. */
export function buildCleanPrompt(item) {
  return [
    "You are cleaning interview-question drafts for an interview-prep question bank.",
    "",
    "HARD RULES:",
    "1. NEVER reproduce any source text verbatim. Paraphrase entirely in your own words and write ORIGINAL model answers. Problem titles, company names and difficulty are facts — everything else must be your own writing.",
    "2. If the draft is only a topic or problem title (e.g. 'Design Pastebin.com', 'Two Sum', an HN thread title), keep it as the question and write an original explanation: what the interviewer is probing, approach, complexity, an example, common mistakes.",
    "3. If the draft question is messy or too long, rewrite it as one clean, focused interview question.",
    "4. Answers: concise but complete (3-6 sentences; for coding problems: approach + complexity + pitfalls).",
    "5. keyPoints: 3-5 short bullet phrases.",
    "6. difficulty: 1 (easy), 2 (medium), or 3 (hard).",
    "7. company: the company name only if the draft is company-tagged, otherwise null.",
    "",
    "Return ONLY strict JSON (no markdown fences, no commentary):",
    '{"question": string, "answer": string, "keyPoints": string[], "difficulty": 1|2|3, "company": string|null}',
    "",
    "DRAFT:",
    JSON.stringify({ question: item.question, field: item.fieldId, level: item.level, meta: item.meta ?? {} }, null, 2)
  ].join("\n");
}

/** Extracts the first balanced JSON object from a model reply, or null. */
export function parseCleanJson(text) {
  const t = String(text ?? "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Validates + normalizes a parsed clean object; returns null when unusable. */
export function applyClean(item, clean) {
  if (!clean || typeof clean !== "object") return null;
  const question = typeof clean.question === "string" ? clean.question.trim() : "";
  const answer = typeof clean.answer === "string" ? clean.answer.trim() : "";
  const difficulty = [1, 2, 3].includes(Number(clean.difficulty)) ? Number(clean.difficulty) : null;
  const company = typeof clean.company === "string" && clean.company.trim() ? clean.company.trim() : null;
  const keyPoints = Array.isArray(clean.keyPoints)
    ? clean.keyPoints.map((k) => String(k).trim()).filter(Boolean).slice(0, 5)
    : [];
  if (!question || !answer) return null;
  return { question, answer, keyPoints, difficulty, company };
}
