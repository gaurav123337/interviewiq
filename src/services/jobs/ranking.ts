/* Company ranking — one row per company, best role wins, descending.
   Includes ranking filters, shortlist, recommendation digests, and
   the India-focused digest. */

import type { CareerProfile, JobPosting } from "../../types";
import { STORAGE_KEYS, storageGet, storageSet } from "../storage";
import { salaryInCurrency } from "../currency";
import { matchJob, VERDICT_META, inferDomain, domainLabel, LEVEL_ORDER } from "./match";

/* ------------------------------------------------------------------ */
/* Company rank                                                        */
/* ------------------------------------------------------------------ */

export interface CompanyRank {
  company: string;
  /** Best match % across the company's jobs (0–100). */
  score: number;
  verdict: "strong" | "good" | "moderate" | "stretch" | "no";
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
    let bestMatch: ReturnType<typeof matchJob> | null = null;
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
/* Ranking filters + shortlist                                         */
/* ------------------------------------------------------------------ */

export interface RankFilters {
  remoteOnly: boolean;
  minScore: number;
  minSalary: number;
  shortlistOnly: boolean;
}

export const EMPTY_RANK_FILTERS: RankFilters = { remoteOnly: false, minScore: 0, minSalary: 0, shortlistOnly: false };

/** One-line "why this pick" for the recommendations list. */
export function recommendationReason(profile: CareerProfile | null, rank: CompanyRank): string {
  const parts: string[] = [];
  if (profile) {
    const years = profile.years;
    const mine = years >= 8 ? "principal" : years >= 5 ? "senior" : years >= 2 ? "mid" : "junior";
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

/** What learning a company's most-missing skill is worth. */
export function skillImpact(profile: CareerProfile | null, rank: CompanyRank): { skill: string; from: number; to: number } | null {
  if (!profile) return null;
  const skill = rank.missing[0];
  if (!skill) return null;
  const boosted = matchJob({ ...profile, skills: [...new Set([...profile.skills, skill])] }, rank.best);
  if (boosted.score <= rank.score) return null;
  return { skill, from: rank.score, to: boosted.score };
}

/* ------------------------------------------------------------------ */
/* Digests                                                             */
/* ------------------------------------------------------------------ */

/** One digest pick line with its one-line reason + learnable gain. */
function digestPickLine(profile: CareerProfile | null, r: CompanyRank, i: number): string {
  const base = `${i + 1}. ${r.company} — ${r.score}% match (${VERDICT_META[r.verdict].label}) · ${r.openings} open role${r.openings === 1 ? "" : "s"} · best fit: ${r.best.title}`;
  const why = recommendationReason(profile, r);
  if (!why) return base;
  const gain = skillImpact(profile, r);
  return `${base}\n   Why: ${why}${gain ? ` · learn ${gain.skill} → ${gain.to}%` : ""}`;
}

/** Plain-text weekly digest of the top company recommendations. */
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
/* 🇮🇳 India & startup digest                                          */
/* ------------------------------------------------------------------ */

const INDIA_LOCATION_RE = /india|bengaluru|bangalore|mumbai|delhi|hyderabad|pune|chennai|gurgaon|gurugram|noida|kolkata|ahmedabad|indore|kochi|chandigarh|jaipur/i;

const INDIA_COMPANIES = [
  "fampay", "cred", "groww", "razorpay", "swiggy", "zomato", "flipkart", "freshworks",
  "chargebee", "postman", "zepto", "meesho", "ola", "paytm", "upstox", "zerodha",
  "dream11", "myntra", "bigbasket", "nobroker", "apna", "sharechat", "unacademy",
  "byju", "ayu", "phonepe", "druva", "zoho", "infosys", "tcs", "wipro", "hcl",
  "technologies", "mindtree", "l&t", "tata", "mahindra", "reliance", "jio"
];

/** True when a posting targets the Indian market (or is remote). */
export function isIndiaPosting(job: JobPosting): boolean {
  const loc = (job.location ?? "").toLowerCase();
  if (INDIA_LOCATION_RE.test(loc)) return true;
  const company = (job.company ?? "").toLowerCase().replace(/[^a-z0-9& ]/g, "");
  if (INDIA_COMPANIES.some(c => company.includes(c))) return true;
  return !!job.remote;
}

/** Plain-text weekly 🇮🇳 India & startup digest. */
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

/** Pure filter over the ranked companies. */
export function filterRanks(ranks: CompanyRank[], f: RankFilters, shortlist: ReadonlySet<string>, displayCurrency?: string): CompanyRank[] {
  return ranks.filter(r => {
    if (f.remoteOnly && !r.best.remote) return false;
    if (f.minScore > 0 && r.score < f.minScore) return false;
    if (f.minSalary > 0) {
      if (!r.best.salary) return false;
      const s = displayCurrency ? salaryInCurrency(r.best.salary, displayCurrency) : r.best.salary;
      if (s.max < f.minSalary) return false;
    }
    if (f.shortlistOnly && !shortlist.has(r.company.toLowerCase())) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Shortlist (local persistence)                                       */
/* ------------------------------------------------------------------ */

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
