/* Salary extraction + provider-agnostic compensation enrichment (Apply Kit).
   Pure helpers live here (no Deno globals) so the client test-suite can
   exercise the exact code the edge function runs. Honesty contract: a job
   only ever gets a salary band from an explicit posting range (extractSalary)
   or from a configured enrichment provider (enrichSalary) — never fabricated.
   Estimates are tagged with source: "estimate" so the UI can label them. */

export interface SalaryBand {
  min: number;
  max: number;
  currency: string;
  /** "posting" = explicit range in the posting; "estimate" = provider lookup. */
  source: "posting" | "estimate";
}

/* ------------------------------------------------------------------ */
/* Posting-range extraction (conservative — no match → null)           */
/* ------------------------------------------------------------------ */

export function extractSalary(text: string): SalaryBand | null {
  const t = (text ?? "").toLowerCase();
  /* Each number may carry its own scale suffix ("120k") — the old pattern
     required the bare digit before the separator, so "$120k–$150k" never
     matched. Group 3/5 = scale (k/lpa/lakh/cr), validated below. */
  const m = t.match(/([$£€₹])\s*(\d+(?:[.,]\d+)?)\s*(k|k\b|lpa|lakh|cr|\/yr|\/year|per year|annum)?\s*[-–to]+\s*([$£€₹]?)\s*(\d+(?:[.,]\d+)?)\s*(k|k\b|lpa|lakh|cr|\/yr|\/year|per year|annum)?/);
  if (!m) return null;
  const num = (raw: string): number => {
    const n = raw.replace(/[^0-9.]/g, "");
    return parseFloat(n);
  };
  let min = num(m[2]);
  let max = num(m[5]);
  const scale = `${m[3] ?? ""} ${m[6] ?? ""}`;
  /* k suffix → thousands; LPA/lakh → 100k INR; cr → 10M INR; plain digits = annual */
  if (/k\b/.test(scale)) { min *= 1000; max *= 1000; }
  else if (/lpa|lakh/.test(scale)) { min *= 100000; max *= 100000; }
  else if (/cr/.test(scale)) { min *= 10000000; max *= 10000000; }
  if (!min || !max || max < min) return null;
  const currency = m[1] === "£" ? "GBP" : m[1] === "€" ? "EUR" : m[1] === "₹" ? "INR" : "USD";
  return { min: Math.round(min), max: Math.round(max), currency, source: "posting" };
}

/* Company size — explicit "N+ employees/people" mentions only. */
export function extractCompanySize(text: string): string | null {
  const t = (text ?? "").toLowerCase();
  const m = t.match(/(\d[\d,.]{0,8})\s*\+?\s*(employees?|people|teammates?|staff)\b/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/[^0-9]/g, ""));
  if (n >= 1000) return "large";
  if (n >= 50) return "mid";
  return "small";
}

/* ------------------------------------------------------------------ */
/* Provider-agnostic enrichment                                        */
/* ------------------------------------------------------------------ */

export interface EnrichmentProvider {
  id: string;
  label: string;
  /** Look up an annual salary band for a job posting. Return null when the
      provider has no data — never guess. */
  fetch: (job: { title: string; company: string; location: string; description: string }, opts: Record<string, string>) => Promise<Omit<SalaryBand, "source"> | null>;
}

/** Adzuna adapter — free tier, no SDK needed. Keys come from the function
    secrets ADZUNA_APP_ID / ADZUNA_APP_KEY (never the client). */
const adzuna: EnrichmentProvider = {
  id: "adzuna",
  label: "Adzuna (free tier)",
  async fetch(job, opts) {
    const appId = opts.appId;
    const appKey = opts.appKey;
    if (!appId || !appKey) return null;
    const country = opts.country ?? "us";
    const what = encodeURIComponent(`${job.title} ${job.company}`.slice(0, 80));
    const where = encodeURIComponent(job.location.split(",")[0].trim().slice(0, 40));
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=1&what=${what}&where=${where}&content-type=application/json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const hit = data?.results?.[0] as { salary_min?: number; salary_max?: number; salary_is_predicted?: boolean } | undefined;
    if (!hit || typeof hit.salary_min !== "number" || typeof hit.salary_max !== "number") return null;
    const min = Math.round(hit.salary_min);
    const max = Math.round(hit.salary_max);
    if (!min || !max || max < min) return null;
    /* Adzuna returns per-year amounts in the posting's currency */
    return { min, max, currency: "USD" };
  }
};

const PROVIDERS: Record<string, EnrichmentProvider> = { adzuna };

/** Enrich a job with a provider band, or null when no provider is configured /
    has data. Pure-ish (fetch is the only side effect) and testable with a
    stubbed fetch. */
export async function enrichSalary(
  providerId: string | undefined,
  opts: Record<string, string>,
  job: { title: string; company: string; location: string; description: string }
): Promise<SalaryBand | null> {
  const provider = providerId ? PROVIDERS[providerId] : undefined;
  if (!provider) return null;
  const band = await provider.fetch(job, opts);
  if (!band) return null;
  return { ...band, source: "estimate" };
}

export const ENRICHMENT_PROVIDERS = Object.values(PROVIDERS);
