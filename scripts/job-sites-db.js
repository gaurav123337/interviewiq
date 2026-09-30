/* job-sites-db — Supabase access for the apply engine's site registry.
   Uses the service key from .claude/settings.local.json (owner machine,
   gitignored) via the same parse as ai-config.js — CI never has it, and CI
   doesn't run the local engine anyway. All writes go through the engine_*
   RPCs (service-role gated server-side). */

import { readFileSync } from "node:fs";

export function loadLocalCreds() {
  const settings = JSON.parse(readFileSync(".claude/settings.local.json", "utf8"));
  const rule = (settings.permissions?.allow ?? []).find(
    (r) => typeof r === "string" && /Bash\(SUPA_URL=/.test(r)
  );
  const m = rule?.match(/SUPA_URL=(https:\/\/\S+?)\s+SUPA_KEY=(\S+?)\s+node/);
  if (!m) throw new Error("no SUPA creds in .claude/settings.local.json");
  return { base: m[1].replace(/\/+$/, ""), key: m[2] };
}

async function rpc(creds, fn, args) {
  const res = await fetch(`${creds.base}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** All registry rows (builtin + discovered, any status). */
export async function listJobSites() {
  const creds = loadLocalCreds();
  const res = await fetch(`${creds.base}/rest/v1/job_sites?select=*&order=host.asc`, {
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
  });
  if (!res.ok) throw new Error(`job_sites read ${res.status}`);
  return res.json();
}

/** Insert/update a site (discovery + rule learning). Returns the row id. */
export async function upsertJobSite({ host, label, jobsUrl, source, rules, sessionOk }) {
  return rpc(loadLocalCreds(), "engine_upsert_job_site", {
    p_host: host, p_label: label, p_jobs_url: jobsUrl ?? null, p_source: source,
    p_rules: rules ?? null, p_session_ok: sessionOk ?? null,
  });
}

/** Record a run's outcome on a site (drives the UI's last-run column). */
export async function recordRun({ host, ok, collected, submitted, skipped, errors, notes }) {
  return rpc(loadLocalCreds(), "engine_record_job_site_run", {
    p_host: host, p_ok: ok, p_collected: collected ?? 0, p_submitted: submitted ?? 0,
    p_skipped: skipped ?? 0, p_errors: errors ?? 0, p_notes: notes ?? null,
  });
}

/** Merge learned selector rules into a site's rules blob. */
export async function setSiteRules(host, rules) {
  return rpc(loadLocalCreds(), "engine_set_job_site_rules", { p_host: host, p_rules: rules });
}

/** Queue a review-gate job the engine skipped in unattended mode (deduped). */
export async function queueJobReview({ siteHost, jobUrl, title, company, formUrl, reason, fit, formFields }) {
  return rpc(loadLocalCreds(), "engine_queue_job_review", {
    p_site_host: siteHost, p_job_url: jobUrl, p_title: title ?? null,
    p_company: company ?? null, p_form_url: formUrl ?? null, p_reason: reason ?? null,
    p_fit: fit ?? null, p_form_fields: formFields ?? null,
  });
}

/* ── form-answer memory: store every filled field for reuse ─────────── */

/** Upsert one field's answer (freshest wins). Fire-and-forget per field is
    fine — failures are non-fatal (memory is an optimization, never a gate). */
export async function putFormAnswer({ siteHost, fieldKey, answer, kind, label }) {
  return rpc(loadLocalCreds(), "engine_put_form_answer", {
    p_site_host: siteHost, p_field_key: fieldKey, p_answer: answer,
    p_kind: kind ?? null, p_label: label ?? null,
  });
}

/** The remembered (label → answer) map for one site. Empty map when the
    memory is unavailable — planFormAnswers falls back to draftAnswer only. */
export async function getFormAnswers(siteHost) {
  const rows = await rpc(loadLocalCreds(), "engine_get_form_answers", { p_site_host: siteHost });
  return Object.fromEntries((rows ?? []).map((r) => [r.field_key, r.answer]));
}

/* ── owner mode switch: off (kill switch) / local / cloud ───────────── */

/** The global apply_config row (array with one element; [] when unset). */
export async function getApplyConfig() {
  return rpc(loadLocalCreds(), "engine_get_apply_config", {});
}

/* ── judge exemplars (the judge's training set) ───────────────────── */

export async function getJudgeExemplars() {
  return rpc(loadLocalCreds(), "engine_get_judge_exemplars", {});
}

/* ── owner review verdicts: URLs the owner already resolved in the UI ── */

/** Latest resolved review status per job URL (done/dismissed/closed).
    The engine skips all of them — done/dismissed are owner decisions,
    closed means the posting no longer accepts applications. */
export async function listReviewedUrls() {
  return rpc(loadLocalCreds(), "engine_list_reviewed_urls", {});
}

/** True when a PENDING review row already exists for the URL — lets the
    engine ping the owner only when a row is NEW, not on every rerun. */
export async function hasPendingReview(jobUrl) {
  return rpc(loadLocalCreds(), "engine_has_pending_review", { p_job_url: jobUrl });
}

/** Resolve any pending review row for a URL (engine-side: a submission
    makes the ask obsolete). status: done | dismissed | closed. */
export async function resolveReviewByUrl(jobUrl, status) {
  return rpc(loadLocalCreds(), "engine_resolve_review_by_url", { p_job_url: jobUrl, p_status: status });
}

/** Weekly digest per board: engine decisions + owner resolutions, 7d. */
export async function applyWeeklyDigest() {
  return rpc(loadLocalCreds(), "admin_apply_weekly_digest", {});
}

/* ── learned skill strikes (owner feedback loop) ───────────────────── */

/** Skills the owner 👎-ed >= p_min times → hard-reject when a JD requires them. */
export async function getSkillStrikes(min = 2) {
  return rpc(loadLocalCreds(), "engine_get_skill_strikes", { p_min: min });
}

/* ── per-job run report (the UI's applications report) ───────────────── */

/** Push one per-job decision. Fire-and-forget from the engine: report
    failures must never break an apply run. */
export async function recordApplyResult({ siteHost, jobUrl, title, company, result, detail, fit }) {
  return rpc(loadLocalCreds(), "engine_record_apply_result", {
    p_site_host: siteHost, p_job_url: jobUrl, p_title: title ?? null,
    p_company: company ?? null, p_result: result, p_detail: detail ?? null,
    p_fit: fit ?? null,
  });
}

/** Pending review rows (the Telegram listener resolves them by ordinal). */
export async function listPendingReviews() {
  return rpc(loadLocalCreds(), "admin_list_job_reviews", {});
}

/** Resolve a review row (done/dismissed/closed) — the Telegram listener's write path. */
export async function resolveJobReview(id, status) {
  return rpc(loadLocalCreds(), "admin_resolve_job_review", { p_id: id, p_status: status });
}

/** Telegram notify config for pings: resolves the per-user ENTITLED row
    (platinum/addon, admin bypass included) via engine_notify_config();
    falls back to the legacy admin row when the RPC is missing. */
export async function getNotifyConfig() {
  const creds = loadLocalCreds();
  const res = await fetch(`${creds.base}/rest/v1/rpc/engine_notify_config`, {
    method: "POST",
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (res.ok) {
    const rows = await res.json();
    if (rows?.[0]) return rows[0];
  }
  const legacy = await fetch(`${creds.base}/rest/v1/notify_config?select=*&key=eq.telegram`, {
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
  });
  if (!legacy.ok) throw new Error(`notify_config read ${legacy.status}`);
  const rows2 = await legacy.json();
  return rows2[0] ?? null;
}
