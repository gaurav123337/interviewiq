#!/usr/bin/env node
/* Pure re-validation helpers for the resource-safety-guard's L5 layer
   (docs/resource-safety-guard.md §3 L5, §5.2) — Phase 4 discovery follow-up.

   Contract: every approved discovered_resource is re-checked on a schedule;
   anything unreachable, redirected, or mutated is AUTO-QUARANTINED (hidden
   from the public view instantly — the credits/community surfaces read the
   approved-only view) and re-queued for admin review. Fail-closed: probe
   ERRORS quarantine too, because an approved link that stops working has no
   business staying public. An explicit 200 with the same content is the only
   pass verdict. Mirrors discover-skills-lib.js style; zero I/O. */

/** Pure: canonical URL for redirect comparison — strips trailing slashes
 *  (except the root) so server-side normalization (example.com → example.com/)
 *  is not misread as a redirect. Mirrors discover-lib canonicalSeedUrl. */
function sameUrl(a, b) {
  const norm = (u) => String(u ?? "").replace(/\/+$/, "") || "/";
  return norm(a) === norm(b);
}

/** Pure: L5 verdict for one probe result.
 *    - probe ok + same final URL + same content marker → "pass"
 *    - anything else (4xx/5xx, redirect away, content changed, network error) → "quarantine"
 *  `contentMarker` is a cheap fingerprint the caller compares (e.g. first
 *  N chars of page text). A null marker on either side means "unknown"
 *  → quarantine (fail-closed), EXCEPT when the resource never had a marker
 *  stored (first revalidation) — then a clean 200 same-URL pass suffices. */
export function l5Verdict({ ok, status, finalUrl, originalUrl, contentMarker, storedMarker }) {
  if (!ok) return { verdict: "quarantine", reason: `unreachable (status ${status ?? "network error"})` };
  if (status && (status < 200 || status >= 300)) {
    return { verdict: "quarantine", reason: `http ${status}` };
  }
  if (finalUrl && originalUrl && !sameUrl(finalUrl, originalUrl)) {
    return { verdict: "quarantine", reason: `redirected to ${finalUrl}` };
  }
  if (storedMarker != null && contentMarker !== storedMarker) {
    return { verdict: "quarantine", reason: "content changed since approval" };
  }
  return { verdict: "pass", reason: null };
}

/** Pure: UPDATE statements that quarantine resources by id, merging the
 *  reason into meta.decision_note and stamping decided_at. Status returns to
 *  'pending' — the L4 human gate re-decides with fresh evidence. */
export function buildQuarantineSql(rows) {
  const ids = (rows ?? []).map(r => Number(r?.id)).filter(n => Number.isFinite(n));
  if (!ids.length) return "";
  const q = (s) => String(s ?? "").replace(/'/g, "''");
  const cases = (rows ?? [])
    .filter(r => Number.isFinite(Number(r?.id)))
    .map(r => `when ${Number(r.id)} then '${q(r.reason ?? "re-validation failed")}'`)
    .join(" ");
  return `update public.discovered_resources
set status = 'pending',
    decided_at = now(),
    meta = meta || ('{"decision_note":' ||
      case id ${cases} else 'L5 auto-quarantine' end
      || ', "l5_quarantined_at":"' || to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '"}')::jsonb
where id in (${ids.join(",")}) and status = 'approved';`;
}

/** Pure: per-resource re-validation summary in scraper_runs.per_source shape,
 *  so the L5 cron reports into the same Item-B pipeline as everything else.
 *  status: ok (all passed) | partial (some quarantined) | failed (all errored). */
export function buildL5RunSummary(results, startedAt) {
  const vals = Object.values(results ?? {});
  const quarantined = vals.filter(r => r?.verdict === "quarantine").length;
  const errored = vals.filter(r => r?.verdict === "quarantine" && /network error|http 5/.test(String(r?.reason ?? "")));
  const status = !vals.length ? "ok" : errored.length === vals.length ? "failed" : quarantined > 0 ? "partial" : "ok";
  return {
    ranAt: new Date(startedAt).toISOString(),
    status,
    perSource: results ?? {},
    inserted: 0,
    errors: quarantined
  };
}
