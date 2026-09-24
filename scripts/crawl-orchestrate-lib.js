#!/usr/bin/env node
/* Pure orchestration helpers for the discovery crawler (Phase 4 Item D2).
   Zero I/O — everything here is unit-testable from vitest; the I/O side
   lives in scripts/crawl-sources.js (management API + fetcher + GitHub REST).
   Mirrors scrape-lib.js style.

   Pipeline (per docs/phase4-enhancements-plan.md §D2): approved seeds →
   discover-lib plan → crawl-lib BFS → scrape-lib extractItems → route:
     • Q&A            → buildUpsertSql → published_questions drafts
     • problem titles → recorded for ai-problems.yml to draft
     • resource links → discovered_resources (pending; surfaced after the
                        D4 approval queue + resource-safety-guard) */

import { normalizeUrl } from "./crawl-lib.js";
import { slugify, patternFromTitle } from "./ai-draft-lib.js";
import { sqlStr } from "./scrape-lib.js";
import { partitionNoiseItems } from "./draft-quality-lib.js";

/* ------------------------------------------------------------------ */
/* link classification                                                 */
/* ------------------------------------------------------------------ */

const SKIP_EXT_RE = /\.(pdf|pptx?|docx?|xlsx?|zip|gz|tgz|dmg|exe|pkg|msi|csv)$/i;
const QA_URL_RE = /interview|question|quiz|faq/i;
const PROBLEM_URL_RE = /problems?|exercise|kata|challenge/i;

/** Derives a human title from a URL slug ("two-sum" → "Two Sum"). */
export function titleFromUrl(url) {
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    return url;
  }
  const slug = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
  const t = slug.replace(/[-_]+/g, " ").trim();
  if (!t || !/[\p{L}]/u.test(t)) return new URL(url).host;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Classifies one discovered link into a routing target. Returns
 *  { url, title, kind: "qa"|"problem"|"resource", pattern? } or null when the
 *  link should be skipped (unparseable, non-web, binary). URL shape + optional
 *  link text drive the decision; review humans make the final call. */
export function classifyLink(rawUrl, baseUrl, linkText = "") {
  const url = normalizeUrl(rawUrl, baseUrl);
  if (!url || !/^https?:/i.test(url)) return null;
  if (SKIP_EXT_RE.test(new URL(url).pathname)) return null;

  const text = String(linkText ?? "").trim();
  const title = text.length >= 4 ? text : titleFromUrl(url);
  const haystack = `${title} ${new URL(url).pathname}`;

  if (QA_URL_RE.test(haystack)) return { url, title, kind: "qa" };
  if (PROBLEM_URL_RE.test(haystack)) {
    return { url, title, kind: "problem", pattern: patternFromTitle(title) };
  }
  return { url, title, kind: "resource" };
}

/* ------------------------------------------------------------------ */
/* attribution                                                         */
/* ------------------------------------------------------------------ */

/** Builds meta.attribution from a discover-lib SeedClassification. GitHub
 *  payloads carry owner/repo for free; HTML/json seeds attribute by host. */
export function attributionFor(seed, extra = {}) {
  const a = {
    source: seed?.attributionSource ?? seed?.host ?? "unknown",
    kind: seed?.kind ?? "html",
    url: seed?.url ?? "",
  };
  if (seed?.owner) a.owner = seed.owner;
  if (seed?.repo) a.repo = seed.repo;
  if (seed?.topic) a.topic = seed.topic;
  return { ...a, ...extra };
}

/** License decision for captured content. Unknown/no-license content is
 *  flagged (meta.needs_license_review) — it still lands as a DRAFT (human
 *  review is the gate), but the flag keeps it out of any auto-rotation and
 *  D4's credits UI can demand attention. */
export function licenseGate(license) {
  const l = String(license ?? "").trim().toLowerCase();
  const known = l.length > 0 && !["no-license", "none", "other", "unknown"].includes(l);
  return { known, license: known ? license : "no-license", needsReview: !known };
}

/* ------------------------------------------------------------------ */
/* routing                                                             */
/* ------------------------------------------------------------------ */

/** Routes scrape-lib items into the three discovery targets. `seed` + optional
 *  license feed meta.attribution / meta.needs_license_review. Answered items
 *  (or question-shaped ones) become Q&A drafts; unanswered items whose title
 *  matches a known problem pattern become problem candidates. Hard noise
 *  (URLs-as-questions, JSON fragments, playground links, tracking params)
 *  is dropped before routing — the 2026-09-24 live crawl showed ~85% of
 *  HN/search-engine drafts were unusable; reviewers should see signal. */
export function routeItems(items, seed, license) {
  const gate = licenseGate(license);
  const attribution = attributionFor(seed, { license: gate.license });
  const [keep, noise] = partitionNoiseItems(items);
  const out = { qa: [], problems: [], resources: [], attribution, noise };
  for (const item of keep) {
    const meta = { ...(item.meta ?? {}), attribution };
    if (gate.needsReview) meta.needs_license_review = true;
    const hasAnswer = typeof item.answer === "string" && item.answer.trim().length > 0;
    const pattern = hasAnswer ? "mixed" : patternFromTitle(item.question ?? "");
    if (!hasAnswer && pattern !== "mixed") {
      out.problems.push({ id: slugify(item.question ?? ""), title: item.question, pattern });
    } else {
      out.qa.push({ ...item, meta });
    }
  }
  return out;
}

/** Validates dashboard seed rows into the shape the crawler plans with —
 *  unknown kinds are skipped with a reason (never crash the run). */
export function mapSeedRows(rows) {
  const valid = new Set(["github-topic", "github-repo", "json", "sitemap", "html"]);
  const seeds = [];
  const skipped = [];
  for (const r of rows ?? []) {
    const url = typeof r?.url === "string" ? r.url.trim() : "";
    if (!url) { skipped.push({ id: r?.id, reason: "empty url" }); continue; }
    const kind = valid.has(r?.kind) ? r.kind : (r?.kind ? r.kind : "html");
    if (!valid.has(kind)) { skipped.push({ id: r?.id, reason: `unknown kind "${r?.kind}"` }); continue; }
    seeds.push({ id: r.id, url, kind, skill: r.skill ?? null, originDetail: r.origin_detail ?? r.originDetail ?? "" });
  }
  return { seeds, skipped };
}

/* ------------------------------------------------------------------ */
/* SQL builders                                                        */
/* ------------------------------------------------------------------ */

/** Idempotent multi-row insert of pending seeds (dashboard-first flow keeps
 *  the "Discover from URL" card and the skill-auto path data-only). */
export function buildSeedInsertSql(seeds) {
  if (!seeds?.length) return "";
  const values = seeds
    .map((s) => `(${sqlStr(s.url)}, ${sqlStr(s.kind ?? "html")}, ${sqlStr(s.origin ?? "manual")}, ${sqlStr(s.originDetail ?? "")}, ${s.skill ? sqlStr(s.skill) : "null"})`)
    .join(",\n  ");
  return `insert into public.discovery_seeds (url, kind, origin, origin_detail, skill)
values
  ${values}
on conflict (url) do nothing;`;
}

/** Idempotent multi-row insert of discovered resources — always status
 *  'pending'; D4's approval queue + resource-safety-guard do the surfacing. */
export function buildResourcesInsertSql(resources) {
  if (!resources?.length) return "";
  const values = resources
    .map((r) => `(${sqlStr(r.url)}, ${sqlStr(r.title ?? titleFromUrl(r.url))}, ${sqlStr(r.kind ?? "resource")}, '${JSON.stringify(r.attribution ?? {}).replace(/'/g, "''")}'::jsonb, ${sqlStr(r.license ?? "unknown")}, ${r.seedId ? Number(r.seedId) : "null"}, '${JSON.stringify(r.meta ?? {}).replace(/'/g, "''")}'::jsonb)`)
    .join(",\n  ");
  return `insert into public.discovered_resources (url, title, kind, attribution, license, seed_id, meta)
values
  ${values}
on conflict (url) do nothing;`;
}

/** Assembles the scraper_runs payload for a discovery crawl (same table the
 *  question scraper reports into — Item B's card covers both pipelines). */
export function buildRunSummary(perSeed, startedAt, inserted, errors) {
  const values = Object.values(perSeed ?? {});
  const errored = values.filter((p) => p.error);
  const status = errors > 0 ? (errored.length === values.length && values.length > 0 ? "failed" : "partial") : "ok";
  return {
    ranAt: new Date(startedAt).toISOString(),
    status,
    perSource: perSeed ?? {},
    inserted: Number(inserted) || 0,
    errors: Number(errors) || 0,
  };
}

/** scraper_runs insert for a discovery run — trigger 'cron' so the B2 card's
 *  pairing logic (±30 min, cron-only) matches it up with the workflow run. */
export function buildRunReportSql(summary, trigger = "cron") {
  return `insert into public.scraper_runs (ran_at, trigger, status, per_source, inserted, errors)
values (${sqlStr(summary.ranAt)}, ${sqlStr(trigger)}, ${sqlStr(summary.status)}, ${sqlStr(JSON.stringify(summary.perSource))}::jsonb, ${Number(summary.inserted) || 0}, ${Number(summary.errors) || 0});`;
}
