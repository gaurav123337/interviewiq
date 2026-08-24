/* Phase 2 — platform job import (Lane B: user-directed public URLs).
   The user pastes a job link from Naukri / LinkedIn / Indeed / anywhere;
   we fetch ONLY the public posting page at their direction, normalize it
   into a JobPosting the existing matcher + feed can consume, and hand the
   apply back to the platform's own page. Never login-gated data, never
   automated submissions, no credential storage. The core here is pure and
   testable; network lives behind a small injectable fetcher. */

import type { JobPosting } from "../types";
import { extractSkillNames } from "./resume";
/* the pure extraction/robots helpers are shared with the import-job edge
   function — one tested copy, exercised by this client suite */
import { extractFromJsonLd, parseMeta, robotsAllows, stripHtml, type RawJobPage } from "../../supabase/functions/_shared/importPage";
/* re-exported so the shared extraction helpers stay part of this service's
   public surface (the client suite + consumers import them from here) */
export { extractFromJsonLd, parseMeta, robotsAllows, stripHtml, type RawJobPage } from "../../supabase/functions/_shared/importPage";

/* ------------------------------------------------------------------ */
/* Platform detection                                                  */
/* ------------------------------------------------------------------ */

export interface PlatformInfo {
  /** Storage-level source id (e.g. "naukri", "linkedin", "other"). */
  id: string;
  /** Human label shown in the UI. */
  label: string;
  host: string;
}

const PLATFORMS: { id: string; label: string; hosts: RegExp }[] = [
  { id: "naukri", label: "Naukri", hosts: /(^|\.)naukri\.com$/ },
  { id: "linkedin", label: "LinkedIn", hosts: /(^|\.)linkedin\.com$/ },
  { id: "indeed", label: "Indeed", hosts: /(^|\.)indeed\.(com|co\.uk|de|fr|in|ca|au)$/ },
  { id: "glassdoor", label: "Glassdoor", hosts: /(^|\.)glassdoor\.(com|co\.in|ca|de|fr)$/ }
];

/** Recognize the platform from a URL. Returns null for non-http(s) URLs;
    unknown sites fall back to { id: "other", label: "Job page" }. */
export function platformFromUrl(raw: string): PlatformInfo | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "");
  for (const p of PLATFORMS) if (p.hosts.test(host)) return { id: p.id, label: p.label, host };
  return { id: "other", label: "Job page", host };
}

/** Human label for any feed source (native + imported). */
const SOURCE_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  ashby: "Ashby",
  lever: "Lever",
  rss: "RSS",
  remoteok: "RemoteOK",
  "imported:naukri": "Naukri",
  "imported:linkedin": "LinkedIn",
  "imported:indeed": "Indeed",
  "imported:glassdoor": "Glassdoor",
  "imported:other": "company page"
};

export const sourceLabel = (s: string): string =>
  SOURCE_LABELS[s] ?? (s.startsWith("imported:") ? s.slice("imported:".length) : s);

/* ------------------------------------------------------------------ */
/* Source trust badges — why you can (or can't) trust a posting        */
/* ------------------------------------------------------------------ */

export interface SourceTrust {
  /** Short chip label, e.g. "Official ATS". */
  label: string;
  /** Icon shown next to the source chip on feed cards. */
  icon: string;
  /** Tooltip explaining the trust level honestly. */
  title: string;
}

/** Trust tier for any feed source: ATS boards are pulled from the
    company's own system, RSS feeds are published by the board itself,
    RemoteOK comes from their official API, and imported jobs are links
    the user pasted themselves. */
export function trustOf(source: string): SourceTrust {
  if (source === "greenhouse" || source === "ashby" || source === "lever") {
    return {
      label: "Official ATS",
      icon: "🛡️",
      title: "Pulled from the company's own application system (Greenhouse/Ashby/Lever) — the posting is the employer's own."
    };
  }
  if (source === "remoteok") {
    return {
      label: "Official API",
      icon: "🛡️",
      title: "Pulled from RemoteOK's official public API — RemoteOK vets the companies it lists."
    };
  }
  if (source === "rss") {
    return {
      label: "Curated feed",
      icon: "📡",
      title: "Published via a public RSS feed from a vetted board (We Work Remotely, Himalayas) — the board screens the postings, but details come from the feed itself."
    };
  }
  if (source.startsWith("imported:")) {
    return {
      label: "You added",
      icon: "🔗",
      title: "Imported from a link you pasted — we read the public page, but you're the one vouching for it."
    };
  }
  return { label: "Feed", icon: "🌐", title: "Pulled from a configured job source." };
}

/* ------------------------------------------------------------------ */
/* Region-aware platform ordering                                      */
/* ------------------------------------------------------------------ */

/** Sort rank for a platform given the profile location: India → Naukri
    first; elsewhere → LinkedIn/Indeed first. Unknown platforms rank last. */
export function sourcePriority(location: string): Record<string, number> {
  const loc = (location ?? "").toLowerCase();
  const india = /india|bengaluru|mumbai|delhi|gurgaon|gurugram|pune|hyderabad|chennai|kolkata|noida|ahmedabad/.test(loc);
  return india
    ? { "imported:naukri": 0, "imported:linkedin": 1, "imported:indeed": 2, "imported:glassdoor": 3 }
    : { "imported:linkedin": 0, "imported:indeed": 1, "imported:naukri": 2, "imported:glassdoor": 3 };
}

/* ------------------------------------------------------------------ */
/* Multi-URL input — one per line (or comma separated)                 */
/* ------------------------------------------------------------------ */

/** Split a paste of multiple job links into clean, deduped URLs. */
export function splitJobUrls(text: string): string[] {
  return [...new Set(
    text.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
  )];
}

/* ------------------------------------------------------------------ */
/* HTML helpers + robots.txt — shared with the edge function           */
/* (see ../../supabase/functions/_shared/importPage.ts)                */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Fetching — polite + rate-limited (per host)                         */
/* ------------------------------------------------------------------ */

const lastFetch = new Map<string, number>();
export const MIN_FETCH_INTERVAL_MS = 1500;

export async function fetchWithRateLimit(url: string, fetcher: (u: string) => Promise<Response>): Promise<Response> {
  const host = new URL(url).hostname;
  const last = lastFetch.get(host) ?? 0;
  const wait = MIN_FETCH_INTERVAL_MS - (Date.now() - last);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  const res = await fetcher(url);
  lastFetch.set(host, Date.now());
  return res;
}

/* ------------------------------------------------------------------ */
/* Normalization → JobPosting                                          */
/* ------------------------------------------------------------------ */

function guessLevel(title: string): string | null {
  const t = title.toLowerCase();
  if (/(intern|graduate|entry.level|apprentice|junior|jr\.?|early.career)/.test(t)) return "junior";
  if (/(staff|principal|distinguished|fellow|chief.architect)/.test(t)) return "principal";
  if (/(director|vp|vice.president|cto|head of|lead|tech.lead|engineering.manager|manager)/.test(t)) return "lead";
  if (/(senior|sr\.?|5\+|6\+|7\+)/.test(t)) return "senior";
  return "mid";
}

/** Stable 8-hex hash — the external id for imported jobs. */
export function stableHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Build a feed-ready JobPosting from an extracted page. Pure + testable. */
export function normalizeImportedJob(platform: PlatformInfo, page: RawJobPage, sourceUrl: string): JobPosting {
  const title = (page.title ?? "").trim();
  const company = (page.company ?? "").trim();
  const location = (page.location ?? "").trim();
  const description = (page.description ?? "").slice(0, 6000);
  const text = `${title}\n${company}\n${location}\n${description}`;
  const url = page.applyUrl ?? sourceUrl;
  return {
    id: `imported:${platform.id}:${stableHash(url)}`,
    source: `imported:${platform.id}`,
    externalId: stableHash(url),
    title: title || "Untitled role",
    company,
    location,
    remote: /remote|hybrid/i.test(`${location} ${description}`),
    description,
    url,
    skills: extractSkillNames(text).slice(0, 14),
    level: guessLevel(title),
    salary: null,
    companySize: null,
    postedAt: null
  };
}

/* ------------------------------------------------------------------ */
/* Orchestration — direct public fetch, then the edge-function path    */
/* ------------------------------------------------------------------ */

export type ImportOutcome =
  | { ok: true; job: JobPosting }
  | { ok: false; reason: "invalid-url" | "blocked" | "network" | "empty"; message: string };

export type ImportListOutcome =
  | { ok: true; jobs: JobPosting[]; listing: boolean }
  | { ok: false; reason: "invalid-url" | "blocked" | "network" | "empty"; message: string };

/** Fetch a public posting page (direct, browser-side). CORS-blocked
    sites fail gracefully — the edge function path handles those. */
export async function importFromUrl(rawUrl: string, fetcher: (u: string) => Promise<Response> = (u) => fetch(u)): Promise<ImportOutcome> {
  const platform = platformFromUrl(rawUrl);
  if (!platform) return { ok: false, reason: "invalid-url", message: "Enter a valid job URL (https://…)" };
  let allows = true;
  try {
    const robotsUrl = new URL("/robots.txt", rawUrl).toString();
    const r = await fetcher(robotsUrl);
    if (r.ok) allows = robotsAllows(await r.text(), new URL(rawUrl).pathname);
  } catch { /* robots fetch blocked (CORS) — edge function enforces server-side */ }
  if (!allows) {
    return { ok: false, reason: "blocked", message: "This site's robots.txt doesn't allow automated fetching — open the job page manually instead." };
  }
  try {
    const res = await fetchWithRateLimit(rawUrl, fetcher);
    if (!res.ok) {
      return { ok: false, reason: "network", message: `The page returned HTTP ${res.status} — open it manually instead.` };
    }
    const html = await res.text();
    const ld = extractFromJsonLd(html);
    const meta = parseMeta(html);
    const title = ld?.title ?? meta.get("og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
    const description = ld?.description ?? meta.get("og:description") ?? meta.get("description") ?? stripHtml(html).slice(0, 2000);
    const job = normalizeImportedJob(platform, {
      title,
      company: ld?.company ?? meta.get("og:site_name"),
      location: ld?.location,
      description,
      applyUrl: ld?.applyUrl
    }, rawUrl);
    if (!job.title || job.title === "Untitled role") {
      return { ok: false, reason: "empty", message: "Couldn't read the posting from that page — open it manually instead." };
    }
    return { ok: true, job };
  } catch {
    return { ok: false, reason: "network", message: "Couldn't fetch this page from the app (the site blocks cross-origin reads) — open it manually and paste the details." };
  }
}

/** Full import: try the import-job Edge Function first (server-side, no
    CORS, robots-enforced), then fall back to the direct public fetch.
    Returns multiple jobs when the URL is a listing/search page.
    Works without sign-in by using the Supabase anon key. */
export async function importFromUrlWithFallback(rawUrl: string, ctx: { supabaseUrl?: string; token?: string; anonKey?: string; fetcher?: (u: string) => Promise<Response> } = {}): Promise<ImportListOutcome> {
  const platform = platformFromUrl(rawUrl);
  if (!platform) return { ok: false, reason: "invalid-url", message: "Enter a valid job URL (https://…)" };
  /* Try the edge function: prefer user token, fall back to anon key */
  const auth = ctx.token || ctx.anonKey;
  if (ctx.supabaseUrl && auth) {
    try {
      const res = await fetch(`${ctx.supabaseUrl}/functions/v1/import-job`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl })
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.ok) {
        // Listing page: multiple jobs returned
        if (body.listing && Array.isArray(body.jobs)) {
          const jobs = body.jobs
            .map((j: RawJobPage) => normalizeImportedJob(platform, j, rawUrl))
            .filter((j: JobPosting) => j.title && j.title !== "Untitled role");
          if (jobs.length > 0) return { ok: true, jobs, listing: true };
        }
        // Single job
        const job = normalizeImportedJob(platform, body.job as RawJobPage, rawUrl);
        if (job.title && job.title !== "Untitled role") return { ok: true, jobs: [job], listing: false };
      }
    } catch { /* edge function unreachable — fall through to direct */ }
  }
  // Client-side fallback: single job
  const result = await importFromUrl(rawUrl, ctx.fetcher);
  if (result.ok) return { ok: true, jobs: [result.job], listing: false };
  return result;
}
