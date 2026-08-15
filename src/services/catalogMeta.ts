/* catalogMeta — the freshness + quality engine for the Skill Counselor
   (docs/skill-counselor.md §4.1, §5.1). Pure and offline-first:
     - resourceFreshness: how old is a resource? (recency scan)
     - applyManifestDiff: the curated changelog diff between the version the
       user last saw and the bundled catalog ("What's new in your paths")
     - resourceQuality: 0–100 score = curated base + recency + free-first +
       community votes (the honest, testable version of the plan's formula) */

import { CATALOG_MANIFEST, SKILLS, type CatalogResource, type CatalogSkill } from "../data/skillCatalog";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

/* ------------------------------------------------------------------ */
/* Freshness — how current is a resource?                              */
/* ------------------------------------------------------------------ */

export type FreshnessStatus = "current" | "stale" | "verify";

export interface FreshnessInfo {
  status: FreshnessStatus;
  yearsOld: number;
  label: string;
}

/** >18 months old → stale; >3 years → verify (the React-19-style flag). */
export function resourceFreshness(r: CatalogResource, now: Date = new Date()): FreshnessInfo {
  const yearsOld = Math.max(0, now.getFullYear() - r.publishedYear);
  const status: FreshnessStatus = yearsOld > 3 ? "verify" : yearsOld > 1 ? "stale" : "current";
  const label = status === "current"
    ? `updated ${r.publishedYear}`
    : status === "stale"
      ? `⚠️ ${r.publishedYear} — verify it's current`
      : `⛔ ${r.publishedYear} — may be outdated`;
  return { status, yearsOld, label };
}

export interface SkillFreshness {
  skillId: string;
  name: string;
  status: FreshnessStatus;
  staleResources: CatalogResource[];
  verifiedCount: number;
}

/** Per-skill recency: any resource in the pool that's stale/verify. */
export function freshnessCheck(skills: CatalogSkill[], now: Date = new Date()): SkillFreshness[] {
  return skills
    .map(s => {
      const flagged = s.resources.filter(r => resourceFreshness(r, now).status !== "current");
      return {
        skillId: s.id,
        name: s.name,
        status: flagged.some(r => resourceFreshness(r, now).status === "verify") ? "verify" as const
          : flagged.length ? "stale" as const : "current" as const,
        staleResources: flagged,
        verifiedCount: s.resources.length - flagged.length
      };
    })
    .filter(s => s.status !== "current");
}

/* ------------------------------------------------------------------ */
/* Manifest diff — "What's new in your paths"                          */
/* ------------------------------------------------------------------ */

export interface StoredManifest {
  version: string;
  lastReviewedAt?: string;
  seenAt?: number;
}

export function getStoredManifest(): StoredManifest {
  return storageGet<StoredManifest>(STORAGE_KEYS.catalogVersion, { version: "" });
}

export function markManifestSeen(): void {
  storageSet(STORAGE_KEYS.catalogVersion, {
    version: CATALOG_MANIFEST.version,
    lastReviewedAt: CATALOG_MANIFEST.lastReviewedAt,
    seenAt: Date.now()
  });
}

export interface CatalogDiff {
  isNew: boolean;
  version: string;
  lastReviewedAt: string;
  changes: string[];
  skillCount: number;
  resourceCount: number;
}

/** The changelog diff for the user: everything new since the version they
    last saw. No stored version → everything (first run). */
export function applyManifestDiff(stored: StoredManifest | null = getStoredManifest()): CatalogDiff {
  const isNew = !stored?.version || stored.version !== CATALOG_MANIFEST.version;
  const resourceCount = Object.values(SKILLS).reduce((n, s) => n + s.resources.length, 0);
  return {
    isNew,
    version: CATALOG_MANIFEST.version,
    lastReviewedAt: CATALOG_MANIFEST.lastReviewedAt,
    changes: [...CATALOG_MANIFEST.changes],
    skillCount: Object.keys(SKILLS).length,
    resourceCount
  };
}

/* ------------------------------------------------------------------ */
/* Quality — 0–100 per app-suggested resource                          */
/* ------------------------------------------------------------------ */

export interface QualityOptions {
  /** Community votes (from the resources table for community picks). */
  communityVotes?: number;
  now?: Date;
}

export function resourceQuality(r: CatalogResource, opts: QualityOptions = {}): number {
  const now = opts.now ?? new Date();
  const yearsOld = Math.max(0, now.getFullYear() - r.publishedYear);
  /* curated baseline + recency + free-first + community signal */
  const recency = Math.max(0, 20 - yearsOld * 8);
  const free = r.free ? 15 : 0;
  const votes = Math.min(10, Math.max(0, opts.communityVotes ?? 0));
  return Math.min(100, 55 + recency + free + votes);
}

export type QualityBand = "Top" | "Great" | "Good" | "Review";

export function qualityBand(score: number): QualityBand {
  if (score >= 85) return "Top";
  if (score >= 70) return "Great";
  if (score >= 55) return "Good";
  return "Review";
}
