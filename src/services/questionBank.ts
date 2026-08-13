/* Personal question bank (Apply Kit) — every interview question a user
   records in a round is collected here, deduped by question text, and can
   be re-practiced later or reused across applications. Pure + persisted
   so it works offline and syncs like the rest of the tracker. */

import type { LevelId } from "../types";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";
import { listTracks } from "./applyTrack";
import { practiceForRound, type DrillCard } from "./drill";
import { getGoal } from "./goal";

export interface BankEntry {
  /** Stable id — hash of the question text (dedupe across applications). */
  id: string;
  question: string;
  /** Where it was asked (for context). */
  company: string;
  jobTitle: string;
  roundLabel: string;
  at: number;
}

type Bank = Record<string, BankEntry>;

export function listBank(): BankEntry[] {
  return Object.values(storageGet<Bank>(STORAGE_KEYS.questionBank, {}))
    .sort((a, b) => b.at - a.at);
}

/** Adds one question to the bank. Dedupes by question text — re-adding from
    another application updates the context but keeps one canonical entry. */
export function addToBank(entry: Omit<BankEntry, "id" | "at">): { added: boolean; id: string } {
  const id = stableId(entry.question);
  const bank = storageGet<Bank>(STORAGE_KEYS.questionBank, {});
  const existing = bank[id];
  const at = existing?.at ?? Date.now();
  bank[id] = { ...entry, id, at };
  storageSet(STORAGE_KEYS.questionBank, bank);
  return { added: !existing, id };
}

/** Extracts individual questions from a round's notes (line-based or split
    on ?/…) and adds each to the bank. Returns how many were newly added. */
export function bankFromRound(notes: string, company: string, jobTitle: string, roundLabel: string): number {
  const parts = notes
    .split(/\n|(?<=[?…!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 8);
  if (!parts.length && notes.trim().length > 8) parts.push(notes.trim());
  let added = 0;
  for (const p of parts) {
    if (addToBank({ question: p, company, jobTitle, roundLabel }).added) added++;
  }
  return added;
}

export function removeFromBank(id: string): void {
  const bank = storageGet<Bank>(STORAGE_KEYS.questionBank, {});
  delete bank[id];
  storageSet(STORAGE_KEYS.questionBank, bank);
}

/** Simple stable hash — enough for dedupe (not crypto). */
export function stableId(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return "q" + h.toString(36);
}

/* ------------------------------------------------------------------ */
/* Bank-driven practice                                                */
/* ------------------------------------------------------------------ */

/** Bank entries whose question came from a failed or low-rated (≤ 2★) round
    anywhere in the tracker — "what actually tripped you up". Pure. */
export function weakestBankEntries(): BankEntry[] {
  const weak = new Set<string>();
  for (const t of listTracks()) {
    for (const r of t.rounds) {
      if (r.outcome === "failed" || (r.went !== null && r.went <= 2)) {
        for (const line of r.questions.split(/\n|(?<=[?…!])\s+/).map(s => s.trim()).filter(Boolean)) {
          if (line.length > 8) weak.add(stableId(line));
        }
      }
    }
  }
  return listBank().filter(b => weak.has(b.id));
}

/** Build a practice deck from the personal bank: every bank question is
    matched against the curated bank for `fieldSel` (own field first, then a
    sweep), deduped, optionally restricted to weakest-round entries, and
    filtered to `lvl` when not "all". Returns up to `count` drill cards. */
export function practiceDeck(
  fieldSel: string,
  lvl: LevelId | "all" = "all",
  opts: { weakest?: boolean; count?: number } = {}
): DrillCard[] {
  const count = opts.count ?? 10;
  const entries = opts.weakest ? weakestBankEntries() : listBank();
  if (!entries.length) return [];
  const field = fieldSel || getGoal()?.fieldId || "frontend";
  const seen = new Set<string>();
  const out: DrillCard[] = [];
  /* join every bank question into one notes blob so practiceForRound can
     keyword-match across all of them at once */
  const notes = entries.map(e => e.question).join("\n");
  for (const c of practiceForRound(notes, field, count)) {
    if (lvl !== "all" && c.lvl !== lvl) continue;
    if (seen.has(c.q)) continue;
    seen.add(c.q);
    out.push(c);
    if (out.length >= count) break;
  }
  return out;
}
