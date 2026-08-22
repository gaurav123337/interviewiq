/* Job feed — local cache, cloud fetch with round-robin per source,
   cross-source dedup, filters, and sort. */

import type { JobPosting } from "../../types";
import { getSupabaseClient } from "../cloud";
import { STORAGE_KEYS, storageGet, storageSet } from "../storage";
import { sourceLabel } from "../importJob";
import { salaryInCurrency } from "../currency";
import { fmtAmount } from "../salaryBench";

/* ------------------------------------------------------------------ */
/* Local cache                                                         */
/* ------------------------------------------------------------------ */

export function listJobs(): JobPosting[] {
  return storageGet<JobPosting[]>(STORAGE_KEYS.jobs, []);
}

function setJobs(jobs: JobPosting[]): void {
  storageSet(STORAGE_KEYS.jobs, jobs.slice(0, 80));
}

/* ------------------------------------------------------------------ */
/* Cloud fetch                                                         */
/* ------------------------------------------------------------------ */

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

const JOB_SELECT = "source, external_id, title, company, location, remote, description, url, skills, level, salary, company_size, posted_at";

/** How many of the 80 cached slots each source can claim. */
const JOBS_PER_SOURCE = 40;
const JOBS_CAP = 80;

/** The feed's source types (the `source` column values jobs-fetch writes). */
const FEED_SOURCES = ["greenhouse", "ashby", "lever", "remoteok", "rss"];

/** Pull the latest feed from the cloud (jobs are public-read) with one
    newest-first query PER source, so every board gets a fair share. */
export async function loadJobsFromCloud(): Promise<JobPosting[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const results = await Promise.all(FEED_SOURCES.map(source =>
    client.from("jobs")
      .select(JOB_SELECT)
      .eq("source", source)
      .order("posted_at", { ascending: false })
      .limit(JOBS_PER_SOURCE)
  ));
  /* true round-robin: interleave one job from each source per pass */
  const queues = results.map(({ data, error }) => (error || !data ? [] : data as unknown as DbJobRow[]));
  const picked: DbJobRow[] = [];
  let pass = 0;
  let took = true;
  while (took && picked.length < JOBS_CAP) {
    took = false;
    for (const q of queues) {
      if (picked.length >= JOBS_CAP) break;
      if (pass < q.length) { picked.push(q[pass]); took = true; }
    }
    pass++;
  }
  const jobs = picked.slice(0, JOBS_CAP).map(toJobPosting);
  const imported = listJobs().filter(isImported);
  setJobs([...imported, ...jobs]);
  return [...imported, ...jobs];
}

/* ------------------------------------------------------------------ */
/* Refresh                                                             */
/* ------------------------------------------------------------------ */

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
/* Filters                                                             */
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

/** Stable sort of the feed by match score descending (highest % first). */
export function sortJobsByMatch(jobs: JobPosting[], scoreOf: (id: string) => number): JobPosting[] {
  return jobs
    .map((j, i) => ({ j, i, s: scoreOf(j.id) || 0 }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.j);
}

/** Human-readable salary band for a job (e.g. "$120k–$150k"). */
export function salaryLabel(j: JobPosting, displayCurrency?: string | null): string | null {
  if (!j.salary) return null;
  const raw = j.salary;
  const s = displayCurrency && displayCurrency !== raw.currency
    ? { ...salaryInCurrency(raw, displayCurrency), source: raw.source }
    : raw;
  return `${fmtAmount(s.min, s.currency)}–${fmtAmount(s.max, s.currency)} ${s.currency}${s.source === "estimate" ? " est." : ""}`;
}

/* ------------------------------------------------------------------ */
/* Cross-source duplicate collapse                                     */
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

/** Collapse the same role posted on multiple sources into one card. */
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
