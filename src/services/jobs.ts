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
import { sourceLabel } from "./importJob";
import { salaryInCurrency } from "./currency";
import { fmtAmount } from "./salaryBench";

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

/** Locally-imported jobs (user pasted the URL) — never part of the public
    cloud feed, and never evicted by a refresh. */
const isImported = (j: JobPosting): boolean => j.source.startsWith("imported:");

/** Add a user-imported job to the local feed (deduped by apply URL).
    Imported jobs sit at the front so the 80-job cap can't evict them. */
export function addImportedJob(job: JobPosting): JobPosting[] {
  const next = [job, ...listJobs().filter(j => j.url !== job.url && !(isImported(j) && j.id === job.id))];
  setJobs(next);
  return next;
}

/** Pull the latest feed from the cloud (jobs are public-read). The user's
    imported jobs ride along — merged at the front, never overwritten. */
export async function loadJobsFromCloud(): Promise<JobPosting[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("jobs")
    .select("source, external_id, title, company, location, remote, description, url, skills, level, salary, company_size, posted_at")
    .order("posted_at", { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const jobs = (data as unknown as DbJobRow[]).map(toJobPosting);
  const imported = listJobs().filter(isImported);
  setJobs([...imported, ...jobs]);
  return [...imported, ...jobs];
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
  /** Feed source (e.g. "greenhouse", "imported:naukri") or null = all. */
  source: string | null;
}

export const EMPTY_FILTERS: JobFilters = {
  query: "",
  remote: null,
  companySize: null,
  salaryMin: null,
  salaryMax: null,
  currency: null,
  source: null
};

/** Pure filter over the feed — testable, keeps the view dumb. */
export function filterJobs(jobs: JobPosting[], f: JobFilters): JobPosting[] {
  const q = f.query.trim().toLowerCase();
  return jobs.filter(j => {
    if (f.source && j.source !== f.source) return false;
    if (f.remote === true && !j.remote) return false;
    if (f.remote === false && j.remote) return false;
    if (f.companySize && j.companySize !== f.companySize) return false;
    /* salary min/max are expressed in the chosen display currency — each
       posting's band is converted first, so a mixed USD/INR feed compares
       fairly instead of silently dropping other-currency postings */
    if (f.salaryMin !== null || f.salaryMax !== null) {
      if (!j.salary) return false;
      const s = f.currency ? salaryInCurrency(j.salary, f.currency) : j.salary;
      if (f.salaryMin !== null && s.max < f.salaryMin) return false;
      if (f.salaryMax !== null && s.min > f.salaryMax) return false;
    }
    if (q) {
      const hay = `${j.title} ${j.company} ${j.location} ${j.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Stable sort of the feed by match score descending (highest % first).
    Ties keep their original order so the sort never shuffles the list. */
export function sortJobsByMatch(jobs: JobPosting[], scoreOf: (id: string) => number): JobPosting[] {
  return jobs
    .map((j, i) => ({ j, i, s: scoreOf(j.id) || 0 }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.j);
}

/** Human-readable salary band for a job (e.g. "$120k–$150k"). When
    displayCurrency is given the band is converted first, so a feed mixing
    USD and INR postings reads in ONE currency (₹-style L/Cr included). */
export function salaryLabel(j: JobPosting, displayCurrency?: string | null): string | null {
  if (!j.salary) return null;
  const raw = j.salary;
  const s = displayCurrency && displayCurrency !== raw.currency
    ? { ...salaryInCurrency(raw, displayCurrency), source: raw.source }
    : raw;
  return `${fmtAmount(s.min, s.currency)}–${fmtAmount(s.max, s.currency)} ${s.currency}${s.source === "estimate" ? " est." : ""}`;
}

/* ------------------------------------------------------------------ */
/* Cross-source duplicate collapse — the same role on Greenhouse, Ashby, */
/* Lever and RSS becomes one card (the richest posting wins).           */
/* ------------------------------------------------------------------ */

/** Normalized dedupe key — title + company, case/punctuation folded. */
function dedupeKey(j: JobPosting): string {
  const t = j.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const c = j.company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${t}|${c}`;
}

/** Which posting best represents a duplicate group: direct ATS sources
    beat RSS (richer, canonical data); skills, a salary, and a fuller
    description break ties. */
function repQuality(j: JobPosting): number {
  return (j.source === "rss" ? 0 : 1) * 1000
    + (j.skills.length > 0 ? 100 : 0)
    + (j.salary ? 10 : 0)
    + (j.description && j.description.length > 200 ? 1 : 0);
}

/** Collapse the same role posted on multiple sources into one card,
    tagging the winner with the other sources (alsoSources). Pure. */
export function dedupeJobs(jobs: JobPosting[]): JobPosting[] {
  const groups = new Map<string, JobPosting[]>();
  for (const j of jobs) {
    const k = dedupeKey(j);
    const list = groups.get(k);
    if (list) list.push(j); else groups.set(k, [j]);
  }
  const out: JobPosting[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => repQuality(b) - repQuality(a));
    const best = sorted[0];
    const others = [...new Set(sorted.slice(1).map(o => sourceLabel(o.source)))];
    out.push(others.length ? { ...best, alsoSources: others } : best);
  }
  return out;
}

/** Last successful feed refresh (epoch ms) — drives the auto-refresh. */
export function lastJobsRefresh(): number {
  return storageGet<number>(STORAGE_KEYS.jobsRefreshedAt, 0);
}

function markJobsRefreshed(): void {
  storageSet(STORAGE_KEYS.jobsRefreshedAt, Date.now());
}

/** Trigger the jobs-fetch Edge Function (signed-in only). */
export async function refreshJobs(): Promise<{ added: number; updated: number; total: number; errors: Record<string, string> }> {
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
  return {
    added: (body as { added?: number }).added ?? 0,
    updated: (body as { updated?: number }).updated ?? 0,
    total: (body as { total?: number }).total ?? 0,
    errors: (body as { errors?: Record<string, string> }).errors ?? {}
  };
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
  /* a role well below your seniority can never dominate the rankings —
     whatever its skill overlap it caps at "moderate", so a senior/principal
     candidate's top picks stay senior-level roles */
  if (lvlBlocker) score = Math.min(score, 55);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const verdict: MatchVerdict =
    score >= 75 ? "strong" : score >= 58 ? "good" : score >= 38 ? "moderate" : score >= 18 ? "stretch" : "no";

  return { score, verdict, matched, missing, blockers };
}

/* ------------------------------------------------------------------ */
/* Company ranking — one row per company, best role wins, descending    */
/* ------------------------------------------------------------------ */

/** One company's standing: its best match across every open role. */
export interface CompanyRank {
  company: string;
  /** Best match % across the company's jobs (0–100). */
  score: number;
  verdict: MatchVerdict;
  /** Number of open roles at this company in the feed. */
  openings: number;
  /** The company's best-matching job. */
  best: JobPosting;
  matched: string[];
  missing: string[];
}

/** Ranks every company in the feed by match %, descending (ties: more
    openings first, then name). Pure + offline — the view just paginates. */
export function rankCompanies(profile: CareerProfile | null, jobs: JobPosting[]): CompanyRank[] {
  const grouped = new Map<string, JobPosting[]>();
  for (const j of jobs) {
    const list = grouped.get(j.company);
    if (list) list.push(j);
    else grouped.set(j.company, [j]);
  }
  const ranks: CompanyRank[] = [];
  for (const [company, list] of grouped) {
    let best: JobPosting = list[0];
    let bestMatch: JobMatch | null = null;
    let bestScore = -1;
    for (const j of list) {
      const m = matchJob(profile, j);
      if (m.score > bestScore) { bestScore = m.score; best = j; bestMatch = m; }
    }
    ranks.push({
      company,
      score: bestScore,
      verdict: bestMatch?.verdict ?? "no",
      openings: list.length,
      best,
      matched: bestMatch?.matched ?? [],
      missing: bestMatch?.missing ?? []
    });
  }
  ranks.sort((a, b) => b.score - a.score || b.openings - a.openings || a.company.localeCompare(b.company));
  return ranks;
}

/* ------------------------------------------------------------------ */
/* Ranking filters + company shortlist                                 */
/* ------------------------------------------------------------------ */

export interface RankFilters {
  /** Keep only companies whose best role is remote. */
  remoteOnly: boolean;
  /** Minimum match % (0 = any). */
  minScore: number;
  /** Minimum annual salary of the best role, in its own currency (0 = any). */
  minSalary: number;
  /** Keep only shortlisted companies. */
  shortlistOnly: boolean;
}

export const EMPTY_RANK_FILTERS: RankFilters = { remoteOnly: false, minScore: 0, minSalary: 0, shortlistOnly: false };

/** One-line "why this pick" for the recommendations list — seniority fit,
    domain, and the skills the profile already covers. Pure + testable. */
export function recommendationReason(profile: CareerProfile | null, rank: CompanyRank): string {
  const parts: string[] = [];
  if (profile) {
    const mine = profileLevel(profile.years);
    const lvl = rank.best.level;
    if (lvl && lvl in LEVEL_ORDER) {
      const diff = LEVEL_ORDER[lvl] - LEVEL_ORDER[mine];
      parts.push(diff > 0 ? `Targets above your level (${lvl})` : diff === 0 ? `Matches your level (${lvl})` : diff === -1 ? `One rung below your level (${lvl})` : `Below your level (${lvl})`);
    }
    const profileDomain = inferDomain([profile.headline, ...profile.targetTitles].join(" "));
    const jobDomain = inferDomain(rank.best.title);
    if (profileDomain !== "other" && jobDomain !== "other") parts.push(domainLabel(jobDomain) + " role");
  }
  if (rank.matched.length) parts.push(`covers ${rank.matched.slice(0, 4).join(", ")}`);
  return parts.join(" · ") || "Upload a resume to rank companies";
}

/** What learning a company's most-missing skill is worth: the boosted score
    for its best role, or null when there's nothing learnable to gain. */
export function skillImpact(profile: CareerProfile | null, rank: CompanyRank): { skill: string; from: number; to: number } | null {
  if (!profile) return null;
  const skill = rank.missing[0];
  if (!skill) return null;
  const boosted = matchJob({ ...profile, skills: [...new Set([...profile.skills, skill])] }, rank.best);
  if (boosted.score <= rank.score) return null;
  return { skill, from: rank.score, to: boosted.score };
}

/** Plain-text weekly digest of the top company recommendations — the body
    for the email digest. Pure + testable. */
/** One digest pick line with its one-line reason + learnable gain — shared
    by the weekly and India digests. */
function digestPickLine(profile: CareerProfile | null, r: CompanyRank, i: number): string {
  const base = `${i + 1}. ${r.company} — ${r.score}% match (${VERDICT_META[r.verdict].label}) · ${r.openings} open role${r.openings === 1 ? "" : "s"} · best fit: ${r.best.title}`;
  const why = recommendationReason(profile, r);
  if (!why) return base;
  const gain = skillImpact(profile, r);
  return `${base}\n   Why: ${why}${gain ? ` · learn ${gain.skill} → ${gain.to}%` : ""}`;
}

export function recommendationsDigest(profile: CareerProfile | null, ranks: CompanyRank[], top = 3): string {
  const picks = ranks.slice(0, top);
  if (!picks.length) {
    return "InterviewIQ — no companies to recommend yet. Upload a resume or save your career profile to rank companies.";
  }
  const lines = [
    "InterviewIQ — weekly company recommendations",
    "",
    ...(profile ? [`Based on your profile: ${profile.headline || "—"} (${profile.years} yrs).`, ""] : []),
    ...picks.map((r, i) => digestPickLine(profile, r, i))
  ];
  if (picks[0].missing.length) {
    lines.push("", `Closest gap for ${picks[0].company}: ${picks[0].missing.slice(0, 4).join(", ")}.`);
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* 🇮🇳 India & startup digest — same engine, filtered to the Indian      */
/* market (locations, known Indian startups, and remote roles).         */
/* Mirrors the server-side composer in _shared/recommendationsDigest.ts */
/* ------------------------------------------------------------------ */

const INDIA_LOCATION_RE = /india|bengaluru|bangalore|mumbai|delhi|hyderabad|pune|chennai|gurgaon|gurugram|noida|kolkata|ahmedabad|indore|kochi|chandigarh|jaipur/i;

const INDIA_COMPANIES = [
  "fampay", "cred", "groww", "razorpay", "swiggy", "zomato", "flipkart", "freshworks",
  "chargebee", "postman", "zepto", "meesho", "ola", "paytm", "upstox", "zerodha",
  "dream11", "myntra", "bigbasket", "nobroker", "apna", "sharechat", "unacademy",
  "byju", "ayu", "phonepe", "druva", "zoho", "infosys", "tcs", "wipro", "hcl",
  "technologies", "mindtree", "l&t", "tata", "mahindra", "reliance", "jio"
];

/** True when a posting targets the Indian market (or is remote, which is
    reachable from India). */
export function isIndiaPosting(job: JobPosting): boolean {
  const loc = (job.location ?? "").toLowerCase();
  if (INDIA_LOCATION_RE.test(loc)) return true;
  const company = (job.company ?? "").toLowerCase().replace(/[^a-z0-9& ]/g, "");
  if (INDIA_COMPANIES.some(c => company.includes(c))) return true;
  return !!job.remote;
}

/** Plain-text weekly 🇮🇳 India & startup digest — the email body for the
    India-focused broadcast. Pure + testable. */
export function indiaDigest(profile: CareerProfile | null, jobs: JobPosting[], top = 3): string {
  const picks = rankCompanies(profile, jobs.filter(isIndiaPosting)).slice(0, top);
  if (!picks.length) {
    return "InterviewIQ — no Indian-market companies to recommend yet. Upload a resume or save your career profile to rank companies.";
  }
  const lines = [
    "InterviewIQ — weekly 🇮🇳 India & startup recommendations",
    "",
    ...(profile ? [`Based on your profile: ${profile.headline || "—"} (${profile.years} yrs).`, ""] : []),
    ...picks.map((r, i) => digestPickLine(profile, r, i))
  ];
  return lines.join("\n");
}

/** Pure filter over the ranked companies — the view stays dumb. */
export function filterRanks(ranks: CompanyRank[], f: RankFilters, shortlist: ReadonlySet<string>, displayCurrency?: string): CompanyRank[] {
  return ranks.filter(r => {
    if (f.remoteOnly && !r.best.remote) return false;
    if (f.minScore > 0 && r.score < f.minScore) return false;
    /* minSalary is expressed in the display currency — convert each
       company's best-role band before comparing (defaults to the band's
       own currency when no display currency is given) */
    if (f.minSalary > 0) {
      if (!r.best.salary) return false;
      const s = displayCurrency ? salaryInCurrency(r.best.salary, displayCurrency) : r.best.salary;
      if (s.max < f.minSalary) return false;
    }
    if (f.shortlistOnly && !shortlist.has(r.company.toLowerCase())) return false;
    return true;
  });
}

/** Shortlisted company names (lowercased), persisted locally. */
export function listShortlist(): string[] {
  return storageGet<string[]>(STORAGE_KEYS.shortlist, []);
}

/** Toggles a company in the shortlist; returns the new list. */
export function toggleShortlist(company: string): string[] {
  const key = company.trim().toLowerCase();
  if (!key) return listShortlist();
  const next = listShortlist().includes(key)
    ? listShortlist().filter(c => c !== key)
    : [...listShortlist(), key];
  storageSet(STORAGE_KEYS.shortlist, next);
  return next;
}
