// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { id: "00000000-0000-4000-8000-000000000001" } as { id: string } | null,
  listeners: new Set<(s: { user: { id: string } | null }) => void>(),
  client: vi.fn(), rpc: vi.fn(), session: vi.fn(), from: vi.fn(), headers: [] as [string, string][], signals: [] as AbortSignal[],
}));
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: state.user }), getSupabaseClient: state.client,
  subscribeCloud: (fn: (s: { user: { id: string } | null }) => void) => { state.listeners.add(fn); fn({ user: state.user }); return () => state.listeners.delete(fn); },
}));
import { agentReadiness, createPipelineClient, DEFAULT_PIPELINE_SETTINGS, PipelineError, validatePipelineSettings, validateProfileConfirmation, type PipelineQuestion } from "../services/applyPipeline";
const USER_A = "00000000-0000-4000-8000-000000000001", USER_B = "00000000-0000-4000-8000-000000000002";
function switchAccount(id: string | null) { state.user = id ? { id } : null; for (const fn of state.listeners) fn({ user: state.user }); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function builder(promise: Promise<unknown>) {
  return { setHeader: (key: string, value: string) => { state.headers.push([key, value]); return { abortSignal: (signal: AbortSignal) => { state.signals.push(signal); return promise; } }; } };
}
const client = { rpc: state.rpc, auth: { getSession: state.session }, from: state.from };
beforeEach(() => {
  vi.clearAllMocks(); state.user = { id: USER_A }; state.listeners.clear(); state.headers.length = 0; state.signals.length = 0;
  state.client.mockReset().mockResolvedValue(client);
  state.session.mockReset().mockImplementation(async () => ({ data: { session: { user: { id: state.user?.id }, access_token: "synthetic-account-token" } }, error: null }));
    state.rpc.mockReset().mockImplementation(() => builder(Promise.resolve({ data: { runs: [] }, error: null })));
});
afterEach(() => { state.listeners.clear(); });

describe("pipeline request account fencing", () => {
  it("pins the own account JWT and never invokes the legacy or admin RPC", async () => {
    const api = createPipelineClient(USER_A);
    await api.listRuns();
    expect(state.rpc.mock.calls).toEqual([["my_apply_pipeline_action", { p_action: "run.list", p_args: { limit: 50 } }]]);
    expect(state.headers).toEqual([["Authorization", "Bearer synthetic-account-token"]]);
    api.dispose(); expect(state.listeners.size).toBe(0);
  });
  it("signed-out callers cannot create a pipeline scope", () => {
    state.user = null; expect(() => createPipelineClient(USER_A)).toThrow(/Sign in/); expect(state.client).not.toHaveBeenCalled();
  });
  it("A→B→A during client lookup permanently cancels an A draft before any RPC", async () => {
    const pending = deferred<typeof client>(); state.client.mockReturnValue(pending.promise);
    const api = createPipelineClient(USER_A), request = api.confirmProfile({ expectedRevision: null, facts: { name: { value: "Private A User", source: "user", confirmedAt: new Date().toISOString() } }, resumeText: "private A resume", resumeApproved: true });
    const rejected = expect(request).rejects.toThrow(/Account or selected agent changed/);
    switchAccount(USER_B); switchAccount(USER_A); pending.resolve(client);
    await rejected; expect(state.rpc).not.toHaveBeenCalled(); expect(state.session).not.toHaveBeenCalled(); api.dispose();
  });
  it("rejects a session belonging to a different account before authorization", async () => {
    state.session.mockResolvedValue({ data: { session: { user: { id: USER_B }, access_token: "B-token" } }, error: null });
    const api = createPipelineClient(USER_A);
    await expect(api.requestRun(USER_A, "review")).rejects.toThrow(/Sign in again/);
    expect(state.rpc).not.toHaveBeenCalled(); api.dispose();
  });
  it("account changes abort an active RPC and reject late results even after returning to A", async () => {
    const pending = deferred<unknown>(); state.rpc.mockImplementation(() => builder(pending.promise));
    const api = createPipelineClient(USER_A), request = api.getProfile();
    const rejected = expect(request).rejects.toThrow(/Account or selected agent changed/);
    await vi.waitFor(() => expect(state.signals).toHaveLength(1));
    switchAccount(USER_B); switchAccount(USER_A);
    expect(state.signals[0].aborted).toBe(true);
    pending.resolve({ data: { profile: { resume_text: "private old resume" } }, error: null });
    await rejected; api.dispose();
  });
  it("disposing a selection prevents queued operations from reaching the RPC", async () => {
    const api = createPipelineClient(USER_A); api.dispose();
    await expect(api.requestRun(USER_A, "review")).rejects.toThrow(/selected agent changed/);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("runtime normalization rejects cross-account rows, invalid statuses and missing wrappers", async () => {
    const api = createPipelineClient(USER_A);
    state.rpc.mockImplementation(() => builder(Promise.resolve({ data: { profile: { user_id: USER_B, resume_text: "Other user's resume" } }, error: null })));
    await expect(api.getProfile()).rejects.toThrow(/Account mismatch/);
    state.rpc.mockImplementation(() => builder(Promise.resolve({ data: { profiles: [] }, error: null })));
    await expect(api.getProfile()).rejects.toThrow(/invalid response/);
    state.rpc.mockImplementation(() => builder(Promise.resolve({ data: { runs: [{ id: USER_A, binding_id: USER_A, mode: "review", status: "done" }] }, error: null })));
    await expect(api.listRuns()).rejects.toThrow(/invalid response/); api.dispose();
  });
  it("normalizes bounded min/max salary and drops lease and secret metadata", async () => {
    const raw = { id: USER_A, run_id: USER_A, target_binding_id: USER_A, status: "queued", profile_revision: 1, settings_revision: 1, answers_revision: 0, score: 100, reason: null,
      lease_nonce: "sensitive-nonce", binding_token: "sensitive-token", job: { jobUrl: "https://careers.example.com/job/test", title: "Engineer", company: "Example", description: "", skills: ["typescript"], location: "Remote", salary: { min: 100000, max: 150000, currency: "USD", period: "year" } } };
    state.rpc.mockImplementation(() => builder(Promise.resolve({ data: { tasks: [raw] }, error: null })));
    const api = createPipelineClient(USER_A), tasks = await api.listTasks();
    expect(tasks[0].job.salary).toEqual({ min: 100000, max: 150000, currency: "USD", period: "year" });
    expect(tasks[0]).not.toHaveProperty("lease_nonce"); expect(tasks[0]).not.toHaveProperty("binding_token");
    raw.job.salary.min = 200000;
    await expect(api.listTasks()).rejects.toThrow(/invalid response/); api.dispose();
  });
  it("invalid exact choices, global scope promotion, consent and shell commands never reach the RPC", async () => {
    const q: PipelineQuestion = { id: USER_A, questionKey: "test", meaning: "unknown:test", questionText: "Choose an option", controlType: "select", options: ["One", "Two"], context: { application: "https://careers.example.com/job/test" }, scope: "application", scopeKey: "https://careers.example.com/job/test", currency: null, reason: null, profileRevision: 1, status: "pending", answerId: null, taskIds: [USER_A], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const api = createPipelineClient(USER_A);
    await expect(api.answerQuestion(q, { answer: "Guessed", scope: q.scope, scopeKey: q.scopeKey, confirm: true })).rejects.toThrow(/offered options/);
    await expect(api.answerQuestion(q, { answer: "One", scope: "global", scopeKey: "", confirm: true })).rejects.toThrow(/explicit scope/);
    await expect(api.answerQuestion({ ...q, controlType: "checkbox" }, { answer: "true", scope: q.scope, scopeKey: q.scopeKey, confirm: true })).rejects.toThrow(/fresh human review/);
    await expect(api.requestCommand(USER_A, "shell" as "pause", { portal: "example.com" })).rejects.toThrow();
    expect(state.rpc).not.toHaveBeenCalled(); api.dispose();
  });
  it.each(["email", "tel", "url"] as const)("preserves exact %s question and saved-answer control type for future reuse", async controlType => {
    const timestamp = new Date().toISOString(), answer = controlType === "email" ? "user@example.invalid" : controlType === "tel" ? "+1 555 123 4567" : "https://portfolio.example.com/user";
    const question = { id: USER_A, question_key: `typed-${controlType}`, meaning: controlType === "email" ? "email" : controlType === "tel" ? "phone" : "portfolio", question_text: `Your ${controlType}`, control_type: controlType, options: [], context: {}, scope: "global", scope_key: "", currency: null, reason: null, profile_revision: 1, status: "pending", answer_id: null, task_ids: [USER_A], created_at: timestamp, updated_at: timestamp };
    const saved = { id: USER_A, meaning: question.meaning, question_text: question.question_text, control_type: controlType, options: [], context: {}, answer, scope: "global", scope_key: "", profile_revision: 1, confirmed_at: timestamp, expires_at: null, revoked_at: null, provenance: "user" };
    state.rpc.mockImplementation((_name, request) => builder(Promise.resolve({ data: request.p_action === "questions.list" ? { questions: [question] } : request.p_action === "questions.answer" ? { answer: saved, revision: 2 } : { answers: [saved], revision: 2 }, error: null })));
    const api = createPipelineClient(USER_A), [normalized] = await api.listQuestions();
    expect(normalized.controlType).toBe(controlType);
    const confirmed = await api.answerQuestion(normalized, { answer, scope: "global", scopeKey: "", confirm: true });
    expect(confirmed.answer.controlType).toBe(controlType);
    expect((await api.listAnswers()).answers[0].controlType).toBe(controlType);
    expect(state.rpc.mock.calls[1]).toEqual(["my_apply_pipeline_action", { p_action: "questions.answer", p_args: { questionId: USER_A, answer, scope: "global", scopeKey: "", confirm: true } }]); api.dispose();
  });
  it("invalid native email/URL answers and file controls never become reusable text answers", async () => {
    const now = new Date().toISOString();
    const q: PipelineQuestion = { id: USER_A, questionKey: "native", meaning: "email", questionText: "Email address", controlType: "email", options: [], context: {}, scope: "global", scopeKey: "", currency: null, reason: null, profileRevision: 1, status: "pending", answerId: null, taskIds: [USER_A], createdAt: now, updatedAt: now };
    const api = createPipelineClient(USER_A);
    await expect(api.answerQuestion(q, { answer: "not-an-email", scope: "global", scopeKey: "", confirm: true })).rejects.toThrow(/valid factual email/);
    await expect(api.answerQuestion({ ...q, controlType: "url" }, { answer: "javascript:alert(1)", scope: "global", scopeKey: "", confirm: true })).rejects.toThrow(/HTTP or HTTPS/);
    expect(state.rpc).not.toHaveBeenCalled();
    state.rpc.mockImplementation(() => builder(Promise.resolve({ data: { questions: [{ id: USER_A, question_key: "file", meaning: "resume", question_text: "Upload resume", control_type: "file", options: [], context: {} }] }, error: null })));
    await expect(api.listQuestions()).rejects.toThrow(/invalid response/); api.dispose();
  });
  it("imports only exact account-scoped saved rows and never consults the local profile cache", async () => {
    const queries: [string, string][] = [];
    state.from.mockImplementation((table: string) => ({ select: (columns: string) => {
      expect(columns).toBe("data");
      return { eq: (column: string, userId: string) => { queries.push([column, userId]); return { setHeader: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: { data: table === "career_profiles" ? { headline: "Engineer", skills: ["typescript"], location: "Remote", years: 2, remote: true, targetTitles: ["Engineer"] } : { text: "Synthetic User\nuser@example.invalid\nTypeScript engineer resume" } }, error: null }) }) }) }; } };
    } }));
    const api = createPipelineClient(USER_A), draft = await api.importDraft();
    expect(queries).toEqual([["user_id", USER_A], ["user_id", USER_A]]); expect(draft.values.email).toBe("user@example.invalid"); expect(draft.values.skills).toEqual(["typescript"]);
    expect(state.rpc).not.toHaveBeenCalled(); api.dispose();
  });
  it("missing RPC is honestly unavailable without admin or synthetic fallback", async () => {
    state.rpc.mockImplementation(() => builder(Promise.resolve({ data: null, error: { code: "PGRST202", message: "private transport body" } })));
    const api = createPipelineClient(USER_A);
    await expect(api.getProfile()).rejects.toThrow(/backend may not be installed/);
    expect(state.rpc).toHaveBeenCalledTimes(1); api.dispose();
  });
  it("does not display raw transport errors or secrets", async () => {
    state.rpc.mockImplementation(() => builder(Promise.resolve({ data: null, error: { code: "XX", message: "private resume and bot token" } })));
    const api = createPipelineClient(USER_A);
    await expect(api.getProfile()).rejects.toThrow("Pipeline request failed. Reload before retrying; completion is not confirmed."); api.dispose();
  });
});

describe("explicit factual approval validation", () => {
  const confirmedAt = "2026-11-14T00:00:00.000Z", validUntil = "2026-12-14T00:00:00.000Z", now = Date.parse("2026-11-14T12:00:00.000Z");
  const fact = (value: string | boolean | string[], extra = {}) => ({ value, source: "user" as const, confirmedAt, ...extra });
  it("safe defaults do not opt into autonomy, submission or AI", () => {
    expect(DEFAULT_PIPELINE_SETTINGS.enabled).toBe(false); expect(DEFAULT_PIPELINE_SETTINGS.autoSubmit).toBe(false);
    expect(DEFAULT_PIPELINE_SETTINGS.aiConsent).toBe(false); expect(validatePipelineSettings(DEFAULT_PIPELINE_SETTINGS)).toBeNull();
  });
  it("work authorization and sponsorship require independent country-bound boolean facts and expiry", () => {
    expect(validateProfileConfirmation({ facts: { workAuthorization: fact(true) }, resumeText: "", resumeApproved: false }, now)).toMatch(/expiry/);
    expect(validateProfileConfirmation({ facts: { workAuthorization: fact(true, { validUntil }) }, resumeText: "", resumeApproved: false }, now)).toMatch(/country-bound/);
    expect(validateProfileConfirmation({ facts: { workAuthorization: fact(true, { validUntil, scope: { country: "IN" } }), requiresSponsorship: fact(false, { validUntil, scope: { country: "IN" } }) }, resumeText: "own resume", resumeApproved: true }, now)).toBeNull();
  });
  it("salary cannot be silently assumed or converted and expired facts are rejected", () => {
    expect(validateProfileConfirmation({ facts: { expectedSalary: fact("50000", { validUntil, scope: { country: "US" } }) }, resumeText: "", resumeApproved: false }, now)).toMatch(/currency/);
    expect(validateProfileConfirmation({ facts: { noticePeriod: fact("1 month", { validUntil: confirmedAt }) }, resumeText: "", resumeApproved: false }, now)).toMatch(/expiry/);
  });
  it("approval requires exact resume content and never accepts inferred provenance", () => {
    expect(validateProfileConfirmation({ facts: { name: fact("A User") }, resumeText: "", resumeApproved: true }, now)).toMatch(/exact resume/);
    expect(validateProfileConfirmation({ facts: { name: { ...fact("A User"), source: "ai" as "user" } }, resumeText: "own resume", resumeApproved: true }, now)).toMatch(/Check/);
  });
  it("portal profile approval binds exact account/resume/scope/expiry and accepts full 12k bound", () => {
    const resumeText = "x".repeat(11000), scope = { portal: "naukri:www.naukri.com/candidate" };
    const input = { facts: { name: fact("A User"), "portalProfileApproved:naukri": fact(true, { scope, validUntil }), "portalAccountIdentity:naukri": fact("a@example.invalid", { scope, validUntil }), "portalResumeText:naukri": fact(resumeText, { scope, validUntil }) }, resumeText, resumeApproved: true };
    expect(validateProfileConfirmation(input, now)).toBeNull();
    expect(validateProfileConfirmation({ ...input, resumeText: "different resume" }, now)).toMatch(/exact approved resume/);
    expect(validateProfileConfirmation({ ...input, facts: { ...input.facts, "portalProfileApproved:naukri": fact(true, { scope: { portal: "instahyre:www.instahyre.com/candidate" }, validUntil }) } }, now)).toMatch(/exact portal scope/);
    expect(validateProfileConfirmation({ facts: { name: fact("A User") }, resumeText: "x".repeat(12001), resumeApproved: true }, now)).toMatch(/12,000/);
  });
  it("agent readiness requires a fresh heartbeat and the real worker capability set", () => {
    const base = { bindingId: USER_A, label: "Test", engineVersion: "paired-worker/1.0.0", capabilities: ["leased-tasks", "verified-answer-bank", "job-bound-receipts"], status: "ready" as const, profileMetadata: {}, heartbeatAt: confirmedAt, revokedAt: null, lastUsedAt: null };
    expect(agentReadiness(base, Date.parse(confirmedAt) + 1000).ready).toBe(true);
    expect(agentReadiness({ ...base, heartbeatAt: null }, now).label).toMatch(/not installed/);
    expect(agentReadiness(base, now).ready).toBe(false);
    expect(agentReadiness({ ...base, revokedAt: confirmedAt }, now).label).toBe("Revoked");
  });
  it("rejects invalid quiet hours and unbounded settings", () => {
    expect(validatePipelineSettings({ ...DEFAULT_PIPELINE_SETTINGS, quietFrom: "22:00" })).toMatch(/both quiet-hour/);
    expect(validatePipelineSettings({ ...DEFAULT_PIPELINE_SETTINGS, timeZone: "Mars/Invalid" })).toMatch(/IANA/);
    expect(validatePipelineSettings({ ...DEFAULT_PIPELINE_SETTINGS, dailyCap: 101 })).not.toBeNull();
  });
});
