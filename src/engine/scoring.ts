import type { SessionQuestion } from "../types";

const STOP = new Set(
  ("a an the and or but if of to in on at for with from by as is are was were be been being it its this that these those do does did done has have had i you he she we they them their your my our his her not no can could will would should may might must shall than then so such there here what which who whom when where why how all any both each few more most other some only own same very just about into over under up out off above below again once also too").split(" ")
);

/** Splits text into lowercase, stopword-filtered tokens. */
export function tokenize(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(w => w.length > 1 && !STOP.has(w));
}

const kpTokens = (kp: string): string[] => tokenize(kp).filter(w => w.length > 2);

/* light suffix stemming so "database"/"databases" and "cache"/"caching" match */
const stem = (w: string) =>
  w.length > 6 && w.endsWith("ing") ? w.slice(0, -3)
  : w.length > 5 && w.endsWith("ed") ? w.slice(0, -2)
  : w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y"
  : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1)
  : w;

/** True when a stemmed token of `skill` appears in any of `texts` (question text, key points…).
    Used to map questions → skills for per-skill coverage. */
export function relatesToSkill(skill: string, ...texts: string[]): boolean {
  const st = new Set(tokenize(skill).map(stem).filter(w => w.length > 3));
  if (!st.size) return false;
  for (const t of texts) {
    for (const w of tokenize(t).map(stem)) {
      if (w.length > 3 && st.has(w)) return true;
    }
  }
  return false;
}

export interface ScoreResult {
  score: number;
  pct: number;
  covered: string[];
  missed: string[];
  words: number;
}

/** Scores an answer by token overlap with the question's key points, plus a length heuristic. */
export function scoreAnswer(userText: string, question: SessionQuestion): ScoreResult {
  const words = tokenize(userText);
  const ansLen = words.length;
  let hit = 0;
  const covered: string[] = [];
  const missed: string[] = [];
  for (const kp of question.kp ?? []) {
    const kt = kpTokens(kp);
    if (!kt.length) continue;
    const isHit = kt.some(t => words.includes(t));
    if (isHit) { hit++; covered.push(kp); } else { missed.push(kp); }
  }
  const total = Math.max(1, question.kp.length);
  const rawPct = hit / total;
  const lenPct = Math.min(1, ansLen / 30);
  const combined = rawPct * 0.75 + lenPct * 0.25;
  let score = Math.round(1 + combined * 4);
  if (!userText || !userText.trim()) score = 0;
  score = Math.max(0, Math.min(5, score));
  return { score, pct: combined, covered, missed, words: ansLen };
}
