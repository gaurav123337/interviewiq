import { test, expect, signIn } from "./fixtures";
import type { Page } from "@playwright/test";
import type { FixtureBackend } from "./backend";

/* Strict synthetic UI contract coverage only. No real employer, agent, login,
   Supabase migration, RLS proof or live application is involved. */
const USER_A = "00000000-0000-4000-8000-000000000001", USER_B = "00000000-0000-4000-8000-000000000002";
const AGENT_A = "10000000-0000-4000-8000-000000000001", AGENT_B = "10000000-0000-4000-8000-000000000002";
const RUN_A = "20000000-0000-4000-8000-000000000001", RUN_B = "20000000-0000-4000-8000-000000000002";
const TASK_A = "30000000-0000-4000-8000-000000000001", TASK_A2 = "30000000-0000-4000-8000-000000000003", TASK_B = "30000000-0000-4000-8000-000000000002";
const QUESTION_A = "40000000-0000-4000-8000-000000000001";
const defaults = { enabled: true, autoSubmit: false, threshold: 60, dailyCap: 10, weeklyCap: 50, employerDailyCap: 2, timeZone: "UTC", roles: ["TypeScript Engineer"], locations: ["Remote"], countries: ["US"], excludeCompanies: [], requireWorkAuthorization: false, allowSponsorship: true, maxAgeDays: 14, aiConsent: false };
function seed(backend: FixtureBackend, userId = USER_A, label = "Alpha", online = true) {
  const now = new Date().toISOString(), binding_id = userId === USER_A ? AGENT_A : AGENT_B, runId = userId === USER_A ? RUN_A : RUN_B;
  backend.pipelineProfiles.set(userId, { revision: 1, answers_revision: 1, facts: { name: { value: `Synthetic ${label} User`, source: "user", confirmedAt: now }, email: { value: `${label.toLowerCase()}@example.invalid`, source: "user", confirmedAt: now }, skills: { value: ["typescript", "react"], source: "user", confirmedAt: now } }, resume_text: `Synthetic ${label} resume\nVerified TypeScript/React experience. User-approved fixture resume.`, resume_approved: true, confirmed_at: now, updated_at: now });
  backend.pipelineSettings.set(userId, { revision: 1, data: structuredClone(defaults), updated_at: now });
  backend.agentBindings.push({ user_id: userId, binding_id, label: `Synthetic ${label} laptop`, created_at: now, last_used_at: null, revoked_at: null });
  backend.pipelineAgents.push({ user_id: userId, binding_id, label: `Synthetic ${label} laptop`, engine_version: online ? "paired-worker/1.0.0" : null, capabilities: online ? ["leased-tasks", "verified-answer-bank", "job-bound-receipts", "human-signin", "session-check"] : [], status: online ? "ready" : null, profile_metadata: {}, heartbeat_at: online ? now : null, revoked_at: null, last_used_at: null });
  backend.pipelineRuns.push({ user_id: userId, id: runId, binding_id, mode: "review", status: "queued", profile_revision: 1, settings_revision: 1, answers_revision: 1, candidate_count: 2, task_count: 2, created_at: now, started_at: null, finished_at: null });
  for (const id of userId === USER_A ? [TASK_A, TASK_A2] : [TASK_B]) backend.pipelineTasks.push({ user_id: userId, id, run_id: runId, target_binding_id: binding_id, job: { jobUrl: `https://employer.example.com/job/${id}`, title: `Synthetic ${label} TypeScript role`, company: "Synthetic Company", description: "Synthetic fixture job", skills: ["typescript"], location: "Remote", country: "US", postedAt: now, portal: "employer.example.com" }, status: userId === USER_A ? "waiting_answer" : "queued", lease_version: 0, lease_until: null, profile_revision: 1, settings_revision: 1, answers_revision: 1, score: 100, reason: "no confirmed answer" });
}
function seedQuestion(backend: FixtureBackend, unknown = false) {
  const now = new Date().toISOString();
  backend.pipelineQuestions.push({ user_id: USER_A, id: QUESTION_A, question_key: "synthetic-same-context", meaning: unknown ? "unknown:why this team" : "noticePeriod", question_text: unknown ? "Why do you want this particular role?" : "What is your notice period?", control_type: unknown ? "textarea" : "select", options: unknown ? [] : ["Immediately", "30 days"], context: { employer: "Synthetic Company", portal: "employer.example.com", application: "https://employer.example.com/job/fixture" }, scope: unknown ? "application" : "employer", scope_key: unknown ? "https://employer.example.com/job/fixture" : "Synthetic Company", currency: null, reason: "No verified factual answer", profile_revision: 1, status: "pending", answer_id: null, task_ids: [TASK_A, TASK_A2], created_at: now, updated_at: now });
}
async function openPipeline(page: Page, bindingId = AGENT_A) {
  await page.goto("#/jobs");
  const panel = page.getByRole("region", { name: "Application pipeline", exact: true });
  await panel.getByRole("button", { name: "Open pipeline controls", exact: true }).click();
  await panel.getByLabel("Pipeline agent", { exact: true }).selectOption(bindingId);
  await expect(panel.getByRole("button", { name: "Reload pipeline", exact: true })).toBeEnabled();
  await expect(panel.getByRole("button", { name: "Confirm my profile", exact: true })).toBeVisible();
  return panel;
}
function calls(backend: FixtureBackend, action: string) { return backend.calls.filter(call => call.path === "/rest/v1/rpc/my_apply_pipeline_action" && (call.body as { p_action?: string })?.p_action === action); }

 test("paired own run queues offline without checkout or Telegram @integration @simulated", async ({ page, backend }) => {
  backend.persona = "addon"; seed(backend, USER_A, "Alpha", false); seed(backend, USER_B, "Beta");
  await signIn(page); const panel = await openPipeline(page);
  await expect(panel.getByText(/Worker version: not reported/)).toBeVisible();
  await expect(panel.getByLabel("Pipeline agent", { exact: true }).locator("option").filter({ hasText: "Beta" })).toHaveCount(0);
  await panel.getByRole("button", { name: "Run my pipeline", exact: true }).click();
  await expect(panel.getByText(/Its worker is offline, paused or incompatible; nothing has been submitted/)).toBeVisible();
  expect(calls(backend, "run.request").map(call => call.body)).toEqual([{ p_action: "run.request", p_args: { bindingId: AGENT_A, mode: "review", limit: 10 } }]);
  expect(backend.calls.filter(call => /admin_request_run|pay-checkout|send-notify-test/.test(call.path))).toEqual([]);
  expect(backend.notifyDeliveries).toEqual([]); expect(backend.pipelineTasks.some(row => row.status === "submitted")).toBe(false);
 });

 test("same-context question is confirmed once; blocked tasks resume only after the explicit answer @integration @simulated", async ({ page, backend }) => {
  backend.persona = "platinum"; seed(backend); seedQuestion(backend);
  await signIn(page); const panel = await openPipeline(page);
  await expect(panel.getByRole("heading", { name: "What is your notice period?", exact: true })).toHaveCount(1);
  await expect(panel.getByText("2 applications waiting · Profile revision 1 · select", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("Answer to What is your notice period?", { exact: true })).toHaveValue("");
  expect(backend.pipelineTasks.filter(row => row.user_id === USER_A).every(row => row.status === "waiting_answer")).toBe(true);
  await panel.getByLabel("Answer to What is your notice period?", { exact: true }).selectOption("30 days");
  await panel.getByLabel("Answer expiry for What is your notice period?", { exact: true }).fill("2099-01-01");
  await expect(panel.getByRole("button", { name: "Confirm answer once", exact: true })).toBeDisabled();
  await panel.getByLabel(/Use this answer only for the displayed employer scope/).check();
  await panel.getByLabel("I confirm this answer is factual and current.", { exact: true }).check();
  await panel.getByRole("button", { name: "Confirm answer once", exact: true }).click();
  await expect(panel.getByText(/Answer confirmed for the displayed scope/)).toBeVisible();
  await expect(panel.getByRole("heading", { name: "What is your notice period?", exact: true })).toHaveCount(0);
  expect(calls(backend, "questions.answer").map(call => call.body)).toEqual([{ p_action: "questions.answer", p_args: { questionId: QUESTION_A, answer: "30 days", scope: "employer", scopeKey: "Synthetic Company", expiresAt: "2099-01-01T23:59:59.000Z", confirm: true } }]);
  expect(backend.pipelineAnswers).toHaveLength(1); expect(backend.pipelineTasks.filter(row => row.user_id === USER_A).every(row => row.status === "queued")).toBe(true);
  // Deliberately simulate observed and uncertain worker outcomes, not magic fixture auto-success.
  backend.completeSyntheticPipelineTask(TASK_A, "submitted"); backend.completeSyntheticPipelineTask(TASK_A2, "unverified");
  await panel.getByRole("button", { name: "Reload pipeline", exact: true }).click();
  await expect(panel.getByText(/Submitted · confirmation observed · Confirmed/)).toBeVisible();
  await expect(panel.getByText(/Unverified · do not retry blindly · Confirmed/)).toBeVisible();
 });

 test("unknown answer is never guessed and profile confirmation invalidates prior answers @integration @simulated", async ({ page, backend }) => {
  backend.persona = "addon"; seed(backend); seedQuestion(backend, true);
  const now = new Date().toISOString();
  backend.pipelineAnswers.push({ user_id: USER_A, id: "50000000-0000-4000-8000-000000000001", question_key: "old", meaning: "name", question_text: "Full name", control_type: "text", options: [], context: {}, answer: "Synthetic Alpha User", scope: "global", scope_key: "", profile_revision: 1, confirmed_at: now, expires_at: null, provenance: "user", revoked_at: null, revoke_reason: null });
  await signIn(page); const panel = await openPipeline(page);
  await expect(panel.getByLabel("Answer to Why do you want this particular role?", { exact: true })).toHaveValue("");
  expect(calls(backend, "questions.answer")).toEqual([]);
  await expect(panel.getByRole("button", { name: "Confirm my profile", exact: true })).toBeDisabled();
  await panel.getByLabel("I approve this exact resume for applications. No AI rewriting is authorized.", { exact: true }).check();
  await panel.getByLabel("I checked every populated fact and its scope/expiry; these are my factual answers.", { exact: true }).check();
  await panel.getByRole("button", { name: "Confirm my profile", exact: true }).click();
  await expect(panel.getByText(/Previous saved answers and pending approvals were invalidated/)).toBeVisible();
  expect(backend.pipelineProfiles.get(USER_A)?.revision).toBe(2); expect(backend.pipelineAnswers[0].revoked_at).not.toBeNull();
  expect(backend.pipelineQuestions[0].status).toBe("dismissed"); expect(calls(backend, "questions.answer")).toEqual([]);
 });

 test("expired account can cancel and revoke but cannot run; account A/B histories stay isolated @integration @simulated", async ({ page, backend }) => {
  backend.persona = "free"; seed(backend); seed(backend, USER_B, "Beta");
  const now = new Date().toISOString();
  backend.pipelineAnswers.push({ user_id: USER_A, id: "50000000-0000-4000-8000-000000000001", question_key: "old", meaning: "name", question_text: "Full name", control_type: "text", options: [], context: {}, answer: "Synthetic Alpha answer", scope: "global", scope_key: "", profile_revision: 1, confirmed_at: now, expires_at: null, provenance: "user", revoked_at: null, revoke_reason: null });
  await signIn(page); const panel = await openPipeline(page);
  await expect(panel.getByRole("button", { name: "Run my pipeline", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Cancel pipeline run", exact: true }).click();
  await expect(panel.getByText(/Run cancelled. Attempts/)).toBeVisible();
  await panel.getByRole("button", { name: "Revoke saved answer", exact: true }).click();
  await expect(panel.getByText(/Saved answer revoked/)).toBeVisible();
  expect(backend.pipelineRuns.find(row => row.user_id === USER_A)?.status).toBe("cancelled");
  expect(backend.pipelineRuns.find(row => row.user_id === USER_B)?.status).toBe("queued");
  expect(backend.pipelineAnswers[0].revoked_at).not.toBeNull(); expect(calls(backend, "run.request")).toEqual([]);
  await page.goto("#/settings"); await page.getByRole("button", { name: "Sign out", exact: true }).click();
  backend.userId = USER_B; backend.persona = "addon"; await signIn(page);
  const beta = await openPipeline(page, AGENT_B);
  await expect(beta.getByLabel("Exact resume text", { exact: true })).toHaveValue(/Synthetic Beta resume/);
  await expect(beta.getByText("Synthetic Alpha answer", { exact: true })).toHaveCount(0);
  await expect(beta.getByLabel("Pipeline agent", { exact: true }).locator("option").filter({ hasText: "Alpha" })).toHaveCount(0);
 });

 test("signin and check commands keep selected binding and exact portal; missing RPC stays unavailable @integration @simulated", async ({ page, backend }) => {
  backend.persona = "addon"; seed(backend); await signIn(page); const panel = await openPipeline(page);
  await panel.getByLabel("Selected agent portal", { exact: true }).fill("employer.example.com");
  await panel.getByRole("button", { name: "Sign in on selected agent", exact: true }).click();
  await expect(panel.getByText(/Last command: retry login · queued/)).toBeVisible();
  await panel.getByRole("button", { name: "Check selected agent session", exact: true }).click();
  await expect(panel.getByText(/Last command: check session · queued/)).toBeVisible();
  expect(calls(backend, "commands.request").map(call => call.body)).toEqual([
    { p_action: "commands.request", p_args: { bindingId: AGENT_A, type: "retry_login", args: { portal: "employer.example.com" } } },
    { p_action: "commands.request", p_args: { bindingId: AGENT_A, type: "check_session", args: { portal: "employer.example.com" } } },
  ]);
  backend.pipelineUnavailable = true;
  await panel.getByRole("button", { name: "Reload pipeline", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText(/backend may not be installed/);
  await expect(panel.getByRole("button", { name: "Run my pipeline", exact: true })).toHaveCount(0);
  expect(calls(backend, "run.request")).toEqual([]);
 });
