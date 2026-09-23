/* Pure core of the Playwright jobs pipeline (Phase 4 Item C) — no I/O, so the
   extraction contract is vitest-testable without a browser (mirrors the
   scripts/scrape-lib.js style). The browser-driving orchestrator lives in
   scrape-jobs-playwright.mjs; targets are data in content/job-playwright-targets.json. */

/** Target categories the pipeline knows how to render. */
export const TARGET_KINDS = ["html-listing", "html-listing-paginated", "json-api", "remoteok-html-fallback"];

/**
 * Validates + normalizes one target. Returns { ok: true, target } or { ok: false, errors }.
 * Required: id, kind, url, selectors.item, selectors fields (title+company).
 * Optional with safe defaults: maxItems (25), delayMs (1200), enabled (true), ua.
 */
export function validateTarget(raw) {
  const errors = [];
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) errors.push("id is required");
  if (!TARGET_KINDS.includes(raw.kind)) errors.push(`kind must be one of: ${TARGET_KINDS.join(", ")}`);
  let url = typeof raw.url === "string" ? raw.url.trim() : "";
  let host = "";
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) errors.push("url must be http(s)");
    host = u.hostname;
  } catch {
    errors.push("url must be absolute");
  }
  const sel = raw.selectors ?? {};
  if (!sel.item) errors.push("selectors.item is required");
  if (!sel.title) errors.push("selectors.title is required");
  if (!sel.company && !raw.company) errors.push("selectors.company is required when target.company is unset");
  if (errors.length) return { ok: false, errors };

  const maxItems = clampInt(raw.maxItems, 1, 100, 25);
  const delayMs = clampInt(raw.delayMs, 0, 60_000, 1200);
  return {
    ok: true,
    target: {
      id, kind: raw.kind, url, host,
      selectors: {
        item: sel.item,
        title: sel.title,
        company: sel.company ?? null,
        location: sel.location ?? null,
        link: sel.link ?? null,
        description: sel.description ?? null,
        postedAt: sel.postedAt ?? null
      },
      company: raw.company ?? null,
      maxItems, delayMs,
      enabled: raw.enabled !== false,
      ua: typeof raw.ua === "string" && raw.ua ? raw.ua : null
    }
  };
}

/**
 * Loads + validates a targets file ({ targets: [...] }). Invalid targets are
 * skipped with their errors collected (never thrown) — one bad hand-edit must
 * not kill a whole run. Returns { targets, skipped }.
 */
export function loadTargets(body) {
  const rawList = Array.isArray(body?.targets) ? body.targets : [];
  const targets = [];
  const skipped = [];
  const seen = new Set();
  for (const raw of rawList) {
    const v = validateTarget(raw);
    if (!v.ok) { skipped.push({ id: raw?.id ?? "(none)", errors: v.errors }); continue; }
    if (seen.has(v.target.id)) { skipped.push({ id: v.target.id, errors: ["duplicate id"] }); continue; }
    seen.add(v.target.id);
    targets.push(v.target);
  }
  return { targets: targets.filter(t => t.enabled), skipped };
}

/**
 * Extracts one job posting from a DOM node. `q(node, css)` is injected so the
 * same code runs under Playwright (real selectors) and vitest (a tiny fake).
 * Returns null when title/company can't be read — partial extractions are
 * worthless for a jobs feed.
 */
export function extractJob(node, target, q) {
  const s = target.selectors;
  const text = (css) => {
    if (!css) return "";
    const el = q(node, css);
    const t = el ? String(el.textContent ?? "") : "";
    return t.replace(/\s+/g, " ").trim();
  };
  const title = text(s.title);
  const company = text(s.company) || target.company || "";
  if (!title || !company) return null;
  let link = "";
  if (s.link) {
    const a = q(node, s.link);
    const href = a ? (a.getAttribute ? a.getAttribute("href") : String(a.href ?? "")) : "";
    if (href) link = normalizeUrl(href, target.url);
  } else if (node && typeof node.getAttribute === "function") {
    /* the item node itself may be the job anchor (e.g. YC's a[href^='/jobs/'] cards) */
    const href = node.getAttribute("href");
    if (href) link = normalizeUrl(href, target.url);
  }
  const postedRaw = text(s.postedAt);
  return {
    title: title.slice(0, 300),
    company: company.slice(0, 160),
    location: text(s.location).slice(0, 160) || null,
    url: link,
    description: text(s.description).slice(0, 2000),
    postedAt: parseRelativeDate(postedRaw)
  };
}

/**
 * Mints the (source, external_id) identity. Plan decision: `source` is the
 * single exact-match value "playwright" (FEED_SOURCES compares exactly), and
 * the host + target live in external_id/meta. Dedupe happens on
 * host + path + resolved title (job boards reuse paths), so re-runs upsert
 * rather than pile up.
 */
export function jobIdentity(targetHost, targetId, job) {
  const base = job.url ? hostOf(job.url) : targetHost;
  const path = job.url ? safePath(job.url) : "";
  const slug = `${job.title} @ ${job.company}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9@-]/g, "").slice(0, 60);
  return { source: "playwright", externalId: `playwright:${base}${path}#${slug}`, targetId };
}

/** Dedupes a run's jobs by external_id, then caps per target and overall. */
export function dedupeJobs(jobs, perTargetCap = 25, totalCap = 80) {
  const seen = new Set();
  const perTarget = new Map();
  const out = [];
  for (const j of jobs) {
    if (seen.has(j.externalId)) continue;
    seen.add(j.externalId);
    const n = perTarget.get(j.targetId) ?? 0;
    if (n >= perTargetCap) continue;
    perTarget.set(j.targetId, n + 1);
    out.push(j);
    if (out.length >= totalCap) break;
  }
  return out;
}

/** SQL-escape (mirrors scrape-lib.sqlStr). */
export function sqlStr(v) {
  return "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}

/**
 * Builds the idempotent jobs upsert. `source` is always 'playwright' (the
 * FEED_SOURCES exact-match decision); the host/target ride in external_id and
 * meta. Rows missing a resolved URL keep url '' (the jobs UI tolerates it;
 * apply-kit generation keys off other fields).
 */
export function buildJobsUpsertSql(jobs) {
  if (!jobs.length) return "";
  const values = jobs.map((j) => {
    const meta = { targetId: j.targetId, host: j.host, extractedAt: j.extractedAt };
    const remote = j.remote ?? /\bremote\b/i.test(`${j.location ?? ""} ${j.description ?? ""}`);
    return `(${sqlStr("playwright")}, ${sqlStr(j.externalId)}, ${sqlStr(j.title)}, ${sqlStr(j.company)}, ${sqlStr(j.location ?? "")}, ${remote ? "true" : "false"}, ${sqlStr(j.url ?? "")}, ${sqlStr(j.description ?? "")}, ${sqlStr(JSON.stringify(j.skills ?? []))}::jsonb, ${j.postedAt ? sqlStr(j.postedAt) : "null"}, ${sqlStr(JSON.stringify(meta))}::jsonb)`;
  }).join(",\n  ");
  return `insert into public.jobs (source, external_id, title, company, location, remote, url, description, skills, posted_at, meta)
values
  ${values}
on conflict (source, external_id) do update
set title = excluded.title,
    company = excluded.company,
    location = excluded.location,
    remote = excluded.remote,
    url = excluded.url,
    description = excluded.description,
    skills = excluded.skills,
    posted_at = excluded.posted_at;`;
}

/** Builds one jobs_fetch_reports row for the run (per-target detail; counts +
    error strings only — never secrets, mirroring jobs-fetch's report row). */
export function buildReport(perTarget, startedAt) {
  const added = perTarget.reduce((n, p) => n + (p.added ?? 0), 0);
  const found = perTarget.reduce((n, p) => n + (p.found ?? 0), 0);
  const errors = Object.fromEntries(perTarget.filter(p => p.error).map(p => [p.targetId, p.error]));
  return {
    added,
    updated: 0,
    /* total counts what the pipeline SAW (the classic feed's semantics), not what it added */
    total: found,
    per_target: perTarget.map(p => ({ targetId: p.targetId, host: p.host, found: p.found ?? 0, added: p.added ?? 0, error: p.error })),
    errors
  };
}

export function buildReportSql(report, startedAt) {
  return `insert into public.jobs_fetch_reports (ran_at, added, updated, total, per_source, errors)
values (${sqlStr(new Date(startedAt).toISOString())}, ${Number(report.added) || 0}, 0, ${Number(report.total) || 0}, ${sqlStr(JSON.stringify(report.per_target))}::jsonb, ${sqlStr(JSON.stringify(report.errors))}::jsonb);`;
}

/* ------------------------------ helpers ------------------------------ */

function clampInt(v, min, max, dflt) {
  const n = Number(v);
  if (v === undefined || v === null || v === "" || !Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
}

function safePath(u) {
  try {
    const p = new URL(u).pathname.replace(/\/+$/, "");
    return p.length > 60 ? p.slice(0, 60) : p;
  } catch { return ""; }
}

/** Strips tracking params/fragments and resolves relative hrefs against the target page. */
export function normalizeUrl(href, baseUrl) {
  try {
    const u = new URL(href, baseUrl);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(k) || k === "ref" || k === "source") u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return href;
  }
}

/** Boards render "2d ago" / "3 hours ago" / ISO — normalize to ISO, else null. */
export function parseRelativeDate(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const rel = t.match(/^(\d+)\s*(m|min|minute|minutes|h|hr|hour|hours|d|day|days|w|wk|week|weeks)\s*ago$/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms = unit.startsWith("m") ? 60_000 : unit.startsWith("h") ? 3_600_000 : unit.startsWith("d") ? 86_400_000 : 604_800_000;
    return new Date(Date.now() - n * ms).toISOString();
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
