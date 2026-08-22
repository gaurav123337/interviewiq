/* Career profile — CRUD, local cache + cloud sync. */

import type { CareerProfile } from "../../types";
import { LEVELS, fieldById } from "../../data";
import { getCloudState, getSupabaseClient } from "../cloud";
import { getGoal, getProfile } from "../goal";
import { STORAGE_KEYS, storageGet, storageSet } from "../storage";

export function getCareerProfile(): CareerProfile | null {
  return storageGet<CareerProfile | null>(STORAGE_KEYS.career, null);
}

export function saveCareerProfile(p: CareerProfile): void {
  storageSet(STORAGE_KEYS.career, { ...p, updatedAt: Date.now() });
  /* best-effort cloud sync — never blocks the UI */
  void saveCareerProfileToCloud(p);
}

/** A fresh profile prefilled from the diagnostic/roadmap skill profile. */
export function defaultCareerProfile(): CareerProfile {
  const sp = getProfile();
  const goal = getGoal();
  const skills = [...new Set((sp?.skills ?? [])
    .filter(s => (s.measured ?? s.self) >= 2)
    .map(s => s.skill))]
    .slice(0, 30);
  const levelName = LEVELS.find(l => l.id === goal?.targetLevel)?.name;
  /* target titles = the full "Senior Frontend Engineer" pattern, so title
     matching keys on the field, not the seniority word alone */
  const fieldName = fieldById(goal?.fieldId)?.name;
  const titles = levelName
    ? [fieldName ? `${levelName} ${fieldName}` : levelName]
    : fieldName ? [fieldName] : [];
  return {
    headline: "",
    years: 0,
    location: "",
    remote: true,
    workAuth: "",
    targetTitles: titles,
    skills,
    summary: "",
    updatedAt: Date.now()
  };
}

export async function loadCareerProfileFromCloud(): Promise<CareerProfile | null> {
  const client = await getSupabaseClient();
  const user = getCloudState().user;
  if (!client || !user) return null;
  const { data, error } = await client.from("career_profiles").select("data").eq("user_id", user.id).maybeSingle();
  if (error || !data) return null;
  return data.data as CareerProfile;
}

export async function saveCareerProfileToCloud(p: CareerProfile): Promise<void> {
  const client = await getSupabaseClient();
  const user = getCloudState().user;
  if (!client || !user) return;
  await client.from("career_profiles").upsert(
    { user_id: user.id, data: p, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
}
