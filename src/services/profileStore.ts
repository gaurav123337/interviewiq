/* profileStore — the ONE canonical profile aggregate (roadmap Item 11).
   ────────────────────────────────────────────────────────────────────
   Historically the user's skills/goal/profile lived in three parallel,
   unsynced localStorage keys with incompatible shapes:
     • iq.skills  — SkillProfile   { goal, skills: SkillRating[], diagnostic?, skippedAt? }
     • iq.goal    — CareerGoal      (also double-stored inside iq.skills.goal)
     • iq.career  — CareerProfile   { …, skills: string[] }
     • iq.resume  — UploadedResume  { fileName, text, extractedAt, profile: CareerProfile }

   This module introduces a single canonical aggregate at `iq.profile`
   (CanonicalProfile, version 2) plus DERIVED VIEWS that reproduce each legacy
   shape, so existing readers can eventually delegate here without changing.

   PR3 SCOPE (this file): the store + migration + views + merge-writers are
   built and unit-proven, but NOTHING in the app is wired to them yet — every
   existing accessor still reads its legacy key, so app behaviour is unchanged.
   PR4 wires the delegators (the live bridge); PR6 retires the legacy keys.

   FIDELITY DESIGN. The roadmap keys its ratings by *composite* human labels
   ("React · Vue · Angular") and depends on that array round-tripping exactly.
   Reconstructing it from a decomposed slug graph is ambiguous, so the verbatim
   SkillRating[] is preserved as `roadmapSkills` (the roadmap's native
   projection) inside the single aggregate. The unified, queryable skill graph
   (`skills`, keyed by canonical slug) is populated ADDITIVELY by decomposing
   those labels plus folding the career/resume skills — it feeds the jobs and
   counselor views. Both live in one store; they never overwrite each other. */

import type {
  CareerGoal, CareerProfile, DiagnosticResult, SkillProfile, SkillRating, UploadedResume
} from "../types";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";
import { canonicalize, decomposeCanonical } from "../data/skillVocab";

/* ------------------------------------------------------------------ */
/* Canonical model                                                     */
/* ------------------------------------------------------------------ */

export type SkillSource = "roadmap" | "diagnostic" | "resume" | "jd" | "manual" | "seed";

/** One node in the unified skill graph, keyed by canonical slug. */
export interface SkillNode {
  slug: string;            // canonical key: skillCatalog id when known, else slugify(display)
  display: string;         // human label (catalog name / alias canonical / verbatim)
  catalogId?: string;      // set iff slug ∈ skillCatalog SKILLS
  self?: number;           // 0-5 self rating (roadmap semantics), verbatim
  measured?: number;       // 0..1 diagnostic coverage, KEEP verbatim
  sources: SkillSource[];  // provenance (union across contributions)
  labels?: string[];       // verbatim composite/roadmap labels this node derived from
  updatedAt: number;
}

/** Which legacy keys existed at migration — lets the views reproduce exact
    null semantics (e.g. getProfile() === null when iq.skills was absent). */
export interface ProfileOrigins {
  skills: boolean;
  goal: boolean;
  career: boolean;
  resume: boolean;
}

export interface CanonicalProfile {
  version: 2;
  /** Single home for the goal — kills the iq.skills.goal / iq.goal double-store. */
  goal: CareerGoal | null;
  /* ex-CareerProfile non-skill fields (verbatim from iq.career when present) */
  headline: string;
  years: number;
  location: string;
  remote: boolean;
  workAuth: string;
  targetTitles: string[];
  summary: string;
  /** The iq.career record's own updatedAt — kept verbatim so toCareerProfile()
      reproduces getCareerProfile().updatedAt exactly (distinct from the
      aggregate `updatedAt`, which is the max across all source timestamps). */
  careerUpdatedAt: number;
  /* ex-UploadedResume (skills fold into the graph; profile becomes derived) */
  resume?: { fileName: string; text: string; extractedAt: number };
  /* ex-SkillProfile diagnostic bits */
  diagnostic?: DiagnosticResult;
  diagnosticSkippedAt?: number;
  /** Verbatim roadmap ratings — the fidelity anchor for toSkillProfile(). */
  roadmapSkills: SkillRating[];
  /** The unified skill graph, keyed by canonical slug (additive view). */
  skills: Record<string, SkillNode>;
  origins: ProfileOrigins;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const goalFingerprint = (g: CareerGoal): string =>
  `${g.currentLevel}|${g.targetLevel}|${g.fieldId}|${g.companyId}`;

const maxDefined = (a: number | undefined, b: number | undefined): number | undefined => {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
};

/** Merge an incoming contribution into the graph node for its slug. Never
    overwrites a stronger signal: self/measured take the max, sources/labels
    union. `display` upgrades to the catalog name once a catalogId is known. */
function upsertNode(
  graph: Record<string, SkillNode>,
  c: { slug: string; display: string; catalogId?: string },
  contrib: { self?: number; measured?: number; source: SkillSource; label?: string; at: number }
): void {
  const prev = graph[c.slug];
  const sources = new Set<SkillSource>(prev?.sources ?? []);
  sources.add(contrib.source);
  const labels = new Set<string>(prev?.labels ?? []);
  if (contrib.label) labels.add(contrib.label);
  const node: SkillNode = {
    slug: c.slug,
    // catalog display wins; otherwise keep the first display we saw.
    display: c.catalogId ? c.display : (prev?.display ?? c.display),
    catalogId: c.catalogId ?? prev?.catalogId,
    self: maxDefined(prev?.self, contrib.self),
    measured: maxDefined(prev?.measured, contrib.measured),
    sources: [...sources],
    labels: labels.size ? [...labels] : undefined,
    updatedAt: Math.max(prev?.updatedAt ?? 0, contrib.at)
  };
  if (node.self === undefined) delete node.self;
  if (node.measured === undefined) delete node.measured;
  if (node.catalogId === undefined) delete node.catalogId;
  if (node.labels === undefined) delete node.labels;
  graph[c.slug] = node;
}

/** Fold one roadmap SkillRating (composite label + self/measured) into the
    graph: decompose the label into atoms and merge each atom additively. */
function ingestRating(graph: Record<string, SkillNode>, r: SkillRating, at: number): void {
  for (const c of decomposeCanonical(r.skill)) {
    upsertNode(graph, c, { self: r.self, measured: r.measured, source: "roadmap", label: r.skill, at });
  }
}

/** Fold a plain claimed-skill label (from career/resume) into the graph. */
function ingestLabel(graph: Record<string, SkillNode>, label: string, source: SkillSource, at: number): void {
  for (const c of decomposeCanonical(label)) {
    upsertNode(graph, c, { source, label, at });
  }
}

const EMPTY_CAREER_FIELDS = {
  headline: "", years: 0, location: "", remote: true, workAuth: "", targetTitles: [] as string[], summary: ""
};

/* ------------------------------------------------------------------ */
/* Migration — build the canonical aggregate from the legacy keys      */
/* ------------------------------------------------------------------ */

/** Reconcile the goal double-store: prefer the copy whose fingerprint matches
    the persisted roadmap progress (so progress isn't reset), else the one with
    the newer createdAt, else whichever exists. */
function reconcileGoal(embedded: CareerGoal | null, standalone: CareerGoal | null): CareerGoal | null {
  if (!embedded) return standalone;
  if (!standalone) return embedded;
  const progFp = storageGet<{ fingerprint?: string } | null>(STORAGE_KEYS.roadmapProg, null)?.fingerprint;
  if (progFp) {
    if (goalFingerprint(embedded) === progFp) return embedded;
    if (goalFingerprint(standalone) === progFp) return standalone;
  }
  return (standalone.createdAt ?? 0) >= (embedded.createdAt ?? 0) ? standalone : embedded;
}

/** Build the canonical aggregate purely from the current legacy keys. Pure
    over storage state (no Date.now), so running it twice is identical. */
export function buildCanonicalFromLegacy(): CanonicalProfile {
  const sp = storageGet<SkillProfile | null>(STORAGE_KEYS.skills, null);
  const goalLegacy = storageGet<CareerGoal | null>(STORAGE_KEYS.goal, null);
  const career = storageGet<CareerProfile | null>(STORAGE_KEYS.career, null);
  const resume = storageGet<UploadedResume | null>(STORAGE_KEYS.resume, null);

  const goal = reconcileGoal(sp?.goal ?? null, goalLegacy);
  const roadmapSkills = (sp?.skills ?? []).map(s => ({ ...s }));

  // Deterministic updatedAt anchored to source timestamps (idempotent).
  const at = Math.max(
    career?.updatedAt ?? 0,
    resume?.extractedAt ?? 0,
    goal?.createdAt ?? 0,
    sp?.diagnostic?.date ?? 0
  );

  const graph: Record<string, SkillNode> = {};
  // Order: roadmap ratings → career labels → resume labels (stable graph order).
  for (const r of roadmapSkills) ingestRating(graph, r, at);
  for (const label of career?.skills ?? []) ingestLabel(graph, label, "manual", at);
  for (const label of resume?.profile?.skills ?? []) ingestLabel(graph, label, "resume", at);

  return {
    version: 2,
    goal,
    headline: career?.headline ?? EMPTY_CAREER_FIELDS.headline,
    years: career?.years ?? EMPTY_CAREER_FIELDS.years,
    location: career?.location ?? EMPTY_CAREER_FIELDS.location,
    remote: career?.remote ?? EMPTY_CAREER_FIELDS.remote,
    workAuth: career?.workAuth ?? EMPTY_CAREER_FIELDS.workAuth,
    targetTitles: career?.targetTitles ?? [...EMPTY_CAREER_FIELDS.targetTitles],
    summary: career?.summary ?? EMPTY_CAREER_FIELDS.summary,
    careerUpdatedAt: career?.updatedAt ?? at,
    resume: resume ? { fileName: resume.fileName, text: resume.text, extractedAt: resume.extractedAt } : undefined,
    diagnostic: sp?.diagnostic,
    diagnosticSkippedAt: sp?.skippedAt,
    roadmapSkills,
    skills: graph,
    origins: { skills: sp != null, goal: goalLegacy != null || sp?.goal != null, career: career != null, resume: resume != null },
    updatedAt: at
  };
}

/* ------------------------------------------------------------------ */
/* Read — lazy, idempotent migration                                   */
/* ------------------------------------------------------------------ */

/** The canonical profile. Migrates from the legacy keys on first access and
    persists the result; a subsequent call returns the stored v2 aggregate
    unchanged (legacy keys are kept in parallel — rollback-safe). */
export function getCanonicalProfile(): CanonicalProfile {
  const existing = storageGet<CanonicalProfile | null>(STORAGE_KEYS.profile, null);
  if (existing && existing.version === 2) return existing;
  const migrated = buildCanonicalFromLegacy();
  storageSet(STORAGE_KEYS.profile, migrated);
  return migrated;
}

/** Persist a mutated canonical profile (stamps updatedAt). */
function saveCanonicalProfile(p: CanonicalProfile): void {
  storageSet(STORAGE_KEYS.profile, { ...p, updatedAt: Date.now() });
}

/** Rebuild the canonical aggregate from the CURRENT legacy keys and persist it
    with a fresh updatedAt stamp. Used by the clear* delegators: deleting a
    legacy key (iq.skills / iq.goal / iq.resume) must not leave that source's
    skills stranded in the cached aggregate. The fresh stamp also lets a later
    last-writer-wins cloud sync keep the cleared state instead of resurrecting
    it from an older remote copy. */
export function rebuildCanonicalProfile(): CanonicalProfile {
  const rebuilt = buildCanonicalFromLegacy();
  saveCanonicalProfile(rebuilt);
  return rebuilt;
}

/* ------------------------------------------------------------------ */
/* Derived views — reproduce the legacy shapes                         */
/* ------------------------------------------------------------------ */

/** SkillProfile view (iq.skills shape). Null when no SkillProfile ever
    existed, matching legacy getProfile(). The skills array is the verbatim
    roadmap projection → byte-exact round-trip. */
export function toSkillProfile(p: CanonicalProfile = getCanonicalProfile()): SkillProfile | null {
  if (!p.origins.skills || !p.goal) return null;
  const out: SkillProfile = { goal: p.goal, skills: p.roadmapSkills.map(s => ({ ...s })) };
  if (p.diagnostic !== undefined) out.diagnostic = p.diagnostic;
  if (p.diagnosticSkippedAt !== undefined) out.skippedAt = p.diagnosticSkippedAt;
  return out;
}

/** Whether a graph node should surface as a claimed career skill: manually
    claimed / resume skills always count; roadmap-only skills count once they
    clear the same (measured ?? self) >= 2 bar that defaultCareerProfile used. */
function qualifiesForCareer(n: SkillNode): boolean {
  const claimed = n.sources.some(s => s === "manual" || s === "resume" || s === "jd" || s === "seed");
  if (claimed) return true;
  const level = n.measured ?? n.self;
  return level !== undefined && level >= 2;
}

/** CareerProfile view (iq.career shape). Non-skill fields are verbatim; skills
    are DERIVED from the unified graph (the unification — this is what makes
    roadmap edits surface on the jobs side once wired in PR4). */
export function toCareerProfile(p: CanonicalProfile = getCanonicalProfile()): CareerProfile {
  const skills: string[] = [];
  const seen = new Set<string>();
  for (const n of Object.values(p.skills)) {
    if (!qualifiesForCareer(n)) continue;
    const label = n.display;
    if (!seen.has(label)) { seen.add(label); skills.push(label); }
  }
  return {
    headline: p.headline,
    years: p.years,
    location: p.location,
    remote: p.remote,
    workAuth: p.workAuth,
    targetTitles: [...p.targetTitles],
    skills: skills.slice(0, 30),
    summary: p.summary,
    updatedAt: p.careerUpdatedAt
  };
}

/** UploadedResume view (iq.resume shape). Null when no resume was uploaded.
    The nested profile is the derived CareerProfile (no longer double-stored). */
export function toUploadedResume(p: CanonicalProfile = getCanonicalProfile()): UploadedResume | null {
  if (!p.resume) return null;
  return {
    fileName: p.resume.fileName,
    text: p.resume.text,
    extractedAt: p.resume.extractedAt,
    profile: toCareerProfile(p)
  };
}

/** The canonical slugs the user owns — every node in the unified graph. These
    are skillCatalog ids when known, which is exactly what resolvePath() compares
    roadmap prerequisites against, so SkillDetail can mark owned prerequisites
    directly (replacing its old, always-empty localStorage["iq.skills"] read). */
export function ownedSkillSlugs(p: CanonicalProfile = getCanonicalProfile()): string[] {
  return Object.keys(p.skills);
}

/* ------------------------------------------------------------------ */
/* Merge-writers — used by the delegators once wired (PR4)             */
/* ------------------------------------------------------------------ */

/** Ingest a SkillProfile save into the canonical store: preserve the roadmap
    ratings verbatim and fold their atoms into the graph. Additive on the
    graph; never drops career/resume-origin skills. */
export function ingestSkillProfile(sp: SkillProfile): void {
  const p = getCanonicalProfile();
  const at = Date.now();
  const graph = { ...p.skills };
  p.origins.skills = true;
  p.origins.goal = p.origins.goal || sp.goal != null;
  for (const r of sp.skills) ingestRating(graph, r, at);
  saveCanonicalProfile({
    ...p,
    goal: sp.goal ?? p.goal,
    diagnostic: sp.diagnostic ?? p.diagnostic,
    diagnosticSkippedAt: sp.skippedAt,
    roadmapSkills: sp.skills.map(s => ({ ...s })),
    skills: graph
  });
}

/** Ingest a standalone goal save. */
export function ingestGoal(g: CareerGoal): void {
  const p = getCanonicalProfile();
  p.origins.goal = true;
  saveCanonicalProfile({ ...p, goal: g });
}

/** Ingest a CareerProfile save: non-skill fields verbatim, skills folded into
    the graph as manually-claimed atoms (additive). */
export function ingestCareerProfile(cp: CareerProfile): void {
  const p = getCanonicalProfile();
  const at = Date.now();
  const graph = { ...p.skills };
  p.origins.career = true;
  for (const label of cp.skills) ingestLabel(graph, label, "manual", at);
  saveCanonicalProfile({
    ...p,
    headline: cp.headline,
    years: cp.years,
    location: cp.location,
    remote: cp.remote,
    workAuth: cp.workAuth,
    targetTitles: [...cp.targetTitles],
    summary: cp.summary,
    careerUpdatedAt: cp.updatedAt,
    skills: graph
  });
}

/** Ingest an UploadedResume save: keep the resume payload, fold its profile's
    skills into the graph as resume-origin atoms. */
export function ingestUploadedResume(r: UploadedResume): void {
  const p = getCanonicalProfile();
  const at = Date.now();
  const graph = { ...p.skills };
  p.origins.resume = true;
  for (const label of r.profile?.skills ?? []) ingestLabel(graph, label, "resume", at);
  saveCanonicalProfile({
    ...p,
    resume: { fileName: r.fileName, text: r.text, extractedAt: r.extractedAt },
    skills: graph
  });
}
