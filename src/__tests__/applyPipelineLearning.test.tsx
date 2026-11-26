// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within, act } from "@testing-library/react";
import type { PipelineClient, PipelineLearning, PipelineTask, PipelineMatchDecision } from "../services/applyPipeline";
const mocks = vi.hoisted(() => ({ user: { id: "account-a" } as { id: string } | null, listeners: new Set<(value: { user: { id: string } | null }) => void>(), realLearning: false, backend: vi.fn(),
  listAgents: vi.fn(), getSettings: vi.fn(), listRuns: vi.fn(), listTasks: vi.fn(), listSessions: vi.fn(), getProfile: vi.fn(), listAnswers: vi.fn(), listQuestions: vi.fn(), listBoards: vi.fn(), listLearning: vi.fn(), recordMatchFeedback: vi.fn(), answerMatchQuestion: vi.fn(), reportManualApplication: vi.fn(), grantMatchAutonomy: vi.fn(), revokeLearning: vi.fn(), requestCommand: vi.fn(), confirmProfile: vi.fn(), requestRun: vi.fn(), dispose: vi.fn() }));
vi.mock("../services/cloud", () => ({ getCloudState: () => ({ user: mocks.user }), subscribeCloud: (fn: (value: { user: { id: string } | null }) => void) => { mocks.listeners.add(fn); fn({ user: mocks.user }); return () => mocks.listeners.delete(fn); },
  getSupabaseClient: async () => ({ auth: { getSession: async () => ({ data: { session: { user: mocks.user, access_token: "synthetic-token" } }, error: null }) },
    rpc: (_name: string, request: unknown) => ({ setHeader: () => ({ abortSignal: () => mocks.backend(request) }) }) }) }));
vi.mock("../services/applyPipeline", async original => {
  const actual = await original<typeof import("../services/applyPipeline")>();
  return { ...actual, createPipelineClient: () => {
    const stub = { ...mocks, check: () => {} } as unknown as PipelineClient;
    if (!mocks.realLearning) return stub;
    const real = actual.createPipelineClient(mocks.user!.id);
    return { ...stub, listLearning: real.listLearning, revokeLearning: real.revokeLearning, check: real.check, dispose: real.dispose };
  } };
});
import ApplyPipelinePanel from "../components/jobs/ApplyPipelinePanel";
import { DEFAULT_PIPELINE_SETTINGS, PipelineError } from "../services/applyPipeline";
const bindingId = "10000000-0000-4000-8000-000000000001", taskId = "20000000-0000-4000-8000-000000000001", runId = "30000000-0000-4000-8000-000000000001";
const now = new Date().toISOString(), portal = "naukri:www.naukri.com/candidate", similarityKey = "verified-match-v1:frontend";
const decision: PipelineMatchDecision = { status: "manual_actionable", eligible: false, score: 80, profileRevision: 1, similarityKey, portal, reason: "Core requirement not verified", codes: ["missing_core_skill"], missingCore: ["react"], requirements: [{ anyOf: ["react"], core: true, evidence: "React is required" }] };
const task: PipelineTask = { id: taskId, runId, bindingId, status: "manual_actionable", profileRevision: 1, settingsRevision: 1, answersRevision: 0, score: 80, reason: "Manual action required", matchDecision: decision, job: { jobUrl: "https://www.naukri.com/job-listings-test-123", title: "Retained React role", company: "Example", description: "React required", skills: ["react"], location: "Remote", portal } };
const empty = (): PipelineLearning => ({ feedback: [], grants: [], questions: [], receipts: [], eligibility: [] });
const proof = (overrides = {}) => ({ taskId, eligible: true, applySimilarCount: 3, observedManualReceiptCount: 2, profileRevision: 1, settingsRevision: 1, similarityKey, portal, ...overrides });
async function open(canRun = true) {
  render(<ApplyPipelinePanel canRun={canRun} />);
  await screen.findByText("Select your local agent");
  fireEvent.click(screen.getByRole("button", { name: "Open pipeline controls" }));
  await screen.findByRole("button", { name: "Confirm my profile" });
  fireEvent.change(screen.getByLabelText("Pipeline agent"), { target: { value: bindingId } });
  return await screen.findByRole("region", { name: "Manual queue and match learning" });
}
beforeEach(() => {
  mocks.user = { id: "account-a" }; mocks.listeners.clear(); mocks.realLearning = false;
  for (const mock of Object.values(mocks)) if (typeof mock === "function" && "mockReset" in mock) mock.mockReset();
  mocks.listAgents.mockResolvedValue([{ bindingId, label: "Test laptop", status: "ready", engineVersion: "paired-worker/1", capabilities: ["leased-tasks", "verified-answer-bank", "job-bound-receipts"], heartbeatAt: now, revokedAt: null, lastUsedAt: null, profileMetadata: {} }]);
  mocks.getSettings.mockResolvedValue({ revision: 1, updatedAt: now, data: DEFAULT_PIPELINE_SETTINGS });
  mocks.getProfile.mockResolvedValue({ revision: 1, answersRevision: 0, resumeText: "Exact resume", resumeApproved: true, facts: { name: { value: "User", source: "user", confirmedAt: now } } });
  mocks.listRuns.mockResolvedValue([]); mocks.listTasks.mockResolvedValue([task]); mocks.listSessions.mockResolvedValue([]);
  mocks.listAnswers.mockResolvedValue({ answers: [], revision: 0 }); mocks.listQuestions.mockResolvedValue([]); mocks.listBoards.mockResolvedValue([]); mocks.listLearning.mockResolvedValue(empty());
  mocks.recordMatchFeedback.mockResolvedValue({ ok: true }); mocks.answerMatchQuestion.mockResolvedValue({ ok: true }); mocks.reportManualApplication.mockResolvedValue({ ok: true }); mocks.grantMatchAutonomy.mockResolvedValue({ ok: true }); mocks.revokeLearning.mockResolvedValue({ ok: true });
  mocks.requestCommand.mockResolvedValue({ id: runId, bindingId, type: "open_manual", status: "queued", reason: null, createdAt: now });
});
afterEach(cleanup);
describe("manual queue and preference learning", () => {
  it("keeps second-page current skips and grants visible and revocable without auto-apply access", async () => {
    mocks.realLearning = true;
    const bound = { similarityKey, portal, profileRevision: 1, settingsRevision: 1, source: "user" as const };
    const currentFeedback = { ...bound, id: taskId, taskId, jobUrl: task.job.jobUrl, scope: "exact" as const, verdict: "skip" as const, confirmedAt: now, revokedAt: null as string | null };
    const currentGrant = { ...bound, id: runId, taskId, grantedAt: now, expiresAt: new Date(Date.parse(now) + 86400000).toISOString(), revokedAt: null as string | null };
    const firstPage = { ...empty(),
      feedback: Array.from({ length: 200 }, (_, index) => ({ ...currentFeedback, id: `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`, revokedAt: now })),
      grants: Array.from({ length: 200 }, (_, index) => ({ ...currentGrant, id: `50000000-0000-4000-8000-${String(index).padStart(12, "0")}`, revokedAt: now })),
    };
    mocks.backend.mockImplementation(async ({ p_action, p_args }: { p_action: string; p_args: { offset?: number; feedbackId?: string; grantId?: string } }) => {
      if (p_action === "learning.list") return { data: p_args.offset === undefined ? { learning: firstPage, hasMore: true }
        : { learning: { ...empty(), feedback: [currentFeedback], grants: [currentGrant], eligibility: [proof({ eligible: false, observedManualReceiptCount: 0 })] }, hasMore: false }, error: null };
      if (p_action === "learning.revoke" && p_args.grantId === currentGrant.id) {
        currentGrant.revokedAt = now; return { data: { ok: true, grant: currentGrant }, error: null };
      }
      if (p_action === "learning.revoke" && p_args.feedbackId === currentFeedback.id) {
        currentFeedback.revokedAt = now; return { data: { ok: true, feedback: currentFeedback }, error: null };
      }
      throw new Error("Unexpected learning request");
    });
    const queue = await open(false);
    const revokeGrant = await within(queue).findByRole("button", { name: "Revoke autonomy grant" });
    expect(revokeGrant.hasAttribute("disabled")).toBe(false);
    expect(within(queue).getByText(/Current preference only/)).toBeTruthy();
    expect(within(queue).getByText(/Current scoped grant · factual gates still required/)).toBeTruthy();
    expect(within(queue).getAllByText("User preference: skip · exact job only")).toHaveLength(201);
    expect(within(queue).getAllByText(`Explicit autonomy grant · ${portal}`)).toHaveLength(201);
    expect(within(queue).getByRole("button", { name: "Grant scoped autonomy" }).hasAttribute("disabled")).toBe(true);
    expect(mocks.backend.mock.calls.map(([request]) => request).some(request => request.p_action === "learning.list" && request.p_args.limit === 200 && request.p_args.offset === 200)).toBe(true);
    fireEvent.click(revokeGrant);
    await screen.findByText(/Scoped autonomy grant revoked/);
    await waitFor(() => expect(within(queue).queryByRole("button", { name: "Revoke autonomy grant" })).toBeNull());
    const revokeFeedback = within(queue).getByRole("button", { name: "Revoke match preference" });
    expect(revokeFeedback.hasAttribute("disabled")).toBe(false); fireEvent.click(revokeFeedback);
    await screen.findByText(/Match preference revoked/);
    expect(mocks.backend.mock.calls.map(([request]) => request).filter(request => request.p_action === "learning.revoke")).toEqual([
      { p_action: "learning.revoke", p_args: { grantId: runId } }, { p_action: "learning.revoke", p_args: { feedbackId: taskId } },
    ]);
    expect(mocks.requestRun).not.toHaveBeenCalled(); expect(mocks.requestCommand).not.toHaveBeenCalled(); expect(mocks.grantMatchAutonomy).not.toHaveBeenCalled();
    expect(mocks.confirmProfile).not.toHaveBeenCalled(); expect(DEFAULT_PIPELINE_SETTINGS.enabled).toBe(false); expect(DEFAULT_PIPELINE_SETTINGS.autoSubmit).toBe(false);
  }, 15000);
  it("retains orphaned/manual/skipped/filtered/review jobs with exact links and factual veto evidence", async () => {
    mocks.listTasks.mockResolvedValue([task, { ...task, id: "filtered", status: "filtered", job: { ...task.job, title: "Filtered role" } }, { ...task, id: "skipped", status: "user_skipped", job: { ...task.job, title: "Skipped role" } }, { ...task, id: "review", status: "waiting_review", job: { ...task.job, title: "Review role" } }]);
    const queue = await open();
    expect(within(queue).getByText("Retained React role")).toBeTruthy();
    for (const name of ["Filtered role", "Skipped role", "Review role"]) expect(within(queue).getByText(name)).toBeTruthy();
    expect(within(queue).getAllByText(/missing_core_skill/).length).toBeGreaterThan(0);
    expect(within(queue).getAllByText(/Missing core requirements: react/).length).toBeGreaterThan(0);
    expect(within(queue).getAllByRole("link", { name: "View exact job" })[0].getAttribute("href")).toBe(task.job.jobUrl);
    fireEvent.click(within(queue).getAllByRole("button", { name: "Open exact job on local agent" })[0]);
    await waitFor(() => expect(mocks.requestCommand).toHaveBeenCalledWith(bindingId, "open_manual", { taskId }));
    expect(mocks.requestRun).not.toHaveBeenCalled();
  });
  it("records exact/similar apply/skip only after explicit preference confirmation and never requests a run", async () => {
    const queue = await open();
    fireEvent.change(within(queue).getByLabelText("Preference scope for Retained React role"), { target: { value: "similar" } });
    fireEvent.change(within(queue).getByLabelText("Preference verdict for Retained React role"), { target: { value: "apply" } });
    const save = within(queue).getByRole("button", { name: "Record match preference" });
    expect(save.hasAttribute("disabled")).toBe(true);
    fireEvent.click(within(queue).getByLabelText(/This is a preference only, not permission to apply/)); fireEvent.click(save);
    await waitFor(() => expect(mocks.recordMatchFeedback).toHaveBeenCalledWith({ taskId, profileRevision: 1, settingsRevision: 1, confirm: true, scope: "similar", verdict: "apply" }));
    expect(mocks.requestRun).not.toHaveBeenCalled(); expect(mocks.requestCommand).not.toHaveBeenCalled(); expect(mocks.confirmProfile).not.toHaveBeenCalled();
  });
  it("yes to a close gap offers manual profile/resume revision only, never invents skills or queues an application", async () => {
    mocks.listTasks.mockResolvedValue([{ ...task, status: "waiting_match_answer", matchDecision: { ...decision, status: "waiting_match_answer", missingCore: [], codes: [], question: { kind: "skill_gap", skills: ["vue"], text: "Do you have Vue experience?" } } }]);
    const queue = await open();
    fireEvent.change(within(queue).getByLabelText("Match answer for Retained React role"), { target: { value: "yes" } });
    fireEvent.click(within(queue).getByLabelText(/My answer does not add skills or approve a resume/));
    fireEvent.click(within(queue).getByRole("button", { name: "Record match answer" }));
    await screen.findByText(/Manually edit your verified profile and reapprove your exact resume/);
    expect(mocks.answerMatchQuestion).toHaveBeenCalledWith({ taskId, profileRevision: 1, settingsRevision: 1, confirm: true, answer: "yes" });
    expect(mocks.confirmProfile).not.toHaveBeenCalled(); expect(mocks.requestRun).not.toHaveBeenCalled();
  });
  it("self-report receives no observed receipt or autonomy graduation credit", async () => {
    mocks.listLearning.mockResolvedValue({ ...empty(), receipts: [{ id: runId, taskId, jobUrl: task.job.jobUrl, similarityKey, portal, profileRevision: 1, settingsRevision: 1, reportedAt: now, observedAt: null, source: "user" }], eligibility: [proof({ eligible: false, observedManualReceiptCount: 0 })] });
    const queue = await open();
    expect(within(queue).getByText(/Self-reported · not observed · no graduation credit/)).toBeTruthy();
    expect(within(queue).getByText(/0 \/ 2 worker-observed manual receipts/)).toBeTruthy();
    expect(within(queue).getByRole("button", { name: "Grant scoped autonomy" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(within(queue).getByLabelText(/I applied manually; this report is not observed evidence/));
    fireEvent.click(within(queue).getByRole("button", { name: "Report manual application" }));
    await waitFor(() => expect(mocks.reportManualApplication).toHaveBeenCalledWith({ taskId, profileRevision: 1, settingsRevision: 1, confirm: true }));
    expect(mocks.grantMatchAutonomy).not.toHaveBeenCalled();
  });
  it("requires matching server proof, expiry and separate grant consent, with server refusal not success", async () => {
    mocks.listTasks.mockResolvedValue([{ ...task, status: "waiting_review", matchDecision: { ...decision, status: "eligible_review", eligible: true, codes: [], missingCore: [] } }]);
    mocks.listLearning.mockResolvedValue({ ...empty(), eligibility: [proof()] });
    mocks.grantMatchAutonomy.mockRejectedValue(new PipelineError("This scope is not eligible for autonomy."));
    const queue = await open(), grant = within(queue).getByRole("button", { name: "Grant scoped autonomy" });
    expect(grant.hasAttribute("disabled")).toBe(true);
    fireEvent.change(within(queue).getByLabelText("Autonomy expiry UTC for Retained React role"), { target: { value: new Date(Date.now() + 86400000).toISOString().slice(0, 16) } });
    expect(grant.hasAttribute("disabled")).toBe(true);
    fireEvent.click(within(queue).getByLabelText(/I explicitly grant autonomy for this similarity and portal only/));
    expect(grant.hasAttribute("disabled")).toBe(false); fireEvent.click(grant);
    await screen.findByRole("alert"); expect(screen.getByRole("alert").textContent).toContain("not eligible");
    expect(screen.queryByText(/Scoped autonomy granted/)).toBeNull();
  });
  it.each(["profile", "settings", "portal", "similarity"])("stale %s proof never enables a grant", async field => {
    mocks.listTasks.mockResolvedValue([{ ...task, status: "waiting_review", matchDecision: { ...decision, status: "eligible_review", eligible: true, codes: [], missingCore: [] } }]);
    mocks.listLearning.mockResolvedValue({ ...empty(), eligibility: [proof(field === "profile" ? { profileRevision: 2 } : field === "settings" ? { settingsRevision: 2 } : field === "portal" ? { portal: "another.example.com" } : { similarityKey: "another" })] });
    const queue = await open();
    fireEvent.change(within(queue).getByLabelText("Autonomy expiry UTC for Retained React role"), { target: { value: new Date(Date.now() + 86400000).toISOString().slice(0, 16) } });
    fireEvent.click(within(queue).getByLabelText(/I explicitly grant autonomy for this similarity and portal only/));
    expect(within(queue).getByRole("button", { name: "Grant scoped autonomy" }).hasAttribute("disabled")).toBe(true);
    expect(mocks.grantMatchAutonomy).not.toHaveBeenCalled();
  });
  it("missing learning backend leaves old controls usable and manual job links retained without unsafe fallback", async () => {
    mocks.listLearning.mockRejectedValue(new PipelineError("Match learning is unavailable. Its backend may not be installed."));
    const queue = await open();
    expect(within(queue).getByText(/Match learning is unavailable/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm my profile" })).toBeTruthy();
    expect(within(queue).getByRole("link", { name: "View exact job" })).toBeTruthy();
    expect(within(queue).getByRole("button", { name: "Open exact job on local agent" }).hasAttribute("disabled")).toBe(true);
    expect(mocks.requestCommand).not.toHaveBeenCalled();
  });
  it("account changes discard a delayed learning success and private learning content", async () => {
    let resolve!: (value: { ok: true }) => void;
    mocks.recordMatchFeedback.mockReturnValue(new Promise(r => { resolve = r; }));
    const queue = await open();
    fireEvent.change(within(queue).getByLabelText("Preference scope for Retained React role"), { target: { value: "exact" } });
    fireEvent.change(within(queue).getByLabelText("Preference verdict for Retained React role"), { target: { value: "skip" } });
    fireEvent.click(within(queue).getByLabelText(/This is a preference only, not permission to apply/));
    fireEvent.click(within(queue).getByRole("button", { name: "Record match preference" }));
    await waitFor(() => expect(mocks.recordMatchFeedback).toHaveBeenCalledOnce());
    act(() => { mocks.user = null; for (const fn of [...mocks.listeners]) fn({ user: null }); });
    await act(async () => resolve({ ok: true }));
    expect(screen.queryByRole("region", { name: "Manual queue and match learning" })).toBeNull();
    expect(screen.queryByText(/Match preference recorded/)).toBeNull();
  });
});
