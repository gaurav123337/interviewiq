/* Personal question bank (Apply Kit) — every interview question a user
   records in a round is collected here, deduped by question text, and can
   be re-practiced later or reused across applications. Pure + persisted
   so it works offline and syncs like the rest of the tracker. */

import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

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
