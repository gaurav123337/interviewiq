/// <reference types="node" />
/* Real transport/edge validation with synthetic IO only; never contacts a board or DB. */
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error The native Node transport intentionally has no declaration.
import { createPipelineTransport } from "../../scripts/job-sites-db.js";
import { decideVerifiedJob } from "../../scripts/apply-pipeline-lib.js";
import { validatePipelineActionRequest } from "../../supabase/functions/_shared/applyPipeline";
import { validateAgentActionRequest } from "../../supabase/functions/_shared/applyAgent";

const id = "11111111-1111-4111-8111-111111111111";
const now = "2026-11-22T12:00:00Z";
const job = { jobUrl: "https://boards.greenhouse.io/proof/jobs/1", title: "Software Engineer", company: "Proof",
  description: "TypeScript required", skills: ["typescript"], location: "Remote", country: "US", postedAt: now };
const profile = { revision: 1, resumeText: "Exact resume", resumeApproved: true, facts: {
  role: { value: "Software Engineer", source: "user" as const, confirmedAt: now },
  locations: { value: ["Remote"], source: "user" as const, confirmedAt: now },
  skills: { value: ["typescript"], source: "user" as const, confirmedAt: now },
} };
const lease = { taskId: id, leaseVersion: 1, leaseNonce: id };
const decision = { ...decideVerifiedJob(job, { profile, settingsRevision: 1, now }), settingsRevision: 1 };
const snapshot = { jobUrl: job.jobUrl, checkedAt: now, accountIdentity: "proof@example.com",
  session: { ok: true, jobUrl: job.jobUrl, checkedAt: now }, receipt: null };
const observation = { commandId: id, claimNonce: id, before: snapshot,
  after: { ...snapshot, checkedAt: "2026-11-22T12:00:01Z", receipt: { selector: "#application_confirmation", text: "Application received", url: job.jobUrl } } };
const reserve = { ...lease, profileRevision: 1, settingsRevision: 1, answersRevision: 0,
  siteAllowed: true, accountVerified: true, requiredComplete: true, answerIds: [], idempotencyKey: "proof", grantId: id, similarityKey: decision.similarityKey };
const validate = (action: string, args: unknown = {}, caller: "agent" | "browser" = "agent") =>
  validatePipelineActionRequest({ operation: "pipeline.action", action, args }, caller);

function transport(reply?: unknown, status = 200) {
  const sent: Array<{ endpoint: string; init: RequestInit; body: { operation: string; action: string; args: unknown } }> = [];
  const fetchImpl = vi.fn(async (endpoint: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    sent.push({ endpoint, init, body });
    return { ok: status === 200, status, json: async () => reply ?? { ok: true, action: body.action, data: body.action === "learning.list" ? { learning: { feedback: [], grants: [] } } : { accepted: true } } };
  });
  return { sent, fetchImpl, action: createPipelineTransport({ mode: "paired", endpoint: "https://example.supabase.co/functions/v1/apply-agent", token: "synthetic-binding-token" }, { fetchImpl }) };
}

describe("verified learning transport", () => {
  it("forwards worker learning, actual pure decisions and independent observations only in the pipeline namespace", async () => {
    const t = transport();
    await expect(t.action("learning.list")).resolves.toEqual({ learning: { feedback: [], grants: [] } });
    await expect(t.action("tasks.decide", { ...lease, decision })).resolves.toEqual({ accepted: true });
    await expect(t.action("learning.manual_observe", observation)).resolves.toEqual({ accepted: true });
    await expect(t.action("submission.reserve", reserve)).resolves.toEqual({ accepted: true });
    expect(t.sent.map(s => s.body)).toEqual([
      { operation: "pipeline.action", action: "learning.list", args: {} },
      { operation: "pipeline.action", action: "tasks.decide", args: { ...lease, decision } },
      { operation: "pipeline.action", action: "learning.manual_observe", args: observation },
      { operation: "pipeline.action", action: "submission.reserve", args: reserve },
    ]);
    for (const sent of t.sent) {
      expect(sent.endpoint).toBe("https://example.supabase.co/functions/v1/apply-agent");
      expect(sent.init.redirect).toBe("error");
      expect(sent.init.headers).toEqual({ Authorization: "Bearer synthetic-binding-token", "Content-Type": "application/json" });
      expect(sent.init.signal).toBeDefined();
      expect(validate(sent.body.action, sent.body.args).ok).toBe(true);
    }
  });
  it("keeps user-only learning writes, browser commands, approval and legacy actions unavailable", async () => {
    const t = transport();
    for (const action of ["learning.feedback", "learning.question", "learning.grant", "learning.revoke", "learning.manual_report", "commands.request", "profile.confirm", "questions.answer", "memory.put", "results.record"]) {
      await expect(t.action(action, {})).rejects.toThrow("Unsupported pipeline action");
      expect(validate(action).ok).toBe(false);
    }
    expect(t.fetchImpl).not.toHaveBeenCalled();
    expect(validate("learning.list", { ownerId: id })).toEqual({ ok: false, error: "authoritative_user_forbidden" });
    expect(validate("learning.list", { limit: 201 }).ok).toBe(false);
  });
  it("preserves paginated learning and SQL row results inside the edge action envelope", async () => {
    for (const hasMore of [true, false]) {
      const data = { hasMore, learning: { feedback: [], grants: [], receipts: [], questions: [], eligibility: [] } };
      const t = transport({ ok: true, action: "learning.list", data });
      const args = { limit: 200, offset: hasMore ? 0 : 200 };
      expect(validate("learning.list", args).ok).toBe(true);
      await expect(t.action("learning.list", args)).resolves.toEqual(data);
      expect(t.sent[0].body).toEqual({ operation: "pipeline.action", action: "learning.list", args });
    }
    const data = { ok: true, receipt: { id } };
    await expect(transport({ ok: true, action: "learning.manual_observe", data }).action("learning.manual_observe", observation)).resolves.toEqual(data);
  });
  it.each([401, 403, 409, 503])("fails closed without fallback on HTTP %s", async status => {
    const t = transport({ ok: false }, status);
    await expect(t.action("learning.list")).rejects.toMatchObject({ code: status === 409 ? "PIPELINE_STALE" : status === 503 ? "PIPELINE_OFFLINE" : "PIPELINE_REVOKED" });
    expect(t.sent).toHaveLength(1);
  });
  it("rejects mismatched and missing response envelopes", async () => {
    for (const body of [{ ok: true, action: "profile.get", data: {} }, { ok: true, action: "learning.list" }]) {
      const t = transport(body);
      await expect(t.action("learning.list")).rejects.toMatchObject({ code: "PIPELINE_OFFLINE" });
    }
  });
});

describe("verified learning edge validation", () => {
  it("accepts optional bounded learning pagination only in the worker pipeline namespace", () => {
    for (const args of [{}, { limit: 1 }, { limit: 200 }, { offset: 0 }, { offset: 2147483647 }, { limit: 200, offset: 400 }]) {
      expect(validate("learning.list", args)).toEqual({ ok: true, action: "learning.list", args });
      expect(validate("learning.list", args, "browser")).toEqual({ ok: false, error: "unsupported_action" });
      expect(validateAgentActionRequest({ operation: "agent.action", action: "learning.list", args }).ok).toBe(false);
    }
    for (const args of [{ limit: 0 }, { limit: -1 }, { limit: 201 }, { limit: 1.5 }, { limit: "1" }, { limit: null },
      { offset: -1 }, { offset: 0.5 }, { offset: 2147483648 }, { offset: "0" }, { offset: null },
      { offset: NaN }, { offset: Infinity }, { offset: 0, limit: 200, hasMore: true }]) {
      expect(validate("learning.list", args)).toEqual({ ok: false, error: "invalid_args" });
    }
    for (const caller of ["agent", "browser"] as const) {
      expect(validate("learning.list", { limit: 200, offset: 0, ownerId: id }, caller)).toEqual({ ok: false, error: "authoritative_user_forbidden" });
      expect(validate("learning.list", { limit: 1, offset: 0, metadata: { user_id: id } }, caller)).toEqual({ ok: false, error: "authoritative_user_forbidden" });
    }
  });
  it("accepts the pure decision wire shape and rejects missing revisions, invalid fences and untrusted metadata", () => {
    expect(validate("tasks.decide", { ...lease, decision }).ok).toBe(true);
    const invalid = [
      { ...decision, settingsRevision: undefined }, { ...decision, profileRevision: 0 },
      { ...decision, status: "submitted" }, { ...decision, source: "user" }, { ...decision, grantId: "not-uuid" },
      { ...decision, status: "eligible_auto", grantId: undefined }, { ...decision, score: NaN },
      { ...decision, similarityKey: "x".repeat(16001) }, { ...decision, reasons: ["javascript:alert(1)"] },
      { ...decision, requirements: [{ anyOf: ["typescript"], core: "true", evidence: "required" }] },
      { ...decision, requirements: [{ anyOf: [], core: true, evidence: "required" }] },
      { ...decision, requirements: [{ anyOf: ["typescript"], core: true, evidence: "<script>alert(1)</script>" }] },
      { ...decision, question: { kind: "skill_gap", skills: ["rust"], text: "Question", controlType: "eval" } },
      { ...decision, portal: "greenhouse\u0007" }, { ...decision, arbitrary: true },
    ];
    for (const bad of invalid) expect(validate("tasks.decide", { ...lease, decision: bad }).ok).toBe(false);
    expect(validate("tasks.decide", { ...lease, leaseNonce: "bad", decision }).ok).toBe(false);
    expect(validate("tasks.decide", { ...lease, decision: { ...decision, owner_id: id } }).ok).toBe(false);
  });
  it("requires grant and bounded similarity in addition to every existing reserve safety argument", () => {
    expect(validate("submission.reserve", reserve).ok).toBe(true);
    for (const patch of [{ grantId: undefined }, { grantId: "bad" }, { similarityKey: undefined }, { similarityKey: "" },
      { similarityKey: "x".repeat(16001) }, { siteAllowed: false }, { accountVerified: "true" }, { requiredComplete: false },
      { answersRevision: -1 }, { answerIds: ["bad"] }, { idempotencyKey: "" }, { leaseVersion: 0 }]) {
      expect(validate("submission.reserve", { ...reserve, ...patch }).ok).toBe(false);
    }
    expect(validate("submission.reserve", { ...reserve, similarityKey: "x".repeat(16000) }).ok).toBe(true);
  });
  it("requires exact public snapshots, independent session booleans and bounded receipt metadata", () => {
    expect(validate("learning.manual_observe", observation).ok).toBe(true);
    for (const after of [
      { ...observation.after, jobUrl: "javascript:alert(1)" }, { ...observation.after, accountIdentity: " " },
      { ...observation.after, checkedAt: "yesterday" }, { ...observation.after, accountIdentity: "x".repeat(201) },
      { ...observation.after, session: { ...snapshot.session, ok: "true" } },
      { ...observation.after, session: { ...snapshot.session, jobUrl: "https://example.com/other" } },
      { ...observation.after, session: { ...snapshot.session, cookies: [] } },
      { ...observation.after, receipt: undefined },
      { ...observation.after, receipt: { selector: "#status", text: "Received", url: "https://127.0.0.1/jobs" } },
      { ...observation.after, receipt: { selector: "javascript:alert(1)", text: "Received", url: job.jobUrl } },
      { ...observation.after, receipt: { selector: "#status", text: "<script>alert(1)</script>", url: job.jobUrl } },
    ]) expect(validate("learning.manual_observe", { ...observation, after }).ok).toBe(false);
    expect(validate("learning.manual_observe", { ...observation, claimNonce: "bad" }).ok).toBe(false);
    expect(validate("learning.manual_observe", { ...observation, before: null }).ok).toBe(false);
    expect(validate("learning.manual_observe", observation, "browser").ok).toBe(false);
  });
  it("accepts auto grants and skill-gap decisions but not server-owned snapshot fields", () => {
    expect(validate("tasks.decide", { ...lease, decision: { ...decision, status: "eligible_auto", grantId: id } }).ok).toBe(true);
    expect(validate("tasks.decide", { ...lease, decision: { ...decision, eligible: false, status: "waiting_match_answer",
      question: { kind: "skill_gap", skills: ["rust"], text: "Do you have Rust experience?" } } }).ok).toBe(true);
    for (const patch of [{ jobUrl: job.jobUrl }, { decidedAt: now }, { answersRevision: 0 }]) {
      expect(validate("tasks.decide", { ...lease, decision: { ...decision, ...patch } }).ok).toBe(false);
    }
  });
  it("treats source and control-plane selectors as inert metadata, not executable values", () => {
    for (const source of ["javascript:alert(1)", "<script>alert(1)</script>", "lever\u0007"]) {
      expect(validate("jobs.ingest", { boardId: id, jobs: [{ ...job, source }] }).ok).toBe(false);
    }
    for (const portal of ["javascript:alert(1)", "<script>alert(1)</script>", "greenhouse\u0007"]) {
      expect(validate("commands.request", { bindingId: id, type: "check_session", args: { portal } }, "browser").ok).toBe(false);
      expect(validate("sessions.report", { portal, status: "authenticated" }).ok).toBe(false);
    }
    for (const controlType of ["eval", "javascript:alert(1)", "<script>"]) {
      expect(validate("questions.queue", { ...lease, question: { meaning: "name", questionText: "Name?", controlType, options: [], context: {} } }).ok).toBe(false);
    }
  });
  it("accepts bounded board match metadata and browser-only exact-task manual commands", () => {
    for (const boardMatch of ["low", "medium", "high", "unknown"]) expect(validate("jobs.ingest", { boardId: id, jobs: [{ ...job, boardMatch }] }).ok).toBe(true);
    for (const boardMatch of ["LOW", "javascript:alert(1)", true, null]) expect(validate("jobs.ingest", { boardId: id, jobs: [{ ...job, boardMatch }] }).ok).toBe(false);
    expect(validate("commands.request", { bindingId: id, type: "open_manual", args: { taskId: id } }, "browser").ok).toBe(true);
    expect(validate("commands.request", { bindingId: id, type: "open_manual", args: { taskId: id } }).ok).toBe(false);
    expect(validate("commands.request", { bindingId: id, type: "open_manual", args: { taskId: id, jobUrl: job.jobUrl } }, "browser").ok).toBe(false);
  });
});
