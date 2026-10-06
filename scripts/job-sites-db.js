/* job-sites-db — Supabase access for the apply engine's site registry.
   Uses the service key from .claude/settings.local.json (owner machine,
   gitignored) via the same parse as ai-config.js — CI never has it, and CI
   doesn't run the local engine anyway. All writes go through the engine_*
   RPCs (service-role gated server-side). */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ABSOLUTE path: supervisor processes (relay shim, watchdogs) run from the
   task scheduler with an arbitrary cwd (often system32) — a relative read
   would throw there and silently fail every apply-mode gate. */
const SETTINGS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".claude", "settings.local.json");

export function loadLocalCreds() {
  const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
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

/** The credential bound to a site (secret included) — engine auto-login. */
export async function credentialForSite(host) {
  const rows = await rpc(loadLocalCreds(), "engine_credential_for_site", { p_host: host });
  return rows?.[0] ?? null;
}

/** App → desktop bridge: the listener's pending 🔑 Sign-in request (if any). */
export async function pendingLoginRequest() {
  const rows = await rpc(loadLocalCreds(), "engine_pending_login_request", {});
  return rows?.[0] ?? null;
}

/** Persist the verified session state after a login-only run (app reflects it). */
export async function setSiteSession(host, ok) {
  const creds = loadLocalCreds();
  const res = await fetch(`${creds.base}/rest/v1/job_sites?host=eq.${encodeURIComponent(host)}`, {
    method: "PATCH",
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ session_ok: !!ok }),
  });
  if (!res.ok) throw new Error(`session write ${res.status}`);
}

/** Mark a sign-in request handled (the listener spawned the login window). */
export async function fulfillLoginRequest(host) {
  return rpc(loadLocalCreds(), "engine_fulfill_login_request", { p_host: host });
}

/** --sessions watchdog verdict (verified / expired / unknown) → the app's
    three-state strip. The RPC stamps session_checked_at + flips session_ok. */
export async function setSiteSessionState(host, state) {
  return rpc(loadLocalCreds(), "admin_set_site_session_state", { p_host: host, p_state: state });
}

/** Report a sign-in lifecycle transition (opened / crashed / verified /
    failed) so the APP can show the owner what the sign-in is doing live
    instead of going dark after the 🔑 click. */
export async function reportLoginStatus(host, status, detail) {
  return rpc(loadLocalCreds(), "engine_report_login_status", {
    p_host: host, p_status: status, p_detail: detail ?? null,
  });
}

/* ⚡ Run-now bridge: the app queues a request; the listener polls it and
   spawns --all. Same shape as the sign-in bridge. */
export async function pendingRunRequest() {
  const rows = await rpc(loadLocalCreds(), "engine_pending_run_request", {});
  return rows?.[0] ?? null;
}

export async function fulfillRunRequest() {
  return rpc(loadLocalCreds(), "engine_fulfill_run_request", {});
}

export async function reportRunStatus(status, detail) {
  return rpc(loadLocalCreds(), "engine_report_run_status", {
    p_status: status, p_detail: detail ?? null,
  });
}

/* 🫀 Engine heartbeat: the listener beats every ~2 min while it is alive and
   reports "stopped" when the owner's Off switch kills it — the app turns
   this into a live 🟢 running / 🔴 stopped badge (staleness counts as
   stopped, so a crashed listener can never look alive). */
export async function reportEngineState(state, detail) {
  return rpc(loadLocalCreds(), "engine_report_engine_state", {
    p_state: state, p_detail: detail ?? null,
  });
}

/** Independent listener-liveness signal for SUPERVISORS: the listener beats
    engine_events every ~2 min over the NETWORK, while wmic AND Get-CimInstance
    both run on the same WMI stack — which transiently returns EMPTY under
    process-spawn load (that false "listener was down" spawned duplicate
    listeners twice on 2026-10-06). A fresh beat proves the listener is up
    no matter what process listing claims. Detail-prefixed "listener" so the
    WATCHER's beats ("watcher …") can never mask a dead listener. Unreadable
    → false (supervisors fall through to the rescue-spawn path, the
    pre-existing direction). */
export async function listenerHeartbeatFresh(maxAgeMs = 210_000) {
  try {
    const evs = await listEngineEvents(1);
    const last = evs.filter((e) => e.state === "running" && String(e.detail ?? "").startsWith("listener")).at(-1);
    if (!last) return false;
    return Date.now() - new Date(last.created_at).getTime() <= maxAgeMs;
  } catch { return false; }
}

/** Same idea for the WATCHER supervisor (ensure-apply-watcher): the watcher
    beats with a "watcher …" detail at cycle boundaries AND per site (a site
    child may legitimately run 12 min, hence the 15-min freshness window). */
export async function watcherHeartbeatFresh(maxAgeMs = 15 * 60_000) {
  try {
    const evs = await listEngineEvents(1);
    const last = evs.filter((e) => e.state === "running" && String(e.detail ?? "").startsWith("watcher")).at(-1);
    if (!last) return false;
    return Date.now() - new Date(last.created_at).getTime() <= maxAgeMs;
  } catch { return false; }
}

/** Raw heartbeat history (beats + stop reports), ASC — the weekly digest's
    uptime line reads this directly with the service key (the admin RPC caps
    at 72h; the engine may read the full retention window). */
export async function listEngineEvents(hours = 168) {
  const creds = loadLocalCreds();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const res = await fetch(`${creds.base}/rest/v1/engine_events?select=state,detail,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc`, {
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
  });
  if (!res.ok) return [];
  return res.json();
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
