import { useState } from "react";
import type { PipelineFeedbackScope, PipelineFeedbackVerdict, PipelineLearning, PipelineLearningConfirmation, PipelineMatchAnswer, PipelineTask } from "../../services/applyPipeline";
import { btnGhost, btnPrimary, btnSm } from "../ui";

/** Match answers/preferences never update facts, reserve submission, or turn on
    settings. Only revision-bound proof from learning.list can offer graduation. */
export function PipelineMatchLearningCard({ task, learning, profileRevision, settingsRevision, busy, canEdit, onFeedback, onQuestion, onReport, onGrant, onOpen }: {
  task: PipelineTask; learning: PipelineLearning | null; profileRevision: number | undefined; settingsRevision: number;
  busy: boolean; canEdit: boolean;
  onFeedback: (input: PipelineLearningConfirmation & { scope: PipelineFeedbackScope; verdict: PipelineFeedbackVerdict }) => Promise<void>;
  onQuestion: (input: PipelineLearningConfirmation & { answer: PipelineMatchAnswer }) => Promise<void>;
  onReport: (input: PipelineLearningConfirmation) => Promise<void>;
  onGrant: (input: PipelineLearningConfirmation & { expiresAt: string }) => Promise<void>;
  onOpen: () => Promise<void>;
}) {
  const [scope, setScope] = useState<PipelineFeedbackScope | "">("");
  const [verdict, setVerdict] = useState<PipelineFeedbackVerdict | "">("");
  const [preferenceConfirmed, setPreferenceConfirmed] = useState(false);
  const [answer, setAnswer] = useState<PipelineMatchAnswer | "">("");
  const [answerConfirmed, setAnswerConfirmed] = useState(false);
  const [reportConfirmed, setReportConfirmed] = useState(false);
  const [grantConfirmed, setGrantConfirmed] = useState(false);
  const [expires, setExpires] = useState("");
  const decision = task.matchDecision;
  const current = task.profileRevision === profileRevision && task.settingsRevision === settingsRevision;
  const bound = (row: { profileRevision: number; settingsRevision: number; similarityKey: string; portal: string }) => current && !!decision && row.profileRevision === profileRevision && row.settingsRevision === settingsRevision && row.similarityKey === decision.similarityKey && row.portal === decision.portal;
  const proof = learning?.eligibility.find(row => row.taskId === task.id && bound(row));
  const activeGrant = learning?.grants.find(row => bound(row) && !row.revokedAt && Date.parse(row.grantedAt) <= Date.now() && Date.parse(row.expiresAt) > Date.now());
  const safeDecision = !!decision?.eligible && ["eligible_review", "eligible_auto"].includes(decision.status) && !decision.codes.length && !decision.missingCore.length;
  const eligible = safeDecision && proof?.eligible === true && proof.applySimilarCount >= 3 && proof.observedManualReceiptCount >= 2 && !!decision.portal && !activeGrant;
  const disabled = busy || !canEdit || !learning || !current;
  const matchingDisabled = disabled || !decision;
  const manualOpen = ["manual_actionable", "waiting_match_answer", "filtered", "user_skipped", "waiting_review", "unsupported", "waiting_answer", "waiting_login", "failed"].includes(task.status);
  const confirmation: PipelineLearningConfirmation = { taskId: task.id, profileRevision: task.profileRevision, settingsRevision: task.settingsRevision, confirm: true };
  const expiresAt = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(expires) ? `${expires}:00.000Z` : "";
  const remaining = Date.parse(expiresAt) - Date.now();
  const validExpiry = remaining > 0 && remaining <= 30 * 86400000;
  const answered = learning?.questions.filter(row => row.taskId === task.id && bound(row));
  const receipts = learning?.receipts.filter(row => row.taskId === task.id);
  return <article aria-label={`Match learning: ${task.job.title}`} className="rounded-lg border border-line/10 bg-deep/40 p-3 text-[12px]">
    <h5 className="text-[13px] font-bold">{task.job.title}</h5>
    <p>{task.job.company} · {task.job.location} · {task.status.replaceAll("_", " ")}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <a className={btnGhost + btnSm} href={task.job.jobUrl} target="_blank" rel="noopener noreferrer">View exact job</a>
      <button type="button" className={btnGhost + btnSm} disabled={disabled || !manualOpen} onClick={() => void onOpen()}>Open exact job on local agent</button>
    </div>
    <p className="mt-1 text-[11px] text-mut">Manual open only navigates to this exact job. It never fills fields or clicks Apply. Any manual receipt must be observed independently; a queued command is not application evidence.</p>
    <p className="mt-2 whitespace-pre-wrap break-words">{decision?.reason ?? task.reason ?? "No verified match decision reported by this backend."}</p>
    <p className="mt-1 text-[11px] text-mut">Profile {task.profileRevision} / Preferences {task.settingsRevision} · {current ? "Current revisions" : "Stale revisions · reload/re-evaluate before recording learning"}</p>
    {decision ? <div className="mt-2 space-y-1 text-[11px]">
      <p>Decision: {decision.status.replaceAll("_", " ")} · Match {decision.score}%</p>
      {!!decision.codes.length && <p className="break-words text-warn">Factual veto / decision codes: {decision.codes.join(", ")}</p>}
      {!!decision.missingCore.length && <p className="text-warn">Missing core requirements: {decision.missingCore.join(", ")}</p>}
      <ul>{decision.requirements.map((requirement, index) => <li key={index}>{requirement.core ? "Core" : "Requirement"}: {requirement.anyOf.join(" OR ")} · {requirement.evidence}</li>)}</ul>
      <p className="break-all text-mut">Similarity: {decision.similarityKey} · Portal: {decision.portal || "unverified"}</p>
    </div> : <p className="mt-2 text-[11px] text-warn">This task has no verified match-learning snapshot. Preference, question and autonomy actions are unavailable; no score-based fallback is used.</p>}
    <form className="mt-3 space-y-2 border-t border-line/10 pt-3" onSubmit={event => { event.preventDefault(); if (matchingDisabled || !scope || !verdict || !preferenceConfirmed) return; setPreferenceConfirmed(false); void onFeedback({ ...confirmation, scope, verdict }); }}>
      <p className="font-bold">Your match preference</p>
      <div className="flex flex-wrap gap-2">
        <label>Scope<select className="inp mt-1 block" aria-label={`Preference scope for ${task.job.title}`} disabled={matchingDisabled} value={scope} onChange={event => { setScope(event.target.value as PipelineFeedbackScope | ""); setPreferenceConfirmed(false); }}>
          <option value="">Choose scope</option><option value="exact">This exact job only</option><option value="similar">Similar jobs in this fingerprint</option>
        </select></label>
        <label>Verdict<select className="inp mt-1 block" aria-label={`Preference verdict for ${task.job.title}`} disabled={matchingDisabled} value={verdict} onChange={event => { setVerdict(event.target.value as PipelineFeedbackVerdict | ""); setPreferenceConfirmed(false); }}>
          <option value="">Choose preference</option><option value="apply">I prefer to apply</option><option value="skip">I prefer to skip</option>
        </select></label>
      </div>
      <label className="flex items-start gap-2 text-[11px]"><input type="checkbox" disabled={matchingDisabled} checked={preferenceConfirmed} onChange={event => setPreferenceConfirmed(event.target.checked)} />This is a preference only, not permission to apply. It cannot override factual vetoes or add skills.</label>
      <button type="submit" className={btnPrimary + btnSm} disabled={matchingDisabled || !scope || !verdict || !preferenceConfirmed}>Record match preference</button>
    </form>
    {decision?.question && <form className="mt-3 space-y-2 border-t border-line/10 pt-3" onSubmit={event => { event.preventDefault(); if (matchingDisabled || !answer || !answerConfirmed) return; setAnswerConfirmed(false); void onQuestion({ ...confirmation, answer }); }}>
      <h6 className="font-bold">{decision.question.text}</h6>
      <label>Your answer<select className="inp mt-1 block w-full" aria-label={`Match answer for ${task.job.title}`} disabled={matchingDisabled} value={answer} onChange={event => { setAnswer(event.target.value as PipelineMatchAnswer | ""); setAnswerConfirmed(false); }}>
        <option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Unsure</option>
      </select></label>
      <label className="flex items-start gap-2 text-[11px]"><input type="checkbox" disabled={matchingDisabled} checked={answerConfirmed} onChange={event => setAnswerConfirmed(event.target.checked)} />My answer does not add skills or approve a resume. Yes only suggests that I update and verify my profile myself.</label>
      <button type="submit" className={btnGhost + btnSm} disabled={matchingDisabled || !answer || !answerConfirmed}>Record match answer</button>
    </form>}
    {answered?.map(row => <p key={row.id} className="mt-2 text-[11px] text-mut">User answered {row.answer}. {row.suggestion === "profile_update" ? "Manually edit your verified profile and reapprove your exact resume before the job is reconsidered. No skill was added." : "No profile fact or application approval was created."}</p>)}
    <form className="mt-3 space-y-2 border-t border-line/10 pt-3" onSubmit={event => { event.preventDefault(); if (disabled || !reportConfirmed || !manualOpen) return; setReportConfirmed(false); void onReport(confirmation); }}>
      <label className="flex items-start gap-2 text-[11px]"><input type="checkbox" disabled={disabled || !manualOpen} checked={reportConfirmed} onChange={event => setReportConfirmed(event.target.checked)} />I applied manually; this report is not observed evidence and gives no autonomy graduation credit.</label>
      <button type="submit" className={btnGhost + btnSm} disabled={disabled || !reportConfirmed || !manualOpen}>Report manual application</button>
    </form>
    {receipts?.map(receipt => <p key={receipt.id} className="mt-2 text-[11px] text-mut">{receipt.source === "worker" && receipt.observedAt ? "Worker-observed manual receipt" : "Self-reported · not observed · no graduation credit"} · Profile {receipt.profileRevision} / Preferences {receipt.settingsRevision} · {receipt.observedAt ?? receipt.reportedAt}</p>)}
    <form className="mt-3 space-y-2 border-t border-line/10 pt-3" onSubmit={event => { event.preventDefault(); if (matchingDisabled || !eligible || !grantConfirmed || !validExpiry) return; setGrantConfirmed(false); void onGrant({ ...confirmation, expiresAt }); }}>
      <h6 className="font-bold">Explicit scoped autonomy · optional</h6>
      <p className="text-[11px] text-mut">{proof ? `${proof.applySimilarCount} / 3 distinct current apply-similar preferences · ${proof.observedManualReceiptCount} / 2 worker-observed manual receipts` : "Server graduation eligibility has not been proven for this task, portal and current revisions."}</p>
      <p className="text-[11px] text-mut">Only the server can prove eligibility and rechecks it when granting. Self-reports, exact preferences and stale revisions do not count. A grant never bypasses factual gates or enables pipeline settings.</p>
      {activeGrant && <p className="text-[11px] text-mut">Current scoped grant · expires {new Date(activeGrant.expiresAt).toLocaleString()}. Revoke it in the learning history below.</p>}
      <label className="block text-[11px]">Expires at (UTC) · required, within 30 days<input className="inp mt-1 block" aria-label={`Autonomy expiry UTC for ${task.job.title}`} type="datetime-local" value={expires} disabled={matchingDisabled} onChange={event => { setExpires(event.target.value); setGrantConfirmed(false); }} /></label>
      <label className="flex items-start gap-2 text-[11px]"><input type="checkbox" disabled={matchingDisabled} checked={grantConfirmed} onChange={event => setGrantConfirmed(event.target.checked)} />I explicitly grant autonomy for this similarity and portal only, with the displayed profile/settings revisions and expiry. All safety checks still apply.</label>
      <button type="submit" className={btnPrimary + btnSm} disabled={matchingDisabled || !eligible || !grantConfirmed || !validExpiry}>Grant scoped autonomy</button>
    </form>
  </article>;
}
