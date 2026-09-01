/* Job gap plan (Apply Kit Phase 2) — turns a job's missing skills into a
   concrete, achievable study plan: per-skill effort estimates, curated
   resources (reusing the roadmap topic library), and a weekly schedule
   sized to the user's available hours. Pure + persisted per job so it
   works offline and survives re-opens. */

import type { JobPosting } from "../types";
import { getTopicInfo } from "../data/resources";
import { canonicalize } from "../data/skillVocab";
import { JD_KEYWORD_LIMIT } from "./roadmap/phases";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export interface GapItem {
  skill: string;
  estHours: number;
  priority: number; /* 1 = learn first (as listed in the job's requirements) */
  primer: string;
  links: { label: string; url: string }[];
}

export interface GapPlan {
  jobId: string;
  jobTitle: string;
  company: string;
  items: GapItem[];
  totalHours: number;
  perWeekHours: number;
  weeks: number;
  createdAt: number;
}

/* Effort bands — infra/ML topics are the heaviest, UI/tooling the lightest. */
const HOURS_BANDS: [RegExp, number][] = [
  [/(kubernetes|k8s|terraform|docker|aws|gcp|azure|kafka|rabbitmq|spark|hadoop|tensorflow|pytorch|machine learning|grpc|webassembly|microservices|observability|serverless|prometheus|grafana|helm|jenkins|data engineering|event-driven)/, 8],
  [/(rust|scala|golang|swift|kotlin|java|python|typescript|javascript|php|ruby|dart|flutter|react native|node|sql|postgres|mysql|mongodb|redis|graphql|django|flask|spring|express|go\b)/, 6],
  [/(react|vue|angular|redux|tailwind|sass|html|css|figma|jest|cypress|playwright|selenium|git|linux|bash|oauth|jwt|encryption|rest\b|ui|ux|accessibility|a11y|etl|tableau|seo)/, 4],
  [/.*/, 3]
];

const hoursFor = (skill: string): number => {
  for (const [re, h] of HOURS_BANDS) if (re.test(skill.toLowerCase())) return h;
  return 3;
};

/** Build the gap plan for a job from its missing skills. Pure + testable. */
export function buildGapPlan(job: JobPosting, missing: string[], perWeekHours: number): GapPlan {
  const items: GapItem[] = missing.map((skill, i) => {
    const info = getTopicInfo(skill);
    return {
      skill,
      estHours: hoursFor(skill),
      priority: i + 1,
      primer: info.primer,
      links: info.links
    };
  });
  const totalHours = items.reduce((sum, it) => sum + it.estHours, 0);
  const hours = Math.max(1, Math.round(perWeekHours) || 4);
  const weeks = Math.max(1, Math.ceil(totalHours / hours));
  return {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    items,
    totalHours,
    perWeekHours: hours,
    weeks,
    createdAt: Date.now()
  };
}

/* Persistence — one plan per job so reopening a card shows the same plan. */
export function getGapPlan(jobId: string): GapPlan | null {
  const plans = storageGet<Record<string, GapPlan>>(STORAGE_KEYS.gapPlans, {});
  return plans[jobId] ?? null;
}

export function saveGapPlan(plan: GapPlan): void {
  const plans = storageGet<Record<string, GapPlan>>(STORAGE_KEYS.gapPlans, {});
  plans[plan.jobId] = plan;
  storageSet(STORAGE_KEYS.gapPlans, plans);
}

/* ------------------------------------------------------------------ */
/* Roadmap write-back (Item 12 gap prep-loop)                          */
/* ------------------------------------------------------------------ */

/** Merge a job's missing-skill labels into a goal's existing `jdKeywords` for
    the Roadmap write-back. Preserves `existing` verbatim and in order (never
    drops a keyword the user already has — some carry roadmap progress), appends
    only skills not already present (matched by canonical slug, so "Node.js"
    won't double up with "node"), and caps additions at `cap`. `cap` defaults to
    `JD_KEYWORD_LIMIT` — the same limit `buildPhases` slices `jdKeywords` to when
    rendering "Job description fit" topics — so at the default the stored array
    stays aligned with what the Roadmap shows. (A caller passing `cap` > that
    limit could store `added` keywords the Roadmap won't render; callers should
    keep the default unless they have a reason not to.) Returns the merged list
    plus the canonical display names `added` and any `dropped` by the cap, so the
    caller can report the outcome. Pure. */
export function mergeGapKeywords(
  existing: string[],
  missingLabels: string[],
  cap = JD_KEYWORD_LIMIT
): { next: string[]; added: string[]; dropped: string[] } {
  const seen = new Set(existing.map(k => canonicalize(k).slug));
  const next = [...existing];
  const added: string[] = [];
  const dropped: string[] = [];
  for (const label of missingLabels) {
    const c = canonicalize(label);
    if (!c.slug || seen.has(c.slug)) continue;
    seen.add(c.slug);
    if (next.length < cap) {
      next.push(c.display);
      added.push(c.display);
    } else {
      dropped.push(c.display);
    }
  }
  return { next, added, dropped };
}
