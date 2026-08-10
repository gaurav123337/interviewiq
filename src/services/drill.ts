import type { LevelId } from "../types";
import { deepDiveCards } from "../data/deepDive";
import { bankItems, shuffle } from "../engine";
import { storageGet, storageSet } from "./storage";
import { codingDrillCards } from "./codingTrack";

export interface DrillCard {
  q: string;
  a: string;
  kp: string[];
  lvl: LevelId;
}

export type Rating = "again" | "hard" | "good" | "easy";

interface SrsEntry {
  /** epoch ms when the card is next due */
  due: number;
  /** 0..5 — interval ladder index */
  lvl: number;
}

const SRS_KEY = "iq.drillSrs";
const MINUTE = 60_000;
const DAY = 86_400_000;
/* review intervals per ladder index: again → 1min, then 1d / 3d / 7d / 14d / 30d */
const INTERVALS = [MINUTE, DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];
/* cards at or above this ladder level count as "learned" */
const LEARNED_LVL = 3;

/* ---------- SRS state ---------- */

export function getSrs(): Record<string, SrsEntry> {
  return storageGet<Record<string, SrsEntry>>(SRS_KEY, {});
}

export function rate(q: string, rating: Rating, now = Date.now()): void {
  const srs = getSrs();
  const cur = srs[q]?.lvl ?? 0;
  const lvl = rating === "again"
    ? 0
    : rating === "hard"
      ? Math.min(LEARNED_LVL + 1, cur + 1)
      : rating === "good"
        ? Math.min(LEARNED_LVL + 2, cur + 1)
        : Math.min(5, cur + 2);
  srs[q] = { due: now + INTERVALS[lvl], lvl };
  storageSet(SRS_KEY, srs);
}

export function isDue(q: string, srs: Record<string, SrsEntry>, now = Date.now()): boolean {
  return !srs[q] || srs[q].due <= now;
}

export function learnedCount(srs: Record<string, SrsEntry>): number {
  return Object.values(srs).filter(e => e.lvl >= LEARNED_LVL).length;
}

export function resetSrs(): void {
  storageSet(SRS_KEY, {});
}

/* ---------- deck building ---------- */

/** Builds a deck of due/new cards, overdue first, then shuffled fresh cards. */
export function makeDeck(fieldSel: string, lvlSel: LevelId | "all", count = 10): DrillCard[] {
  const srs = getSrs();
  const now = Date.now();
  const { items } = bankItems(fieldSel, "");
  /* auto-feed the deck from the curated deep-dive knowledge base (QA pairs
     become flashcards) — new topics added there flow into Drill for free */
  const bankQ = new Set(items.map(i => i.q));
  const dd = deepDiveCards()
    .filter(c => !bankQ.has(c.q))
    .map(c => ({ ...c, lvl: (lvlSel === "all" ? "mid" : lvlSel) as LevelId }));
  /* coding problems the user has failed ≥2× join the deck as flashcards */
  const cd = codingDrillCards()
    .filter(c => !bankQ.has(c.q))
    .map(c => ({ ...c, lvl: (lvlSel === "all" ? c.lvl : lvlSel) as LevelId }));
  const pool = [
    ...items.filter(i => (lvlSel === "all" || i.lvl === lvlSel) && isDue(i.q, srs, now)),
    ...dd.filter(c => (lvlSel === "all" || c.lvl === lvlSel) && isDue(c.q, srs, now)),
    ...cd.filter(c => (lvlSel === "all" || c.lvl === lvlSel) && isDue(c.q, srs, now))
  ];
  const overdue = pool.filter(i => srs[i.q]).sort((a, b) => srs[a.q].due - srs[b.q].due);
  const fresh = shuffle(pool.filter(i => !srs[i.q]));
  const ordered = [...overdue, ...fresh];
  return ordered.slice(0, Math.min(count, ordered.length)).map(i => ({ q: i.q, a: i.a, kp: i.kp, lvl: i.lvl }));
}
