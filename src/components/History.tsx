import { useState } from "react";
import { useApp } from "../store";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip, EmptyState, Modal } from "./ui";

export function History() {
  const { state, openHistory, deleteHistory, clearHistory } = useApp();
  const { sessions } = state;
  const [confirmClear, setConfirmClear] = useState(false);

  if (!sessions.length) {
    return (
      <div className="anim-view">
        <EmptyState icon="🗂️" title="No sessions yet">
          <p className="text-sm text-mut">Complete an interview and your results will show up here.</p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="anim-view">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🗂️ History</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Your interview <span className="grad-text">track record</span>.</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">Review past sessions, spot patterns, and watch your scores climb.</p>
      </div>

      <div className="mt-6 flex justify-end">
        <button className={btnDanger + btnSm} onClick={() => setConfirmClear(true)}>Clear all history</button>
      </div>

      <div className="mt-3 space-y-3">
        {sessions.map(s => {
          const gradeTone = s.agg.grade === "A" || s.agg.grade === "B" ? "ok" : s.agg.grade === "C" ? "warn" : "bad";
          return (
            <div key={s.id} className={`${cardCls} flex flex-wrap items-center gap-3 px-5 py-4`}>
              <div className="grid h-11 w-11 flex-none place-items-center rounded-xl grad-bg text-lg font-extrabold text-white shadow-[0_6px_16px_rgba(99,102,241,.4)]">
                {s.agg.grade}
              </div>
              <div className="min-w-[200px] flex-1">
                <div className="text-[14.5px] font-extrabold leading-tight">{s.meta.company} · {s.meta.field} · {s.meta.level}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-mut">
                  <span>{new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span>·</span>
                  <span>{s.answers.length} questions</span>
                  <span>·</span>
                  <span className="text-fnt">{s.agg.score.toFixed(1)}/5</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Chip tone={gradeTone as "ok"}>{Math.round(s.agg.pct * 100)}%</Chip>
                <button className={btnPrimary + btnSm} onClick={() => openHistory(s.id)}>Review</button>
                <button className={btnGhost + btnSm} onClick={() => { deleteHistory(s.id); toast("Session deleted"); }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {confirmClear && (
        <Modal onClose={() => setConfirmClear(false)} title="Clear all history?" desc="This removes every saved session. Your settings and question bank stay untouched.">
          <div className="flex gap-3">
            <button className={btnGhost} onClick={() => setConfirmClear(false)}>Cancel</button>
            <button className={btnDanger} onClick={() => { clearHistory(); setConfirmClear(false); toast("History cleared"); }}>Yes, clear everything</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
