/* Salary benchmark (Apply Kit) — market ranges by seniority, plus real
   aggregation of the job feed's salary data. Honesty contract: the static
   table is clearly labelled "indicative US market ranges" (curated from
   public salary research, not user data); the live rows are REAL bands from
   the current feed (posting ranges + provider estimates), so users see what
   the market actually shows today. Markets adjust the static table by
   cost-of-living multipliers and approximate FX — never the live rows.
   Pure + testable, offline-first. */

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

/** Compact single amount e.g. "$150k", "₹27L", "₹1.3Cr". */
export function fmtAmount(n: number, currency = "USD"): string {
  const s = currencySymbol(currency);
  if (currency === "INR") {
    if (n >= 10_000_000) return `${s}${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000) return `${s}${Math.round(n / 100_000)}L`;
    if (n >= 1_000) return `${s}${Math.round(n / 1_000)}k`;
    return `${s}${Math.round(n)}`;
  }
  if (n >= 1_000_000) return `${s}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${s}${Math.round(n / 1_000)}k`;
  return `${s}${Math.round(n)}`;
}

/** Compact band label e.g. "$150k–$220k". */
export function fmtBand(min: number, max: number, currency = "USD"): string {
  return `${fmtAmount(min, currency)}–${fmtAmount(max, currency)}`;
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

/* ---------- location-aware market bands ---------- */

export interface Market {
  id: string;
  label: string;
  /** USD-comp ratio vs US national (1.0) — indicative, from public COL research */
  mult: number;
  /** approx local currency per 1 USD, for display conversion */
  fx: number;
  currency: string;
  note: string;
  /** substrings to auto-detect from a location string */
  keywords: string[];
}

export const MARKETS: Market[] = [
  { id: "us-national", label: "US national", mult: 1, fx: 1, currency: "USD", note: "Baseline", keywords: [] },
  { id: "us-sf", label: "SF Bay Area", mult: 1.28, fx: 1, currency: "USD", note: "Highest-cost US tech hub", keywords: ["san francisco", "sf bay", "bay area", "palo alto", "mountain view", "sunnyvale", "menlo park"] },
  { id: "us-nyc", label: "New York", mult: 1.22, fx: 1, currency: "USD", note: "US metro", keywords: ["new york", "nyc", "manhattan", "brooklyn", "queens"] },
  { id: "us-seattle", label: "Seattle", mult: 1.16, fx: 1, currency: "USD", note: "US metro", keywords: ["seattle", "redmond", "bellevue"] },
  { id: "us-austin", label: "Austin", mult: 0.96, fx: 1, currency: "USD", note: "US metro", keywords: ["austin", "round rock"] },
  { id: "us-remote", label: "US remote", mult: 0.94, fx: 1, currency: "USD", note: "Remote (US-based)", keywords: ["remote"] },
  { id: "uk-london", label: "London", mult: 0.82, fx: 1.28, currency: "GBP", note: "Converted at ~£0.78/USD", keywords: ["london"] },
  { id: "in-bengaluru", label: "Bengaluru", mult: 0.22, fx: 83, currency: "INR", note: "Converted at ~₹83/USD", keywords: ["bengaluru", "bangalore"] },
  { id: "in-mumbai", label: "Mumbai / tier-1 India", mult: 0.21, fx: 83, currency: "INR", note: "Converted at ~₹83/USD", keywords: ["mumbai", "bombay", "pune", "hyderabad", "chennai", "india"] },
  { id: "in-delhi", label: "Delhi NCR", mult: 0.2, fx: 83, currency: "INR", note: "Converted at ~₹83/USD", keywords: ["delhi", "gurgaon", "gurugram", "noida"] }
];

/** Pick the market that best matches a location string ("San Francisco, CA",
    "Bengaluru, India", "Remote"…). Falls back to US national. */
export function detectMarket(location: string | null | undefined): Market {
  const loc = (location ?? "").toLowerCase();
  for (const m of MARKETS) {
    if (m.id === "us-national") continue;
    if (m.keywords.some(k => loc.includes(k))) return m;
  }
  return MARKETS[0];
}

export interface MarketBand {
  /** in the market's local currency */
  min: number;
  max: number;
  /** USD-equivalent (for cross-market comparison) */
  minUsd: number;
  maxUsd: number;
  currency: string;
  marketId: string;
}

/** Adjust a USD baseline band to a market: COL multiplier, then FX. */
export function marketBand(band: { min: number; max: number }, market: Market): MarketBand {
  const minUsd = Math.round(band.min * market.mult);
  const maxUsd = Math.round(band.max * market.mult);
  return {
    min: Math.round(minUsd * market.fx),
    max: Math.round(maxUsd * market.fx),
    minUsd,
    maxUsd,
    currency: market.currency,
    marketId: market.id
  };
}

/* ---------- percentile positioning ---------- */

/** Where `expected` sits inside [min, max], clamped to 0–100. */
export function positionInBand(expected: number, min: number, max: number): number {
  if (max <= min) return 50;
  return Math.max(0, Math.min(100, Math.round(((expected - min) / (max - min)) * 100)));
}

/** 1st / 2nd / 3rd / 4th… for percentile labels. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function positionRead(pct: number): { label: string; tone: "low" | "mid" | "high" } {
  if (pct < 30) return { label: "Below the market mid-point", tone: "low" };
  if (pct <= 70) return { label: "Around the market mid-point", tone: "mid" };
  return { label: "Above the market mid-point", tone: "high" };
}

/* ---------- offer comparison + negotiation ---------- */

export interface OfferInput {
  /** annual base, in the market's currency */
  base: number;
  /** annualized equity value, same currency (0 if none) */
  equity: number;
  currency: string;
}

export type OfferVerdictKind = "below" | "in-range" | "above";

export function offerVerdict(offer: OfferInput, band: { min: number; max: number }): {
  kind: OfferVerdictKind;
  total: number;
  pct: number;
  gapToMin: number;
  label: string;
} {
  const total = offer.base + offer.equity;
  const pct = positionInBand(total, band.min, band.max);
  const kind: OfferVerdictKind = total < band.min ? "below" : total > band.max ? "above" : "in-range";
  const gapToMin = Math.max(0, band.min - total);
  const label = kind === "below" ? "Below the market band" : kind === "above" ? "Above the market band" : "Inside the market band";
  return { kind, total, pct, gapToMin, label };
}

/** Negotiation talking points given an offer vs the market band. Honest —
    never fabricates a number, only reframes what the band already shows.
    displayCurrency (default: the market's own) is used for the numbers so
    the card reads in the app-wide currency. */
export function negotiationPoints(offer: OfferInput, band: { min: number; max: number }, market: Market, displayCurrency = market.currency): string[] {
  const v = offerVerdict(offer, band);
  const mid = Math.round((band.min + band.max) / 2);
  const midS = fmtAmount(mid, displayCurrency);
  const pts: string[] = [];
  if (v.kind === "below") {
    pts.push(`Your offer (${fmtAmount(v.total, displayCurrency)}) sits below the ${market.label} band — anchor at the market mid-point (${midS}), which is the market rate, not a stretch.`);
    pts.push(`If the band is firm, ask what unlocks more: equity/ESOP, a sign-on bonus, or a title step that widens the range.`);
  } else if (v.kind === "in-range") {
    pts.push(`You're inside the ${market.label} band at the ${v.pct}th percentile — ask for a specific number near the mid-point (${midS}), not "more".`);
  } else {
    pts.push(`You're above the ${market.label} band — keep the number and negotiate the details: equity, vesting, start-date leverage.`);
  }
  pts.push("Get equity/ESOP value in writing — vesting schedule and strike price change the real number.");
  pts.push("Request the offer in writing with a response deadline, then compare it side-by-side with the live feed bands above.");
  return pts;
}
