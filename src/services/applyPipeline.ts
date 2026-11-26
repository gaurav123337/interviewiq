/* Browser control plane only: auth.uid() owns every row. No fallback to the
   legacy owner RPC, local resume cache, binding tokens or inferred answers. */
import { getCloudState, getSupabaseClient, subscribeCloud } from "./cloud";
import { extractContacts } from "./autoApply";

export type AnswerScope = "global" | "country" | "employer" | "portal" | "application";
export interface FactScope { country?: string; employer?: string; portal?: string; application?: string }
export interface VerifiedFact { value: string | number | boolean | string[]; source: "user"; confirmedAt: string; scope?: FactScope; validUntil?: string }
export interface PipelineProfile { revision: number; facts: Record<string, VerifiedFact>; resumeText: string; resumeApproved: boolean; answersRevision: number }
export interface PipelineSettings {
  enabled: boolean; autoSubmit: boolean; threshold: number; dailyCap: number; weeklyCap: number;
  employerDailyCap: number; timeZone: string; roles: string[]; locations: string[];
  excludeCompanies: string[]; countries: string[]; requireWorkAuthorization: boolean; allowSponsorship: boolean;
  minimumSalary?: { value: number; currency: string; period: "year" | "month" | "hour" };
  maxAgeDays: number; aiConsent: boolean; quietFrom?: string; quietTo?: string;
}
export interface PipelineSettingsRecord { revision: number; data: PipelineSettings; updatedAt: string }
export interface PipelineJob {
  jobUrl: string; title: string; company: string; description: string; skills: string[]; location: string;
  country?: string; postedAt?: string; source?: string; externalId?: string; remote?: boolean; portal?: string; boardMatch?: "low" | "medium" | "high" | "unknown";
  salary?: { min?: number; max?: number; currency: string; period: "year" | "month" | "hour" };
}
export type PipelineTaskStatus = "queued" | "in_progress" | "submitting" | "waiting_answer" | "waiting_login" | "waiting_review" | "unsupported" | "submitted" | "unverified" | "failed" | "cancelled" | "filtered" | "manual_actionable" | "waiting_match_answer" | "manual_applied" | "user_skipped";
export interface PipelineMatchDecision {
  status: "manual_actionable" | "waiting_match_answer" | "eligible_review" | "eligible_auto";
  similarityKey: string; portal: string; reason: string; codes: string[]; missingCore: string[]; eligible: boolean; score: number; profileRevision: number;
  requirements: { anyOf: string[]; core: boolean; evidence: string }[];
  question?: { kind: "skill_gap"; skills: string[]; text: string };
}
export interface PipelineTask { id: string; runId: string; bindingId: string; job: PipelineJob; status: PipelineTaskStatus; profileRevision: number; settingsRevision: number; answersRevision: number; score: number; reason: string | null; matchDecision?: PipelineMatchDecision }
export type PipelineFeedbackScope = "exact" | "similar";
export type PipelineFeedbackVerdict = "apply" | "skip";
export type PipelineMatchAnswer = "yes" | "no" | "unsure";
export interface PipelineMatchFeedback { id: string; jobUrl: string; similarityKey: string; portal: string; scope: PipelineFeedbackScope; verdict: PipelineFeedbackVerdict; profileRevision: number; settingsRevision: number; confirmedAt: string; revokedAt: string | null; source: "user" }
export interface PipelineAutonomyGrant { id: string; similarityKey: string; portal: string; profileRevision: number; settingsRevision: number; grantedAt: string; expiresAt: string; revokedAt: string | null; source: "user" }
export interface PipelineLearningConfirmation { taskId: string; profileRevision: number; settingsRevision: number; confirm: true }
export interface PipelineManualReceipt { id: string; taskId: string; jobUrl: string; similarityKey: string; portal: string; profileRevision: number; settingsRevision: number; reportedAt: string | null; observedAt: string | null; source: "user" | "worker"; commandId?: string; accountIdentity?: string }
export interface PipelineMatchLearningQuestion { id: string; taskId: string; jobUrl: string; similarityKey: string; portal: string; profileRevision: number; settingsRevision: number; question: NonNullable<PipelineMatchDecision["question"]>; answer: PipelineMatchAnswer; answeredAt: string; source: "user"; suggestion: "profile_update" | "none" }
export interface PipelineLearningEligibility { taskId: string; eligible: boolean; applySimilarCount: number; observedManualReceiptCount: number; profileRevision: number; settingsRevision: number; similarityKey: string; portal: string }
export interface PipelineLearning { feedback: PipelineMatchFeedback[]; grants: PipelineAutonomyGrant[]; receipts: PipelineManualReceipt[]; questions: PipelineMatchLearningQuestion[]; eligibility: PipelineLearningEligibility[] }
export interface PipelineRun { id: string; bindingId: string; mode: "review" | "auto"; status: "queued" | "running" | "completed" | "cancelled"; profileRevision: number; settingsRevision: number; answersRevision: number; candidateCount: number; taskCount: number; createdAt: string; startedAt: string | null; finishedAt: string | null }
export type QuestionControl = "text" | "textarea" | "email" | "tel" | "url" | "select" | "radio" | "checkbox" | "number" | "date";
export interface PipelineQuestion { id: string; questionKey: string; meaning: string; questionText: string; controlType: QuestionControl; options: string[]; context: FactScope & { currency?: string }; scope: AnswerScope; scopeKey: string; currency: string | null; reason: string | null; profileRevision: number; status: "pending" | "answered" | "dismissed"; answerId: string | null; taskIds: string[]; createdAt: string; updatedAt: string }
export interface PipelineAnswer { id: string; meaning: string; questionText: string; controlType: QuestionControl; options: string[]; context: FactScope & { currency?: string }; answer: string; scope: AnswerScope; scopeKey: string; profileRevision: number; confirmedAt: string; expiresAt: string | null; revokedAt: string | null; provenance: "user" }
export interface PipelineBoard { id: string; url: string; host: string; label: string; type: "manual" | "greenhouse" | "lever" | "ashby" | "workday"; status: "pending" | "disabled" | "dead"; createdAt: string; updatedAt: string }
export interface PipelineAgent { bindingId: string; label: string; engineVersion: string | null; capabilities: string[]; status: "ready" | "paused" | "offline" | null; profileMetadata: { revision?: number; resumeApproved?: boolean }; heartbeatAt: string | null; revokedAt: string | null; lastUsedAt: string | null }
export interface PipelineSession { bindingId: string; portal: string; status: "authenticated" | "expired" | "login_required" | "unsupported"; accountLabel: string | null; checkedAt: string }
export type PipelineCommandType = "pause" | "resume" | "retry_login" | "open_question" | "check_session" | "open_manual";
export interface PipelineCommand { id: string; bindingId: string; type: PipelineCommandType; status: "queued" | "claimed" | "done" | "failed" | "cancelled"; reason: string | null; createdAt: string }
export const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
  enabled: false, autoSubmit: false, threshold: 60, dailyCap: 10, weeklyCap: 50,
  employerDailyCap: 2, timeZone: "UTC", roles: [], locations: [], excludeCompanies: [], countries: [],
  requireWorkAuthorization: false, allowSponsorship: true, maxAgeDays: 14, aiConsent: false,
};
export const PROFILE_FACT_KEYS = ["name", "firstName", "lastName", "email", "phone", "skills", "role", "locations", "location", "yearsExperience", "noticePeriod", "currentSalary", "expectedSalary", "salaryCurrency", "workAuthorization", "requiresSponsorship", "relocation", "linkedin", "portfolio"] as const;
export const MAX_PIPELINE_RESUME = 12000;
export const PORTAL_FACT_KEYS = ["portalProfileApproved:naukri", "portalAccountIdentity:naukri", "portalResumeText:naukri", "portalProfileApproved:instahyre", "portalAccountIdentity:instahyre", "portalResumeText:instahyre"] as const;
const unavailable = "Your application pipeline is unavailable. Its backend may not be installed. Reload to check; no application was requested.";
export class PipelineError extends Error {}
export function pipelineErrorMessage(error: unknown): string {
  return error instanceof PipelineError ? error.message : "Pipeline request failed. Reload before retrying; completion is not confirmed.";
}
const fail = (message = "Pipeline returned an invalid response. Reload before proceeding."): never => { throw new PipelineError(message); };
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
function object(v: unknown): Record<string, unknown> { return record(v) ? v : fail(); }
function text(v: unknown, max = 500, min = 0): string {
  return typeof v === "string" && v.length >= min && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v) ? v : fail();
}
function integer(v: unknown, min = 0, max = 2147483647): number { return typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max ? v : fail(); }
function bool(v: unknown): boolean { return typeof v === "boolean" ? v : fail(); }
function strings(v: unknown, maxItems = 100, maxLength = 200): string[] {
  return Array.isArray(v) && v.length <= maxItems ? v.map(x => text(x, maxLength, 1)) : fail();
}
function date(v: unknown): string {
  const s = text(v, 40, 1);
  return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(s) && Number.isFinite(Date.parse(s)) ? s : fail();
}
function nullableDate(v: unknown): string | null { return v === null ? null : date(v); }
function id(v: unknown): string {
  const s = text(v, 36, 36);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : fail();
}
function nullableText(v: unknown, max = 2000): string | null { return v === null ? null : text(v, max); }
function scope(v: unknown, currency = false): FactScope & { currency?: string } {
  const input = object(v), out: FactScope & { currency?: string } = {};
  for (const key of Object.keys(input)) {
    if (!["country", "employer", "portal", "application", ...(currency ? ["currency"] : [])].includes(key)) fail();
    Object.assign(out, { [key]: text(input[key], 500, 1) });
  }
  return out;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T { return typeof v === "string" && allowed.includes(v as T) ? v as T : fail(); }
function owner(row: Record<string, unknown>, userId: string): void { if (row.user_id !== undefined && row.user_id !== userId || row.userId !== undefined && row.userId !== userId) fail("Account mismatch. Reopen the pipeline for your current account."); }
function facts(v: unknown): Record<string, VerifiedFact> {
  const input = object(v);
  if (Object.keys(input).length > 100) fail();
  const out: Record<string, VerifiedFact> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!PROFILE_FACT_KEYS.includes(key as typeof PROFILE_FACT_KEYS[number]) && !PORTAL_FACT_KEYS.includes(key as typeof PORTAL_FACT_KEYS[number]) && !/^skillYears:[a-z0-9+#. /-]{1,80}$/.test(key)) fail();
    const fact = object(raw);
    const value = Array.isArray(fact.value) ? strings(fact.value) : typeof fact.value === "string" ? text(fact.value, key.startsWith("portalResumeText:") ? MAX_PIPELINE_RESUME : 10000, 1)
      : typeof fact.value === "boolean" ? fact.value : typeof fact.value === "number" && Number.isFinite(fact.value) ? fact.value : fail();
    if (fact.source !== "user") fail();
    out[key] = { value, source: "user", confirmedAt: date(fact.confirmedAt),
      ...(fact.scope !== undefined ? { scope: scope(fact.scope) } : {}),
      ...(fact.validUntil !== undefined ? { validUntil: date(fact.validUntil) } : {}) };
  }
  return out;
}
function settings(v: unknown): PipelineSettings {
  const row = object(v);
  const timeZone = text(row.timeZone, 100, 1);
  try { new Intl.DateTimeFormat("en", { timeZone }); } catch { return fail("Enter a valid IANA time zone, such as Europe/London or UTC."); }
  const quiet = (v: unknown) => { const s = text(v, 5, 5); return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : fail("Quiet hours must use HH:MM."); };
  if ((row.quietFrom === undefined) !== (row.quietTo === undefined)) fail("Enter both quiet-hour times or leave both blank.");
  let minimumSalary: PipelineSettings["minimumSalary"];
  if (row.minimumSalary !== undefined) {
    const salary = object(row.minimumSalary);
    if (typeof salary.value !== "number" || !Number.isFinite(salary.value) || salary.value < 0) fail("Enter a nonnegative minimum salary.");
    const currency = text(salary.currency, 3, 3);
    if (!/^[A-Z]{3}$/.test(currency)) fail("Use an explicit three-letter salary currency code.");
    minimumSalary = { value: salary.value as number, currency, period: oneOf(salary.period, ["year", "month", "hour"] as const) };
  }
  return { enabled: bool(row.enabled), autoSubmit: bool(row.autoSubmit), threshold: integer(row.threshold, 0, 100),
    dailyCap: integer(row.dailyCap, 0, 100), weeklyCap: integer(row.weeklyCap, 0, 500), employerDailyCap: integer(row.employerDailyCap, 0, 20),
    timeZone, roles: strings(row.roles, 30), locations: strings(row.locations, 30), excludeCompanies: strings(row.excludeCompanies),
    countries: strings(row.countries, 30, 100), requireWorkAuthorization: bool(row.requireWorkAuthorization), allowSponsorship: bool(row.allowSponsorship),
    ...(minimumSalary ? { minimumSalary } : {}),
    maxAgeDays: integer(row.maxAgeDays, 1, 90), aiConsent: bool(row.aiConsent),
    ...(row.quietFrom === undefined ? {} : { quietFrom: quiet(row.quietFrom), quietTo: quiet(row.quietTo) }) };
}
export function validatePipelineSettings(value: PipelineSettings): string | null {
  try { settings(value); return null; } catch (error) { return pipelineErrorMessage(error); }
}
export function validateProfileConfirmation(value: { facts: Record<string, VerifiedFact>; resumeText: string; resumeApproved: boolean }, now = Date.now()): string | null {
  try {
    const verified = facts(value.facts);
    if (!Object.keys(verified).length) return "Enter the facts you have verified before confirming your profile.";
    for (const [key, fact] of Object.entries(verified)) {
      if (Date.parse(fact.confirmedAt) > now + 1000) return "Fact confirmation cannot be in the future.";
      if (["noticePeriod", "currentSalary", "expectedSalary", "salaryCurrency", "workAuthorization", "requiresSponsorship"].includes(key) && (!fact.validUntil || Date.parse(fact.validUntil) <= now)) return "Salary, availability and work-authorization facts need a future expiry date.";
      if (fact.validUntil && (Date.parse(fact.validUntil) <= now || Date.parse(fact.validUntil) <= Date.parse(fact.confirmedAt))) return "Fact expiry must be after confirmation and in the future.";
      if (["workAuthorization", "requiresSponsorship"].includes(key) && (typeof fact.value !== "boolean" || !fact.scope?.country)) return "Work authorization and sponsorship are separate country-bound yes/no facts.";
      if (["currentSalary", "expectedSalary"].includes(key) && (!verified.salaryCurrency || !fact.scope?.country)) return "Salary facts need an explicit currency and country.";
    }
    for (const portal of ["naukri", "instahyre"] as const) {
      const approval = verified[`portalProfileApproved:${portal}`], account = verified[`portalAccountIdentity:${portal}`], resume = verified[`portalResumeText:${portal}`];
      if (!approval && !account && !resume) continue;
      const pattern = new RegExp(`^${portal}:(?:www\\.)?${portal}\\.com/candidate$`);
      if (!approval || approval.value !== true || !account || typeof account.value !== "string" || !resume || resume.value !== value.resumeText || !value.resumeApproved) return "Portal approval requires the exact approved resume, a verified account identity and explicit profile confirmation.";
      for (const fact of [approval, account, resume]) {
        if (!fact.scope?.portal || !pattern.test(fact.scope.portal) || fact.scope.portal !== approval.scope?.portal || !fact.validUntil || Date.parse(fact.validUntil) <= now || Date.parse(fact.validUntil) - Date.parse(fact.confirmedAt) > 30 * 86400000) return "Portal approvals need the exact portal scope and an expiry within 30 days.";
      }
    }
    if (value.resumeText.length > MAX_PIPELINE_RESUME) return "Resume exceeds 12,000 characters. Shorten the exact resume yourself before approving it; nothing is truncated automatically.";
    text(value.resumeText, MAX_PIPELINE_RESUME);
    if (value.resumeApproved && !value.resumeText.trim()) return "Paste your exact resume before approving it.";
    bool(value.resumeApproved);
    return null;
  } catch { return "Check the profile values, scope and expiry dates before confirming."; }
}

const ANSWER_SCOPES = ["global", "country", "employer", "portal", "application"] as const;
const CONTROLS = ["text", "textarea", "email", "tel", "url", "select", "radio", "checkbox", "number", "date"] as const;
const TASK_STATES = ["queued", "in_progress", "submitting", "waiting_answer", "waiting_login", "waiting_review", "unsupported", "submitted", "unverified", "failed", "cancelled", "filtered", "manual_actionable", "waiting_match_answer", "manual_applied", "user_skipped"] as const;
const COMMAND_TYPES = ["pause", "resume", "retry_login", "open_question", "check_session", "open_manual"] as const;
const learningUnavailable = "Match learning is unavailable. Its backend may not be installed or may need an update. Existing pipeline controls remain usable; no learning or manual-open fallback is used.";
export function isPublicPipelineUrl(value: string): boolean {
  try {
    const url = new URL(value), host = url.hostname.toLowerCase().replace(/\.$/, "");
    return value.length <= 2048 && url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443")
      && host.includes(".") && !host.includes(":") && !/^[\d.]+$/.test(host) && !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host);
  } catch { return false; }
}
function publicUrl(v: unknown): string { const url = text(v, 2048, 1); return isPublicPipelineUrl(url) ? url : fail(); }
function profileRow(raw: unknown, userId: string): PipelineProfile | null {
  if (raw === null) return null;
  const row = object(raw); owner(row, userId);
  return { revision: integer(row.revision, 1), facts: facts(row.facts), resumeText: text(row.resume_text, MAX_PIPELINE_RESUME), resumeApproved: bool(row.resume_approved), answersRevision: integer(row.answers_revision) };
}
function settingsRow(raw: unknown, userId: string): PipelineSettingsRecord {
  const row = object(raw); owner(row, userId);
  return { revision: integer(row.revision, 1), data: settings(row.data), updatedAt: date(row.updated_at) };
}
function jobRow(raw: unknown): PipelineJob {
  const row = object(raw);
  return { jobUrl: publicUrl(row.jobUrl), title: text(row.title, 500, 1), company: text(row.company, 500, 1), description: text(row.description, 50000), skills: strings(row.skills), location: text(row.location, 500),
    ...(row.country !== undefined ? { country: text(row.country, 100, 1) } : {}), ...(row.postedAt !== undefined ? { postedAt: date(row.postedAt) } : {}),
    ...(row.source !== undefined ? { source: text(row.source, 100, 1) } : {}), ...(row.externalId !== undefined ? { externalId: text(row.externalId, 500, 1) } : {}),
    ...(row.remote !== undefined ? { remote: bool(row.remote) } : {}), ...(row.portal !== undefined ? { portal: text(row.portal, 200, 1) } : {}),
    ...(row.boardMatch !== undefined ? { boardMatch: oneOf(row.boardMatch, ["low", "medium", "high", "unknown"] as const) } : {}),
    ...(row.salary !== undefined ? { salary: salaryRow(row.salary) } : {}) };
}
function salaryRow(raw: unknown): NonNullable<PipelineJob["salary"]> {
  const row = object(raw);
  const amount = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1000000000 ? value : fail();
  const min = row.min === undefined ? undefined : amount(row.min), max = row.max === undefined ? undefined : amount(row.max);
  if (min === undefined && max === undefined || min !== undefined && max !== undefined && min > max) fail();
  return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), currency: text(row.currency, 10, 1), period: oneOf(row.period, ["year", "month", "hour"] as const) };
}
function matchQuestionRow(raw: unknown): NonNullable<PipelineMatchDecision["question"]> {
  const row = object(raw);
  return { kind: oneOf(row.kind, ["skill_gap"] as const), skills: strings(row.skills, 100), text: text(row.text, 2000, 1) };
}
function matchDecisionRow(raw: unknown): PipelineMatchDecision {
  const row = object(raw);
  const result: PipelineMatchDecision = { status: oneOf(row.status, ["manual_actionable", "waiting_match_answer", "eligible_review", "eligible_auto"] as const),
    similarityKey: text(row.similarityKey, 16000, 1), portal: text(row.portal, 200), reason: text(row.reason, 2000, 1), codes: strings(row.codes), missingCore: strings(row.missingCore),
    eligible: bool(row.eligible), score: integer(row.score, 0, 100), profileRevision: integer(row.profileRevision, 1),
    requirements: Array.isArray(row.requirements) && row.requirements.length <= 100 ? row.requirements.map(raw => { const requirement = object(raw); return { anyOf: strings(requirement.anyOf, 100), core: bool(requirement.core), evidence: text(requirement.evidence, 2000) }; }) : fail(),
    ...(row.question !== undefined && row.question !== null ? { question: matchQuestionRow(row.question) } : {}) };
  if (result.eligible !== ["eligible_review", "eligible_auto"].includes(result.status)) fail();
  return result;
}
function taskRow(raw: unknown, userId: string): PipelineTask {
  const row = object(raw); owner(row, userId);
  const task: PipelineTask = { id: id(row.id), runId: id(row.run_id), bindingId: id(row.target_binding_id), job: jobRow(row.job), status: oneOf(row.status, TASK_STATES),
    profileRevision: integer(row.profile_revision, 1), settingsRevision: integer(row.settings_revision, 1), answersRevision: integer(row.answers_revision), score: integer(row.score, 0, 100), reason: nullableText(row.reason),
    ...(row.match_decision !== undefined && row.match_decision !== null ? { matchDecision: matchDecisionRow(row.match_decision) } : {}) };
  if (task.matchDecision && task.matchDecision.profileRevision !== task.profileRevision) fail();
  return task;
}
function learningScopeRow(raw: unknown, userId: string) {
  const row = object(raw); owner(row, userId);
  return { row, similarityKey: text(row.similarityKey, 16000, 1), portal: text(row.portal, 200), profileRevision: integer(row.profileRevision, 1), settingsRevision: integer(row.settingsRevision, 1) };
}
function feedbackRow(raw: unknown, userId: string): PipelineMatchFeedback {
  const { row, ...bound } = learningScopeRow(raw, userId);
  return { ...bound, id: id(row.id), jobUrl: publicUrl(row.jobUrl), scope: oneOf(row.scope, ["exact", "similar"] as const), verdict: oneOf(row.verdict, ["apply", "skip"] as const), confirmedAt: date(row.confirmedAt), revokedAt: nullableDate(row.revokedAt), source: oneOf(row.source, ["user"] as const) };
}
function grantRow(raw: unknown, userId: string): PipelineAutonomyGrant {
  const { row, ...bound } = learningScopeRow(raw, userId);
  const result = { ...bound, id: id(row.id), grantedAt: date(row.grantedAt), expiresAt: date(row.expiresAt), revokedAt: nullableDate(row.revokedAt), source: oneOf(row.source, ["user"] as const) };
  if (Date.parse(result.expiresAt) <= Date.parse(result.grantedAt) || Date.parse(result.expiresAt) > Date.parse(result.grantedAt) + 30 * 86400000) fail();
  return result;
}
function manualReceiptRow(raw: unknown, userId: string): PipelineManualReceipt {
  const { row, ...bound } = learningScopeRow(raw, userId);
  const result = { ...bound, id: id(row.id), taskId: id(row.taskId), jobUrl: publicUrl(row.jobUrl), reportedAt: nullableDate(row.reportedAt), observedAt: nullableDate(row.observedAt), source: oneOf(row.source, ["user", "worker"] as const),
    ...(row.commandId !== undefined && row.commandId !== null ? { commandId: id(row.commandId) } : {}), ...(row.accountIdentity !== undefined && row.accountIdentity !== null ? { accountIdentity: text(row.accountIdentity, 500, 1) } : {}) };
  // A user report can never masquerade as worker-observed submission evidence.
  if (result.source === "user" && (result.observedAt !== null || !result.reportedAt) || result.source === "worker" && !result.observedAt) fail();
  return result;
}
function learningQuestionRow(raw: unknown, userId: string): PipelineMatchLearningQuestion {
  const { row, ...bound } = learningScopeRow(raw, userId);
  const result = { ...bound, id: id(row.id), taskId: id(row.taskId), jobUrl: publicUrl(row.jobUrl), question: matchQuestionRow(row.question), answer: oneOf(row.answer, ["yes", "no", "unsure"] as const), answeredAt: date(row.answeredAt), source: oneOf(row.source, ["user"] as const), suggestion: oneOf(row.suggestion, ["profile_update", "none"] as const) };
  if (result.suggestion === "profile_update" && result.answer !== "yes") fail();
  return result;
}
function eligibilityRow(raw: unknown, userId: string): PipelineLearningEligibility {
  const { row, ...bound } = learningScopeRow(raw, userId);
  const result = { ...bound, taskId: id(row.taskId), eligible: bool(row.eligible), applySimilarCount: integer(row.applySimilarCount), observedManualReceiptCount: integer(row.observedManualReceiptCount) };
  if (result.eligible && (result.applySimilarCount < 3 || result.observedManualReceiptCount < 2 || !result.portal)) fail();
  return result;
}
function runRow(raw: unknown, userId: string): PipelineRun {
  const row = object(raw); owner(row, userId);
  return { id: id(row.id), bindingId: id(row.binding_id), mode: oneOf(row.mode, ["review", "auto"] as const), status: oneOf(row.status, ["queued", "running", "completed", "cancelled"] as const),
    profileRevision: integer(row.profile_revision, 1), settingsRevision: integer(row.settings_revision, 1), answersRevision: integer(row.answers_revision), candidateCount: integer(row.candidate_count), taskCount: integer(row.task_count),
    createdAt: date(row.created_at), startedAt: nullableDate(row.started_at), finishedAt: nullableDate(row.finished_at) };
}
function questionRow(raw: unknown, userId: string): PipelineQuestion {
  const row = object(raw); owner(row, userId);
  const result: PipelineQuestion = { id: id(row.id), questionKey: text(row.question_key, 12000, 1), meaning: text(row.meaning, 200, 1), questionText: text(row.question_text, 2000, 1),
    controlType: oneOf(row.control_type, CONTROLS), options: strings(row.options, 100, 500), context: scope(row.context, true), scope: oneOf(row.scope, ANSWER_SCOPES), scopeKey: text(row.scope_key, 500),
    currency: nullableText(row.currency, 10), reason: nullableText(row.reason), profileRevision: integer(row.profile_revision, 1), status: oneOf(row.status, ["pending", "answered", "dismissed"] as const),
    answerId: row.answer_id === null ? null : id(row.answer_id), taskIds: Array.isArray(row.task_ids) && row.task_ids.length <= 200 ? row.task_ids.map(id) : fail(), createdAt: date(row.created_at), updatedAt: date(row.updated_at) };
  if ((result.scope !== "global" && !result.scopeKey) || (["select", "radio"].includes(result.controlType) && !result.options.length)) fail();
  return result;
}
function answerRow(raw: unknown, userId: string): PipelineAnswer {
  const row = object(raw); owner(row, userId);
  if (row.provenance !== "user") fail();
  return { id: id(row.id), meaning: text(row.meaning, 200, 1), questionText: text(row.question_text, 2000, 1), controlType: oneOf(row.control_type, CONTROLS), options: strings(row.options, 100, 500), context: scope(row.context, true),
    answer: text(row.answer, 10000, 1), scope: oneOf(row.scope, ANSWER_SCOPES), scopeKey: text(row.scope_key, 500), profileRevision: integer(row.profile_revision, 1), confirmedAt: date(row.confirmed_at), expiresAt: nullableDate(row.expires_at), revokedAt: nullableDate(row.revoked_at), provenance: "user" };
}
function boardRow(raw: unknown, userId: string): PipelineBoard {
  const row = object(raw); owner(row, userId);
  return { id: id(row.id), url: publicUrl(row.url), host: text(row.host, 253, 1), label: text(row.label, 200, 1), type: oneOf(row.type, ["manual", "greenhouse", "lever", "ashby", "workday"] as const), status: oneOf(row.status, ["pending", "disabled", "dead"] as const), createdAt: date(row.created_at), updatedAt: date(row.updated_at) };
}
function agentRow(raw: unknown, userId: string): PipelineAgent {
  const row = object(raw); owner(row, userId);
  const metadata = object(row.profile_metadata);
  return { bindingId: id(row.binding_id), label: text(row.label, 200, 1), engineVersion: nullableText(row.engine_version, 100), capabilities: strings(row.capabilities, 50, 100),
    status: row.status === null ? null : oneOf(row.status, ["ready", "paused", "offline"] as const), profileMetadata: { ...(metadata.revision !== undefined ? { revision: integer(metadata.revision) } : {}), ...(metadata.resumeApproved !== undefined ? { resumeApproved: bool(metadata.resumeApproved) } : {}) },
    heartbeatAt: nullableDate(row.heartbeat_at), revokedAt: nullableDate(row.revoked_at), lastUsedAt: nullableDate(row.last_used_at) };
}
function sessionRow(raw: unknown, userId: string): PipelineSession {
  const row = object(raw); owner(row, userId);
  return { bindingId: id(row.binding_id), portal: text(row.portal, 200, 1), status: oneOf(row.status, ["authenticated", "expired", "login_required", "unsupported"] as const), accountLabel: nullableText(row.account_label, 200), checkedAt: date(row.checked_at) };
}
function commandRow(raw: unknown, userId: string): PipelineCommand {
  const row = object(raw); owner(row, userId);
  return { id: id(row.id), bindingId: id(row.binding_id), type: oneOf(row.type, COMMAND_TYPES), status: oneOf(row.status, ["queued", "claimed", "done", "failed", "cancelled"] as const), reason: nullableText(row.reason), createdAt: date(row.created_at) };
}
function rows<T>(raw: unknown, parse: (row: unknown, userId: string) => T, userId: string): T[] { return Array.isArray(raw) && raw.length <= 200 ? raw.map(row => parse(row, userId)) : fail(); }
export function agentReadiness(agent: PipelineAgent, now = Date.now()): { online: boolean; ready: boolean; label: string } {
  if (agent.revokedAt) return { online: false, ready: false, label: "Revoked" };
  if (!agent.heartbeatAt || !agent.engineVersion) return { online: false, ready: false, label: "Paired · worker not installed or never reported" };
  const age = now - Date.parse(agent.heartbeatAt);
  const online = age >= -60000 && age <= 5 * 60000 && agent.status !== "offline";
  const capable = ["leased-tasks", "verified-answer-bank", "job-bound-receipts"].every(capability => agent.capabilities.includes(capability));
  return { online, ready: online && capable && agent.status === "ready", label: !online ? "Offline · waiting for local worker" : !capable ? "Online · pipeline capability missing" : agent.status === "paused" ? "Online · paused" : "Online · ready" };
}
export function needsHumanQuestion(question: PipelineQuestion): boolean {
  return question.controlType === "checkbox" || /manualAttestation|demographic|invalidQuestion/i.test(question.meaning)
    || /\b(?:consent|agree|certify|attest|acknowledge|terms|privacy|background check|data processing|signature|gender|race|ethnicity|disability|veteran|religion|caste)\b/i.test(question.questionText);
}

/** One scope is permanently invalidated by A→B→A or disposal. Every RPC pins
    the captured account JWT, so delayed SDK auth cannot send an A draft as B. */
export function createPipelineClient(userId: string) {
  if (!userId || getCloudState().user?.id !== userId) fail("Sign in to manage your application pipeline.");
  const controller = new AbortController();
  let invalid = false;
  const unsubscribe = subscribeCloud(state => { if (state.user?.id !== userId) { invalid = true; controller.abort(); } });
  const check = () => { if (invalid || controller.signal.aborted || getCloudState().user?.id !== userId) fail("Account or selected agent changed. Reopen the pipeline for your current account."); };
  const dispose = () => { invalid = true; controller.abort(); unsubscribe(); };
  async function authorized() {
    check();
    const client = await getSupabaseClient();
    check();
    if (!client) return fail(unavailable);
    const { data, error } = await client.auth.getSession();
    check();
    if (error || data.session?.user.id !== userId || !data.session.access_token) return fail("Sign in again to manage your application pipeline.");
    return { client, token: data.session.access_token };
  }
  async function action(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const { client, token } = await authorized();
    const request = client.rpc("my_apply_pipeline_action", { p_action: name, p_args: args });
    const { data, error } = await request.setHeader("Authorization", `Bearer ${token}`).abortSignal(controller.signal);
    check();
    if (error) {
      const code = typeof error.code === "string" ? error.code : "";
      const message = typeof error.message === "string" ? error.message : "";
      if (code === "40001" || message.includes("stale_profile") || message.includes("stale_settings")) fail("Profile, settings or questions changed elsewhere. Reload before saving again.");
      const learningAction = name.startsWith("learning.") || name === "commands.request" && args.type === "open_manual";
      if (learningAction && (["PGRST202", "42883", "42P01"].includes(code) || /unsupported[ _]action|unknown[ _]action/.test(message))) fail(learningUnavailable);
      if (name === "learning.grant" && /grant_not_eligible|insufficient.*(?:feedback|receipt)|graduation.*(?:denied|ineligible)/.test(message)) fail("This scope is not eligible for autonomy. The server requires three distinct current apply-similar preferences and two worker-observed manual receipts for the same portal and revisions. Self-reports do not count.");
      if (learningAction && /(?:factual|match)_veto|manual_only|core_gap|missing_core/.test(message)) fail("Factual requirements still block this action. Preferences and question answers cannot override verified skill or safety gaps.");
      if (/not[ _]entitled|entitlement_required/.test(message)) fail("Auto-apply access is required to start or change the pipeline. You can still cancel runs and revoke answers.");
      if (["PGRST202", "42883", "42P01"].includes(code)) fail(unavailable);
      fail("Pipeline request failed. Reload before retrying; completion is not confirmed.");
    }
    return object(data);
  }
  async function importDraft(): Promise<{ values: Record<string, string | number | boolean | string[]>; resumeText: string }> {
    const { client, token } = await authorized();
    const ownRead = async (table: "career_profiles" | "uploaded_resumes") => {
      const query = client.from(table).select("data").eq("user_id", userId);
      const result = await query.setHeader("Authorization", `Bearer ${token}`).abortSignal(controller.signal).maybeSingle();
      check();
      if (result.error) return fail("Your saved profile draft could not be loaded. Enter verified facts manually or reload.");
      return result.data === null ? null : object(object(result.data).data);
    };
    const [career, resume] = await Promise.all([ownRead("career_profiles"), ownRead("uploaded_resumes")]);
    check();
    const resumeText = resume ? text(resume.text, 100000) : "";
    const contacts = extractContacts(resumeText);
    const values: Record<string, string | number | boolean | string[]> = {};
    for (const key of ["name", "email", "phone"] as const) if (contacts[key]) values[key] = contacts[key]!;
    if (career) {
      if (career.headline !== undefined && text(career.headline, 500).trim()) values.role = text(career.headline, 500);
      if (career.skills !== undefined) values.skills = strings(career.skills);
      if (career.location !== undefined && text(career.location, 500).trim()) values.location = text(career.location, 500);
      if (career.years !== undefined && typeof career.years === "number" && Number.isFinite(career.years) && career.years >= 0 && career.years <= 100) values.yearsExperience = career.years;
      if (career.targetTitles !== undefined) values.targetRoles = strings(career.targetTitles, 30);
      if (typeof career.remote === "boolean") values.locations = [typeof values.location === "string" ? values.location : "", career.remote ? "Remote" : ""].filter(Boolean);
    }
    return { values, resumeText };
  }
  async function getProfile() { return profileRow((await action("profile.get")).profile, userId); }
  async function confirmProfile(input: { expectedRevision: number | null; facts: Record<string, VerifiedFact>; resumeText: string; resumeApproved: boolean }) {
    if (input.expectedRevision !== null) integer(input.expectedRevision, 1);
    const invalid = validateProfileConfirmation(input);
    if (invalid) fail(invalid);
    return profileRow((await action("profile.confirm", { expectedRevision: input.expectedRevision, facts: facts(input.facts), resumeText: input.resumeText, resumeApproved: input.resumeApproved })).profile, userId) ?? fail();
  }
  async function getSettings() { return settingsRow((await action("settings.get")).settings, userId); }
  async function putSettings(input: { expectedRevision: number | null; settings: PipelineSettings }) {
    if (input.expectedRevision !== null) integer(input.expectedRevision, 1);
    return settingsRow((await action("settings.put", { expectedRevision: input.expectedRevision, settings: settings(input.settings) })).settings, userId);
  }
  async function listAnswers() {
    const result = await action("answers.list", { limit: 200, includeRevoked: true });
    return { answers: rows(result.answers, answerRow, userId), revision: integer(result.revision) };
  }
  async function revokeAnswer(answerId: string) { return answerRow((await action("answers.revoke", { answerId: id(answerId) })).answer, userId); }
  async function listQuestions() { return rows((await action("questions.list", { limit: 200, status: "pending" })).questions, questionRow, userId); }
  async function answerQuestion(question: PipelineQuestion, input: { answer: string; scope: AnswerScope; scopeKey: string; expiresAt?: string; confirm: true }) {
    if (needsHumanQuestion(question)) fail("This demographic or legal attestation needs fresh human review on the application; it cannot become a reusable answer.");
    if (input.scope !== question.scope || input.scopeKey !== question.scopeKey || input.confirm !== true) fail("Use the question's explicit scope and confirm the answer yourself.");
    const answer = text(input.answer, 10000, 1);
    if (["select", "radio"].includes(question.controlType) && !question.options.includes(answer)) fail("Choose one of the exact offered options.");
    if (question.controlType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) fail("Enter a valid factual email address for this question.");
    if (question.controlType === "url") {
      try { const url = new URL(answer); if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) fail("Enter a factual HTTP or HTTPS URL without credentials."); }
      catch { fail("Enter a factual HTTP or HTTPS URL without credentials."); }
    }
    if (question.controlType === "number" && (!/^-?\d+(?:\.\d+)?$/.test(answer) || !Number.isFinite(Number(answer)))) fail("Enter a numeric answer for this question.");
    if (input.expiresAt !== undefined && Date.parse(date(input.expiresAt)) <= Date.now()) fail("Answer expiry must be in the future.");
    if (["currentSalary", "expectedSalary", "workAuthorization", "requiresSponsorship", "noticePeriod"].includes(question.meaning) && !input.expiresAt) fail("This time-sensitive answer needs an expiry date.");
    const result = await action("questions.answer", { questionId: id(question.id), answer, scope: input.scope, scopeKey: input.scopeKey, ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}), confirm: true });
    return { answer: answerRow(result.answer, userId), revision: integer(result.revision) };
  }
  async function listBoards() { return rows((await action("boards.list", { limit: 200 })).boards, boardRow, userId); }
  async function addBoard(url: string, label?: string) {
    if (!isPublicPipelineUrl(url)) fail("Enter a public HTTPS board URL without credentials, private hosts or IP addresses.");
    return boardRow((await action("boards.add", { url, ...(label?.trim() ? { label: text(label.trim(), 200, 1) } : {}), type: "manual" })).board, userId);
  }
  async function requestRun(bindingId: string, mode: "review" | "auto", limit = 10) {
    const selected = id(bindingId);
    const result = await action("run.request", { bindingId: selected, mode: oneOf(mode, ["review", "auto"] as const), limit: integer(limit, 1, 100) });
    const run = runRow(result.run, userId);
    if (run.bindingId !== selected) fail("Selected agent mismatch. Reload; no completion is confirmed.");
    return { run, publicFeedAvailable: bool(result.publicFeedAvailable) };
  }
  async function listRuns() { return rows((await action("run.list", { limit: 50 })).runs, runRow, userId); }
  async function cancelRun(runId: string) {
    const selected = id(runId), run = runRow((await action("run.cancel", { runId: selected })).run, userId);
    return run.id === selected ? run : fail();
  }
  async function listTasks(runId?: string) { return rows((await action("tasks.list", { ...(runId ? { runId: id(runId) } : {}), limit: 200 })).tasks, taskRow, userId); }
  async function listAgents() { return rows((await action("agent.list", { limit: 200 })).agents, agentRow, userId); }
  async function listSessions() { return rows((await action("sessions.list", { limit: 200 })).sessions, sessionRow, userId); }
  async function listLearning(): Promise<PipelineLearning> {
    const pageSize = 200, maxRows = 10000;
    const learning: PipelineLearning = { feedback: [], grants: [], receipts: [], questions: [], eligibility: [] };
    // Each table has its own stable 200-row page at this offset. Never publish a
    // partial ledger: omitted skips or grants would hide current revocation controls.
    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const result = await action("learning.list", offset === 0 ? {} : { limit: pageSize, offset }); owner(result, userId);
      const raw = object(result.learning); owner(raw, userId);
      const page: PipelineLearning = { feedback: rows(raw.feedback, feedbackRow, userId), grants: rows(raw.grants, grantRow, userId), receipts: rows(raw.receipts, manualReceiptRow, userId), questions: rows(raw.questions, learningQuestionRow, userId),
        // Old installations may lack graduation proof; never infer it from counts.
        eligibility: raw.eligibility === undefined ? [] : rows(raw.eligibility, eligibilityRow, userId) };
      const hasMore = result.hasMore === undefined ? false : bool(result.hasMore);
      for (const key of Object.keys(learning) as (keyof PipelineLearning)[]) {
        if (learning[key].length + page[key].length > maxRows) fail("Match learning exceeds the 10,000-row read limit. The complete history could not be loaded; no partial learning is shown.");
      }
      learning.feedback.push(...page.feedback); learning.grants.push(...page.grants); learning.receipts.push(...page.receipts);
      learning.questions.push(...page.questions); learning.eligibility.push(...page.eligibility);
      if (!hasMore) return learning;
    }
    return fail("Match learning exceeds the 10,000-row read limit. The complete history could not be loaded; no partial learning is shown.");
  }
  function learningConfirmation(input: PipelineLearningConfirmation) {
    if (input.confirm !== true) fail("Explicitly confirm this learning action yourself.");
    return { taskId: id(input.taskId), profileRevision: integer(input.profileRevision, 1), settingsRevision: integer(input.settingsRevision, 1), confirm: true as const };
  }
  async function acknowledgeLearning(name: string, args: Record<string, unknown>): Promise<{ ok: true }> {
    const result = await action(name, args); owner(result, userId);
    if (result.ok !== true) fail();
    // SQL acknowledges the exact saved row, not just transport success. Validate
    // provenance/ownership and the requested target before claiming completion.
    const key = name === "learning.feedback" || name === "learning.revoke" && args.feedbackId !== undefined ? "feedback"
      : name === "learning.question" ? "question" : name === "learning.manual_report" ? "receipt" : "grant";
    const raw = object(result[key]);
    if (name === "learning.revoke") {
      const revoked = key === "feedback" ? feedbackRow(raw, userId) : grantRow(raw, userId);
      if (revoked.id !== (args.feedbackId ?? args.grantId) || !revoked.revokedAt) fail();
    } else {
      const bound = learningScopeRow(raw, userId);
      if (id(raw.taskId) !== args.taskId || bound.profileRevision !== args.profileRevision || bound.settingsRevision !== args.settingsRevision) fail();
      if (key === "feedback") {
        const saved = feedbackRow(raw, userId);
        if (saved.scope !== args.scope || saved.verdict !== args.verdict || saved.revokedAt !== null) fail();
      } else if (key === "question") {
        if (learningQuestionRow(raw, userId).answer !== args.answer) fail();
      } else if (key === "receipt") {
        if (manualReceiptRow(raw, userId).source !== "user") fail();
      } else {
        const saved = grantRow(raw, userId);
        if (Date.parse(saved.expiresAt) !== Date.parse(date(args.expiresAt)) || saved.revokedAt !== null) fail();
      }
    }
    return { ok: true };
  }
  async function recordMatchFeedback(input: PipelineLearningConfirmation & { scope: PipelineFeedbackScope; verdict: PipelineFeedbackVerdict }) {
    return acknowledgeLearning("learning.feedback", { ...learningConfirmation(input), scope: oneOf(input.scope, ["exact", "similar"] as const), verdict: oneOf(input.verdict, ["apply", "skip"] as const) });
  }
  async function answerMatchQuestion(input: PipelineLearningConfirmation & { answer: PipelineMatchAnswer }) {
    return acknowledgeLearning("learning.question", { ...learningConfirmation(input), answer: oneOf(input.answer, ["yes", "no", "unsure"] as const) });
  }
  async function reportManualApplication(input: PipelineLearningConfirmation) { return acknowledgeLearning("learning.manual_report", learningConfirmation(input)); }
  async function revokeLearning(input: { feedbackId?: string; grantId?: string }) {
    const keys = Object.keys(input);
    if (keys.length !== 1 || !["feedbackId", "grantId"].includes(keys[0])) fail("Select exactly one preference or autonomy grant to revoke.");
    return acknowledgeLearning("learning.revoke", input.feedbackId !== undefined ? { feedbackId: id(input.feedbackId) } : { grantId: id(input.grantId) });
  }
  async function grantMatchAutonomy(input: PipelineLearningConfirmation & { expiresAt: string }) {
    const confirmed = learningConfirmation(input), expiresAt = date(input.expiresAt), remaining = Date.parse(expiresAt) - Date.now();
    if (remaining <= 0) fail("Choose a future autonomy expiry.");
    if (remaining > 30 * 86400000) fail("Autonomy expiry must be within 30 days.");
    return acknowledgeLearning("learning.grant", { ...confirmed, expiresAt });
  }
  async function requestCommand(bindingId: string, type: PipelineCommandType, args: { portal?: string; questionId?: string; taskId?: string } = {}) {
    const selected = id(bindingId), commandType = oneOf(type, COMMAND_TYPES);
    if (Object.keys(args).some(key => !["portal", "questionId", "taskId"].includes(key))) fail("Only exact pipeline targets are allowed; no browser URL, fill or click instruction is accepted.");
    const commandArgs = { ...(args.portal !== undefined ? { portal: text(args.portal, 200, 1) } : {}), ...(args.questionId !== undefined ? { questionId: id(args.questionId) } : {}), ...(args.taskId !== undefined ? { taskId: id(args.taskId) } : {}) };
    if (["retry_login", "check_session"].includes(commandType) && !commandArgs.portal) fail("Select the exact portal for this agent.");
    if (commandType === "open_manual" && (!commandArgs.taskId || Object.keys(commandArgs).length !== 1)) fail("Select the exact task to open manually; no filling or clicking is authorized.");
    if (commandType !== "open_manual" && commandArgs.taskId) fail("Task targets are only accepted for exact manual open.");
    const result = commandRow((await action("commands.request", { bindingId: selected, type: commandType, args: commandArgs })).command, userId);
    return result.bindingId === selected && result.type === commandType ? result : fail();
  }
  return { dispose, check, importDraft, getProfile, confirmProfile, getSettings, putSettings, listAnswers, revokeAnswer,
    listQuestions, answerQuestion, listBoards, addBoard, requestRun, listRuns, cancelRun, listTasks, listAgents, listSessions, requestCommand,
    listLearning, recordMatchFeedback, answerMatchQuestion, reportManualApplication, revokeLearning, grantMatchAutonomy };
}
export type PipelineClient = ReturnType<typeof createPipelineClient>;
