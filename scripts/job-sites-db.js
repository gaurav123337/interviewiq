/* job-sites-db — tenant-scoped core data, with explicit legacy owner tooling.
   Paired mode never reads a service key or falls back to owner-global RPCs. */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { getApplyAgentRuntimeContext } from "./apply-agent-runtime.js";

const AGENT_CONTEXT = getApplyAgentRuntimeContext();
const PAIRED = AGENT_CONTEXT.mode === "paired";
const SETTINGS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".claude", "settings.local.json");

export function pairedOperationUnavailable(name) {
  const error = new Error(`${name} unavailable in paired mode (owner-global operation)`);
  error.code = "PAIRED_UNAVAILABLE";
  throw error;
}

const ACTIONS = new Set([
  "sites.list", "results.list", "results.record", "reviews.list", "reviews.queue",
  "reviews.resolve", "reviews.resolved", "reviews.unresolve", "reviews.has_pending",
  "reviews.reviewed_urls", "reviews.resolve_url", "variants.list", "variants.put",
  "variants.latest", "variants.approve", "memory.get", "memory.put", "memory.touch",
  "memory.stats", "strikes.list", "strikes.clear", "exemplars.list", "exemplars.put",
  "exemplars.delete", "feedback.put", "outcomes.record", "outcomes.stats",
  "outcomes.digest", "digest.weekly", "notify.get",
]);

/** No retry/fallback: revoked or unavailable authorization is always an error. */
export async function pairedAgentAction(action, args = {}) {
  if (!PAIRED) throw new Error("Paired agent context required");
  if (!ACTIONS.has(action)) pairedOperationUnavailable(action);
  let res;
  try {
    res = await fetch(AGENT_CONTEXT.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${AGENT_CONTEXT.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "agent.action", action, args }),
      signal: AbortSignal.timeout(30_000),
      redirect: "error", // never forward the bearer token through a redirect
    });
  } catch {
    const error = new Error(`paired ${action}: authorization unavailable`);
    error.code = "PAIRED_AUTH_UNAVAILABLE";
    throw error;
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.ok !== true || body.action !== action || !Object.hasOwn(body, "data")) {
    const error = new Error(`paired ${action} unavailable (HTTP ${res.status})`);
    error.code = res.status === 401 || res.status === 403 ? "PAIRED_AUTH_REJECTED" : "PAIRED_AUTH_UNAVAILABLE";
    throw error;
  }
  return body.data;
}

/** sites.list authenticates the binding and its current entitlement every time. */
export async function assertPairedEntitlement() {
  const rows = await pairedAgentAction("sites.list");
  if (!Array.isArray(rows)) {
    const error = new Error("paired catalog authorization unavailable");
    error.code = "PAIRED_AUTH_UNAVAILABLE";
    throw error;
  }
  return rows;
}

export function loadLocalCreds() {
  if (PAIRED) pairedOperationUnavailable("loadLocalCreds");
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

// Pin the verified rollout owner once; never infer ownership from browser/profile data.
let legacyUser;
async function coreAction(action, args = {}) {
  if (PAIRED) return pairedAgentAction(action, args);
  const creds = loadLocalCreds();
  legacyUser ??= rpc(creds, "apply_legacy_user_id", {}).then((id) => {
    if (typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("verified legacy apply owner unavailable");
    }
    return id;
  });
  return rpc(creds, "apply_agent_action", { p_user: await legacyUser, p_action: action, p_args: args });
}

/** Safe catalog in paired mode; legacy registry tooling can still see all rows. */
export async function listJobSites() {
  if (PAIRED) return assertPairedEntitlement();
  const creds = loadLocalCreds();
  const res = await fetch(`${creds.base}/rest/v1/job_sites?select=*&order=host.asc`, {
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
  });
  if (!res.ok) throw new Error(`job_sites read ${res.status}`);
  return res.json();
}

/* Core data uses the same owner-scoped action contract in BOTH modes. */
export async function listApplyResultsForHost(host, limit = 40) {
  return coreAction("results.list", { host, limit });
}
export async function recordApplyResult({ siteHost, jobUrl, title, company, result, detail, fit, ageH, eventId }) {
  return coreAction("results.record", { siteHost, jobUrl, title, company, result, detail, fit, ageH, eventId: eventId ?? randomUUID() });
}
export async function queueJobReview({ siteHost, jobUrl, title, company, formUrl, reason, fit, formFields, ageH }) {
  return coreAction("reviews.queue", { siteHost, jobUrl, title, company, formUrl, reason, fit, formFields, ageH });
}
export async function listPendingReviews() { return coreAction("reviews.list"); }
export async function resolveJobReview(id, status) { return coreAction("reviews.resolve", { id, status }); }
export async function listReviewedUrls() { return coreAction("reviews.reviewed_urls"); }
export async function hasPendingReview(jobUrl) { return coreAction("reviews.has_pending", { jobUrl }); }
export async function resolveReviewByUrl(jobUrl, status) { return coreAction("reviews.resolve_url", { jobUrl, status }); }
export async function putFormAnswer({ siteHost, fieldKey, answer, kind, label }) {
  return coreAction("memory.put", { siteHost, fieldKey, answer, kind, label });
}
export async function touchFormAnswers(siteHost, fieldKeys) {
  if (!Array.isArray(fieldKeys) || !fieldKeys.length) return;
  return coreAction("memory.touch", { siteHost, fieldKeys });
}
export async function getFormAnswers(siteHost) {
  const rows = await coreAction("memory.get", { siteHost });
  return Object.fromEntries((rows ?? []).map((r) => [r.field_key, r.answer]));
}
export async function putResumeVariant({ jobUrl, siteHost, title, company, masterText, variantText, diffSummary, variantId }) {
  return coreAction("variants.put", { jobUrl, siteHost, title, company, masterText, variantText, diffSummary, variantId });
}
export async function latestResumeVariant(jobUrl) { return coreAction("variants.latest", { jobUrl }); }
export async function recordApplyOutcome({ siteHost, jobUrl, fit, viewed, responseKind, detail }) {
  return coreAction("outcomes.record", { siteHost, jobUrl, fit, viewed: !!viewed, responseKind, detail });
}
export async function outcomeDigest() { return coreAction("outcomes.digest"); }
export async function outcomeStats() { return coreAction("outcomes.stats"); }
export async function getSkillStrikes(min = 2) {
  return (await coreAction("strikes.list", { min })).map(({ skill, strikes }) => ({ skill, strikes }));
}
export async function getSkillStrikesRaw() { return coreAction("strikes.list", { min: 1 }); }
export async function clearSkillStrikes(skills) { return coreAction("strikes.clear", { skills }); }
export async function getJudgeExemplars() { return coreAction("exemplars.list"); }
export async function putJudgeExemplar(kind, summary, reason, sourceUrl) {
  return coreAction("exemplars.put", { kind, summary, reason, sourceUrl });
}
export async function applyWeeklyDigest() { return coreAction("digest.weekly"); }
export async function getNotifyConfig() { return coreAction("notify.get"); }

/* Owner-global surfaces are deliberately unavailable to paired bindings. */
export async function activateProbationSites(days = 7, max = 3) {
  if (PAIRED) pairedOperationUnavailable("activateProbationSites");
  return rpc(loadLocalCreds(), "engine_activate_probation_sites", { p_days: days, p_max: max }) ?? [];
}
export async function upsertJobSite({ host, label, jobsUrl, source, rules, sessionOk }) {
  if (PAIRED) pairedOperationUnavailable("upsertJobSite");
  return rpc(loadLocalCreds(), "engine_upsert_job_site", {
    p_host: host, p_label: label, p_jobs_url: jobsUrl ?? null, p_source: source,
    p_rules: rules ?? null, p_session_ok: sessionOk ?? null,
  });
}
export async function recordRun({ host, ok, collected, submitted, skipped, errors, notes }) {
  if (PAIRED) pairedOperationUnavailable("recordRun");
  return rpc(loadLocalCreds(), "engine_record_job_site_run", {
    p_host: host, p_ok: ok, p_collected: collected ?? 0, p_submitted: submitted ?? 0,
    p_skipped: skipped ?? 0, p_errors: errors ?? 0, p_notes: notes ?? null,
  });
}
export async function setSiteRules(host, rules) {
  if (PAIRED) pairedOperationUnavailable("setSiteRules");
  return rpc(loadLocalCreds(), "engine_set_job_site_rules", { p_host: host, p_rules: rules });
}
export async function getApplyConfig() {
  if (PAIRED) pairedOperationUnavailable("getApplyConfig");
  return rpc(loadLocalCreds(), "engine_get_apply_config", {});
}
export async function engineGetApplyPolicy() {
  if (PAIRED) pairedOperationUnavailable("engineGetApplyPolicy");
  return rpc(loadLocalCreds(), "engine_get_apply_policy", {});
}
export async function suspendDeadBoards(minApplications = 10, maxSweeps = 3) {
  if (PAIRED) pairedOperationUnavailable("suspendDeadBoards");
  return rpc(loadLocalCreds(), "engine_suspend_dead_boards", { p_min_applications: minApplications, p_max_sweeps: maxSweeps });
}
export async function credentialForSite(host) {
  if (PAIRED) pairedOperationUnavailable("credentialForSite");
  const rows = await rpc(loadLocalCreds(), "engine_credential_for_site", { p_host: host });
  return rows?.[0] ?? null;
}
export async function engineUpdateCredentialLastVerified(host) {
  if (PAIRED) pairedOperationUnavailable("engineUpdateCredentialLastVerified");
  return rpc(loadLocalCreds(), "engine_update_credential_last_verified", { p_host: host });
}
export async function pendingLoginRequest() {
  if (PAIRED) pairedOperationUnavailable("pendingLoginRequest");
  const rows = await rpc(loadLocalCreds(), "engine_pending_login_request", {});
  return rows?.[0] ?? null;
}
export async function setSiteSession(host, ok) {
  if (PAIRED) pairedOperationUnavailable("setSiteSession");
  const creds = loadLocalCreds();
  const res = await fetch(`${creds.base}/rest/v1/job_sites?host=eq.${encodeURIComponent(host)}`, {
    method: "PATCH",
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ session_ok: !!ok }),
  });
  if (!res.ok) throw new Error(`session write ${res.status}`);
}
export async function fulfillLoginRequest(host) {
  if (PAIRED) pairedOperationUnavailable("fulfillLoginRequest");
  return rpc(loadLocalCreds(), "engine_fulfill_login_request", { p_host: host });
}
export async function setSiteSessionState(host, state) {
  if (PAIRED) pairedOperationUnavailable("setSiteSessionState");
  return rpc(loadLocalCreds(), "admin_set_site_session_state", { p_host: host, p_state: state });
}
export async function reportLoginStatus(host, status, detail) {
  if (PAIRED) pairedOperationUnavailable("reportLoginStatus");
  return rpc(loadLocalCreds(), "engine_report_login_status", { p_host: host, p_status: status, p_detail: detail ?? null });
}
export async function pendingRunRequest() {
  if (PAIRED) pairedOperationUnavailable("pendingRunRequest");
  const rows = await rpc(loadLocalCreds(), "engine_pending_run_request", {});
  return rows?.[0] ?? null;
}
export async function fulfillRunRequest() {
  if (PAIRED) pairedOperationUnavailable("fulfillRunRequest");
  return rpc(loadLocalCreds(), "engine_fulfill_run_request", {});
}
export async function reportRunStatus(status, detail) {
  if (PAIRED) pairedOperationUnavailable("reportRunStatus");
  return rpc(loadLocalCreds(), "engine_report_run_status", { p_status: status, p_detail: detail ?? null });
}
export async function reportEngineState(state, detail) {
  if (PAIRED) pairedOperationUnavailable("reportEngineState");
  return rpc(loadLocalCreds(), "engine_report_engine_state", { p_state: state, p_detail: detail ?? null });
}
export async function listenerHeartbeatFresh(maxAgeMs = 210_000) {
  if (PAIRED) pairedOperationUnavailable("listenerHeartbeatFresh");
  try {
    const evs = await listEngineEvents(1);
    const last = evs.filter((e) => e.state === "running" && String(e.detail ?? "").startsWith("listener")).at(-1);
    return !!last && Date.now() - new Date(last.created_at).getTime() <= maxAgeMs;
  } catch { return false; }
}
export async function watcherHeartbeatFresh(maxAgeMs = 15 * 60_000) {
  if (PAIRED) pairedOperationUnavailable("watcherHeartbeatFresh");
  try {
    const evs = await listEngineEvents(1);
    const last = evs.filter((e) => e.state === "running" && String(e.detail ?? "").startsWith("watcher")).at(-1);
    return !!last && Date.now() - new Date(last.created_at).getTime() <= maxAgeMs;
  } catch { return false; }
}
export async function listEngineEvents(hours = 168) {
  if (PAIRED) pairedOperationUnavailable("listEngineEvents");
  const creds = loadLocalCreds();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const res = await fetch(`${creds.base}/rest/v1/engine_events?select=state,detail,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc`, {
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
  });
  if (!res.ok) return [];
  return res.json();
}
