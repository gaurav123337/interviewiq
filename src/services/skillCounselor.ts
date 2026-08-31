/* skillCounselor — the pure engine behind the Skill Counselor view
   (docs/skill-counselor.md §8). Offline-first and unit-tested: given the
   user's claimed skills + years and a chosen field/track/target band, it
   produces the ordered path, the gap list, the level-up delta and a
   digest-style plan. No network, no AI — the catalog (src/data/skillCatalog.ts)
   is the curated, versioned source of truth. */

import { type CareerProfile } from "../types";
import {
  BAND_LABEL, BAND_ORDER, BAND_WHATS_NEW, FIELDS, SKILLS,
  skillsOf, trackById,
  type Band, type CatalogSkill, type CatalogField, type CatalogTrack
} from "../data/skillCatalog";
import { canonicalize } from "../data/skillVocab";

/** The user's owned skills as a set of canonical catalog ids. CareerProfile
    stores display names ("Node.js", "CI/CD", "Data structures"); canonicalize
    folds each to its catalog id (node / ci-cd / data-structures) so the
    `ownedIds.has(s.id)` checks below actually match. A plain `.toLowerCase()`
    left these unmatched and silently under-counted owned skills. */
function ownedIdsOf(profile: Pick<CareerProfile, "skills"> | null): Set<string> {
  return new Set((profile?.skills ?? []).map(s => canonicalize(s).slug));
}

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
    (folded to canonical catalog ids via skillVocab). The "next" skill is the
    first missing one in path order — the single most actionable step. */
export function gapAnalysis(
  profile: Pick<CareerProfile, "years" | "skills"> | null,
  fieldId: string,
  trackId: string
): GapResult | null {
  const track = trackById(fieldId, trackId);
  if (!track) return null;
  const path = skillsOf(track);
  const ownedIds = ownedIdsOf(profile);
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

  const ownedIds = ownedIdsOf(profile);
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

/* ------------------------------------------------------------------ */
/* Auto-track pick — "based on your resume, we suggest this path"      */
/* ------------------------------------------------------------------ */

export interface TrackSuggestion {
  fieldId: string;
  trackId: string;
  field: CatalogField;
  track: CatalogTrack;
  /** % of the path already owned. */
  matchPct: number;
  owned: number;
  total: number;
  reason: string;
}

/** Pick the track the user already overlaps most with (resume skills vs
    path). No profile → the classic first path, with an honest reason. */
export function suggestTrack(
  profile: Pick<CareerProfile, "years" | "skills"> | null
): TrackSuggestion {
  const ownedIds = ownedIdsOf(profile);
  let best: TrackSuggestion | null = null;
  for (const field of FIELDS) {
    for (const track of field.tracks) {
      const path = skillsOf(track);
      const owned = path.filter(s => ownedIds.has(s.id)).length;
      const pct = Math.round((owned / path.length) * 100);
      if (!best || pct > best.matchPct || (pct === best.matchPct && owned > best.owned)) {
        best = {
          fieldId: field.id, trackId: track.id, field, track,
          matchPct: pct, owned, total: path.length,
          reason: ""
        };
      }
    }
  }
  const b = best!;
  if (!profile || !ownedIds.size) {
    b.reason = `No skill profile yet — start with the classic ${b.track.name} path. Add your resume/skills for a personalized pick.`;
  } else if (b.owned > 0) {
    b.reason = `You already own ${b.owned}/${b.total} skills on the ${b.track.name} path (${b.matchPct}%) — the shortest run to a new title.`;
  } else {
    b.reason = `No overlap yet — the ${b.track.name} path is the recommended starting point.`;
  }
  return b;
}

/* ------------------------------------------------------------------ */
/* 90-day study plan — 12 weekly milestones from the gap               */
/* ------------------------------------------------------------------ */

export interface StudyMilestone {
  week: number;
  title: string;
  skillIds: string[];
  hours: number;
}

export interface StudyPlan {
  fieldId: string;
  trackId: string;
  targetBand: Band;
  milestones: StudyMilestone[];
  totalHours: number;
  perWeekHours: number;
  createdAt: number;
}

const HOURS_BY_DIFFICULTY: Record<1 | 2 | 3, number> = { 1: 4, 2: 6, 3: 8 };

/** Schedule the gap into ≤12 weekly milestones, greedily packed by the
    user's weekly availability. Path order = learning order, so prerequisites
    naturally precede what depends on them. Pure + persisted by the caller. */
export function build90DayPlan(
  profile: Pick<CareerProfile, "years" | "skills"> | null,
  fieldId: string,
  trackId: string,
  targetBand: Band,
  perWeekHours = 4
): StudyPlan | null {
  const track = trackById(fieldId, trackId);
  const gap = gapAnalysis(profile, fieldId, trackId);
  if (!track || !gap) return null;
  const perWeek = Math.max(1, Math.round(perWeekHours) || 4);
  const missing = gap.missing.filter(s => BAND_ORDER[s.band] <= BAND_ORDER[targetBand]);
  const totalHours = missing.reduce((n, s) => n + HOURS_BY_DIFFICULTY[s.difficulty], 0);
  const weeks = Math.min(12, Math.max(1, Math.ceil(totalHours / perWeek)));

  const buckets: { skillIds: string[]; hours: number }[] = Array.from({ length: weeks }, () => ({ skillIds: [], hours: 0 }));
  let bi = 0;
  for (const s of missing) {
    const h = HOURS_BY_DIFFICULTY[s.difficulty];
    /* pack greedily; move to the next week when this week is full */
    if (bi < weeks - 1 && buckets[bi].hours + h > perWeek) bi++;
    buckets[bi].skillIds.push(s.id);
    buckets[bi].hours += h;
  }
  return {
    fieldId, trackId, targetBand,
    milestones: buckets.map((b, i) => ({
      week: i + 1,
      title: `Week ${i + 1} — ${b.skillIds.map(id => SKILLS[id]?.name ?? id).join(", ")}`,
      skillIds: b.skillIds,
      hours: b.hours
    })),
    totalHours,
    perWeekHours: perWeek,
    createdAt: Date.now()
  };
}
