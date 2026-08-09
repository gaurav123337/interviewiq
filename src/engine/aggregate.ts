import type { Aggregate, Answer, CatStat } from "../types";

/** Maps a 0..1 coverage score to a letter grade. Single source of truth for grading. */
export function grade(pct: number): string {
  return pct >= 0.9 ? "A" : pct >= 0.8 ? "B" : pct >= 0.65 ? "C" : pct >= 0.5 ? "D" : "F";
}

interface CatAcc { label: string; score: number; pct: number; n: number }

/** Aggregates a session's answers into an overall score/grade and per-category stats. */
export function aggregate(answers: Answer[]): Aggregate {
  const byCat = new Map<string, CatAcc>();
  let total = 0;
  let sum = 0;
  for (const a of answers) {
    const cat = a.q.catLabel;
    const cur = byCat.get(cat) ?? { label: cat, score: 0, pct: 0, n: 0 };
    cur.n++;
    cur.score = 0;
    byCat.set(cat, cur);
  }
  for (const a of answers) {
    const cur = byCat.get(a.q.catLabel)!;
    cur.score += a.fb.score;
  }
  for (const a of answers) {
    total++;
    sum += a.fb.score;
  }
  if (!total) return { score: 0, pct: 0, grade: "F", cats: [] };
  const cats: CatStat[] = [...byCat.entries()].map(([label, v]) => ({
    label,
    score: +(v.score / v.n).toFixed(2),
    pct: v.score / (v.n * 5)
  }));
  const pct = sum / (total * 5);
  return { score: +(pct * 5).toFixed(2), pct, grade: grade(pct), cats };
}

/** Ranks the key points missed most often across a session as study topics. */
export function topicSuggestions(answers: Answer[]): string[] {
  const counts = new Map<string, number>();
  for (const a of answers) {
    for (const kp of a.fb.missed ?? []) counts.set(kp, (counts.get(kp) ?? 0) + 1);
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([kp]) => kp);
}
