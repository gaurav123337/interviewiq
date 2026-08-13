/* Salary benchmark (Apply Kit) — market ranges by seniority, plus real
   aggregation of the job feed's salary data. Honesty contract: the static
   table is clearly labelled "indicative US market ranges" (curated from
   public salary research, not user data); the live rows are REAL bands from
   the current feed (posting ranges + provider estimates), so users see what
   the market actually shows today. Pure + testable, offline-first. */

import type { JobPosting } from "../types";

export type BenchLevel = "junior" | "mid" | "senior" | "lead" | "principal";

/** Indicative annual market ranges (USD) per seniority — curated baseline.
    These power the benchmark when no live data exists for a company. */
export const BENCHMARK: Record<BenchLevel, { min: number; max: number; label: string }> = {
  junior: { min: 70_000, max: 115_000, label: "Junior" },
  mid: { min: 110_000, max: 165_000, label: "Mid-level" },
  senior: { min: 150_000, max: 220_000, label: "Senior" },
  lead: { min: 190_000, max: 280_000, label: "Lead / Staff" },
  principal: { min: 250_000, max: 400_000, label: "Principal / Distinguished" }
};

export const BENCH_LEVELS: BenchLevel[] = ["junior", "mid", "senior", "lead", "principal"];

/** Profile seniority from years of experience — same ladder as the matcher. */
export function benchLevelForYears(years: number): BenchLevel {
  if (years >= 8) return "principal";
  if (years >= 5) return "senior";
  if (years >= 2) return "mid";
  return "junior";
}

/** Currency label for the benchmark card. */
export function currencySymbol(currency: string): string {
  const sym: Record<string, string> = { USD: "$", GBP: "£", EUR: "€", INR: "₹" };
  return sym[currency] ?? currency;
}

/** Compact band label e.g. "$150k–$220k". */
export function fmtBand(min: number, max: number, currency = "USD"): string {
  const s = currencySymbol(currency);
  const f = (n: number) => n >= 1_000_000 ? `${s}${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${s}${Math.round(n / 1_000)}k` : `${s}${n}`;
  return `${f(min)}–${f(max)}`;
}

export interface CompanyBand {
  company: string;
  /** Real bands from the live feed for this company. */
  bands: { min: number; max: number; currency: string; source: "posting" | "estimate" }[];
  /** Median band across the company's real bands (in USD when possible). */
  median?: { min: number; max: number; currency: string };
}

/** Aggregate real salary bands from the live feed by company. Companies with
    no salary data are omitted — the card never invents a number. */
export function companyBands(jobs: JobPosting[]): CompanyBand[] {
  const by: Record<string, CompanyBand> = {};
  for (const j of jobs) {
    if (!j.salary) continue;
    const b = by[j.company] ?? { company: j.company, bands: [] };
    b.bands.push({ min: j.salary.min, max: j.salary.max, currency: j.salary.currency, source: j.salary.source ?? "posting" });
    by[j.company] = b;
  }
  const out = Object.values(by);
  for (const c of out) {
    /* median across the company's bands (numbers only; mixed currencies are
       still labelled per-band, median is computed on raw values) */
    if (c.bands.length) {
      const mins = c.bands.map(b => b.min).sort((a, b) => a - b);
      const maxs = c.bands.map(b => b.max).sort((a, b) => a - b);
      const med = (arr: number[]) => arr[Math.floor(arr.length / 2)];
      c.median = { min: med(mins), max: med(maxs), currency: c.bands[0].currency };
    }
  }
  return out.sort((a, b) => (b.median?.min ?? 0) - (a.median?.min ?? 0));
}

/** The benchmark view-model for the card: the user's level band plus any
    live company bands in the feed (filtered by the chosen company prefix). */
export function benchmarkView(profileYears: number, jobs: JobPosting[], companyFilter = ""): {
  level: BenchLevel;
  levelBand: { min: number; max: number; label: string };
  live: CompanyBand[];
} {
  const level = benchLevelForYears(profileYears);
  const live = companyBands(jobs).filter(c => !companyFilter || c.company.toLowerCase().includes(companyFilter.toLowerCase()));
  return { level, levelBand: BENCHMARK[level], live };
}
