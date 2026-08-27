/* QuestionsSection — extracted from Admin.tsx */

import { useEffect, useState } from "react";
import type { LevelId } from "../../types";
import { FIELDS, LEVELS } from "../../data";
import { createQuestion, deleteQuestion, setQuestionPublished } from "../../services/admin";
import { getPublishedQuestions } from "../../services/remoteConfig";
import { toast } from "../../toast";
import { btnPrimary, btnSm, btnDanger, btnGhost, cardCls, Chip, Modal } from "../ui";

/* ------------------------------------------------------------------ */
/* Question bank — publish admin-curated questions                     */
/* ------------------------------------------------------------------ */

export function QuestionsSection({ list, busy, setBusy, onChanged }: {
  list: ReturnType<typeof getPublishedQuestions>; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [fieldId, setFieldId] = useState(FIELDS[0]?.id ?? "");
  const [level, setLevel] = useState<LevelId>("senior");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  useEffect(() => { setPage(0); }, [list.length]);

  const publish = async () => {
    if (!question.trim()) { toast("Question is required"); return; }
    setBusy(true);
    try {
      await createQuestion({
        fieldId, level, question: question.trim(), answer: answer.trim(),
        keyPoints: keyPoints.split(/[,\\n]/).map(k => k.trim()).filter(Boolean)
      });
      toast("📚 Question published — appears in sessions and the bank");
      setQuestion(""); setAnswer(""); setKeyPoints("");
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">✍️ Add a question</h2>
        <p className="mb-4 text-[12.5px] text-mut">Published questions merge into sessions for that field+level and appear in the Question Bank.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select value={fieldId} onChange={e => setFieldId(e.target.value)} className="inp">
              {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
            </select>
            <select value={level} onChange={e => setLevel(e.target.value as LevelId)} className="inp">
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
            </select>
          </div>
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Interview question…" className="inp w-full" />
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3} placeholder="Model answer…" className="inp w-full resize-y" />
          <input value={keyPoints} onChange={e => setKeyPoints(e.target.value)} placeholder="Key points, comma-separated (drives scoring)" className="inp w-full" />
          <button className={btnPrimary + btnSm} onClick={publish} disabled={busy}>Publish question</button>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">📚 Published questions ({list.length})</h2>
        {list.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2 py-2">
            <button className={btnGhost + btnSm} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
            <span className="text-[12px] text-mut font-bold">Page {page + 1} of {Math.ceil(list.length / PAGE_SIZE)}</span>
            <button className={btnGhost + btnSm} onClick={() => setPage(p => Math.min(Math.ceil(list.length / PAGE_SIZE) - 1, p + 1))} disabled={(page + 1) * PAGE_SIZE >= list.length}>Next →</button>
          </div>
        )}
        <div className="mt-3 space-y-2.5">
          {list.length === 0 && <p className="text-[13px] text-mut">Nothing published yet.</p>}
          {list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(q => (
            <div key={q.id} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="lvl">{LEVELS.find(l => l.id === q.level)?.icon} {LEVELS.find(l => l.id === q.level)?.name}</Chip>
                  <Chip tone="cat">{FIELDS.find(f => f.id === q.fieldId)?.name ?? q.fieldId}</Chip>
                  <Chip tone={q.published ? "ok" : "default"}>{q.published ? "LIVE" : "DRAFT"}</Chip>
                </div>
                <div className="mt-1.5 text-[14px] font-bold">{q.question}</div>
                {q.answer && <p className="mt-1 text-[13px] text-mut line-clamp-2">{q.answer}</p>}
                {q.keyPoints.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{q.keyPoints.slice(0, 5).map(k => <Chip key={k}>{k}</Chip>)}</div>}
              </div>
              <div className="flex flex-none gap-2">
                <button className={btnGhost + btnSm} onClick={async () => { setBusy(true); try { await setQuestionPublished(q.id, !q.published); await onChanged(); } catch (e) { toast("✗ " + (e as Error).message); } finally { setBusy(false); } }} disabled={busy}>
                  {q.published ? "Unpublish" : "Publish"}
                </button>
                <button className={btnDanger + btnSm} onClick={() => setConfirmDel(q.id)} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmDel !== null && (
        <Modal onClose={() => setConfirmDel(null)} title="Delete this question?" desc="It will disappear from every client on next sync.">
          <div className="flex gap-3">
            <button className={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button className={btnDanger} onClick={async () => {
              setBusy(true);
              try { await deleteQuestion(confirmDel); await onChanged(); toast("Question deleted"); }
              catch (e) { toast("✗ " + (e as Error).message); }
              finally { setBusy(false); setConfirmDel(null); }
            }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
