/* Coding-activity tracking — the seam that lets code problems flow through the
   app's existing learning systems:
   - Drill mode: a problem failed ≥2× becomes a spaced-repetition card
     (codingDrillCards → makeDeck).
   - Miss harvesting: every attempt is queued as a `coding_attempt` usage event
     so admins see per-problem pass rates in the Quality Center.
   State lives in localStorage (same offline-first pattern as SRS), with the
   event queued through the existing outbox. */

import { CODING_PROBLEMS, type CodingProblem } from "../data/coding";
import { queueEvent } from "./events";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";
import type { DrillCard } from "./drill";

export interface CodingTrackEntry {
  fails: number;
  solved: boolean;
}

export function getCodingTrack(): Record<string, CodingTrackEntry> {
  return storageGet<Record<string, CodingTrackEntry>>(STORAGE_KEYS.codingTrack, {});
}

/** Record a full-suite run: `passed` = every visible+hidden case passed. */
export function recordCodingAttempt(id: string, passed: boolean): void {
  const track = getCodingTrack();
  const cur = track[id] ?? { fails: 0, solved: false };
  track[id] = passed
    ? { ...cur, solved: true }
    : { fails: cur.fails + 1, solved: cur.solved };
  storageSet(STORAGE_KEYS.codingTrack, track);
  /* miss harvesting — the Quality Center aggregates these per problem */
  void queueEvent("coding_attempt", { problemId: id, passed });
}

/** Problems the user has failed at least twice and never solved → drill cards.
    Cards carry the Pro hint as the answer so Drill doubles as a reminder. */
export function codingDrillCards(problems: CodingProblem[] = CODING_PROBLEMS): DrillCard[] {
  const track = getCodingTrack();
  const cards: DrillCard[] = [];
  for (const p of problems) {
    const t = track[p.id];
    if (!t || t.solved || t.fails < 2) continue;
    const hint = p.hint?.trim();
    cards.push({
      q: `Code: ${p.title}`,
      a: hint && hint.length > 0
        ? hint
        : p.kind === "fn"
          ? `Implement ${p.fn.name}(${p.fn.args}) → ${p.fn.returns}.`
          : p.prompt,
      kp: [catOf(p), "Practice in the playground — tests are hidden, so verify edge cases yourself."],
      lvl: p.difficulty === 1 ? "junior" : p.difficulty === 2 ? "mid" : "senior"
    });
    if (cards.length >= 6) break;
  }
  return cards;
}

const catOf = (p: CodingProblem): string =>
  p.kind === "cli" ? "Algorithms" : p.kind === "fn" ? "JS functions" : "UI components";
