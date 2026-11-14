import { useState, type FormEvent } from "react";
import { btnGhost, btnPrimary, btnSm } from "../ui";
import { needsHumanQuestion, type PipelineQuestion, type PipelineTask } from "../../services/applyPipeline";

export function PipelineQuestionCard({ question, tasks, busy, canAnswer, onAnswer, onOpen }: {
  question: PipelineQuestion; tasks: PipelineTask[]; busy: boolean; canAnswer: boolean;
  onAnswer: (input: { answer: string; scope: PipelineQuestion["scope"]; scopeKey: string; expiresAt?: string; confirm: true }) => Promise<void>;
  onOpen: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [expires, setExpires] = useState("");
  const [scopeConfirmed, setScopeConfirmed] = useState(false);
  const manual = needsHumanQuestion(question);
  const timeSensitive = ["currentSalary", "expectedSalary", "workAuthorization", "requiresSponsorship", "noticePeriod"].includes(question.meaning);
  const linkedTasks = tasks.filter(task => question.taskIds.includes(task.id));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !canAnswer || manual || !answer.trim() || !confirmed || !scopeConfirmed || (timeSensitive && !expires)) return;
    await onAnswer({ answer, scope: question.scope, scopeKey: question.scopeKey, ...(expires ? { expiresAt: `${expires}T23:59:59.000Z` } : {}), confirm: true });
  };
  return <article aria-label={`Question: ${question.questionText}`} className="rounded-lg border border-warn/25 bg-deep/40 p-3">
    <h5 className="text-[13px] font-bold">{question.questionText}</h5>
    <p className="mt-1 text-[11px] text-mut">{question.taskIds.length} application{question.taskIds.length === 1 ? "" : "s"} waiting · Profile revision {question.profileRevision} · {question.controlType}</p>
    {linkedTasks.length > 0 && <ul className="mt-1 text-[11px] text-fnt">{linkedTasks.map(task => <li key={task.id}>{task.job.title} · {task.job.company}</li>)}</ul>}
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 text-[11px] text-fnt">
      <dt>Reuse scope</dt><dd className="break-all">{question.scope}{question.scopeKey ? ` · ${question.scopeKey}` : " · explicit reusable identity fact"}</dd>
      {Object.entries(question.context).map(([key, value]) => <div key={key} className="contents"><dt>{key}</dt><dd className="break-all">{value}</dd></div>)}
      {question.currency && !question.context.currency && <><dt>currency</dt><dd>{question.currency}</dd></>}
    </dl>
    {question.reason && <p className="mt-1 text-[11px] text-mut">{question.reason}</p>}
    {manual ? <div className="mt-2 space-y-2">
      <p className="text-[12px] text-fnt">Human action required. Demographic answers, legal attestations and consent are never silently reused. Complete this exact application in the local worker's review window.</p>
      <button type="button" disabled={busy || !canAnswer} className={btnGhost + btnSm} onClick={() => void onOpen()}>Open question for human review</button>
    </div> : <form className="mt-2 space-y-2" onSubmit={event => void submit(event)}>
      <label className="block text-[12px]">Your factual answer
        {["select", "radio"].includes(question.controlType) ? <select aria-label={`Answer to ${question.questionText}`} className="inp mt-1 w-full" disabled={busy || !canAnswer} value={answer} onChange={event => { setAnswer(event.target.value); setConfirmed(false); }}>
          <option value="">Choose an offered option</option>{question.options.map((option, index) => <option key={`${index}:${option}`} value={option}>{option}</option>)}
        </select> : question.controlType === "textarea" ? <textarea aria-label={`Answer to ${question.questionText}`} className="inp mt-1 w-full" disabled={busy || !canAnswer} value={answer} maxLength={10000} onChange={event => { setAnswer(event.target.value); setConfirmed(false); }} />
          : <input aria-label={`Answer to ${question.questionText}`} className="inp mt-1 w-full" disabled={busy || !canAnswer} type={["email", "tel", "url", "number", "date"].includes(question.controlType) ? question.controlType : "text"} step="any" value={answer} maxLength={10000} onChange={event => { setAnswer(event.target.value); setConfirmed(false); }} />}
      </label>
      <label className="block text-[11px]">Answer valid until (UTC){timeSensitive ? " · required for this time-sensitive answer" : " · optional"}
        <input type="date" aria-label={`Answer expiry for ${question.questionText}`} disabled={busy || !canAnswer} className="inp mt-1 w-full" value={expires} onChange={event => { setExpires(event.target.value); setConfirmed(false); }} />
      </label>
      <label className="flex items-start gap-2 text-[11px]"><input type="checkbox" disabled={busy || !canAnswer} checked={scopeConfirmed} onChange={event => setScopeConfirmed(event.target.checked)} />Use this answer only for the displayed {question.scope} scope and the same question/options/context. I explicitly approve that reuse scope.</label>
      <label className="flex items-start gap-2 text-[11px]"><input type="checkbox" disabled={busy || !canAnswer} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm this answer is factual and current.</label>
      <p className="text-[11px] text-mut">No answer is suggested or guessed. One confirmation can unblock the matching applications shown above; changed context or a new profile revision asks again.</p>
      <button className={btnPrimary + btnSm} type="submit" disabled={busy || !canAnswer || !answer.trim() || !scopeConfirmed || !confirmed || (timeSensitive && !expires)}>Confirm answer once</button>
    </form>}
  </article>;
}
