import { assertEquals } from "jsr:@std/assert";
import {
  DEFAULT_PIPELINE_SETTINGS, PIPELINE_AGENT_ACTIONS, PIPELINE_BROWSER_ACTIONS,
  isPipelineSettings, isPublicPipelineUrl, matchPipelineJob, validatePipelineActionRequest,
  type PipelineJob, type VerifiedProfile,
} from "./applyPipeline.ts";

const id = "11111111-1111-4111-8111-111111111111";
const lease = { taskId: id, leaseVersion: 1, leaseNonce: id };
const now = Date.parse("2026-11-14T12:00:00Z");
const profile: VerifiedProfile = { revision: 1, answers_revision: 0, resume_text: "Exact resume", resume_approved: true,
  facts: { role: { value: "Software Engineer", source: "user", confirmedAt: "2026-11-14T00:00:00Z" },
    locations: { value: ["Remote"], source: "user", confirmedAt: "2026-11-14T00:00:00Z" },
    skills: { value: ["typescript", "sql"], source: "user", confirmedAt: "2026-11-14T00:00:00Z" } } };
const job: PipelineJob = { jobUrl: "https://boards.greenhouse.io/proof/jobs/1", title: "Software Engineer", company: "Proof",
  description: "Build software", skills: ["typescript", "sql"], location: "Remote", country: "US", postedAt: "2026-11-14T10:00:00Z" };
const request = (action: string, args: unknown = {}, caller: "agent" | "browser" = "agent") => validatePipelineActionRequest({ operation: "pipeline.action", action, args }, caller);

Deno.test("pipeline action namespace is separate and user identity is never accepted", () => {
  assertEquals(PIPELINE_AGENT_ACTIONS.includes("boards.discover"), true);
  assertEquals(PIPELINE_BROWSER_ACTIONS.includes("profile.confirm"), true);
  assertEquals(request("memory.put").ok, false);
  assertEquals(request("profile.confirm").ok, false);
  assertEquals(request("profile.get", { user_id: id }), { ok: false, error: "authoritative_user_forbidden" });
  assertEquals(request("agent.heartbeat", { engineVersion: "proof", capabilities: [], status: "ready", profileMetadata: { cookies: "private" } }).ok, false);
  assertEquals(request("profile.get", { arbitrary: "private" }).ok, false);
  assertEquals(request("boards.discover", { url: "https://jobs.lever.co/proof" }).ok, true);
});
Deno.test("strict task fences and reserved attempts cannot report arbitrary success", () => {
  assertEquals(request("tasks.claim", { limit: 11 }).ok, false);
  assertEquals(request("tasks.claim", { limit: 1, leaseSeconds: 30 }).ok, true);
  assertEquals(request("tasks.renew", { ...lease, leaseVersion: 0 }).ok, false);
  assertEquals(request("tasks.report", { ...lease, status: "submitted" }).ok, false);
  assertEquals(request("submission.reserve", { ...lease, profileRevision: 1, settingsRevision: 1, answersRevision: 0,
    siteAllowed: true, accountVerified: true, requiredComplete: true, answerIds: [], idempotencyKey: "proof" }).ok, true);
  assertEquals(request("submission.reserve", { ...lease, profileRevision: 1, settingsRevision: 1, answersRevision: 0,
    siteAllowed: "true", accountVerified: true, requiredComplete: true, answerIds: [], idempotencyKey: "proof" }).ok, false);
  assertEquals(request("submission.finish", { ...lease, reservationId: id, reservationNonce: id, outcome: "submitted" }).ok, false);
  assertEquals(request("submission.finish", { ...lease, reservationId: id, reservationNonce: id, outcome: "unverified" }).ok, true);
});
Deno.test("settings require explicit booleans, bounded caps, real timezone and paired quiet hours", () => {
  assertEquals(isPipelineSettings(DEFAULT_PIPELINE_SETTINGS), true);
  for (const settings of [
    { ...DEFAULT_PIPELINE_SETTINGS, enabled: "true" }, { ...DEFAULT_PIPELINE_SETTINGS, dailyCap: 101 },
    { ...DEFAULT_PIPELINE_SETTINGS, timeZone: "Mars/Orbit" }, { ...DEFAULT_PIPELINE_SETTINGS, quietFrom: "22:00" },
    { ...DEFAULT_PIPELINE_SETTINGS, quietFrom: "25:00", quietTo: "06:00" },
    { ...DEFAULT_PIPELINE_SETTINGS, minimumSalary: { value: 100, currency: "dollars", period: "year" } },
  ]) assertEquals(isPipelineSettings(settings), false);
  assertEquals(isPipelineSettings({ ...DEFAULT_PIPELINE_SETTINGS, quietFrom: "22:00", quietTo: "06:00",
    minimumSalary: { value: 100000, currency: "USD", period: "year" } }), true);
});
Deno.test("verified profile accepts dedicated per-skill keys but not engine-created authority", () => {
  const args = { expectedRevision: null, facts: { "skillYears:node.js": { value: 3, source: "user" } }, resumeText: "Resume", resumeApproved: true };
  assertEquals(request("profile.confirm", args, "browser").ok, true);
  assertEquals(request("profile.confirm", { ...args, facts: { name: { value: "A", source: "ai" } } }, "browser").ok, false);
  assertEquals(request("profile.confirm", { ...args, facts: { "bad:key": { value: "A", source: "user" } } }, "browser").ok, false);
  assertEquals(request("profile.confirm", { ...args, facts: { "skillYears:react": { value: "many", source: "user" } } }, "browser").ok, false);
  assertEquals(request("profile.confirm", { ...args, facts: { "portalProfileApproved:naukri": { value: true, source: "user", scope: { portal: "naukri:naukri.com/candidate" } } } }, "browser").ok, true);
  assertEquals(request("profile.confirm", { ...args, facts: { "portalProfileApproved:naukri": { value: true, source: "user" } } }, "browser").ok, false);
  assertEquals(request("profile.confirm", { ...args, resumeText: "x".repeat(12001) }, "browser").ok, false);
});
Deno.test("questions retain exact options, explicit scoped confirmation and metadata bounds", () => {
  assertEquals(request("questions.queue", { ...lease, question: { meaning: "unknown:question", questionText: "What is your answer?",
    controlType: "select", options: ["One", "Two"], context: { application: job.jobUrl }, scope: "application", scopeKey: job.jobUrl,
    questionKey: "opaque-not-authority", profileRevision: 1 } }).ok, true);
  for (const controlType of ["email", "tel", "url"]) assertEquals(request("questions.queue", { ...lease, question: {
    meaning: controlType === "email" ? "email" : controlType === "tel" ? "phone" : "portfolio", questionText: "Contact field", controlType,
    options: [], context: {}, scope: "global", profileRevision: 1,
  } }).ok, true);
  assertEquals(request("questions.queue", { ...lease, question: { meaning: "name", questionText: "Name?", controlType: "select", options: [], context: {} } }).ok, false);
  assertEquals(request("questions.answer", { questionId: id, answer: "One", scope: "country", confirm: true }, "browser").ok, false);
  assertEquals(request("questions.answer", { questionId: id, answer: "One", scope: "application", scopeKey: job.jobUrl, confirm: false }, "browser").ok, false);
  assertEquals(request("questions.answer", { questionId: id, answer: "One", scope: "application", scopeKey: job.jobUrl, confirm: true }, "browser").ok, true);
});
Deno.test("public targets fail closed for credentials, local/private network and unsafe schemes", () => {
  for (const url of ["http://example.com/jobs", "https://127.0.0.1/jobs", "https://10.0.0.1/jobs", "https://localhost/jobs",
    "https://metadata.internal/jobs", "https://[::1]/jobs", "https://name:password@example.com/jobs", "https://example.com:8443/jobs", "https://example.com/jobs#receipt", "https://example.com/jobs?next=https://evil.example", "https://example.com/jobs%2Fsecret", "javascript:alert(1)"]) {
    assertEquals(isPublicPipelineUrl(url), false, url);
  }
  assertEquals(isPublicPipelineUrl(job.jobUrl), true);
});
Deno.test("bounded deterministic match uses confirmed skills and hard preferences, never resume inference", () => {
  assertEquals(matchPipelineJob(profile, DEFAULT_PIPELINE_SETTINGS, job, now), { score: 100, reason: null });
  assertEquals(matchPipelineJob({ facts: {} }, { ...DEFAULT_PIPELINE_SETTINGS, roles: ["Software Engineer"], locations: ["Remote"] }, job, now).reason, "confirmed_skills_required");
  assertEquals(matchPipelineJob(profile, { ...DEFAULT_PIPELINE_SETTINGS, excludeCompanies: ["Proof"] }, job, now).reason, "excluded_company");
  assertEquals(matchPipelineJob(profile, DEFAULT_PIPELINE_SETTINGS, { ...job, skills: ["typescript", "java", "rust"] }, now), { score: 33, reason: "below_threshold" });
  assertEquals(matchPipelineJob(profile, DEFAULT_PIPELINE_SETTINGS, { ...job, postedAt: undefined }, now).reason, "posting_age_unknown_or_stale");
  assertEquals(matchPipelineJob(profile, { ...DEFAULT_PIPELINE_SETTINGS, requireWorkAuthorization: true }, job, now).reason, "work_authorization_unconfirmed");
  assertEquals(matchPipelineJob({ facts: { ...profile.facts, workAuthorization: { value: true, source: "user", confirmedAt: "2026-11-14T00:00:00Z", scope: { country: "GB" } } } },
    { ...DEFAULT_PIPELINE_SETTINGS, requireWorkAuthorization: true }, job, now).reason, "work_authorization_unconfirmed");
  assertEquals(matchPipelineJob(profile, { ...DEFAULT_PIPELINE_SETTINGS, minimumSalary: { value: 100000, currency: "USD", period: "year" } }, job, now).reason, "salary_unknown_or_below_minimum");
  assertEquals(matchPipelineJob(profile, { ...DEFAULT_PIPELINE_SETTINGS, minimumSalary: { value: 100000, currency: "USD", period: "year" } },
    { ...job, salary: { min: 90000, max: 120000, currency: "USD", period: "year" } }, now).reason, null);
});
Deno.test("commands require type-specific selectors and fenced reports, never caller job targets", () => {
  for (const type of ["pause", "resume"]) {
    assertEquals(request("commands.request", { bindingId: id, type }, "browser").ok, true);
    assertEquals(request("commands.request", { bindingId: id, type, args: { portal: "greenhouse" } }, "browser").ok, false);
    assertEquals(request("commands.request", { bindingId: id, type, args: null }, "browser").ok, false);
  }
  for (const type of ["check_session", "retry_login"]) {
    assertEquals(request("commands.request", { bindingId: id, type }, "browser").ok, false);
    assertEquals(request("commands.request", { bindingId: id, type, args: { portal: " " } }, "browser").ok, false);
    assertEquals(request("commands.request", { bindingId: id, type, args: { portal: "greenhouse", questionId: id } }, "browser").ok, false);
    assertEquals(request("commands.request", { bindingId: id, type, args: { portal: "greenhouse", jobUrl: job.jobUrl } }, "browser").ok, false);
  }
  assertEquals(request("commands.request", { bindingId: id, type: "open_question" }, "browser").ok, false);
  assertEquals(request("commands.request", { bindingId: id, type: "open_question", args: { questionId: id } }, "browser").ok, true);
  assertEquals(request("commands.request", { bindingId: id, type: "open_question", args: { questionId: id }, job }, "browser").ok, false);
  assertEquals(request("commands.report", { commandId: id, status: "done" }).ok, false);
  assertEquals(request("commands.report", { commandId: id, claimNonce: id, status: "submitted" }).ok, false);
  assertEquals(request("commands.report", { commandId: id, claimNonce: id, status: "done" }).ok, true);
});
Deno.test("check-session command accepts only metadata, never scripts or cookies", () => {
  assertEquals(request("commands.request", { bindingId: id, type: "check_session", args: { portal: "greenhouse" } }, "browser").ok, true);
  assertEquals(request("commands.request", { bindingId: id, type: "eval", args: {} }, "browser").ok, false);
  assertEquals(request("sessions.report", { portal: "greenhouse", status: "authenticated", cookies: [] }).ok, false);
});
