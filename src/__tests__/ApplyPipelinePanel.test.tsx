// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PipelineAgent, PipelineAnswer, PipelineClient, PipelineProfile, PipelineQuestion, PipelineRun, PipelineSession, PipelineSettingsRecord, PipelineTask } from "../services/applyPipeline";
const state = vi.hoisted(() => ({
  user: { id: "account-a" } as { id: string } | null,
  listeners: new Set<(value: { user: { id: string } | null }) => void>(),
  getProfile: vi.fn(), confirmProfile: vi.fn(), getSettings: vi.fn(), putSettings: vi.fn(), listAgents: vi.fn(), listRuns: vi.fn(), listTasks: vi.fn(), listSessions: vi.fn(), listAnswers: vi.fn(), listQuestions: vi.fn(), listBoards: vi.fn(), listLearning: vi.fn(), requestRun: vi.fn(), cancelRun: vi.fn(), answerQuestion: vi.fn(), revokeAnswer: vi.fn(), requestCommand: vi.fn(), importDraft: vi.fn(), addBoard: vi.fn(), dispose: vi.fn(), clients: [] as { live: boolean; userId: string }[],
}));
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: state.user }),
  subscribeCloud: (fn: (value: { user: { id: string } | null }) => void) => { state.listeners.add(fn); fn({ user: state.user }); return () => state.listeners.delete(fn); },
}));
vi.mock("../services/applyPipeline", async importOriginal => ({
  ...await importOriginal<typeof import("../services/applyPipeline")>(),
  createPipelineClient: (userId: string) => {
    const scope = { live: true, userId }; state.clients.push(scope);
    return {
      check: () => { if (!scope.live || state.user?.id !== userId) throw new Error("Account changed"); },
      dispose: () => { scope.live = false; state.dispose(); },
      ...Object.fromEntries(Object.entries(state).filter(([key, value]) => typeof value === "function" && key !== "dispose")),
    } as PipelineClient;
  },
}));
import ApplyPipelinePanel from "../components/jobs/ApplyPipelinePanel";
import { DEFAULT_PIPELINE_SETTINGS, PipelineError } from "../services/applyPipeline";
const AGENT_A = "10000000-0000-4000-8000-000000000001", AGENT_B = "10000000-0000-4000-8000-000000000002";
const RUN_A = "20000000-0000-4000-8000-000000000001", RUN_B = "20000000-0000-4000-8000-000000000002";
const TASK_A = "30000000-0000-4000-8000-000000000001", TASK_B = "30000000-0000-4000-8000-000000000002";
const now = new Date().toISOString();
const profile: PipelineProfile = { revision: 1, answersRevision: 1, resumeText: "Synthetic A User\nTypeScript and React engineer. This is an exact user-approved test resume.", resumeApproved: true, facts: {
  name: { value: "Synthetic A User", source: "user", confirmedAt: now }, email: { value: "a@example.invalid", source: "user", confirmedAt: now }, skills: { value: ["typescript", "react"], source: "user", confirmedAt: now },
} };
const settings: PipelineSettingsRecord = { revision: 1, updatedAt: now, data: { ...DEFAULT_PIPELINE_SETTINGS, enabled: true, roles: ["TypeScript Engineer"], locations: ["Remote"] } };
const agent = (bindingId = AGENT_A, label = "Synthetic laptop A"): PipelineAgent => ({ bindingId, label, engineVersion: "paired-worker/1.0.0", capabilities: ["leased-tasks", "verified-answer-bank", "job-bound-receipts", "human-signin", "session-check"], status: "ready", profileMetadata: { revision: 1, resumeApproved: true }, heartbeatAt: new Date().toISOString(), revokedAt: null, lastUsedAt: now });
const run = (bindingId = AGENT_A, id = RUN_A): PipelineRun => ({ id, bindingId, mode: "review", status: "queued", profileRevision: 1, settingsRevision: 1, answersRevision: 1, candidateCount: 2, taskCount: 2, createdAt: now, startedAt: null, finishedAt: null });
const task = (id = TASK_A, title = "Synthetic role A", bindingId = AGENT_A, runId = RUN_A): PipelineTask => ({ id, runId, bindingId, status: "waiting_answer", profileRevision: 1, settingsRevision: 1, answersRevision: 1, score: 100, reason: "new context question", job: { jobUrl: `https://careers.example.com/job/${id}`, title, company: "Synthetic Company", description: "Test fixture", skills: ["typescript"], location: "Remote", portal: "boards.example.com" } });
const question: PipelineQuestion = { id: "40000000-0000-4000-8000-000000000001", questionKey: "same-question-context", meaning: "noticePeriod", questionText: "What is your notice period?", controlType: "select", options: ["Immediately", "30 days"], context: { employer: "Synthetic Company", portal: "boards.example.com" }, scope: "employer", scopeKey: "Synthetic Company", currency: null, reason: "No verified fact", profileRevision: 1, status: "pending", answerId: null, taskIds: [TASK_A, TASK_B], createdAt: now, updatedAt: now };
const answer: PipelineAnswer = { id: "50000000-0000-4000-8000-000000000001", meaning: question.meaning, questionText: question.questionText, controlType: question.controlType, options: question.options, context: question.context, answer: "30 days", scope: question.scope, scopeKey: question.scopeKey, profileRevision: 1, confirmedAt: now, expiresAt: "2099-01-01T00:00:00.000Z", revokedAt: null, provenance: "user" };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function switchAccount(userId: string | null) { state.user = userId ? { id: userId } : null; for (const fn of [...state.listeners]) fn({ user: state.user }); }
async function openPanel(canRun = true) {
  render(<ApplyPipelinePanel canRun={canRun} />);
  await screen.findByText("Select your local agent");
  fireEvent.click(screen.getByRole("button", { name: "Open pipeline controls" }));
  await screen.findByRole("button", { name: "Confirm my profile" });
}
async function selectAgent(id = AGENT_A) {
  fireEvent.change(screen.getByLabelText("Pipeline agent"), { target: { value: id } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Run my pipeline" }).hasAttribute("disabled")).toBe(false));
}
beforeEach(() => {
  state.user = { id: "account-a" }; state.listeners.clear(); state.clients.length = 0;
  for (const value of Object.values(state)) if (typeof value === "function" && "mockReset" in value) value.mockReset();
  state.getProfile.mockResolvedValue(profile); state.confirmProfile.mockResolvedValue({ ...profile, revision: 2 });
  state.getSettings.mockResolvedValue(settings); state.putSettings.mockResolvedValue({ ...settings, revision: 2 });
  state.listAgents.mockResolvedValue([agent(), agent(AGENT_B, "Synthetic laptop B")]); state.listRuns.mockResolvedValue([run()]);
  state.listTasks.mockResolvedValue([task(), task(TASK_B, "Synthetic role B")]); state.listSessions.mockResolvedValue([]);
  state.listAnswers.mockResolvedValue({ answers: [], revision: 1 }); state.listQuestions.mockResolvedValue([question]); state.listBoards.mockResolvedValue([]);
  state.listLearning.mockResolvedValue({ feedback: [], grants: [], receipts: [], questions: [], eligibility: [] });
  state.requestRun.mockResolvedValue({ run: run(), publicFeedAvailable: true }); state.cancelRun.mockResolvedValue({ ...run(), status: "cancelled" });
  state.answerQuestion.mockResolvedValue({ answer, revision: 2 }); state.revokeAnswer.mockResolvedValue({ ...answer, revokedAt: now });
  state.requestCommand.mockImplementation(async (bindingId, type) => ({ id: "60000000-0000-4000-8000-000000000001", bindingId, type, status: "queued", reason: null, createdAt: now }));
  state.importDraft.mockResolvedValue({ values: { name: "Unverified Imported User", email: "draft@example.invalid", skills: ["typescript"] }, resumeText: "Unverified own saved draft resume" });
  state.addBoard.mockResolvedValue({});
});
afterEach(cleanup);

describe("integrated customer pipeline", () => {
  it("loads metadata collapsed without reading or showing the resume, then requires explicit agent selection", async () => {
    render(<ApplyPipelinePanel canRun={true} />);
    await screen.findByText("Select your local agent");
    expect(state.getProfile).not.toHaveBeenCalled(); expect(state.listAnswers).not.toHaveBeenCalled();
    expect(screen.queryByText(/Synthetic A User/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open pipeline controls" }));
    await screen.findByRole("button", { name: "Confirm my profile" });
    expect((screen.getByLabelText("Pipeline agent") as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Run my pipeline" }).hasAttribute("disabled")).toBe(true);
    await selectAgent();
    fireEvent.click(screen.getByRole("button", { name: "Run my pipeline" }));
    await screen.findByText(/Run queued for your selected agent. Track/);
    expect(state.requestRun.mock.calls).toEqual([[AGENT_A, "review", 10]]);
    expect(screen.getByText(/Telegram is optional/)).toBeTruthy();
  });
  it("offline queues are not reported as started or submitted and expose explicit local setup instructions", async () => {
    state.listAgents.mockResolvedValue([{ ...agent(), heartbeatAt: null, engineVersion: null, capabilities: [], status: null }]);
    await openPanel(); await selectAgent();
    expect(screen.getByText(/Worker version: not reported/)).toBeTruthy();
    expect(screen.getByText("node scripts/apply-pipeline-worker.js")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Run my pipeline" }));
    await screen.findByText(/Its worker is offline, paused or incompatible; nothing has been submitted/);
    expect(screen.queryByText("Submitted · confirmation observed")).toBeNull();
  });
  it("imports only an unconfirmed own draft and never silently confirms a resume or profile", async () => {
    state.getProfile.mockResolvedValue(null);
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Import my saved profile draft" }));
    await waitFor(() => expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Unverified Imported User"));
    expect((screen.getByLabelText("I approve this exact resume for applications. No AI rewriting is authorized.") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("I checked every populated fact and its scope/expiry; these are my factual answers.") as HTMLInputElement).checked).toBe(false);
    expect(state.confirmProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm my profile" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByLabelText("I approve this exact resume for applications. No AI rewriting is authorized."));
    fireEvent.click(screen.getByLabelText("I checked every populated fact and its scope/expiry; these are my factual answers."));
    state.getProfile.mockResolvedValue({ ...profile, revision: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Confirm my profile" }));
    await screen.findByText(/Previous saved answers and pending approvals were invalidated/);
    expect(state.confirmProfile).toHaveBeenCalledOnce();
    const input = state.confirmProfile.mock.calls[0][0];
    expect(input.expectedRevision).toBeNull(); expect(input.resumeApproved).toBe(true);
    expect(input.facts.name.value).toBe("Unverified Imported User"); expect(input.facts.name.source).toBe("user");
  });
  it("asks a grouped question once, uses exact options/scope/expiry and waits for explicit confirmation", async () => {
    await openPanel(); await selectAgent();
    expect(screen.getAllByRole("heading", { name: question.questionText })).toHaveLength(1);
    expect(screen.getByText("2 applications waiting · Profile revision 1 · select")).toBeTruthy();
    expect((screen.getByLabelText(`Answer to ${question.questionText}`) as HTMLSelectElement).value).toBe("");
    fireEvent.change(screen.getByLabelText(`Answer to ${question.questionText}`), { target: { value: "30 days" } });
    fireEvent.change(screen.getByLabelText(`Answer expiry for ${question.questionText}`), { target: { value: "2099-01-01" } });
    expect(state.answerQuestion).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/Use this answer only for the displayed employer scope/));
    fireEvent.click(screen.getByLabelText("I confirm this answer is factual and current."));
    state.listQuestions.mockResolvedValue([]); state.listAnswers.mockResolvedValue({ answers: [answer], revision: 2 });
    state.listTasks.mockResolvedValue([{ ...task(), status: "queued" }, { ...task(TASK_B, "Synthetic role B"), status: "queued" }]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm answer once" }));
    await screen.findByText(/Answer confirmed for the displayed scope/);
    expect(state.answerQuestion.mock.calls).toEqual([[question, { answer: "30 days", scope: "employer", scopeKey: "Synthetic Company", expiresAt: "2099-01-01T23:59:59.000Z", confirm: true }]]);
    expect(screen.queryByRole("button", { name: "Confirm answer once" })).toBeNull();
  });
  it.each(["email", "tel", "url"] as const)("renders native %s questions without weakening their saved control type", async controlType => {
    const typed = { ...question, meaning: controlType === "email" ? "email" : controlType === "tel" ? "phone" : "portfolio", questionText: `Your ${controlType}`, controlType, options: [], scope: "global" as const, scopeKey: "", context: {} };
    state.listQuestions.mockResolvedValue([typed]); await openPanel(); await selectAgent();
    const input = screen.getByLabelText(`Answer to ${typed.questionText}`) as HTMLInputElement;
    expect(input.type).toBe(controlType); expect(input.value).toBe("");
    const value = controlType === "email" ? "typed@example.invalid" : controlType === "tel" ? "+1 555 123 4567" : "https://portfolio.example.com/user";
    fireEvent.change(input, { target: { value } });
    expect(input.checkValidity()).toBe(true);
    fireEvent.click(screen.getByLabelText(/Use this answer only for the displayed global scope/));
    fireEvent.click(screen.getByLabelText("I confirm this answer is factual and current."));
    fireEvent.click(screen.getByRole("button", { name: "Confirm answer once" }));
    await waitFor(() => expect(state.answerQuestion).toHaveBeenCalledOnce());
    expect(state.answerQuestion.mock.calls[0][0].controlType).toBe(controlType);
    expect(state.answerQuestion.mock.calls[0][1]).toEqual({ answer: value, scope: "global", scopeKey: "", confirm: true });
  });
  it("unknown question starts blank and legal or demographic consent cannot become a reusable answer", async () => {
    const unknown = { ...question, meaning: "unknown:why this team", questionText: "Why do you want to join this team?", controlType: "textarea" as const, options: [], scope: "application" as const, scopeKey: task().job.jobUrl };
    const legal = { ...question, id: "40000000-0000-4000-8000-000000000002", meaning: "manualAttestation", questionText: "I agree to the privacy terms", controlType: "checkbox" as const };
    state.listQuestions.mockResolvedValue([unknown, legal]);
    await openPanel(); await selectAgent();
    expect((screen.getByLabelText(`Answer to ${unknown.questionText}`) as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByLabelText(`Answer to ${legal.questionText}`)).toBeNull();
    expect(screen.getByRole("button", { name: "Open question for human review" })).toBeTruthy();
    expect(state.answerQuestion).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open question for human review" }));
    await screen.findByText(/Last command: open question · queued/);
    expect(state.requestCommand.mock.calls).toEqual([[AGENT_A, "open_question", { questionId: legal.id }]]);
  });
  it("expired access prevents new actions but permits cancellation, answer revocation and stopping future cycles", async () => {
    state.listAnswers.mockResolvedValue({ answers: [answer], revision: 1 });
    await openPanel(false);
    fireEvent.change(screen.getByLabelText("Pipeline agent"), { target: { value: AGENT_A } });
    await screen.findByRole("button", { name: "Cancel pipeline run" });
    expect(screen.getByRole("button", { name: "Run my pipeline" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Confirm my profile" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel pipeline run" }));
    await screen.findByText(/Run cancelled. Attempts/); expect(state.cancelRun.mock.calls).toEqual([[RUN_A]]);
    fireEvent.click(screen.getByRole("button", { name: "Revoke saved answer" }));
    await screen.findByText(/Saved answer revoked/); expect(state.revokeAnswer.mock.calls).toEqual([[answer.id]]);
    fireEvent.click(screen.getByRole("button", { name: "Turn pipeline off" }));
    await screen.findByText(/Future cycles are stopped/); expect(state.putSettings.mock.calls[0][0].settings.enabled).toBe(false);
    expect(state.requestRun).not.toHaveBeenCalled();
  });
  it("signin/check-session commands target the exact own binding and portal; queue isn't session proof", async () => {
    await openPanel(); await selectAgent(AGENT_B);
    fireEvent.change(screen.getByLabelText("Selected agent portal"), { target: { value: "boards.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in on selected agent" }));
    await screen.findByText(/Last command: retry login · queued/);
    fireEvent.click(screen.getByRole("button", { name: "Check selected agent session" }));
    await screen.findByText(/Last command: check session · queued/);
    expect(state.requestCommand.mock.calls).toEqual([[AGENT_B, "retry_login", { portal: "boards.example.com" }], [AGENT_B, "check_session", { portal: "boards.example.com" }]]);
    expect(screen.queryByText(/Sign-in observed/)).toBeNull();
  });
  it("missing backend fails closed without exposing raw errors or a mock-success state", async () => {
    state.listAgents.mockRejectedValue(new PipelineError("Your application pipeline is unavailable. Its backend may not be installed. Reload to check; no application was requested."));
    render(<ApplyPipelinePanel canRun={true} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Open pipeline controls" }));
    expect(screen.queryByRole("button", { name: "Run my pipeline" })).toBeNull(); expect(state.requestRun).not.toHaveBeenCalled();
    expect(screen.getByText(/No legacy owner or synthetic fallback/)).toBeTruthy();
  });
  it("selection changes immediately discard drafts and ignore a late prior-binding operation", async () => {
    const pending = deferred<{ run: PipelineRun; publicFeedAvailable: boolean }>(); state.requestRun.mockReturnValue(pending.promise);
    await openPanel(); await selectAgent();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "private A binding draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Run my pipeline" }));
    await waitFor(() => expect(state.requestRun).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText("Pipeline agent"), { target: { value: AGENT_B } });
    await waitFor(() => expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Synthetic A User"));
    await act(async () => pending.resolve({ run: run(), publicFeedAvailable: true }));
    expect(screen.queryByText(/Run queued for your selected agent. Track/)).toBeNull();
    expect(state.clients.some(client => !client.live)).toBe(true);
  });
  it("batched A→B→A clears state and rejects old generation results; sign-out zeroes private content", async () => {
    const pending = deferred<{ run: PipelineRun; publicFeedAvailable: boolean }>(); state.requestRun.mockReturnValue(pending.promise);
    await openPanel(); await selectAgent();
    fireEvent.change(screen.getByLabelText("Exact resume text"), { target: { value: "PRIVATE PREVIOUS ACCOUNT RESUME" } });
    fireEvent.click(screen.getByRole("button", { name: "Run my pipeline" }));
    act(() => { switchAccount("account-b"); switchAccount("account-a"); });
    await screen.findByRole("button", { name: "Open pipeline controls" });
    expect(screen.queryByLabelText("Exact resume text")).toBeNull();
    await act(async () => pending.resolve({ run: run(), publicFeedAvailable: true }));
    expect(screen.queryByText(/Run queued for your selected agent/)).toBeNull();
    act(() => switchAccount(null));
    expect(screen.getByText(/Sign in to confirm your own profile/)).toBeTruthy(); expect(screen.queryByText(/Synthetic laptop/)).toBeNull();
  });
  it("portal profile approval requires explicit exact account and resume consent before saving scoped facts", async () => {
    await openPanel();
    const expiry = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    fireEvent.change(screen.getByLabelText("naukri approved account identity"), { target: { value: "portal-user@example.invalid" } });
    fireEvent.change(screen.getByLabelText("naukri approval expiry"), { target: { value: expiry } });
    const consent = screen.getByLabelText(/I verified this naukri account and updated its stored profile/) as HTMLInputElement;
    expect(consent.checked).toBe(false); expect(consent.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("I approve this exact resume for applications. No AI rewriting is authorized."));
    fireEvent.click(consent);
    fireEvent.click(screen.getByLabelText("I checked every populated fact and its scope/expiry; these are my factual answers."));
    fireEvent.click(screen.getByRole("button", { name: "Confirm my profile" }));
    await waitFor(() => expect(state.confirmProfile).toHaveBeenCalledOnce());
    const facts = state.confirmProfile.mock.calls[0][0].facts;
    expect(facts["portalProfileApproved:naukri"].value).toBe(true);
    expect(facts["portalAccountIdentity:naukri"].value).toBe("portal-user@example.invalid");
    expect(facts["portalResumeText:naukri"].value).toBe(profile.resumeText);
    expect(facts["portalProfileApproved:naukri"].scope).toEqual({ portal: "naukri:www.naukri.com/candidate" });
    expect(facts["portalProfileApproved:naukri"].validUntil).toBe(`${expiry}T23:59:59.000Z`);
    expect(facts["portalProfileApproved:instahyre"]).toBeUndefined();
  });
  it("resume changes invalidate portal/profile approval and oversized text is never truncated", async () => {
    await openPanel();
    const expiry = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    fireEvent.change(screen.getByLabelText("naukri approved account identity"), { target: { value: "portal-user@example.invalid" } });
    fireEvent.change(screen.getByLabelText("naukri approval expiry"), { target: { value: expiry } });
    fireEvent.click(screen.getByLabelText("I approve this exact resume for applications. No AI rewriting is authorized."));
    fireEvent.click(screen.getByLabelText(/I verified this naukri account/));
    fireEvent.change(screen.getByLabelText("Exact resume text"), { target: { value: "x".repeat(12001) } });
    expect((screen.getByLabelText(/I verified this naukri account/) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("I approve this exact resume for applications. No AI rewriting is authorized.") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Exact resume text") as HTMLTextAreaElement).value.length).toBe(12001);
    expect(screen.getByText(/12,001 \/ 12,000 characters/)).toBeTruthy(); expect(state.confirmProfile).not.toHaveBeenCalled();
  });
  it("task timeline distinguishes observed, unverified and waiting states without timeout completion", async () => {
    state.listTasks.mockResolvedValue([{ ...task(), status: "submitted" }, { ...task(TASK_B), status: "unverified", reason: "submission_lease_expired" }]);
    state.listRuns.mockResolvedValue([{ ...run(), status: "completed", finishedAt: now }]);
    await openPanel(); await selectAgent();
    expect(screen.getByText(/Submitted · confirmation observed · Confirmed/)).toBeTruthy();
    expect(screen.getByText(/Unverified · do not retry blindly · Confirmed/)).toBeTruthy();
    expect(screen.getByText("Processing ended · inspect task outcomes")).toBeTruthy();
  });
});
