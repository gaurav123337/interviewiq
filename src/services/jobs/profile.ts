/* Career profile — CRUD, local cache + cloud sync. */

import type { CareerProfile } from "../../types";
import { LEVELS, fieldById } from "../../data";
import { getCloudState, getSupabaseClient } from "../cloud";
import { getGoal } from "../goal";
import { getCanonicalProfile, ingestCareerProfile, toCareerProfile } from "../profileStore";

export function getCareerProfile(): CareerProfile | null {
  const p = getCanonicalProfile();
  /* Preserve the exact legacy null contract: a career profile "exists" only
     once the user has saved one (origins.career). When it does exist, its
     skills are DERIVED from the unified graph — so roadmap/diagnostic edits
     surface here live (the Item 11 bridge). A user who has never created a
     career profile still gets null → the "Prefill from my skills" CTA shows. */
  if (!p.origins.career) return null;
  return toCareerProfile(p);
}

export function saveCareerProfile(p: CareerProfile): void {
  const saved = { ...p, updatedAt: Date.now() };
  /* the career profile lives in the one canonical aggregate (skills fold into
     the graph); origins.career flips true so getCareerProfile() stops returning null */
  ingestCareerProfile(saved);
  /* best-effort cloud sync — never blocks the UI (stamped copy, matches local) */
  void saveCareerProfileToCloud(saved);
}

/** A fresh profile prefilled from the unified skill graph (roadmap / diagnostic
    / resume, via the canonical store). When no target titles have been saved
    yet, synthesize the "Senior Frontend Engineer" pattern from the goal so
    title matching keys on the field, not the seniority word alone. */
export function defaultCareerProfile(): CareerProfile {
  const base = toCareerProfile(getCanonicalProfile());
  if (base.targetTitles.length === 0) {
    const goal = getGoal();
    const levelName = LEVELS.find(l => l.id === goal?.targetLevel)?.name;
    const fieldName = fieldById(goal?.fieldId)?.name;
    base.targetTitles = levelName
      ? [fieldName ? `${levelName} ${fieldName}` : levelName]
      : fieldName ? [fieldName] : [];
  }
  return base;
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
