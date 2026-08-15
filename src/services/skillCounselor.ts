/* skillCounselor — the pure engine behind the Skill Counselor view
   (docs/skill-counselor.md §8). Offline-first and unit-tested: given the
   user's claimed skills + years and a chosen field/track/target band, it
   produces the ordered path, the gap list, the level-up delta and a
   digest-style plan. No network, no AI — the catalog (src/data/skillCatalog.ts)
   is the curated, versioned source of truth. */

import { type CareerProfile } from "../types";
import {
  BAND_LABEL, BAND_ORDER, BAND_WHATS_NEW,
  skillsOf, trackById,
  type Band, type CatalogSkill
} from "../data/skillCatalog";

/** Approximate the profile's seniority from years (mirrors the matcher's
    ladder, plus staff/principal so the counselor can show the delta). */
export function bandForYears(years: number): Band {
  if (years >= 10) return "principal";
  if (years >= 7) return "staff";
  if (years >= 4) return "senior";
  if (years >= 2) return "mid";
  return "junior";
}

export interface GapResult {
  owned: CatalogSkill[];
  missing: CatalogSkill[];
  currentBand: Band;
  next: CatalogSkill | null;
  /** Owned skills at/below the current band — the floor you're building on. */
  foundation: CatalogSkill[];
}

/** Split a track's path into owned vs missing against the user's skills
    (canonical ids, lowercased). The "next" skill is the first missing one in
    path order — the single most actionable step. */
export function gapAnalysis(
  profile: Pick<CareerProfile, "years" | "skills"> | null,
  fieldId: string,
  trackId: string
): GapResult | null {
  const track = trackById(fieldId, trackId);
  if (!track) return null;
  const path = skillsOf(track);
  const ownedIds = new Set((profile?.skills ?? []).map(s => s.trim().toLowerCase()));
  const currentBand = bandForYears(profile?.years ?? 0);

  const owned = path.filter(s => ownedIds.has(s.id));
  const missing = path.filter(s => !ownedIds.has(s.id));
  const foundation = owned.filter(s => BAND_ORDER[s.band] <= BAND_ORDER[currentBand]);

  return { owned, missing, currentBand, next: missing[0] ?? null, foundation };
}

export interface LevelUpDelta {
  currentBand: Band;
  targetBand: Band;
  /** Skills in bands strictly above the current one, up to the target. */
  newSkills: CatalogSkill[];
  /** Skills in bands above the target (out of reach for now). */
  later: CatalogSkill[];
  changes: string[];
}

/** What's needed to move from the user's current band to a chosen target:
    only the DELTA (new bands + what changes), never the whole path again. */
export function levelUpDelta(
  profile: Pick<CareerProfile, "years" | "skills"> | null,
  fieldId: string,
  trackId: string,
  targetBand: Band
): LevelUpDelta | null {
  const track = trackById(fieldId, trackId);
  if (!track) return null;
  const path = skillsOf(track);
  const currentBand = bandForYears(profile?.years ?? 0);
  const tIdx = BAND_ORDER[targetBand];
  const cIdx = BAND_ORDER[currentBand];

  const ownedIds = new Set((profile?.skills ?? []).map(s => s.trim().toLowerCase()));
  const newSkills = path.filter(s =>
    BAND_ORDER[s.band] > cIdx && BAND_ORDER[s.band] <= tIdx && !ownedIds.has(s.id)
  );
  const later = path.filter(s => BAND_ORDER[s.band] > tIdx);

  const changes: string[] = [];
  for (const b of Object.keys(BAND_ORDER) as Band[]) {
    const bi = BAND_ORDER[b];
    if (bi > cIdx && bi <= tIdx && BAND_WHATS_NEW[b]) changes.push(`${BAND_LABEL[b]} — ${BAND_WHATS_NEW[b]}`);
  }
  return { currentBand, targetBand, newSkills, later, changes };
}

/** Digest-style plan text — one line per key fact, ready for sharing or
    pasting into the email digest shape. */
export function buildPlan(
  profile: Pick<CareerProfile, "years" | "skills"> | null,
  fieldId: string,
  trackId: string,
  targetBand: Band
): string[] {
  const track = trackById(fieldId, trackId);
  if (!track) return [];
  const gap = gapAnalysis(profile, fieldId, trackId);
  const delta = levelUpDelta(profile, fieldId, trackId, targetBand);
  if (!gap || !delta) return [];

  const title = track.targetTitles[0] ?? track.name;
  const out: string[] = [];
  out.push(`🎯 Path to ${BAND_LABEL[targetBand]} ${title} (${track.name} track)`);
  out.push(`📊 You're at ${BAND_LABEL[delta.currentBand]} (${profile?.years ?? 0} yrs) with ${gap.owned.length} of ${gap.owned.length + gap.missing.length} path skills.`);
  if (gap.next) out.push(`📈 Learn next: ${gap.next.name} → then ${gap.missing.slice(1, 4).map(s => s.name).join(" → ")}.`);
  if (delta.newSkills.length) out.push(`🧭 To reach ${BAND_LABEL[targetBand]}: ${delta.newSkills.slice(0, 6).map(s => s.name).join(", ")}${delta.newSkills.length > 6 ? "…" : ""}.`);
  for (const c of delta.changes.slice(0, 2)) out.push(`✨ ${c}`);
  return out;
}
