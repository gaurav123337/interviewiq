/* The customer control plane is separate from the legacy singleton owner engine.
   Every async operation is fenced by account generation and selected binding. */
import { useEffect, useRef, useState } from "react";
import { getCloudState, subscribeCloud } from "../../services/cloud";
import { agentReadiness, createPipelineClient, pipelineErrorMessage, type PipelineAnswer, type PipelineAgent, type PipelineBoard, type PipelineClient, type PipelineCommand, type PipelineCommandType, type PipelineProfile, type PipelineQuestion, type PipelineRun, type PipelineSession, type PipelineSettingsRecord, type PipelineTask, type PipelineTaskStatus, type VerifiedFact } from "../../services/applyPipeline";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip } from "../ui";
import { PipelineProfileForm } from "./PipelineProfileForm";
import { PipelineSettingsForm } from "./PipelineSettingsForm";
import { PipelineQuestionCard } from "./PipelineQuestionCard";

const TASK_LABELS: Record<PipelineTaskStatus, string> = {
  queued: "Queued", in_progress: "Matching / preparing", submitting: "Submission in progress · not confirmed",
  waiting_answer: "Waiting for your answer", waiting_login: "Waiting for sign-in", waiting_review: "Waiting for human review",
  unsupported: "Unsupported · manual application required", submitted: "Submitted · confirmation observed", unverified: "Unverified · do not retry blindly",
  failed: "Failed", cancelled: "Cancelled", filtered: "Filtered by your preferences",
};
interface Snapshot { agents: PipelineAgent[]; settings: PipelineSettingsRecord; runs: PipelineRun[]; tasks: PipelineTask[]; sessions: PipelineSession[] }
interface PrivateSnapshot { profile: PipelineProfile | null; answers: PipelineAnswer[]; answersRevision: number; questions: PipelineQuestion[]; boards: PipelineBoard[] }
export default function ApplyPipelinePanel({ canRun }: { canRun: boolean }) {
  const [account, setAccount] = useState(() => ({ id: getCloudState().user?.id ?? null, version: 0 }));
  useEffect(() => subscribeCloud(state => setAccount(previous => {
    const id = state.user?.id ?? null;
    return id === previous.id ? previous : { id, version: previous.version + 1 };
  })), []);
  if (!account.id) return <section className={`${cardCls} mt-5 p-5`} aria-label="Application pipeline"><h3 className="text-[15px] font-bold">Your autonomous application pipeline</h3><p className="mt-1 text-[12px] text-fnt">Sign in to confirm your own profile and manage a paired local worker. No application has been requested.</p></section>;
  return <AccountPipeline key={`${account.id}:${account.version}`} userId={account.id} canRun={canRun} />;
}
function AccountPipeline({ userId, canRun }: { userId: string; canRun: boolean }) {
  const [open, setOpen] = useState(false);
  const [bindingId, setBindingId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [privateData, setPrivateData] = useState<PrivateSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [command, setCommand] = useState<PipelineCommand | null>(null);
  const [portal, setPortal] = useState("");
  const [boardUrl, setBoardUrl] = useState("");
  const [boardLabel, setBoardLabel] = useState("");
  const [limit, setLimit] = useState(10);
  const generation = useRef(0);
  const alive = useRef(true);
  const pending = useRef(false);
  const api = useRef<PipelineClient | null>(null);
  const selection = useRef(bindingId);
  const access = useRef(canRun);
  access.current = canRun;
  const current = (version: number) => alive.current && generation.current === version && getCloudState().user?.id === userId;
  const selectedAgent = snapshot?.agents.find(agent => agent.bindingId === bindingId && !agent.revokedAt);
  const readiness = selectedAgent ? agentReadiness(selectedAgent) : null;
  const tasks = snapshot?.tasks.filter(task => task.bindingId === bindingId) ?? [];
  const runs = snapshot?.runs.filter(run => run.bindingId === bindingId) ?? [];
  const sessions = snapshot?.sessions.filter(session => session.bindingId === bindingId) ?? [];
  const questions = privateData?.questions.filter(question => question.taskIds.some(id => tasks.some(task => task.id === id))) ?? [];
  const portals = [...new Set([...sessions.map(session => session.portal), ...tasks.map(task => task.job.portal ?? new URL(task.job.jobUrl).hostname)])];
  const ownProfile = privateData?.profile;
  const runnable = !!selectedAgent && !!snapshot?.settings.data.enabled && !!ownProfile?.resumeApproved && !!ownProfile.facts.name && !!ownProfile.facts.email && Array.isArray(ownProfile.facts.skills?.value) && ownProfile.facts.skills.value.length > 0;

  async function readSnapshot(client: PipelineClient): Promise<Snapshot> {
    const [agents, settings, runs, tasks, sessions] = await Promise.all([client.listAgents(), client.getSettings(), client.listRuns(), client.listTasks(), client.listSessions()]);
    return { agents, settings, runs, tasks, sessions };
  }
  async function readPrivate(client: PipelineClient): Promise<PrivateSnapshot> {
    const [profile, answers, questions, boards] = await Promise.all([client.getProfile(), client.listAnswers(), client.listQuestions(), client.listBoards()]);
    return { profile, answers: answers.answers, answersRevision: answers.revision, questions, boards };
  }
  async function reload(includePrivate = open, background = false) {
    const client = api.current, version = generation.current;
    if (!client || !current(version) || pending.current) return;
    pending.current = true;
    if (!background) { setBusy(true); setError(null); }
    try {
      const [next, personal] = await Promise.all([readSnapshot(client), includePrivate ? readPrivate(client) : Promise.resolve(null)]);
      if (!current(version)) return;
      setSnapshot(next);
      if (personal) setPrivateData(personal);
      if (selection.current && !next.agents.some(agent => agent.bindingId === selection.current && !agent.revokedAt)) {
        chooseBinding(""); setMessage("The selected agent was revoked. Select an active agent before requesting anything.");
      }
      setError(null);
    } catch (failure) {
      if (current(version)) { setError(pipelineErrorMessage(failure)); setSnapshot(null); setPrivateData(null); }
    } finally { if (current(version)) { pending.current = false; setBusy(false); } }
  }
  function chooseBinding(id: string) {
    if (id === selection.current) return;
    generation.current++; api.current?.dispose(); api.current = null; pending.current = false;
    selection.current = id; setBindingId(id); setCommand(null); setMessage(null); setError(null); setBusy(false); setPortal(""); setBoardUrl(""); setBoardLabel("");
    setSnapshot(previous => previous ? { ...previous, runs: [], tasks: [], sessions: [] } : null);
    setPrivateData(null);
  }
  useEffect(() => {
    alive.current = true;
    const version = ++generation.current;
    selection.current = bindingId;
    const client = createPipelineClient(userId); api.current = client;
    const unsubscribe = subscribeCloud(state => {
      if (state.user?.id !== userId) {
        alive.current = false; generation.current++; client.dispose(); api.current = null;
        setSnapshot(null); setPrivateData(null); setPortal(""); setBoardUrl(""); setBoardLabel(""); setMessage(null); setError(null); setCommand(null); setOpen(false);
      }
    });
    if (current(version)) void reload(open);
    return () => { generation.current++; client.dispose(); if (api.current === client) api.current = null; pending.current = false; unsubscribe(); };
  }, [userId, bindingId]);
  useEffect(() => {
    if (open && !busy && snapshot && !privateData && api.current) void reload(true);
  }, [open, busy, snapshot, privateData]);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => { void reload(true, true); }, 15000);
    return () => clearInterval(timer);
  }, [open, bindingId]);
  useEffect(() => {
    if (!canRun) { setCommand(null); setMessage(null); }
  }, [canRun]);

  async function operation<T>(run: (client: PipelineClient) => Promise<T>, success: (value: T) => string, cleanupAllowed = false): Promise<T | null> {
    const client = api.current, version = generation.current;
    if (!client || !current(version) || pending.current) return null;
    if (!cleanupAllowed && !access.current) { setError("Auto-apply access is required to start or change the pipeline. You can still cancel runs and revoke answers."); return null; }
    pending.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const value = await run(client);
      if (!current(version)) return null;
      if (!cleanupAllowed && !access.current) { setError("Access changed while the request was in flight. Reload to check its status; no completion is confirmed."); return null; }
      setMessage(success(value));
      const [next, personal] = await Promise.all([readSnapshot(client), open ? readPrivate(client) : Promise.resolve(null)]);
      if (!current(version)) return null;
      setSnapshot(next); if (personal) setPrivateData(personal);
      return value;
    } catch (failure) { if (current(version)) setError(pipelineErrorMessage(failure)); return null; }
    finally { if (current(version)) { pending.current = false; setBusy(false); } }
  }
  async function sendCommand(type: PipelineCommandType, targetPortal?: string, questionId?: string) {
    if (!selectedAgent) return;
    const result = await operation(client => client.requestCommand(bindingId, type, { ...(targetPortal ? { portal: targetPortal } : {}), ...(questionId ? { questionId } : {}) }), () => "Command queued for the selected local agent. A queue acknowledgement is not proof that its browser opened or the session was verified.", type === "pause");
    if (result) setCommand(result);
  }
  const confirmProfile = async (input: { facts: Record<string, VerifiedFact>; resumeText: string; resumeApproved: boolean }) => {
    await operation(client => client.confirmProfile({ ...input, expectedRevision: privateData?.profile?.revision ?? null }), () => "Profile confirmed. Previous saved answers and pending approvals were invalidated; review new questions before resuming.");
  };
  const requestRun = async () => {
    if (!runnable || !canRun || !snapshot || !selectedAgent) return;
    await operation(client => client.requestRun(bindingId, snapshot.settings.data.autoSubmit ? "auto" : "review", limit), result =>
      result.run.taskCount === 0 ? "Run recorded, but no new tasks were eligible. Nothing was submitted."
        : !agentReadiness(selectedAgent).ready ? "Run queued for your selected agent. Its worker is offline, paused or incompatible; nothing has been submitted."
          : "Run queued for your selected agent. Track each task below; queued is not submitted.");
  };
  const status = error ? "Unavailable · fail closed" : !snapshot ? "Checking backend…" : !snapshot.agents.some(agent => !agent.revokedAt) ? "Local worker not paired" : readiness?.label ?? "Select your local agent";
  return <section className={`${cardCls} mt-5 overflow-hidden`} aria-label="Application pipeline">
    <div className="flex flex-wrap items-center justify-between gap-2 p-5">
      <div><h3 className="text-[15px] font-extrabold">Your autonomous application pipeline</h3><p className="mt-1 max-w-3xl text-[12px] text-fnt">Confirm your facts once, choose your own local agent, and answer only new context-specific questions. Telegram is optional and never required to run.</p></div>
      <button type="button" className={btnGhost + btnSm} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? "Close pipeline controls" : "Open pipeline controls"}</button>
      <div className="w-full text-[12px] text-mut" role="status">{status}</div>
      {!canRun && <p className="w-full text-[12px] text-warn">Auto-apply access is inactive. You can still inspect your data, cancel queued runs, pause an agent and revoke saved answers.</p>}
      {error && <p role="alert" className="w-full text-[12px] text-red-400">{error}</p>}
    </div>
    {open && <div className="space-y-4 border-t border-line/10 p-5" aria-busy={busy}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1 text-[12px]">Your paired local agent
          <select className="inp mt-1 w-full" aria-label="Pipeline agent" value={bindingId} onChange={event => chooseBinding(event.target.value)}>
            <option value="">Select an agent explicitly</option>{snapshot?.agents.filter(agent => !agent.revokedAt).map(agent => <option key={agent.bindingId} value={agent.bindingId}>{agent.label} · {agentReadiness(agent).label}</option>)}
          </select>
        </label>
        <button type="button" className={btnGhost + btnSm} disabled={busy} onClick={() => void reload(true)}>Reload pipeline</button>
      </div>
      <div className="rounded-lg border border-line/10 bg-deep/40 p-3 text-[12px] text-fnt">
        <p>This web app does not install or start a browser worker automatically. Pair your machine in “Your personal agent” below, then start the paired worker from the updated project checkout.</p>
        <p className="mt-1">One-time dependency setup: <code>npm run apply:setup</code>. Pair this account: <code>npm run apply:pair</code>. Start the pipeline: <code>node scripts/apply-pipeline-worker.js</code>. Keep that terminal and machine online. Never use the owner service key.</p>
        <p className="mt-1">{selectedAgent ? `Worker version: ${selectedAgent.engineVersion ?? "not reported"} · Last heartbeat: ${selectedAgent.heartbeatAt ? new Date(selectedAgent.heartbeatAt).toLocaleString() : "never"}.` : "No selected worker. Pairing alone is not an installation or a live heartbeat."}</p>
        <p className="mt-1">Cloud-browser installation, AI rewriting and real job-site execution are not performed by this panel.</p>
      </div>
      {!snapshot && <p className="text-[12px] text-warn">Pipeline controls are unavailable until the authenticated backend responds. No legacy owner or synthetic fallback is used.</p>}
      {snapshot && <>
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line/10 p-3">
          <label className="text-[12px]">Maximum tasks this run<input className="inp mt-1 block w-28" aria-label="Pipeline run task limit" type="number" min="1" max="100" value={limit} disabled={busy || !canRun} onChange={event => setLimit(Number(event.target.value))} /></label>
          <button type="button" className={btnPrimary + btnSm} disabled={busy || !canRun || !runnable} onClick={() => void requestRun()}>Run my pipeline</button>
          <button type="button" className={btnDanger + btnSm} disabled={busy || !snapshot.settings.data.enabled} onClick={() => void operation(client => client.putSettings({ expectedRevision: snapshot.settings.revision, settings: { ...snapshot.settings.data, enabled: false, autoSubmit: false } }), () => "Pipeline disabled. Future cycles are stopped; ambiguous past submission attempts remain unverified.", true)}>Turn pipeline off</button>
          <button type="button" className={btnDanger + btnSm} disabled={busy || !selectedAgent} onClick={() => void sendCommand("pause")}>Pause selected agent</button>
          <button type="button" className={btnGhost + btnSm} disabled={busy || !canRun || !selectedAgent} onClick={() => void sendCommand("resume")}>Resume selected agent</button>
          <p className="w-full text-[11px] text-mut">{!runnable ? "Select an agent, confirm name/email/skills and approve your exact resume, then save enabled preferences before running." : snapshot.settings.data.autoSubmit ? "Auto-submit is explicitly enabled, but every task must still pass the safety gates." : "Review mode: prepare only; no automatic submission."} Offline workers keep requests queued, never silently completed.</p>
        </div>
        <section aria-label="Selected agent sessions" className="rounded-xl border border-line/10 p-4">
          <h4 className="text-[14px] font-bold">Sign-in and session checks · selected agent only</h4>
          <p className="mt-1 text-[11px] text-mut">Passwords, cookies and binding secrets never appear here. Sign in in the local browser yourself; session metadata is observed by that same agent, not by this web browser.</p>
          <p className="mt-1 text-[11px] text-mut">Portal commands use an eligible application belonging to this agent. Question review opens the exact application linked to that question; a sign-in command is not an application review or submission.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2"><label className="text-[12px]">Exact portal<input className="inp mt-1 block" aria-label="Selected agent portal" list="pipeline-portals" value={portal} onChange={event => setPortal(event.target.value)} disabled={busy || !canRun || !selectedAgent} maxLength={200} /><datalist id="pipeline-portals">{portals.map(value => <option key={value} value={value} />)}</datalist></label>
            <button type="button" className={btnGhost + btnSm} disabled={busy || !canRun || !selectedAgent || !portal.trim()} onClick={() => void sendCommand("retry_login", portal.trim())}>Sign in on selected agent</button>
            <button type="button" className={btnGhost + btnSm} disabled={busy || !canRun || !selectedAgent || !portal.trim()} onClick={() => void sendCommand("check_session", portal.trim())}>Check selected agent session</button>
          </div>
          {sessions.length === 0 && <p className="mt-2 text-[12px] text-mut">No observed sessions for this selected agent.</p>}
          <ul className="mt-2 space-y-1 text-[12px]">{sessions.map(session => <li key={session.portal}>{session.portal} · {session.status === "authenticated" ? "Sign-in observed" : session.status.replaceAll("_", " ")} · Checked {new Date(session.checkedAt).toLocaleString()}{session.accountLabel ? ` · ${session.accountLabel}` : ""}</li>)}</ul>
          {command && <p className="mt-2 text-[11px] text-mut">Last command: {command.type.replaceAll("_", " ")} · {command.status}. Session verification must be observed separately.</p>}
        </section>
        {privateData ? <>
          <PipelineProfileForm key={`profile:${bindingId}:${privateData.profile?.revision ?? "none"}`} profile={privateData.profile} busy={busy} canEdit={canRun} onConfirm={confirmProfile}
            onImport={async () => await operation(client => client.importDraft(), () => "Loaded your own saved draft. Extraction is unverified; check all values and explicitly approve the resume before confirming.")} />
          <PipelineSettingsForm key={`settings:${bindingId}:${snapshot.settings.revision}`} value={snapshot.settings.data} busy={busy} canEdit={canRun}
            onSave={async settings => { await operation(client => client.putSettings({ expectedRevision: snapshot.settings.revision, settings }), () => "Preferences saved. Pending approvals were invalidated so the worker must recheck the current rules."); }} />
          <section aria-label="Pipeline action needed" className="rounded-xl border border-line/10 p-4">
            <h4 className="text-[14px] font-bold">Action needed · answer once in the same context</h4>
            <p className="mt-1 text-[12px] text-mut">Unknown answers stay blank. The backend batches the same meaning, control, offered options and context. No blanket global answer or legal consent is inferred.</p>
            {!bindingId ? <p className="mt-2 text-[12px]">Select the agent whose applications you want to review.</p> : questions.length === 0 ? <p className="mt-2 text-[12px]">No new questions waiting for this agent.</p> : <div className="mt-3 space-y-3">{questions.map(question => <PipelineQuestionCard key={`${question.id}:${question.profileRevision}`} question={question} tasks={tasks} busy={busy} canAnswer={canRun}
              onAnswer={async input => { await operation(client => client.answerQuestion(question, input), () => "Answer confirmed for the displayed scope. Matching tasks may resume after all their required questions are resolved."); }}
              onOpen={async () => { await sendCommand("open_question", undefined, question.id); }} />)}</div>}
          </section>
          <section aria-label="Pipeline answer bank" className="rounded-xl border border-line/10 p-4">
            <h4 className="text-[14px] font-bold">Verified answer bank · revision {privateData.answersRevision}</h4>
            <p className="mt-1 text-[11px] text-mut">Revoking an answer invalidates pending approvals. Expired or prior-profile answers are not reusable.</p>
            {!privateData.answers.length && <p className="mt-2 text-[12px]">No confirmed answers saved.</p>}
            <ul className="mt-2 space-y-2">{privateData.answers.map(answer => <li key={answer.id} className="rounded-lg border border-line/10 p-3 text-[12px]">
              <b>{answer.questionText}</b><p className="mt-1 whitespace-pre-wrap break-words">{answer.answer}</p><p className="mt-1 text-[11px] text-mut">User-confirmed · {answer.scope}{answer.scopeKey ? `: ${answer.scopeKey}` : ""} · Profile revision {answer.profileRevision} · Confirmed {new Date(answer.confirmedAt).toLocaleString()} · Expires {answer.expiresAt ? new Date(answer.expiresAt).toLocaleString() : "no expiry"}</p>
              <p className="mt-1 text-[11px] text-mut">{answer.revokedAt ? "Revoked · not reusable" : answer.expiresAt && Date.parse(answer.expiresAt) <= Date.now() ? "Expired · not reusable" : answer.profileRevision !== privateData.profile?.revision ? "Profile changed · not reusable" : "Confirmed for this scope and exact question context"}</p>
              {!answer.revokedAt && <button type="button" className={btnDanger + btnSm + " mt-2"} disabled={busy} onClick={() => void operation(client => client.revokeAnswer(answer.id), () => "Saved answer revoked. Pending approvals must be checked again.", true)}>Revoke saved answer</button>}
            </li>)}</ul>
          </section>
          <section aria-label="Private board discovery" className="rounded-xl border border-line/10 p-4">
            <h4 className="text-[14px] font-bold">Add a private discovery candidate</h4><p className="mt-1 text-[12px] text-mut">Adding a board does not approve it for auto-submit. New boards remain discovery candidates; unsupported forms require manual review.</p>
            <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void operation(client => client.addBoard(boardUrl.trim(), boardLabel), () => "Private board added as a discovery candidate, not an auto-submit site."); }}>
              <label className="flex-1 text-[12px]">Public HTTPS board URL<input className="inp mt-1 w-full" aria-label="Private discovery board URL" value={boardUrl} onChange={event => setBoardUrl(event.target.value)} disabled={busy || !canRun} maxLength={2048} /></label>
              <label className="text-[12px]">Label<input className="inp mt-1 block" aria-label="Private discovery board label" value={boardLabel} onChange={event => setBoardLabel(event.target.value)} disabled={busy || !canRun} maxLength={200} /></label>
              <button type="submit" className={btnGhost + btnSm} disabled={busy || !canRun || !boardUrl.trim()}>Add discovery candidate</button>
            </form>
            <ul className="mt-2 text-[12px]">{privateData.boards.map(board => <li key={board.id}>{board.label} · {board.status} · {board.host} · discovery only</li>)}</ul>
          </section>
        </> : <p className="text-[12px] text-mut">Loading your own verified profile, questions and answer bank…</p>}
        <section aria-label="Pipeline task timeline" className="rounded-xl border border-line/10 p-4">
          <h4 className="text-[14px] font-bold">Task timeline · selected agent</h4><p className="mt-1 text-[11px] text-mut">With enabled preferences, the selected worker can continue matching new jobs after your first explicit run. Cancel stops that run only; turn the pipeline off to stop future cycles. A completed run means processing ended, not that every job was submitted. Only “Submitted · confirmation observed” records observed submission evidence. Timeouts and interrupted attempts remain unverified.</p>
          {!bindingId ? <p className="mt-2 text-[12px]">Select an agent to inspect its runs and tasks.</p> : !runs.length ? <p className="mt-2 text-[12px]">No recorded runs for this agent.</p> : <ul className="mt-3 space-y-2">{runs.map(run => <li key={run.id} className="rounded-lg border border-line/10 p-3 text-[12px]">
            <div className="flex flex-wrap items-center gap-2"><b>{new Date(run.createdAt).toLocaleString()}</b><Chip tone={run.status === "cancelled" ? "default" : "co"}>{run.status === "completed" ? "Processing ended · inspect task outcomes" : run.status === "queued" ? "Queued · waiting for worker" : run.status}</Chip><span>{run.mode === "auto" ? "Auto-submit opted in" : "Review only"} · {run.taskCount} tasks / {run.candidateCount} candidates</span>
              {["queued", "running"].includes(run.status) && <button type="button" className={btnDanger + btnSm} disabled={busy} onClick={() => void operation(client => client.cancelRun(run.id), () => "Run cancelled. Attempts that may have crossed submission remain unverified; do not retry them blindly.", true)}>Cancel pipeline run</button>}
            </div>
            <ul className="mt-2 space-y-2">{tasks.filter(task => task.runId === run.id).map(task => <li key={task.id} className="border-l-2 border-line/20 pl-3"><b>{task.job.title}</b> · {task.job.company}<p>{TASK_LABELS[task.status]} · Confirmed skill match {task.score}%</p><p className="break-words text-[11px] text-mut">{task.reason ?? "Deterministic match accepted; application preflight still required."} · Profile {task.profileRevision} / Preferences {task.settingsRevision} / Answers {task.answersRevision}</p>
              {task.status === "waiting_review" && <button type="button" className={btnGhost + btnSm + " mt-1"} disabled={busy || !canRun} onClick={() => void sendCommand("retry_login", task.job.portal ?? new URL(task.job.jobUrl).hostname)}>Open local sign-in window</button>}
            </li>)}</ul>
          </li>)}</ul>}
        </section>
      </>}
      {message && <p role="status" className="text-[12px] text-fnt">{message}</p>}
    </div>}
  </section>;
}
