/* Phase 4 (compliant cloud collectors) — Workday CXS feed parsing for the
   jobs-fetch edge function. Pure, deno-tested — mirrors the same contract the
   local engine's parseWorkdayJobs (scripts/apply-engine-lib.js) already pins:
   the feed carries NO full JD (description stays title+location), the prose
   `postedOn` becomes an honest estimated posted_at, and a row without a
   usable identity is skipped rather than guessed. */

export interface WorkdayRef {
  tenant: string;
  site: string;
  /** the CXS POST endpoint, built from the ref — never guessed per posting */
  apiUrl: string;
}

const TOKEN_RE = /^[a-z0-9][a-z0-9_-]{1,60}$/i;

/** "mastercard/CorporateCareers" → the CXS POST plan. A ref without BOTH a
    valid tenant and site segment is unusable (unlike Greenhouse, Workday
    cannot be listed without the site name) — null keeps the honest skip. */
export function parseWorkdayRef(ref: string): WorkdayRef | null {
  const parts = String(ref ?? "").split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const [tenant, site] = parts;
  /* a ref MAY name its data-center host ("kla.wd1") — the CXS tenant path
     segment is always the BASE (e.g. "mastercard"), so the .wdN host suffix
     is split off, never smuggled into the cxs URL */
  const base = tenant.replace(/\.wd[1-5]$/i, "");
  if (!TOKEN_RE.test(base) || !TOKEN_RE.test(site)) return null;
  const wd = tenant.match(/\.wd([1-5])$/i)?.[1] ?? "1"; // wd1..wd5 are the documented clusters
  return { tenant: base, site, apiUrl: `https://${base}.wd${wd}.myworkdayjobs.com/wday/cxs/${base}/${site}/jobs` };
}

/** "Posted 3 Days Ago" / "Posted Today" / "Posted 30+ Days Ago" → hours.
    The feed stamps prose only — an estimated posted_at beats null ordering,
    and the estimate direction (older, never fresher) keeps "new" tables
    honest: "Today" is 0h while "30+ Days" is capped at 30*24. */
export function proseAgeToHours(postedOn: string): number | null {
  const m = String(postedOn ?? "").match(/^(?:posted\s+)?(\w+)\s*(?:hours?|days?|days\+\+)$/i)
    ?? String(postedOn ?? "").match(/^(?:posted\s+)?(\d+)(hours?|days?)(?:\s+ago)?$/i);
  const s = String(postedOn ?? "").toLowerCase().replace(/^posted\s+/i, "").trim();
  if (/^today$/.test(s) || /^just posted$/.test(s)) return 0;
  if (/^yesterday$/.test(s)) return 24;
  const num = s.match(/^(\d+)\s*\+?\s*(hours?|days?)(?:\s+ago)?$/);
  if (num) {
    const n = parseInt(num[1], 10);
    return /hours?/.test(num[2]) ? n : n * 24;
  }
  return null;
}

export interface WorkdayPosting {
  externalId: string;
  title: string;
  location: string | null;
  remote: boolean;
  /** canonical posting URL when the feed carried one — NEVER guessed */
  url: string;
  postedAt: string | null; // ISO estimate from the prose stamp
}

export function parseWorkdayPostings(payload: unknown, { now = Date.now() } = {}): WorkdayPosting[] {
  const jobs = Array.isArray((payload as { jobPostings?: unknown[] })?.jobPostings)
    ? (payload as { jobPostings: Record<string, unknown>[] }).jobPostings
    : [];
  const out: WorkdayPosting[] = [];
  for (const j of jobs) {
    const title = String(j?.title ?? "").trim();
    const externalId = String(j?.externalId ?? "").trim();
    if (!title || !externalId) continue; // no identity → can't be deduped later — skip, honest
    const loc = String(j?.locationsText ?? "").trim() || null;
    const hours = proseAgeToHours(String(j?.postedOn ?? ""));
    out.push({
      externalId,
      title,
      location: loc,
      remote: /remote|work from home/i.test(loc ?? ""),
      url: String((j as { canonicalPostingUrl?: string }).canonicalPostingUrl ?? "").trim(),
      postedAt: hours !== null ? new Date(now - hours * 3_600_000).toISOString() : null,
    });
  }
  return out;
}
