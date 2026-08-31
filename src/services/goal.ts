/* Career goal + skill profile + roadmap progress persistence (the roadmap's data layer).
   Reads/writes only through the storage repository — consistent with the sync seam. */

import type { CareerGoal, SkillProfile } from "../types";
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "./storage";
import { clearRoadmapFromCanonical, getCanonicalProfile, ingestGoal, ingestSkillProfile, toSkillProfile } from "./profileStore";

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
  /* single home for the goal — the canonical aggregate (iq.profile) */
  return getCanonicalProfile().goal;
}

export function saveGoal(g: CareerGoal): void {
  /* the goal lives only in the one canonical aggregate now */
  ingestGoal(g);
}

export function getProfile(): SkillProfile | null {
  /* derived view over the canonical aggregate — reproduces the iq.skills shape
     (null when no SkillProfile was ever saved), byte-exact on the roadmap ratings */
  return toSkillProfile();
}

export function saveProfile(p: SkillProfile): void {
  /* roadmap ratings fan out into the canonical skill graph, so a roadmap edit
     surfaces on the jobs/counselor side without a manual re-save */
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
  clearProgress();
  /* canonical teardown: drop the goal, diagnostic and roadmap ratings and strip
     the "roadmap" source from the graph (career/resume skills survive). The
     fresh stamp keeps a later cloud sync from resurrecting the cleared state. */
  clearRoadmapFromCanonical();
}
