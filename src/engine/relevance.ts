import type { QA } from "../types";
import { tokenize } from "./scoring";
import { pickN } from "./random";

/**
 * Picks up to `n` questions whose text best matches `keywords` (token overlap
 * on question + answer + key points). Falls back to random selection when no
 * usable keywords are provided, so callers never end up with an empty session.
 */
export function pickRelevant<T extends QA>(qs: T[], keywords: string[], n: number): T[] {
  if (n <= 0 || !qs.length) return [];
  const kw = new Set(keywords.flatMap(k => tokenize(k)));
  if (!kw.size) return pickN(qs, n);

  const scored = qs.map(q => {
    const text = tokenize(q.q + " " + (q.a ?? "") + " " + (q.kp ?? []).join(" "));
    let hit = 0;
    for (const t of text) if (kw.has(t)) hit++;
    return { q, hit };
  });
  /* best matches first, random tie-break so sessions stay varied */
  scored.sort((a, b) => b.hit - a.hit || Math.random() - 0.5);
  return scored.slice(0, Math.min(n, scored.length)).map(s => s.q);
}
