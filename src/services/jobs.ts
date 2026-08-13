/* Jobs feature (Phase 1) — career profile, the ATS job feed, and the
   match-verdict matcher. Offline-first: the profile and feed cache in
   localStorage; cloud reads/writes happen best-effort when signed in.
   The verdict is a PURE function (matchJob) so it's unit-testable and
   works offline — Pro gating happens in the UI layer. */

import type { CareerProfile, JobMatch, JobPosting, MatchVerdict } from "../types";
import { LEVELS, fieldById } from "../data";
import { getCloudState, getSupabaseClient } from "./cloud";
import { getGoal, getProfile } from "./goal";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

/* ------------------------------------------------------------------ */
/* Career profile                                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Jobs feed                                                           */
/* ------------------------------------------------------------------ */

export function listJobs(): JobPosting[] {
  return storageGet<JobPosting[]>(STORAGE_KEYS.jobs, []);
}

function setJobs(jobs: JobPosting[]): void {
  storageSet(STORAGE_KEYS.jobs, jobs.slice(0, 80));
}

interface DbJobRow {
  source: string;
  external_id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  description: string;
  url: string;
  skills: string[];
  level: string | null;
  salary: { min: number; max: number; currency: string } | null;
  company_size: string | null;
  posted_at: string | null;
}

const toJobPosting = (r: DbJobRow): JobPosting => ({
  id: `${r.source}:${r.external_id}`,
  source: r.source,
  externalId: r.external_id,
  title: r.title,
  company: r.company,
  location: r.location ?? "",
  remote: r.remote,
  description: r.description,
  url: r.url,
  skills: r.skills ?? [],
  level: r.level ?? null,
  salary: r.salary ?? null,
  companySize: r.company_size ?? null,
  postedAt: r.posted_at
});

/** Pull the latest feed from the cloud (jobs are public-read). */
export async function loadJobsFromCloud(): Promise<JobPosting[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("jobs")
    .select("source, external_id, title, company, location, remote, description, url, skills, level, salary, company_size, posted_at")
    .order("posted_at", { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const jobs = (data as unknown as DbJobRow[]).map(toJobPosting);
  setJobs(jobs);
  return jobs;
}

/* ------------------------------------------------------------------ */
/* Feed filters (Apply Kit) — salary band, company size, remote, text   */
/* ------------------------------------------------------------------ */

export interface JobFilters {
  query: string;
  remote: boolean | null;
  companySize: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
}

export const EMPTY_FILTERS: JobFilters = {
  query: "",
  remote: null,
  companySize: null,
  salaryMin: null,
  salaryMax: null,
  currency: null
};

/** Pure filter over the feed — testable, keeps the view dumb. */
export function filterJobs(jobs: JobPosting[], f: JobFilters): JobPosting[] {
  const q = f.query.trim().toLowerCase();
  return jobs.filter(j => {
    if (f.remote === true && !j.remote) return false;
    if (f.remote === false && j.remote) return false;
    if (f.companySize && j.companySize !== f.companySize) return false;
    if (f.currency && j.salary?.currency && j.salary.currency !== f.currency) return false;
    if (f.salaryMin !== null) {
      if (!j.salary || j.salary.max < f.salaryMin) return false;
    }
    if (f.salaryMax !== null) {
      if (!j.salary || j.salary.min > f.salaryMax) return false;
    }
    if (q) {
      const hay = `${j.title} ${j.company} ${j.location} ${j.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Human-readable salary band for a job (e.g. "$120k–$150k") or null. */
export function salaryLabel(j: JobPosting): string | null {
  if (!j.salary) return null;
  const { min, max, currency } = j.salary;
  const sym: Record<string, string> = { USD: "$", GBP: "£", EUR: "€", INR: "₹" };
  const s = sym[currency] ?? (currency + " ");
  const fmt = (n: number) => n >= 1000000 ? `${s}${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${s}${Math.round(n / 1000)}k` : `${s}${n}`;
  return `${fmt(min)}–${fmt(max)} ${currency}${j.salary.source === "estimate" ? " est." : ""}`;
}

/** Last successful feed refresh (epoch ms) — drives the auto-refresh. */
export function lastJobsRefresh(): number {
  return storageGet<number>(STORAGE_KEYS.jobsRefreshedAt, 0);
}

function markJobsRefreshed(): void {
  storageSet(STORAGE_KEYS.jobsRefreshedAt, Date.now());
}

/** Trigger the jobs-fetch Edge Function (signed-in only). */
export async function refreshJobs(): Promise<{ added: number; updated: number; total: number }> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Sign in to refresh the job feed");
  const { data: session } = await client.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("Sign in to refresh the job feed");
  const res = await fetch("https://ndrusywvceojsoirhkhl.supabase.co/functions/v1/jobs-fetch", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Refresh failed");
  await loadJobsFromCloud();
  markJobsRefreshed();
  return { added: (body as { added?: number }).added ?? 0, updated: (body as { updated?: number }).updated ?? 0, total: (body as { total?: number }).total ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Match verdict — pure, offline, unit-testable                        */
/* ------------------------------------------------------------------ */

const LEVEL_ORDER: Record<string, number> = { junior: 0, mid: 1, senior: 2, lead: 3, principal: 4 };

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
/* Domain classification — the gate that keeps Sales roles from ever    */
/* looking like "Good fit" for an engineer. Same table drives the       */
/* server-side title extraction so both ends agree.                    */
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
/* Skill normalization — profile skills are display labels like         */
/* "JavaScript / TypeScript" or "React · Vue · Angular"; jobs store raw */
/* tokens. Tokenize both sides (plus basic singularization) so          */
/* "typescript" matches "JavaScript / TypeScript".                     */
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

  /* integrity caps: a domain mismatch or no-skill role can never look good */
  if (known && !sameDomain) score = Math.min(score, 20);
  if (limited) score = Math.min(score, 40);

  /* blockers knock the score down but never below zero */
  score -= blockers.length * 6;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const verdict: MatchVerdict =
    score >= 75 ? "strong" : score >= 58 ? "good" : score >= 38 ? "moderate" : score >= 18 ? "stretch" : "no";

  return { score, verdict, matched, missing, blockers };
}
