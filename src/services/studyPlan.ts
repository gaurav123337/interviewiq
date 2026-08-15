/* studyPlan — persistence for the counselor's 90-day plan
   (docs/skill-counselor.md §8). The plan itself is pure
   (skillCounselor.build90DayPlan); this layer keeps it + the week-level
   checkboxes offline across sessions. */

import { STORAGE_KEYS, storageGet, storageSet } from "./storage";
import type { StudyPlan } from "./skillCounselor";

export function getSavedStudyPlan(): StudyPlan | null {
  return storageGet<StudyPlan | null>(STORAGE_KEYS.counselorPlan, null);
}

export function saveStudyPlan(plan: StudyPlan): void {
  storageSet(STORAGE_KEYS.counselorPlan, plan);
}

export function clearStudyPlan(): void {
  storageSet(STORAGE_KEYS.counselorPlan, null);
}

/** Progress key: `${fieldId}/${trackId}/${targetBand}` → week number → done. */
export function planProgressKey(p: { fieldId: string; trackId: string; targetBand: string }): string {
  return `${p.fieldId}/${p.trackId}/${p.targetBand}`;
}

export function getPlanProgress(key: string): Record<number, boolean> {
  const all = storageGet<Record<string, Record<number, boolean>>>(STORAGE_KEYS.counselorProgress, {});
  return all[key] ?? {};
}

export function setWeekDone(key: string, week: number, done: boolean): void {
  const all = storageGet<Record<string, Record<number, boolean>>>(STORAGE_KEYS.counselorProgress, {});
  const cur = all[key] ?? {};
  cur[week] = done;
  all[key] = cur;
  storageSet(STORAGE_KEYS.counselorProgress, all);
}
