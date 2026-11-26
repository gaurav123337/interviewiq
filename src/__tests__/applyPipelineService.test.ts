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

describe("match-learning control plane", () => {
  const confirmedAt = new Date().toISOString();
  const feedback = { id: USER_A, jobUrl: "https://careers.example.com/job/test", similarityKey: "verified-match-v1:test", portal: "naukri:www.naukri.com/candidate", scope: "similar", verdict: "apply", profileRevision: 2, settingsRevision: 3, confirmedAt, revokedAt: null, source: "user" };
  const confirmation = { taskId: USER_A, profileRevision: 2, settingsRevision: 3, confirm: true as const };
  const bound = { similarityKey: feedback.similarityKey, portal: feedback.portal, profileRevision: 2, settingsRevision: 3 };
  const grant = { ...bound, id: USER_B, taskId: USER_A, grantedAt: confirmedAt, expiresAt: new Date(Date.parse(confirmedAt) + 86400000).toISOString(), revokedAt: null, source: "user" };
  const receipt = { ...bound, id: USER_B, taskId: USER_A, jobUrl: feedback.jobUrl, reportedAt: confirmedAt, observedAt: null, source: "user", commandId: null, accountIdentity: null };
  const question = { ...bound, id: USER_B, taskId: USER_A, jobUrl: feedback.jobUrl, question: { kind: "skill_gap", skills: ["react"], text: "Do you know React?" }, answer: "yes", answeredAt: confirmedAt, source: "user", suggestion: "profile_update" };
  const eligibility = { ...bound, taskId: USER_A, eligible: false, applySimilarCount: 0, observedManualReceiptCount: 0 };
  const ledger = () => ({ feedback: [], grants: [], receipts: [], questions: [], eligibility: [] });
  const rowId = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  const respond = (data: unknown, error: unknown = null) => state.rpc.mockImplementation(() => builder(Promise.resolve({ data, error })));
  it("appends every learning array sequentially, preserving current grant and skip beyond the first 200 rows", async () => {
    const pages = Array.from({ length: 3 }, (_, page) => {
      const indices = Array.from({ length: page === 2 ? 1 : 200 }, (_, index) => page * 200 + index);
      return { learning: {
        feedback: indices.map(index => ({ ...feedback, id: rowId(index), verdict: index === 200 ? "skip" : "apply", profileRevision: index === 200 ? 2 : 1 })),
        grants: indices.map(index => ({ ...grant, id: rowId(index), revokedAt: index === 200 ? null : confirmedAt })),
        receipts: indices.map(index => ({ ...receipt, id: rowId(index) })),
        questions: indices.map(index => ({ ...question, id: rowId(index) })),
        eligibility: indices.map(index => ({ ...eligibility, taskId: rowId(index) })),
      }, hasMore: page < 2 };
    });
    const second = deferred<unknown>();
    state.rpc.mockImplementationOnce(() => builder(Promise.resolve({ data: pages[0], error: null })))
      .mockImplementationOnce(() => builder(second.promise))
      .mockImplementationOnce(() => builder(Promise.resolve({ data: pages[2], error: null })));
    const api = createPipelineClient(USER_A), request = api.listLearning();
    await vi.waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(2));
    expect(state.rpc).toHaveBeenCalledTimes(2);
    second.resolve({ data: pages[1], error: null });
    const learning = await request;
    for (const key of Object.keys(learning) as (keyof typeof learning)[]) expect(learning[key]).toHaveLength(401);
    expect(learning.feedback[200]).toMatchObject({ id: rowId(200), verdict: "skip", profileRevision: 2 });
    expect(learning.grants[200]).toMatchObject({ id: rowId(200), revokedAt: null });
    expect(learning.feedback.map(row => row.id)).toEqual(Array.from({ length: 401 }, (_, index) => rowId(index)));
    expect(state.rpc.mock.calls.map(call => call[1])).toEqual([
      { p_action: "learning.list", p_args: {} },
      { p_action: "learning.list", p_args: { limit: 200, offset: 200 } },
      { p_action: "learning.list", p_args: { limit: 200, offset: 400 } },
    ]);
    expect(state.session).toHaveBeenCalledTimes(3);
    expect(state.headers).toEqual(Array.from({ length: 3 }, () => ["Authorization", "Bearer synthetic-account-token"])); api.dispose();
  });
  it("continues when only one learning table has more rows", async () => {
    const first = { ...ledger(), grants: Array.from({ length: 200 }, (_, index) => ({ ...grant, id: rowId(index) })) };
    state.rpc.mockImplementationOnce(() => builder(Promise.resolve({ data: { learning: first, hasMore: true }, error: null })))
      .mockImplementationOnce(() => builder(Promise.resolve({ data: { learning: { ...ledger(), grants: [grant] }, hasMore: false }, error: null })));
    const api = createPipelineClient(USER_A), learning = await api.listLearning();
    expect(learning.grants).toHaveLength(201); expect(learning.feedback).toEqual([]); api.dispose();
  });
  it.each(["feedback", "grants", "receipts", "questions", "eligibility"] as const)("accepts exactly 10,000 %s rows without truncation", async key => {
    const sample = { feedback, grants: grant, receipts: receipt, questions: question, eligibility }[key];
    state.rpc.mockImplementation((_name, request) => builder(Promise.resolve({ data: { learning: { ...ledger(), [key]: Array(200).fill(sample) }, hasMore: (request.p_args.offset ?? 0) < 9800 }, error: null })));
    const api = createPipelineClient(USER_A), learning = await api.listLearning();
    expect(learning[key]).toHaveLength(10000); expect(state.rpc).toHaveBeenCalledTimes(50); api.dispose();
  });
  it("rejects a ledger beyond the read bound instead of returning a silently truncated success", async () => {
    respond({ learning: { ...ledger(), feedback: Array(200).fill(feedback) }, hasMore: true });
    const api = createPipelineClient(USER_A);
    await expect(api.listLearning()).rejects.toThrow(/10,000|10000/);
    expect(state.rpc).toHaveBeenCalledTimes(50); api.dispose();
  });
  it.each(["marker", "oversized", "foreign", "malformed", "backend"])("rejects %s errors on a later page instead of returning partial learning", async kind => {
    const second = kind === "backend" ? { data: null, error: { code: "XX", message: "private payload" } }
      : { data: { learning: { ...ledger(), feedback: kind === "oversized" ? Array(201).fill(feedback) : kind === "foreign" ? [{ ...feedback, user_id: USER_B }] : kind === "malformed" ? [{ ...feedback, source: "ai" }] : [] }, hasMore: kind === "marker" ? "false" : false }, error: null };
    state.rpc.mockImplementationOnce(() => builder(Promise.resolve({ data: { learning: { ...ledger(), feedback: Array(200).fill(feedback) }, hasMore: true }, error: null })))
      .mockImplementationOnce(() => builder(Promise.resolve(second)));
    const api = createPipelineClient(USER_A);
    await expect(api.listLearning()).rejects.toThrow(kind === "foreign" ? /Account mismatch/ : kind === "backend" ? /completion is not confirmed/ : /invalid response/);
    expect(state.rpc).toHaveBeenCalledTimes(2); api.dispose();
  });
  it("A→B→A during next-page authorization prevents the next RPC and permanently invalidates learning", async () => {
    const pending = deferred<unknown>();
    state.session.mockImplementationOnce(async () => ({ data: { session: { user: { id: USER_A }, access_token: "synthetic-account-token" } }, error: null }))
      .mockImplementationOnce(() => pending.promise);
    respond({ learning: { ...ledger(), feedback: Array(200).fill(feedback) }, hasMore: true });
    const api = createPipelineClient(USER_A), request = api.listLearning(), rejected = expect(request).rejects.toThrow(/Account or selected agent changed/);
    await vi.waitFor(() => expect(state.session).toHaveBeenCalledTimes(2));
    switchAccount(USER_B); switchAccount(USER_A);
    pending.resolve({ data: { session: { user: { id: USER_A }, access_token: "synthetic-account-token" } }, error: null });
    await rejected; expect(state.rpc).toHaveBeenCalledTimes(1);
    await expect(api.listLearning()).rejects.toThrow(/Account or selected agent changed/); api.dispose();
  });
  it("A→B→A aborts a later page and never returns the earlier page as a partial success", async () => {
    const pending = deferred<unknown>();
    state.rpc.mockImplementationOnce(() => builder(Promise.resolve({ data: { learning: { ...ledger(), feedback: Array(200).fill(feedback) }, hasMore: true }, error: null })))
      .mockImplementationOnce(() => builder(pending.promise));
    const api = createPipelineClient(USER_A), request = api.listLearning(), rejected = expect(request).rejects.toThrow(/Account or selected agent changed/);
    await vi.waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(2));
    switchAccount(USER_B); switchAccount(USER_A); pending.resolve({ data: { learning: ledger(), hasMore: false }, error: null });
    await rejected; expect(state.signals.every(signal => signal.aborted)).toBe(true); api.dispose();
  });
  it("parses revision-bound learning without exposing secrets, rejecting foreign or inferred rows", async () => {
    const api = createPipelineClient(USER_A);
    respond({ learning: { feedback: [{ ...feedback, user_id: USER_A, binding_token: "private" }], grants: [], receipts: [], questions: [] } });
    const learning = await api.listLearning();
    expect(learning.feedback).toEqual([feedback]);
    expect(state.rpc.mock.calls[0]).toEqual(["my_apply_pipeline_action", { p_action: "learning.list", p_args: {} }]);
    respond({ learning: { feedback: [{ ...feedback, user_id: USER_B }], grants: [], receipts: [], questions: [] } });
    await expect(api.listLearning()).rejects.toThrow(/Account mismatch/);
    respond({ learning: { feedback: [{ ...feedback, source: "ai" }], grants: [], receipts: [], questions: [] } });
    await expect(api.listLearning()).rejects.toThrow(/invalid response/);
    respond({ learning: { feedback: [], grants: [], receipts: [] } });
    await expect(api.listLearning()).rejects.toThrow(/invalid response/); api.dispose();
  });
  it("parses camel match decisions and new manual statuses while old task snapshots stay usable", async () => {
    const raw = { id: USER_A, run_id: USER_A, target_binding_id: USER_A, status: "waiting_match_answer", profile_revision: 2, settings_revision: 3, answers_revision: 0, score: 80, reason: null,
      job: { jobUrl: feedback.jobUrl, title: "Engineer", company: "Example", description: "Vue required", skills: ["vue"], location: "Remote", boardMatch: "low" },
      match_decision: { status: "waiting_match_answer", eligible: false, score: 80, profileRevision: 2, similarityKey: feedback.similarityKey, portal: feedback.portal, reason: "Unconfirmed Vue", codes: [], missingCore: [], requirements: [{ anyOf: ["vue", "react"], core: false, evidence: "Vue or React" }], question: { kind: "skill_gap", skills: ["vue/react"], text: "Do you have experience?" } } };
    const api = createPipelineClient(USER_A); respond({ tasks: [raw] });
    expect((await api.listTasks())[0]).toMatchObject({ status: "waiting_match_answer", job: { boardMatch: "low" }, matchDecision: { profileRevision: 2, requirements: [{ anyOf: ["vue", "react"] }] } });
    for (const status of ["manual_actionable", "manual_applied", "user_skipped"]) {
      respond({ tasks: [{ ...raw, status }] }); expect((await api.listTasks())[0].status).toBe(status);
    }
    respond({ tasks: [{ ...raw, match_decision: undefined, job: { ...raw.job, boardMatch: undefined } }] });
    expect((await api.listTasks())[0].matchDecision).toBeUndefined();
    respond({ tasks: [{ ...raw, match_decision: { ...raw.match_decision, eligible: true } }] });
    await expect(api.listTasks()).rejects.toThrow(/invalid response/);
    respond({ tasks: [{ ...raw, match_decision: { ...raw.match_decision, profileRevision: 1 } }] });
    await expect(api.listTasks()).rejects.toThrow(/invalid response/);
    respond({ tasks: [{ ...raw, job: { ...raw.job, boardMatch: "excellent" } }] });
    await expect(api.listTasks()).rejects.toThrow(/invalid response/); api.dispose();
  });
  it("typed receipts distinguish worker observation from self-report; eligibility cannot manufacture counts", async () => {
    const api = createPipelineClient(USER_A), bound = { similarityKey: feedback.similarityKey, portal: feedback.portal, profileRevision: 2, settingsRevision: 3 };
    const selfreport = { ...bound, id: USER_A, taskId: USER_A, jobUrl: feedback.jobUrl, reportedAt: confirmedAt, observedAt: null, source: "user" };
    const observed = { ...selfreport, id: USER_B, reportedAt: null, observedAt: confirmedAt, source: "worker", commandId: USER_A, accountIdentity: "user@example.invalid", secret: "private" };
    const question = { ...bound, id: USER_A, taskId: USER_A, jobUrl: feedback.jobUrl, question: { kind: "skill_gap", skills: ["react"], text: "Do you know React?" }, answer: "yes", answeredAt: confirmedAt, source: "user", suggestion: "profile_update" };
    const eligibility = { ...bound, taskId: USER_A, eligible: true, applySimilarCount: 3, observedManualReceiptCount: 2 };
    const ledger = { feedback: [], grants: [], receipts: [selfreport, observed], questions: [question], eligibility: [eligibility] };
    respond({ learning: ledger });
    const learning = await api.listLearning();
    expect(learning.receipts[0]).toEqual(selfreport); expect(learning.receipts[1]).not.toHaveProperty("secret"); expect(learning.questions[0]).toEqual(question); expect(learning.eligibility).toEqual([eligibility]);
    respond({ learning: { ...ledger, receipts: [{ ...selfreport, observedAt: confirmedAt }] } });
    await expect(api.listLearning()).rejects.toThrow(/invalid response/);
    respond({ learning: { ...ledger, receipts: [{ ...observed, userId: USER_B }] } });
    await expect(api.listLearning()).rejects.toThrow(/Account mismatch/);
    respond({ learning: { ...ledger, eligibility: [{ ...eligibility, observedManualReceiptCount: 1 }] } });
    await expect(api.listLearning()).rejects.toThrow(/invalid response/);
    respond({ learning: { ...ledger, questions: [{ ...question, answer: "no" }] } });
    await expect(api.listLearning()).rejects.toThrow(/invalid response/);
    respond({ learning: { ...ledger, grants: [{ ...bound, id: USER_A, grantedAt: confirmedAt, expiresAt: new Date(Date.parse(confirmedAt) + 31 * 86400000).toISOString(), revokedAt: null, source: "user" }] } });
    await expect(api.listLearning()).rejects.toThrow(/invalid response/); api.dispose();
  });
  it("records preferences/questions/self-reports only with explicit scope/revisions, never promotes profile facts", async () => {
    state.rpc.mockImplementation((_name, request) => builder(Promise.resolve({ data: request.p_action === "learning.feedback" ? { ok: true, feedback: { ...feedback, taskId: USER_A, scope: "exact", verdict: "skip" } }
      : request.p_action === "learning.question" ? { ok: true, question } : { ok: true, receipt }, error: null })));
    const api = createPipelineClient(USER_A);
    await api.recordMatchFeedback({ ...confirmation, scope: "exact", verdict: "skip" });
    await api.answerMatchQuestion({ ...confirmation, answer: "yes" });
    await api.reportManualApplication(confirmation);
    expect(state.rpc.mock.calls.map(call => call[1])).toEqual([
      { p_action: "learning.feedback", p_args: { ...confirmation, scope: "exact", verdict: "skip" } },
      { p_action: "learning.question", p_args: { ...confirmation, answer: "yes" } },
      { p_action: "learning.manual_report", p_args: confirmation },
    ]);
    expect(state.rpc.mock.calls.every(call => !call[1].p_action.startsWith("profile."))).toBe(true);
    await expect(api.recordMatchFeedback({ ...confirmation, scope: "global" as "exact", verdict: "apply" })).rejects.toThrow();
    await expect(api.reportManualApplication({ ...confirmation, confirm: false as true })).rejects.toThrow(/confirm/);
    await expect(api.answerMatchQuestion({ ...confirmation, profileRevision: 0, answer: "yes" })).rejects.toThrow();
    expect(state.rpc).toHaveBeenCalledTimes(3); api.dispose();
  });
  it.each(["feedback", "question", "receipt", "grant", "revoke_feedback", "revoke_grant"] as const)("requires a valid SQL keyed result for %s, not a generic acknowledgement", async kind => {
    const api = createPipelineClient(USER_A), expiresAt = grant.expiresAt;
    const key = kind === "revoke_feedback" ? "feedback" : kind === "revoke_grant" ? "grant" : kind;
    const saved = { feedback: { ...feedback, taskId: USER_A }, question, receipt, grant }[key];
    const resultRow = kind.startsWith("revoke_") ? { ...saved, revokedAt: confirmedAt } : saved;
    const run = () => kind === "feedback" ? api.recordMatchFeedback({ ...confirmation, scope: "similar", verdict: "apply" })
      : kind === "question" ? api.answerMatchQuestion({ ...confirmation, answer: "yes" })
      : kind === "receipt" ? api.reportManualApplication(confirmation)
      : kind === "grant" ? api.grantMatchAutonomy({ ...confirmation, expiresAt })
      : api.revokeLearning(kind === "revoke_feedback" ? { feedbackId: feedback.id } : { grantId: grant.id });
    respond({ ok: true, [key]: resultRow }); await expect(run()).resolves.toEqual({ ok: true });
    for (const data of [{ ok: true }, { [key]: resultRow }, { ok: false, [key]: resultRow }, { ok: true, [key]: null }, { ok: true, [key]: { ...resultRow, source: "ai" } }]) {
      respond(data); await expect(run()).rejects.toThrow(/invalid response/);
    }
    respond({ ok: true, [key]: { ...resultRow, user_id: USER_B } }); await expect(run()).rejects.toThrow(/Account mismatch/);
    respond({ ok: true, [key]: { ...resultRow, userId: USER_B } }); await expect(run()).rejects.toThrow(/Account mismatch/);
    respond({ ok: true, [key]: { ...resultRow, ...(kind.startsWith("revoke_") ? { id: rowId(999) } : { taskId: USER_B }) } }); await expect(run()).rejects.toThrow(/invalid response/);
    if (kind.startsWith("revoke_")) {
      respond({ ok: true, [key]: { ...resultRow, revokedAt: null } }); await expect(run()).rejects.toThrow(/invalid response/);
    } else {
      respond({ ok: true, [key]: { ...resultRow, profileRevision: 1 } }); await expect(run()).rejects.toThrow(/invalid response/);
      respond({ ok: true, [key]: { ...resultRow, settingsRevision: 1 } }); await expect(run()).rejects.toThrow(/invalid response/);
    }
    api.dispose();
  });
  it("rejects a keyed success that contradicts the requested preference, answer, report provenance or grant expiry", async () => {
    const api = createPipelineClient(USER_A);
    respond({ ok: true, feedback: { ...feedback, taskId: USER_A, verdict: "skip" } });
    await expect(api.recordMatchFeedback({ ...confirmation, scope: "similar", verdict: "apply" })).rejects.toThrow(/invalid response/);
    respond({ ok: true, feedback: { ...feedback, taskId: USER_A, scope: "exact" } });
    await expect(api.recordMatchFeedback({ ...confirmation, scope: "similar", verdict: "apply" })).rejects.toThrow(/invalid response/);
    respond({ ok: true, question: { ...question, answer: "no", suggestion: "none" } });
    await expect(api.answerMatchQuestion({ ...confirmation, answer: "yes" })).rejects.toThrow(/invalid response/);
    respond({ ok: true, receipt: { ...receipt, source: "worker", observedAt: confirmedAt } });
    await expect(api.reportManualApplication(confirmation)).rejects.toThrow(/invalid response/);
    respond({ ok: true, grant: { ...grant, expiresAt: new Date(Date.parse(grant.expiresAt) + 1000).toISOString() } });
    await expect(api.grantMatchAutonomy({ ...confirmation, expiresAt: grant.expiresAt })).rejects.toThrow(/invalid response/); api.dispose();
  });
  it("never treats ok:false or an empty response as confirmed and surfaces safe stale/grant refusal", async () => {
    const api = createPipelineClient(USER_A);
    respond({ ok: false }); await expect(api.reportManualApplication(confirmation)).rejects.toThrow(/invalid response/);
    respond({}); await expect(api.recordMatchFeedback({ ...confirmation, scope: "similar", verdict: "apply" })).rejects.toThrow(/invalid response/);
    respond(null, { code: "40001", message: "stale_profile private payload" });
    await expect(api.answerMatchQuestion({ ...confirmation, answer: "yes" })).rejects.toThrow(/changed elsewhere/);
    respond(null, { code: "22023", message: "grant_not_eligible private payload" });
    await expect(api.grantMatchAutonomy({ ...confirmation, expiresAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toThrow(/not eligible/);
    api.dispose();
  });
  it("grant requires explicit future expiry within 30 days and revoke accepts exactly one owned row identifier", async () => {
    respond({ ok: true, feedback: { ...feedback, taskId: USER_A, revokedAt: confirmedAt } }); const api = createPipelineClient(USER_A);
    await expect(api.grantMatchAutonomy({ ...confirmation, expiresAt: new Date(Date.now() - 1000).toISOString() })).rejects.toThrow(/expiry/);
    await expect(api.grantMatchAutonomy({ ...confirmation, expiresAt: new Date(Date.now() + 31 * 86400000).toISOString() })).rejects.toThrow(/30 days/);
    await expect(api.revokeLearning({ feedbackId: USER_A, grantId: USER_B })).rejects.toThrow(/exactly one/);
    expect(state.rpc).not.toHaveBeenCalled();
    await api.revokeLearning({ feedbackId: USER_A });
    expect(state.rpc.mock.calls[0][1]).toEqual({ p_action: "learning.revoke", p_args: { feedbackId: USER_A } }); api.dispose();
  });
  it("manual open is bound to exact task, never arbitrary URL or a fill/click command", async () => {
    const api = createPipelineClient(USER_A);
    respond({ command: { id: USER_A, binding_id: USER_A, type: "open_manual", status: "queued", reason: null, created_at: confirmedAt } });
    await expect(api.requestCommand(USER_A, "open_manual")).rejects.toThrow(/exact task/);
    await api.requestCommand(USER_A, "open_manual", { taskId: USER_B });
    expect(state.rpc.mock.calls[0][1]).toEqual({ p_action: "commands.request", p_args: { bindingId: USER_A, type: "open_manual", args: { taskId: USER_B } } }); api.dispose();
  });
  it("learning backend absence is distinct from an empty learning ledger without fallback", async () => {
    respond(null, { code: "22023", message: "unsupported action" }); const api = createPipelineClient(USER_A);
    await expect(api.listLearning()).rejects.toThrow(/Match learning is unavailable/);
    expect(state.rpc).toHaveBeenCalledTimes(1); api.dispose();
  });
  it("learning requests remain permanently account-fenced through A→B→A", async () => {
    const pending = deferred<unknown>(); state.rpc.mockImplementation(() => builder(pending.promise));
    const api = createPipelineClient(USER_A), request = api.recordMatchFeedback({ ...confirmation, scope: "similar", verdict: "apply" });
    const rejected = expect(request).rejects.toThrow(/Account or selected agent changed/);
    await vi.waitFor(() => expect(state.signals).toHaveLength(1));
    switchAccount(USER_B); switchAccount(USER_A); pending.resolve({ data: { ok: true, feedback: { ...feedback, taskId: USER_A } }, error: null });
    await rejected; expect(state.signals[0].aborted).toBe(true); api.dispose();
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
