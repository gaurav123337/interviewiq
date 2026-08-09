import type { LevelId } from "../types";
import { bankItems, shuffle } from "../engine";
import { storageGet, storageSet } from "./storage";

export interface DrillCard {
  q: string;
  a: string;
  kp: string[];
  lvl: LevelId;
}

const LEARNED_KEY = "iq.drillLearned";

/* ---------- learned tracking (lightweight SRS: learned cards drop out of future decks) ---------- */

export function getLearned(): Set<string> {
  return new Set(storageGet<string[]>(LEARNED_KEY, []));
}

export function markLearned(q: string): void {
  const s = getLearned();
  s.add(q);
  storageSet(LEARNED_KEY, [...s]);
}

export function resetLearned(): void {
  storageSet(LEARNED_KEY, []);
}

/* ---------- deck building ---------- */

export function makeDeck(fieldSel: string, lvlSel: LevelId | "all", learned: Set<string>, count = 10): DrillCard[] {
  const { items } = bankItems(fieldSel, "");
  const pool = items.filter(i => (lvlSel === "all" || i.lvl === lvlSel) && !learned.has(i.q));
  return shuffle(pool).slice(0, Math.min(count, pool.length)).map(i => ({ q: i.q, a: i.a, kp: i.kp, lvl: i.lvl }));
}
