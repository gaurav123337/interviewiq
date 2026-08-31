/* Career goal + skill profile + roadmap progress persistence (the roadmap's data layer).
   Reads/writes only through the storage repository — consistent with the sync seam. */

import type { CareerGoal, SkillProfile } from "../types";
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "./storage";
import { ingestGoal, ingestSkillProfile, rebuildCanonicalProfile } from "./profileStore";

/** Which goal a progress record belongs to (level/field/company identity).
    Changing the substance of the goal resets progress automatically. */
export const goalFingerprint = (g: CareerGoal) => `${g.currentLevel}|${g.targetLevel}|${g.fieldId}|${g.companyId}`;

export interface RoadmapProgress {
  fingerprint: string;
  /** Topic ids checked off (topic.id = `${phase}-${index}`). */
  completed: string[];
  completedAt: Record<string, number>;
  updatedAt: number;
}

const EMPTY_PROGRESS: RoadmapProgress = { fingerprint: "", completed: [], completedAt: {}, updatedAt: 0 };

export function getGoal(): CareerGoal | null {
  return storageGet(STORAGE_KEYS.goal, null);
}

export function saveGoal(g: CareerGoal): void {
  storageSet(STORAGE_KEYS.goal, g);
  /* live bridge: the goal also lands in the one canonical aggregate */
  ingestGoal(g);
}

export function getProfile(): SkillProfile | null {
  return storageGet(STORAGE_KEYS.skills, null);
}

export function saveProfile(p: SkillProfile): void {
  storageSet(STORAGE_KEYS.skills, p);
  /* live bridge: roadmap ratings fan out into the canonical skill graph, so a
     roadmap edit surfaces on the jobs/counselor side without a manual re-save */
  ingestSkillProfile(p);
}

/** Records that the user skipped the diagnostic (roadmap falls back to self-assessment). */
export function markDiagnosticSkipped(profile: SkillProfile): SkillProfile {
  const next = { ...profile, skippedAt: Date.now() };
  saveProfile(next);
  return next;
}

export function getProgress(): RoadmapProgress {
  return storageGet(STORAGE_KEYS.roadmapProg, EMPTY_PROGRESS);
}

export function saveProgress(p: RoadmapProgress): void {
  storageSet(STORAGE_KEYS.roadmapProg, p);
}

/** Toggles a topic's done state for the given goal (namespaced by fingerprint). */
export function toggleTopicProgress(goal: CareerGoal, topicId: string): RoadmapProgress {
  const p = getProgress();
  const fp = goalFingerprint(goal);
  const completed = p.fingerprint === fp ? p.completed : [];
  const done = completed.includes(topicId);
  const next: RoadmapProgress = {
    fingerprint: fp,
    completed: done ? completed.filter(id => id !== topicId) : [...completed, topicId],
    completedAt: { ...(p.fingerprint === fp ? p.completedAt : {}) },
    updatedAt: Date.now()
  };
  if (done) delete next.completedAt[topicId];
  else next.completedAt[topicId] = Date.now();
  saveProgress(next);
  return next;
}

export function clearProgress(): void {
  storageRemove(STORAGE_KEYS.roadmapProg);
}

export function clearGoal(): void {
  storageRemove(STORAGE_KEYS.goal);
  storageRemove(STORAGE_KEYS.skills);
  clearProgress();
  /* the roadmap's legacy keys are gone — rebuild the canonical aggregate from
     what remains so no stale goal/roadmap skills linger in the cached profile
     (the fresh stamp keeps a later cloud sync from resurrecting them). */
  rebuildCanonicalProfile();
}
