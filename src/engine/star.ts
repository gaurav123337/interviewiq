/* STAR behavioral scoring — detects how completely an answer tells a
   Situation → Task → Action → Result story, on the app's 0-5 scale. */

const SITUATION = /\b(when i was|in my|at my|during|my team|my role was|the project|the situation|i worked on|back when|in a previous)\b/i;
const TASK = /\b(i needed to|my goal|the task|my task was|i was tasked|assigned to|i was responsible|i had to|my objective|i was asked to|the challenge was|i owned)\b/i;
const ACTION = /\b(i (did|built|led|created|introduced|changed|implemented|designed|wrote|shipped|drove|refactored|negotiated|hired|launched|fixed|improved|reduced|started|organized|mentored|taught|automated)|we (built|shipped|launched|implemented))\b/i;
const RESULT = /\b(result|outcome|as a result|because of this|led to|in the end|it worked|the impact|increased|decreased|reduced|improved|grew|saved|converted|adopted|learned|what i (learned|took away))\b/i;

export const STAR_ELEMENTS = [
  { id: "S", label: "Situation", re: SITUATION, hint: "Set the scene — when and where, with enough context that the interviewer can follow the story." },
  { id: "T", label: "Task", re: TASK, hint: "Name your goal or responsibility — what you were trying to accomplish." },
  { id: "A", label: "Action", re: ACTION, hint: "Describe YOUR actions in first person with specifics — what you did, not what the team vaguely did." },
  { id: "R", label: "Result", re: RESULT, hint: "Quantify the outcome — numbers, adoption, time saved — and what you learned." }
] as const;

export interface StarResult {
  score: number;   // 0-5
  pct: number;     // 0..1 — fraction of STAR present (actions weigh most)
  present: string[];
  missing: string[];
  words: number;
}

/** Scores a behavioral answer by how completely it tells a STAR story. */
export function scoreStar(userText: string): StarResult {
  const text = String(userText || "").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const present = STAR_ELEMENTS.filter(e => e.re.test(text)).map(e => e.id);
  const missing = STAR_ELEMENTS.filter(e => !e.re.test(text)).map(e => e.id);

  const have = STAR_ELEMENTS.filter(e => e.re.test(text));
  /* action + result weigh ~2x the setup elements (that's where answers actually fail) */
  const weights: Record<string, number> = { S: 1, T: 1, A: 2, R: 2 };
  const wSum = STAR_ELEMENTS.reduce((n, e) => n + weights[e.id], 0);
  const wHit = have.reduce((n, e) => n + weights[e.id], 0);
  const lenPct = Math.min(1, words / 70);
  const combined = (wHit / wSum) * 0.85 + lenPct * 0.15;
  let score = Math.round(1 + combined * 4);
  if (!text) score = 0;
  score = Math.max(0, Math.min(5, score));
  return { score, pct: combined, present, missing, words };
}
