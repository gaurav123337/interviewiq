/* Match verdict — pure, offline, unit-testable.
   Scores a job against a career profile and returns a verdict (strong/good/
   moderate/stretch/no) with matched/missing skills and blocker reasons. */

import type { CareerProfile, JobMatch, JobPosting, MatchVerdict } from "../../types";

/* ------------------------------------------------------------------ */
/* Level ordering                                                      */
/* ------------------------------------------------------------------ */

export const LEVEL_ORDER: Record<string, number> = { junior: 0, mid: 1, senior: 2, lead: 3, principal: 4 };

/** Approximate the profile's seniority from years of experience. */
const profileLevel = (years: number): keyof typeof LEVEL_ORDER =>
  years >= 8 ? "principal" : years >= 5 ? "senior" : years >= 2 ? "mid" : "junior";

export const VERDICT_META: Record<MatchVerdict, { label: string; tone: "ok" | "co" | "warn" | "bad" | "default" }> = {
  strong: { label: "Strong match", tone: "ok" },
  good: { label: "Good fit", tone: "co" },
  moderate: { label: "Moderate", tone: "warn" },
  stretch: { label: "Stretch", tone: "bad" },
  no: { label: "Not recommended", tone: "default" }
};

/* ------------------------------------------------------------------ */
/* Domain classification                                               */
/* ------------------------------------------------------------------ */

const DOMAIN_RULES: [string, string, RegExp][] = [
  ["data", "Data", /data scientist|data analyst|data engineer|analytics|machine learning|business intelligence|bi engineer/],
  ["design", "Design", /product designer|ux designer|ui designer|designer|creative/],
  ["product", "Product & Program", /product manager|product owner|program manager|technical program manager/],
  ["marketing", "Marketing", /marketing|growth|brand|content|seo|campaign|media|social|communications|comms/],
  ["finance", "Finance", /finance|accounting|controller|compensation|payroll|audit|tax|fp&a|financial/],
  ["legal", "Legal", /legal|counsel|paralegal|compliance|privacy|litigation/],
  ["hr", "People & HR", /recruit|people|talent|human resources|employee|hr/],
  ["sales", "Sales & BD", /sales|business development|account executive|account manager|partnerships|revenue|go.to.market/],
  ["ops", "Operations", /operations|vendor|support|logistics|procurement|facilities/],
  ["software", "Engineering", /software|engineer|developer|programmer|front.?end|back.?end|full.?stack|devops|sre|site reliability|platform|infrastructure|security|mobile|ios|android|qa|quality|automation|sdet|test|web/]
];

const DOMAIN_LABELS: Record<string, string> = Object.fromEntries(DOMAIN_RULES.map(([id, label]) => [id, label]));

/** Classify a title/headline into a domain family ("software", "sales"…). */
export function inferDomain(text: string): string {
  const t = (text ?? "").toLowerCase();
  for (const [id, , re] of DOMAIN_RULES) if (re.test(t)) return id;
  return "other";
}

export const domainLabel = (id: string): string => DOMAIN_LABELS[id] ?? "Other";

/* ------------------------------------------------------------------ */
/* Skill normalization                                                 */
/* ------------------------------------------------------------------ */

const tokens = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9+#]/g, " ").trim().split(/\s+/).filter(Boolean);

const matchSkill = (a: string, b: string): boolean => {
  const at = tokens(a);
  const bt = tokens(b);
  if (at.some(t => bt.includes(t))) return true;
  /* plural tolerance: "APIs" ≈ "api", "databases" ≈ "database" */
  const singular = (arr: string[]) => arr.map(t => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
  return singular(at).some(t => singular(bt).includes(t));
};

/** Seniority words never count as a title match. */
const LEVEL_WORDS = new Set(["senior", "junior", "staff", "lead", "principal", "director", "manager", "head", "intern", "mid", "entry", "sr"]);

/** Seniority fit + the below-level blocker. Returns [points, blocker?]. */
function levelFit(profile: CareerProfile, level: string | null): [number, string | null] {
  if (!level || !(level in LEVEL_ORDER)) return [8, null];
  const diff = LEVEL_ORDER[level] - LEVEL_ORDER[profileLevel(profile.years)];
  if (diff >= 1) return [15, null]; /* role is above you — great target */
  if (diff === 0) return [12, null];
  if (diff === -1) return [5, null]; /* one rung below — stretch */
  return [2, `Below your seniority (role targets ${level}, you're at ${profileLevel(profile.years)})`];
}

/* ------------------------------------------------------------------ */
/* Main match function                                                 */
/* ------------------------------------------------------------------ */

/** Score a job against the career profile → verdict + reasons. */
export function matchJob(profile: CareerProfile | null, job: JobPosting): JobMatch {
  if (!profile) {
    return {
      score: 0,
      verdict: "no",
      matched: [],
      missing: job.skills,
      blockers: ["Complete your career profile to see a match verdict."]
    };
  }

  const own = profile.skills.map(s => s.trim()).filter(Boolean);
  const matched = job.skills.filter(s => own.some(p => matchSkill(p, s)));
  const missing = job.skills.filter(s => !own.some(p => matchSkill(p, s)));

  const blockers: string[] = [];
  let score = 0;
  let limited = false;

  /* domain gate — the biggest correctness lever */
  const profileDomain = inferDomain([profile.headline, ...profile.targetTitles].join(" "));
  const jobDomain = inferDomain(job.title);
  const known = profileDomain !== "other" && jobDomain !== "other";
  const sameDomain = known && profileDomain === jobDomain;
  if (known && !sameDomain) {
    blockers.push(`Outside your field — this is a ${domainLabel(jobDomain)} role`);
  }

  /* skill overlap — the biggest positive signal */
  if (job.skills.length > 0) {
    score += (matched.length / job.skills.length) * 55;
  } else if (sameDomain) {
    score += 40; /* domain-only evidence for sparse descriptions */
  } else if (known) {
    limited = true; /* different domain AND no skills → no signal */
  } else {
    score += 18;
    limited = true;
    blockers.push("Limited info — no skills extracted for this role");
  }

  /* title fit — target words (field words, not seniority words) */
  const title = job.title.toLowerCase();
  const targetWords = new Set(profile.targetTitles
    .flatMap(t => t.split(/\s+/))
    .map(w => w.toLowerCase())
    .filter(w => w.length > 3 && !LEVEL_WORDS.has(w)));
  score += [...targetWords].some(w => title.includes(w)) ? 12 : 0;

  /* seniority fit against the extracted level */
  const [lvlPts, lvlBlocker] = levelFit(profile, job.level);
  score += lvlPts;
  if (lvlBlocker) blockers.push(lvlBlocker);

  /* location / remote */
  if (profile.remote) {
    if (job.remote) score += 10;
    else blockers.push("On-site role — you prefer remote");
  } else if (profile.location.trim()) {
    const loc = profile.location.trim().toLowerCase();
    const jobLoc = job.location.toLowerCase();
    if (jobLoc && !job.remote && !jobLoc.includes(loc)) {
      blockers.push(`Role is in ${job.location} — not ${profile.location}`);
    }
  }

  /* integrity caps */
  if (known && !sameDomain) score = Math.min(score, 20);
  if (limited) score = Math.min(score, 40);

  /* blockers knock the score down but never below zero */
  score -= blockers.length * 6;
  if (lvlBlocker) score = Math.min(score, 55);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const verdict: MatchVerdict =
    score >= 75 ? "strong" : score >= 58 ? "good" : score >= 38 ? "moderate" : score >= 18 ? "stretch" : "no";

  return { score, verdict, matched, missing, blockers };
}

export { profileLevel };
