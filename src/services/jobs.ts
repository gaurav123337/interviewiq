/* Jobs feature (Phase 1) — career profile, the ATS job feed, and the
   match-verdict matcher. Offline-first: the profile and feed cache in
   localStorage; cloud reads/writes happen best-effort when signed in.
   The verdict is a PURE function (matchJob) so it's unit-testable and
   works offline — Pro gating happens in the UI layer. */

import type { CareerProfile, JobMatch, JobPosting, MatchVerdict } from "../types";
import { LEVELS } from "../data";
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
  return {
    headline: "",
    years: 0,
    location: "",
    remote: true,
    workAuth: "",
    targetTitles: levelName ? [levelName] : [],
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
  postedAt: r.posted_at
});

/** Pull the latest feed from the cloud (jobs are public-read). */
export async function loadJobsFromCloud(): Promise<JobPosting[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("jobs")
    .select("source, external_id, title, company, location, remote, description, url, skills, level, posted_at")
    .order("posted_at", { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const jobs = (data as unknown as DbJobRow[]).map(toJobPosting);
  setJobs(jobs);
  return jobs;
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
  const own = new Set(profile.skills.map(s => s.trim().toLowerCase()).filter(Boolean));
  const required = new Set(job.skills.map(s => s.trim().toLowerCase()).filter(Boolean));
  const matched = job.skills.filter(s => own.has(s.toLowerCase()));
  const missing = job.skills.filter(s => !own.has(s.toLowerCase()));

  const blockers: string[] = [];
  let score = 0;

  /* skill overlap — the biggest signal */
  if (required.size > 0) score += (matched.length / required.size) * 55;
  else score += 30; /* no extracted skills → neutral */

  /* title fit — does the role mention your target titles? */
  const title = job.title.toLowerCase();
  const targetWords = new Set(profile.targetTitles.flatMap(t => t.split(/\s+/)).map(w => w.toLowerCase()).filter(w => w.length > 3));
  score += [...targetWords].some(w => title.includes(w)) ? 20 : 8;

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

  /* blockers knock the score down but never below zero */
  score -= blockers.length * 12;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const verdict: MatchVerdict =
    score >= 75 ? "strong" : score >= 55 ? "good" : score >= 35 ? "moderate" : score >= 15 ? "stretch" : "no";

  return { score, verdict, matched, missing, blockers };
}
