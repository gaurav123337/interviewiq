/* Career goal + skill profile persistence (the roadmap's data layer).
   Reads/writes only through the storage repository — consistent with the sync seam. */

import type { CareerGoal, SkillProfile } from "../types";
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "./storage";

export function getGoal(): CareerGoal | null {
  return storageGet(STORAGE_KEYS.goal, null);
}

export function saveGoal(g: CareerGoal): void {
  storageSet(STORAGE_KEYS.goal, g);
}

export function getProfile(): SkillProfile | null {
  return storageGet(STORAGE_KEYS.skills, null);
}

export function saveProfile(p: SkillProfile): void {
  storageSet(STORAGE_KEYS.skills, p);
}

/** Records that the user skipped the diagnostic (roadmap falls back to self-assessment). */
export function markDiagnosticSkipped(profile: SkillProfile): SkillProfile {
  const next = { ...profile, skippedAt: Date.now() };
  saveProfile(next);
  return next;
}

export function clearGoal(): void {
  storageRemove(STORAGE_KEYS.goal);
  storageRemove(STORAGE_KEYS.skills);
}
