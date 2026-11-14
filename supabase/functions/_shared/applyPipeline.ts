/* Autonomous apply contracts and boundary validation. Candidate facts and saved
   answers are user-confirmed only; this module deliberately has no AI/network IO. */
import { containsAuthoritativeUserId, type JsonValue } from "./applyAgent.ts";

export const PIPELINE_BROWSER_ACTIONS = [
  "profile.get", "profile.confirm", "settings.get", "settings.put", "answers.list",
  "answers.revoke", "questions.list", "questions.answer", "boards.list", "boards.add",
  "run.request", "run.list", "run.cancel", "tasks.list", "agent.list", "sessions.list",
  "commands.request",
] as const;
export const PIPELINE_AGENT_ACTIONS = [
  "profile.get", "settings.get", "answers.list", "questions.queue", "boards.list", "boards.discover",
  "jobs.list", "jobs.ingest", "tasks.claim", "tasks.renew", "tasks.report",
  "submission.reserve", "submission.finish", "agent.heartbeat", "sessions.report",
  "commands.claim", "commands.report",
] as const;
export type PipelineBrowserAction = typeof PIPELINE_BROWSER_ACTIONS[number];
export type PipelineAgentAction = typeof PIPELINE_AGENT_ACTIONS[number];
export type PipelineAction = PipelineBrowserAction | PipelineAgentAction;
export type FactValue = string | number | boolean | string[];
export type AnswerScope = "global" | "country" | "employer" | "portal" | "application";
export interface FactScope { country?: string; employer?: string; portal?: string; application?: string }
export interface VerifiedFact {
  value: FactValue;
  source: "user";
  confirmedAt: string;
  scope?: FactScope;
  validUntil?: string;
}
export interface VerifiedProfile {
  revision: number;
  facts: Record<string, VerifiedFact>;
  resume_text: string;
  resume_approved: boolean;
  answers_revision: number;
}
export interface PipelineSettings {
  enabled: boolean;
  autoSubmit: boolean;
  threshold: number;
  dailyCap: number;
  weeklyCap: number;
  employerDailyCap: number;
  timeZone: string;
  roles: string[];
  locations: string[];
  countries: string[];
  excludeCompanies: string[];
  minimumSalary?: { value: number; currency: string; period: "year" | "month" | "hour" };
  requireWorkAuthorization: boolean;
  allowSponsorship: boolean;
  maxAgeDays: number;
  aiConsent: boolean;
  quietFrom?: string;
  quietTo?: string;
}
export const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
  enabled: false, autoSubmit: false, threshold: 60, dailyCap: 10, weeklyCap: 50,
  employerDailyCap: 2, timeZone: "UTC", roles: [], locations: [], countries: [],
  excludeCompanies: [], requireWorkAuthorization: false, allowSponsorship: true, maxAgeDays: 14, aiConsent: false,
};
export interface PipelineJob {
  jobUrl: string;
  title: string;
  company: string;
  description: string;
  skills: string[];
  location: string;
  country?: string;
  postedAt?: string;
  source?: string;
  externalId?: string;
  remote?: boolean;
  portal?: string;
  salary?: { min?: number; max?: number; currency: string; period: "year" | "month" | "hour" };
}
export interface PipelineRun {
  id: string; binding_id: string; mode: "review" | "auto";
  status: "queued" | "running" | "completed" | "cancelled";
  profile_revision: number; settings_revision: number; answers_revision: number;
  candidate_count: number; task_count: number;
  created_at: string; started_at: string | null; finished_at: string | null;
}
export interface PipelineQuestionRow {
  id: string; question_key: string; meaning: string; question_text: string;
  control_type: PipelineQuestion["controlType"]; options: string[]; context: FactScope & { currency?: string };
  scope: AnswerScope; scope_key: string; currency: string | null; reason: string | null;
  profile_revision: number; status: "pending" | "answered" | "dismissed";
  answer_id: string | null; task_ids: string[]; created_at: string; updated_at: string;
}
export interface PipelineBoard {
  id: string; url: string; host: string; label: string; type: "manual" | "greenhouse" | "lever" | "ashby" | "workday";
  status: "pending" | "disabled" | "dead"; created_at: string; updated_at: string;
}
export interface PipelineAgent {
  binding_id: string; label: string; engine_version: string | null; capabilities: string[];
  status: "ready" | "paused" | "offline" | null; profile_metadata: { revision?: number; resumeApproved?: boolean };
  heartbeat_at: string | null; revoked_at: string | null; last_used_at: string | null;
}
export interface PipelineSession {
  binding_id: string; portal: string; status: "authenticated" | "expired" | "login_required" | "unsupported";
  account_label: string | null; checked_at: string;
}
export type PipelineCommandType = "pause" | "resume" | "retry_login" | "open_question" | "check_session";
export interface PipelineCommand {
  id: string; binding_id: string; type: PipelineCommandType; args: { portal?: string; questionId?: string };
  task_id: string | null; claim_nonce: string | null;
  job?: PipelineJob; question?: PipelineQuestionRow; // Server-derived, never accepted in command requests.
  status: "queued" | "claimed" | "done" | "failed" | "cancelled"; reason: string | null;
  created_at: string; claimed_at: string | null; finished_at: string | null;
}
export interface PipelineSettingsRow { revision: number; data: PipelineSettings; updated_at: string }
export type PipelineTaskStatus = "queued" | "in_progress" | "submitting" | "waiting_answer"
  | "waiting_login" | "waiting_review" | "unsupported" | "submitted" | "unverified"
  | "failed" | "cancelled" | "filtered";
export interface PipelineTask {
  id: string;
  run_id: string;
  target_binding_id: string;
  job: PipelineJob;
  status: PipelineTaskStatus;
  lease_version: number;
  lease_until: string | null;
  lease_nonce: string | null;
  profile_revision: number;
  settings_revision: number;
  answers_revision: number;
  score: number;
  reason: string | null;
}
export interface PipelineQuestion {
  meaning: string;
  questionText: string;
  controlType: "text" | "textarea" | "select" | "radio" | "checkbox" | "number" | "date" | "email" | "tel" | "url";
  options: string[];
  context: FactScope & { currency?: string };
  scope?: AnswerScope;
  scopeKey?: string;
  questionKey?: string;
  currency?: string;
  reason?: string;
  profileRevision?: number;
}
export interface VerifiedAnswer {
  id: string;
  meaning: string;
  question_text: string;
  control_type: PipelineQuestion["controlType"];
  options: string[];
  context: FactScope;
  answer: string;
  scope: AnswerScope;
  scope_key: string;
  profile_revision: number;
  confirmed_at: string;
  expires_at: string | null;
  provenance: "user";
  revoked_at: string | null;
}
export interface LeaseArgs { taskId: string; leaseVersion: number; leaseNonce: string }
export interface SubmissionEvidence { kind: "confirmation_page" | "receipt"; text: string; url?: string }
export interface SubmissionReservation {
  id: string;
  task_id: string;
  nonce: string;
  status: "reserved" | "submitted" | "unverified" | "failed";
}
export interface PipelineActionArgs {
  "profile.get": Record<string, never>;
  "profile.confirm": { expectedRevision: number | null; facts: Record<string, Omit<VerifiedFact, "confirmedAt"> & { confirmedAt?: string }>; resumeText: string; resumeApproved: boolean };
  "settings.get": Record<string, never>;
  "settings.put": { expectedRevision: number | null; settings: PipelineSettings };
  "answers.list": { limit?: number; includeRevoked?: boolean };
  "answers.revoke": { answerId: string };
  "questions.list": { limit?: number; status?: "pending" | "answered" | "dismissed" };
  "questions.answer": { questionId: string; answer: string; scope: AnswerScope; scopeKey?: string; expiresAt?: string; confirm: true };
  "questions.queue": LeaseArgs & { question: PipelineQuestion };
  "boards.list": { limit?: number };
  "boards.add": { url: string; label?: string; type?: "manual" | "greenhouse" | "lever" | "ashby" | "workday" };
  "boards.discover": { url: string; label?: string; type?: "manual" | "greenhouse" | "lever" | "ashby" | "workday" };
  "run.request": { bindingId: string; limit?: number; mode?: "review" | "auto" };
  "run.list": { limit?: number };
  "run.cancel": { runId: string };
  "tasks.list": { runId?: string; limit?: number };
  "jobs.list": { offset?: number; limit?: number };
  "jobs.ingest": { boardId: string; jobs: PipelineJob[] };
  "tasks.claim": { limit?: number; leaseSeconds?: number };
  "tasks.renew": LeaseArgs & { leaseSeconds?: number };
  "tasks.report": LeaseArgs & { status: "waiting_answer" | "waiting_login" | "waiting_review" | "unsupported" | "failed" | "filtered" | "unverified"; reason?: string; evidence?: SubmissionEvidence };
  "submission.reserve": LeaseArgs & { profileRevision: number; settingsRevision: number; answersRevision: number; siteAllowed: true; accountVerified: true; requiredComplete: true; answerIds: string[]; idempotencyKey: string };
  "submission.finish": LeaseArgs & { reservationId: string; reservationNonce: string; outcome: "submitted" | "unverified" | "failed"; evidence?: SubmissionEvidence };
  "agent.list": { limit?: number };
  "agent.heartbeat": { engineVersion: string; capabilities: string[]; status: "ready" | "paused" | "offline"; profileMetadata?: { revision?: number; resumeApproved?: boolean } };
  "sessions.list": { limit?: number };
  "sessions.report": { portal: string; status: "authenticated" | "expired" | "login_required" | "unsupported"; accountLabel?: string };
  "commands.request": { bindingId: string; type: PipelineCommandType; args?: { portal?: string; questionId?: string } };
  "commands.claim": { limit?: number };
  "commands.report": { commandId: string; claimNonce: string; status: "done" | "failed"; reason?: string };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const BROWSER = new Set<string>(PIPELINE_BROWSER_ACTIONS);
const AGENT = new Set<string>(PIPELINE_AGENT_ACTIONS);
const SCOPES = ["global", "country", "employer", "portal", "application"];
const CONTROLS = ["text", "textarea", "select", "radio", "checkbox", "number", "date", "email", "tel", "url"];
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === "object" && !Array.isArray(v); }
function text(v: unknown, max = 500, min = 1): v is string { return typeof v === "string" && v.length >= min && v.length <= max && !v.includes("\u0000"); }
function integer(v: unknown, min: number, max: number): boolean { return Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max; }
function uuid(v: unknown): boolean { return typeof v === "string" && UUID.test(v); }
function timestamp(v: unknown): boolean { return typeof v === "string" && ISO.test(v) && Number.isFinite(Date.parse(v)); }
function strings(v: unknown, maxItems = 100, maxLength = 200): v is string[] {
  return Array.isArray(v) && v.length <= maxItems && v.every(s => text(s, maxLength));
}
function keys(v: Record<string, unknown>, allowed: string[]): boolean { return Object.keys(v).every(k => allowed.includes(k)); }
function optional(v: unknown, check: (v: unknown) => boolean): boolean { return v === undefined || check(v); }
function scope(v: unknown): boolean {
  return object(v) && keys(v, ["country", "employer", "portal", "application"]) && Object.values(v).every(x => text(x, 500));
}
/** HTTPS-only public targets. SQL repeats this boundary before persisting URLs. */
export function isPublicPipelineUrl(value: unknown): boolean {
  if (!text(value, 2048)) return false;
  try {
    if (value !== value.trim() || /[\u0000-\u0020\u007f\\]/.test(value)) return false;
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && !host.endsWith(".") && (!url.port || url.port === "443")
      && !/%2f|%5c|%25|%00/i.test(url.pathname)
      && ![...url.searchParams].some(([k, v]) => /^(?:url|redirect|redirect_uri|redirecturl|next|return|returnurl|continue|callback)$/i.test(k) || /^(?:https?:|javascript:|data:|\/\/)/i.test(v))
      && host.includes(".") && !host.includes(":") && !/^[\d.]+$/.test(host)
      && !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host);
  } catch { return false; }
}
function facts(v: unknown): boolean {
  if (!object(v) || Object.keys(v).length > 100) return false;
  return Object.entries(v).every(([key, fact]) =>     (/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(key) || /^skillYears:[a-z0-9+#. /-]{1,80}$/.test(key)
      || /^(portalProfileApproved|portalAccountIdentity|portalResumeText):[a-z][a-z0-9_-]{0,39}$/.test(key)) && object(fact)
    && (!key.startsWith("skillYears:") || typeof fact.value === "number" && Number.isFinite(fact.value) && fact.value >= 0 && fact.value <= 100)
    && (!key.startsWith("portal") || !key.includes(":") || object(fact.scope) && text(fact.scope.portal, 500)
      && (key.startsWith("portalProfileApproved:") ? typeof fact.value === "boolean" : text(fact.value, key.startsWith("portalResumeText:") ? 12000 : 500)))
    && keys(fact, ["value", "source", "confirmedAt", "scope", "validUntil"])
    && fact.source === "user" && (text(fact.value, key.startsWith("portalResumeText:") ? 12000 : 10000, 0) || typeof fact.value === "boolean"
      || typeof fact.value === "number" && Number.isFinite(fact.value) || strings(fact.value))
    && optional(fact.confirmedAt, timestamp) && optional(fact.validUntil, timestamp) && optional(fact.scope, scope));
}
export function isPipelineSettings(v: unknown): v is PipelineSettings {
  if (!object(v) || !keys(v, Object.keys(DEFAULT_PIPELINE_SETTINGS).concat("quietFrom", "quietTo", "minimumSalary"))) return false;
  const quiet = (x: unknown) => typeof x === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
  let timeZone = false;
  if (text(v.timeZone, 100)) { try { new Intl.DateTimeFormat("en", { timeZone: v.timeZone }); timeZone = true; } catch { /* fail closed */ } }
  return typeof v.enabled === "boolean" && typeof v.autoSubmit === "boolean" && typeof v.aiConsent === "boolean"
    && typeof v.requireWorkAuthorization === "boolean" && typeof v.allowSponsorship === "boolean"
    && optional(v.minimumSalary, salary)
    && integer(v.threshold, 0, 100) && integer(v.dailyCap, 0, 100) && integer(v.weeklyCap, 0, 500)
    && integer(v.employerDailyCap, 0, 20) && integer(v.maxAgeDays, 1, 90) && timeZone
    && strings(v.roles, 30) && strings(v.locations, 30) && strings(v.countries, 100) && strings(v.excludeCompanies, 100)
    && optional(v.quietFrom, quiet) && optional(v.quietTo, quiet)
    && (v.quietFrom === undefined) === (v.quietTo === undefined);
}
function salary(v: unknown): boolean {
  return object(v) && keys(v, ["value", "currency", "period"]) && typeof v.value === "number" && Number.isFinite(v.value)
    && v.value >= 0 && v.value <= 1000000000 && typeof v.currency === "string" && /^[A-Z]{3}$/.test(v.currency)
    && ["year", "month", "hour"].includes(v.period as string);
}
function jobSalary(v: unknown): boolean {
  return object(v) && keys(v, ["min", "max", "currency", "period"]) && (v.min !== undefined || v.max !== undefined)
    && optional(v.min, x => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1000000000)
    && optional(v.max, x => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1000000000)
    && (v.min === undefined || v.max === undefined || (v.min as number) <= (v.max as number))
    && typeof v.currency === "string" && /^[A-Z]{3}$/.test(v.currency) && ["year", "month", "hour"].includes(v.period as string);
}
function question(v: unknown): boolean {
  return object(v) && keys(v, ["meaning", "questionText", "controlType", "options", "context", "scope", "scopeKey", "questionKey", "currency", "reason", "profileRevision"])
    && text(v.meaning, 200) && text(v.questionText, 2000) && CONTROLS.includes(v.controlType as string)
    && strings(v.options, 100, 500) && object(v.context)
    && keys(v.context, ["country", "employer", "portal", "application", "currency"]) && Object.values(v.context).every(x => text(x, 500))
    && optional(v.scope, x => SCOPES.includes(x as string)) && optional(v.scopeKey, x => text(x, 500, 0))
    && (v.scope === undefined || v.scope === "global" || text(v.scopeKey, 500))
    && optional(v.questionKey, x => text(x, 2000)) && optional(v.currency, x => text(x, 10))
    && optional(v.reason, x => text(x, 1000)) && optional(v.profileRevision, x => integer(x, 1, 2147483647))
    && (!["select", "radio"].includes(v.controlType as string) || (v.options as string[]).length > 0);
}
function job(v: unknown): boolean {
  return object(v) && keys(v, ["jobUrl", "title", "company", "description", "skills", "location", "country", "postedAt", "source", "externalId", "remote", "portal", "salary"])
    && isPublicPipelineUrl(v.jobUrl) && text(v.title, 500) && text(v.company, 500) && text(v.description, 50000, 0)
    && strings(v.skills, 100) && text(v.location, 500, 0) && optional(v.country, x => text(x, 100))
    && optional(v.postedAt, timestamp) && optional(v.source, x => text(x, 100)) && optional(v.externalId, x => text(x, 500))
    && optional(v.portal, x => text(x, 200)) && optional(v.remote, x => typeof x === "boolean") && optional(v.salary, jobSalary);
}
function evidence(v: unknown): boolean {
  return object(v) && keys(v, ["kind", "text", "url"]) && ["confirmation_page", "receipt"].includes(v.kind as string)
    && text(v.text, 4000) && optional(v.url, isPublicPipelineUrl);
}
const LEASE_KEYS = ["taskId", "leaseVersion", "leaseNonce"];
function lease(a: Record<string, unknown>): boolean { return uuid(a.taskId) && integer(a.leaseVersion, 1, 2147483647) && uuid(a.leaseNonce); }
const LIMIT_ACTIONS = new Set(["boards.list", "run.list", "agent.list", "sessions.list", "commands.claim"]);
export type PipelineValidation = { ok: true; action: PipelineAction; args: Record<string, JsonValue> }
  | { ok: false; error: "unsupported_action" | "invalid_args" | "authoritative_user_forbidden" };
export function validatePipelineActionRequest(value: unknown, caller: "browser" | "agent" = "agent"): PipelineValidation {
  if (!object(value)) return { ok: false, error: "invalid_args" };
  const SECRET_KEYS = new Set(["token", "tokenhash", "cookie", "cookies", "password", "secret", "authorization", "servicerolekey"]);
  const pending: unknown[] = [value];
  while (pending.length) {
    const current = pending.pop();
    if (Array.isArray(current)) pending.push(...current);
    else if (object(current)) for (const [key, item] of Object.entries(current)) {
      if (SECRET_KEYS.has(key.toLowerCase().replace(/[^a-z]/g, ""))) return { ok: false, error: "invalid_args" };
      if (typeof item === "object") pending.push(item);
    }
  }
  if (containsAuthoritativeUserId(value)) return { ok: false, error: "authoritative_user_forbidden" };
  if (typeof value.action !== "string" || !(caller === "browser" ? BROWSER : AGENT).has(value.action)) return { ok: false, error: "unsupported_action" };
  if (!keys(value, ["operation", "action", "args"]) || !object(value.args ?? {})) return { ok: false, error: "invalid_args" };
  const a = (value.args ?? {}) as Record<string, unknown>;
  const action = value.action as PipelineAction;
  const listLimit = (max = 200) => optional(a.limit, x => integer(x, 1, max));
  let valid = false;
  if (["profile.get", "settings.get"].includes(action)) valid = keys(a, []);
  else if (LIMIT_ACTIONS.has(action)) valid = keys(a, ["limit"]) && listLimit(action === "commands.claim" ? 20 : 200);
  else switch (action) {
    case "profile.confirm": valid = keys(a, ["expectedRevision", "facts", "resumeText", "resumeApproved"])
      && (a.expectedRevision === null || integer(a.expectedRevision, 1, 2147483647)) && facts(a.facts)
      && text(a.resumeText, 12000, 0) && typeof a.resumeApproved === "boolean"; break;
    case "settings.put": valid = keys(a, ["expectedRevision", "settings"]) && (a.expectedRevision === null || integer(a.expectedRevision, 1, 2147483647)) && isPipelineSettings(a.settings); break;
    case "answers.list": valid = keys(a, ["limit", "includeRevoked"]) && listLimit() && optional(a.includeRevoked, x => typeof x === "boolean") && (caller === "browser" || a.includeRevoked !== true); break;
    case "answers.revoke": valid = keys(a, ["answerId"]) && uuid(a.answerId); break;
    case "questions.list": valid = keys(a, ["limit", "status"]) && listLimit() && optional(a.status, x => ["pending", "answered", "dismissed"].includes(x as string)); break;
    case "questions.answer": valid = keys(a, ["questionId", "answer", "scope", "scopeKey", "expiresAt", "confirm"])
      && uuid(a.questionId) && text(a.answer, 12000) && SCOPES.includes(a.scope as string) && a.confirm === true
      && (a.scope === "global" ? a.scopeKey === undefined || a.scopeKey === "" : text(a.scopeKey, 500)) && optional(a.expiresAt, timestamp); break;
    case "questions.queue": valid = keys(a, [...LEASE_KEYS, "question"]) && lease(a) && question(a.question); break;
    case "boards.discover":
    case "boards.add": valid = keys(a, ["url", "label", "type"]) && isPublicPipelineUrl(a.url)
      && optional(a.label, x => text(x, 200)) && optional(a.type, x => ["manual", "greenhouse", "lever", "ashby", "workday"].includes(x as string)); break;
    case "run.request": valid = keys(a, ["bindingId", "limit", "mode"]) && uuid(a.bindingId) && listLimit(100) && optional(a.mode, x => x === "review" || x === "auto"); break;
    case "run.cancel": valid = keys(a, ["runId"]) && uuid(a.runId); break;
    case "tasks.list": valid = keys(a, ["runId", "limit"]) && optional(a.runId, uuid) && listLimit(); break;
    case "jobs.list": valid = keys(a, ["offset", "limit"]) && optional(a.offset, x => integer(x, 0, 100000)) && listLimit(); break;
    case "jobs.ingest": valid = keys(a, ["boardId", "jobs"]) && uuid(a.boardId) && Array.isArray(a.jobs) && a.jobs.length <= 100 && a.jobs.every(job); break;
    case "tasks.claim": valid = keys(a, ["limit", "leaseSeconds"]) && listLimit(10) && optional(a.leaseSeconds, x => integer(x, 30, 300)); break;
    case "tasks.renew": valid = keys(a, [...LEASE_KEYS, "leaseSeconds"]) && lease(a) && optional(a.leaseSeconds, x => integer(x, 30, 300)); break;
    case "tasks.report": valid = keys(a, [...LEASE_KEYS, "status", "reason", "evidence"]) && lease(a)
      && ["waiting_answer", "waiting_login", "waiting_review", "unsupported", "failed", "filtered", "unverified"].includes(a.status as string)
      && optional(a.reason, x => text(x, 2000)) && optional(a.evidence, evidence); break;
    case "submission.reserve": valid = keys(a, [...LEASE_KEYS, "profileRevision", "settingsRevision", "answersRevision", "siteAllowed", "accountVerified", "requiredComplete", "answerIds", "idempotencyKey"])
      && lease(a) && integer(a.profileRevision, 1, 2147483647) && integer(a.settingsRevision, 1, 2147483647)
      && integer(a.answersRevision, 0, 2147483647) && a.siteAllowed === true && a.accountVerified === true && a.requiredComplete === true
      && Array.isArray(a.answerIds) && a.answerIds.length <= 100 && a.answerIds.every(uuid) && text(a.idempotencyKey, 200); break;
    case "submission.finish": valid = keys(a, [...LEASE_KEYS, "reservationId", "reservationNonce", "outcome", "evidence"])
      && lease(a) && uuid(a.reservationId) && uuid(a.reservationNonce) && ["submitted", "unverified", "failed"].includes(a.outcome as string)
      && optional(a.evidence, evidence) && (a.outcome !== "submitted" || evidence(a.evidence)); break;
    case "agent.heartbeat": valid = keys(a, ["engineVersion", "capabilities", "status", "profileMetadata"]) && text(a.engineVersion, 100)
      && strings(a.capabilities, 50, 100) && ["ready", "paused", "offline"].includes(a.status as string)
      && optional(a.profileMetadata, x => object(x) && keys(x, ["revision", "resumeApproved"])
        && optional(x.revision, n => integer(n, 0, 2147483647)) && optional(x.resumeApproved, n => typeof n === "boolean")); break;
    case "sessions.report": valid = keys(a, ["portal", "status", "accountLabel"]) && text(a.portal, 200)
      && ["authenticated", "expired", "login_required", "unsupported"].includes(a.status as string) && optional(a.accountLabel, x => text(x, 200)); break;
    case "commands.request": {
      const commandArgs = a.args === undefined ? {} : a.args;
      valid = keys(a, ["bindingId", "type", "args"]) && uuid(a.bindingId) && object(commandArgs)
        && (["pause", "resume"].includes(a.type as string) ? keys(commandArgs, [])
          : ["retry_login", "check_session"].includes(a.type as string) ? keys(commandArgs, ["portal"]) && text(commandArgs.portal, 200) && !!commandArgs.portal.trim()
          : a.type === "open_question" && keys(commandArgs, ["questionId"]) && uuid(commandArgs.questionId));
      break;
    }
    case "commands.report": valid = keys(a, ["commandId", "claimNonce", "status", "reason"]) && uuid(a.commandId) && uuid(a.claimNonce)
      && ["done", "failed"].includes(a.status as string) && optional(a.reason, x => text(x, 2000)); break;
  }
  return valid ? { ok: true, action, args: a as Record<string, JsonValue> } : { ok: false, error: "invalid_args" };
}

/** Conservative deterministic matching mirrored by apply_pipeline_match in SQL.
    Resume prose and inferred candidate facts never contribute to this score. */
export function matchPipelineJob(profile: Pick<VerifiedProfile, "facts">, settings: PipelineSettings, job: PipelineJob, now = Date.now()): { score: number; reason: string | null } {
  const norm = (s: string) => s.trim().toLowerCase();
  if (!isPublicPipelineUrl(job.jobUrl)) return { score: 0, reason: "invalid_job_url" };
  if (settings.excludeCompanies.some(x => norm(x) === norm(job.company))) return { score: 0, reason: "excluded_company" };
  const validFact = (fact: VerifiedFact | undefined) => fact?.source === "user" && Number.isFinite(Date.parse(fact.confirmedAt)) && Date.parse(fact.confirmedAt) <= now
    && (!fact.validUntil || Date.parse(fact.validUntil) > now);
  const role = profile.facts.role;
  const locations = profile.facts.locations;
  const wantedRoles = settings.roles.length ? settings.roles : validFact(role) && !role.scope && typeof role.value === "string" ? [role.value] : [];
  const wantedLocations = settings.locations.length ? settings.locations : validFact(locations) && !locations.scope && Array.isArray(locations.value) ? locations.value : [];
  if (!wantedRoles.length) return { score: 0, reason: "confirmed_role_required" };
  if (!wantedRoles.some(x => norm(job.title).includes(norm(x)))) return { score: 0, reason: "role_filter" };
  if (!wantedLocations.length) return { score: 0, reason: "confirmed_locations_required" };
  if (!wantedLocations.some(x => norm(job.location).includes(norm(x)) || job.remote === true && norm(x) === "remote")) return { score: 0, reason: "location_filter" };
  if (settings.countries.length && !settings.countries.some(x => norm(x) === norm(job.country ?? ""))) return { score: 0, reason: "country_filter" };
  if (settings.minimumSalary && (!job.salary || job.salary.currency !== settings.minimumSalary.currency || job.salary.period !== settings.minimumSalary.period || (job.salary.max ?? job.salary.min ?? -1) < settings.minimumSalary.value)) return { score: 0, reason: "salary_unknown_or_below_minimum" };
  const countryFact = (name: string) => {
    const fact = profile.facts[name];
    return validFact(fact) && job.country && norm(fact.scope?.country ?? "") === norm(job.country) ? fact : undefined;
  };
  if (settings.requireWorkAuthorization && countryFact("workAuthorization")?.value !== true) return { score: 0, reason: "work_authorization_unconfirmed" };
  if (!settings.allowSponsorship && countryFact("requiresSponsorship")?.value !== false) return { score: 0, reason: "sponsorship_unconfirmed_or_required" };
  const posted = job.postedAt ? Date.parse(job.postedAt) : NaN;
  if (!Number.isFinite(posted) || posted > now + 86400000 || posted < now - settings.maxAgeDays * 86400000) return { score: 0, reason: "posting_age_unknown_or_stale" };
  const fact = profile.facts.skills;
  const verified = validFact(fact) && !fact.scope;
  const skills = new Set(verified && Array.isArray(fact.value) ? fact.value.map(norm).filter(Boolean) : []);
  const required = [...new Set(job.skills.map(norm).filter(Boolean))];
  if (!skills.size || !required.length) return { score: 0, reason: "confirmed_skills_required" };
  const score = Math.floor(100 * required.filter(x => skills.has(x)).length / required.length);
  return { score, reason: score < settings.threshold ? "below_threshold" : null };
}
