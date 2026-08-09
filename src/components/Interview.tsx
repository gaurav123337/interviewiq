import { useEffect, useRef, useState } from "react";
import type { SessionQuestion } from "../types";
import { companyById, levelById } from "../data";
import { aiAvailable, getFeedback, getHint } from "../ai";
import { grade } from "../engine";
import { useApp } from "../store";
import { toast } from "../toast";
import { fmtTime } from "../util";
import { btn, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Kp, Modal } from "./ui";

const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;

export function Interview() {
  const { state, submitAnswer, skipQuestion, nextQuestion, exitToResults } = useApp();
  const { session, idx, feedbackShown, config, answers } = state;
  const q: SessionQuestion | undefined = session?.questions[idx];

  const [answer, setAnswer] = useState("");
  const [ai, setAi] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setAnswer(""); setAi(null); setAiLoading(false); }, [idx]);

  if (!session || !q) return null;

  const meta = session.meta;
  const co = companyById(meta.companyId);
  const prog = (idx / session.questions.length) * 100;
  const avg = answers.length ? (answers.reduce((a, b) => a + b.fb.score, 0) / answers.length).toFixed(1) : null;

  const onSubmit = () => {
    submitAnswer(answer);
    if (aiAvailable()) {
      setAiLoading(true);
      getFeedback({
        question: q.q, userAnswer: answer,
        levelName: levelById(q.level).name, fieldName: meta.field, companyName: meta.company
      }).then(t => { setAi(t); setAiLoading(false); })
        .catch(() => { setAi(null); setAiLoading(false); toast("AI feedback unavailable — offline feedback still applies."); });
    }
  };

  const onHint = async () => {
    let hint: string | null = null;
    if (aiAvailable()) {
      try { hint = await getHint(q.q, levelById(q.level).name); } catch { hint = null; }
    }
    if (!hint) hint = "Try to cover at least one of: " + (q.kp || []).slice(0, 3).join(" · ");
    toast("💡 " + hint.slice(0, 180));
  };

  return (
    <div className="anim-view">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button className={btnGhost + btnSm} onClick={() => setShowExit(true)}>← End</button>
        <div className="min-w-[220px] flex-1 text-xl font-extrabold tracking-tight">
          {meta.company} · {meta.field} · {meta.level}
        </div>
        <div className="min-w-[170px] flex-none">
          <div className="h-[7px] overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full grad-bg transition-all duration-500" style={{ width: prog + "%" }} />
          </div>
          <div className="mt-1 flex justify-between text-xs font-semibold text-mut">
            <span>Question {idx + 1} of {session.questions.length}</span>
            {avg && <span>Avg: {avg}/5</span>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[860px]">
        <div className="mb-3.5 flex items-center gap-3 text-sm font-semibold text-mut">
          <span className="grid h-[42px] w-[42px] place-items-center rounded-full grad-bg text-[21px] shadow-[0_8px_22px_rgba(99,102,241,.4)]">{co.icon}</span>
          <span><strong className="text-ink">Alex</strong> — Senior Interviewer{co.id !== "general" ? `, ${co.name}` : ""}</span>
        </div>

        <div className={`${cardCls} mb-4 p-6 max-sm:p-4`}>
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip tone="cat">{q.catLabel}</Chip>
            <Chip tone="lvl">{levelById(q.level).icon} {levelById(q.level).name}</Chip>
            {q.src === "company" && <Chip tone="co">Tailored to {meta.company}</Chip>}
          </div>
          <p className="min-h-[56px] text-[19px] font-bold leading-[1.45] tracking-tight">
            <Typewriter key={q.q} text={q.q} />
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {config.timing !== "none" && <Timer total={config.timing === "strict" ? 90 : 180} onExpire={onSubmit} />}
            <button className={btnGhost + btnSm} onClick={onHint} disabled={feedbackShown}>💡 Hint</button>
          </div>

          <div className="relative mt-4">
            <textarea
              ref={boxRef}
              value={answer}
              onChange={e => { setAnswer(e.target.value); autoGrow(e.target); }}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit(); }}
              disabled={feedbackShown}
              readOnly={feedbackShown}
              placeholder="Type your answer… (or use the mic). Try to structure it: approach → reasoning → tradeoffs."
              className="min-h-[150px] w-full resize-y rounded-xl border border-white/25 bg-[#080c18]/60 p-4 text-[15px] leading-relaxed placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20 disabled:opacity-80"
            />
          </div>

          {!feedbackShown && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <MicButton answer={answer} setAnswer={setAnswer} disabled={config.timing !== "none" && false} />
              <span className="flex-1" />
              <button className={btnGhost} onClick={skipQuestion}>Skip</button>
              <button className={btnOk} onClick={onSubmit}>Submit answer</button>
            </div>
          )}
        </div>

        {feedbackShown && <FeedbackPanel ai={ai} aiLoading={aiLoading} onSkip={skipQuestion} onNext={nextQuestion} isLast={idx + 1 >= session.questions.length} />}
      </div>

      {showExit && (
        <Modal onClose={() => setShowExit(false)} title="End this interview?" desc={`You're on question ${idx + 1} of ${session.questions.length}. Progress so far will be saved.`}>
          <div className="flex gap-3">
            <button className={btnGhost} onClick={() => setShowExit(false)}>Keep going</button>
            <button className={`${btn} border border-bad/40 px-4 py-2 text-sm text-bad hover:bg-bad/10`} onClick={() => { setShowExit(false); exitToResults(); }}>End & see results</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- typewriter ---------- */
function Typewriter({ text }: { text: string }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const iv = window.setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(iv);
    }, 16);
    return () => window.clearInterval(iv);
  }, [text]);
  return <span>{shown}{shown.length < text.length && <span className="caret" />}</span>;
}

/* ---------- timer ---------- */
function Timer({ total, onExpire }: { total: number; onExpire: () => void }) {
  const [left, setLeft] = useState(total);
  const fired = useRef(false);
  useEffect(() => {
    setLeft(total);
    fired.current = false;
    const iv = window.setInterval(() => {
      setLeft(l => {
        const next = l - 1;
        if (next <= 0 && !fired.current) {
          fired.current = true;
          window.clearInterval(iv);
          onExpire();
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const low = left <= 30;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-extrabold tabular-nums ${low ? "border-bad/50 bg-bad/10 text-bad" : "border-white/10 bg-white/10 text-mut"}`}>
      <svg viewBox="0 0 16 16" width="14" height="14" className="h-3.5 w-3.5">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="rgba(148,163,184,.3)" strokeWidth="2.5" />
        <circle
          cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="40.8" strokeDashoffset={40.8 * (1 - (total - left) / total)} transform="rotate(-90 8 8)"
        />
      </svg>
      {fmtTime(left)}
    </span>
  );
}

/* ---------- mic ---------- */
function MicButton({ answer, setAnswer, disabled }: { answer: string; setAnswer: (s: string) => void; disabled: boolean }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const toggle = () => {
    if (!SR) { toast("Voice input not supported in this browser."); return; }
    if (listening) {
      recRef.current?.stop();
      recRef.current = null;
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let t = "";
      for (const r of Array.from(e.results)) t += r[0].transcript;
      setAnswer((answer.trim() ? answer.trim() + " " : "") + t);
    };
    rec.onend = () => { recRef.current = null; setListening(false); };
    rec.onerror = () => { recRef.current = null; setListening(false); toast("Mic error — try typing."); };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  if (disabled) return null;
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        title={listening ? "Stop listening" : "Speak your answer"}
        className={`grid h-[42px] w-[42px] place-items-center rounded-xl border text-lg transition-all ${listening ? "border-bad/60 bg-bad/15 text-bad" : "border-white/25 bg-white/10 text-mut hover:bg-white/20"}`}
      >
        🎤
      </button>
      {listening && <span className="text-xs font-semibold text-fnt">listening… speak now</span>}
    </>
  );
}

/* ---------- feedback panel ---------- */
function FeedbackPanel({ ai, aiLoading, onSkip, onNext, isLast }: {
  ai: string | null; aiLoading: boolean; onSkip: () => void; onNext: () => void; isLast: boolean;
}) {
  const { state } = useApp();
  const answer = state.answers[state.answers.length - 1];
  if (!answer) return null;
  const { fb, q } = answer;
  const pct = fb.pct;
  const ringColor = pct >= 0.8 ? "var(--color-ok)" : pct >= 0.55 ? "var(--color-warn)" : "var(--color-bad)";
  const R = 33, C = 2 * Math.PI * R;
  const gradeL = grade(pct);

  return (
    <div className="anim-view mt-5 overflow-hidden rounded-2xl border border-white/10">
      <div className="flex flex-wrap items-center gap-4 border-b border-white/10 bg-gradient-to-b from-panel3 to-panel2 px-6 py-4">
        <div className="relative h-[74px] w-[74px] flex-none">
          <svg viewBox="0 0 76 76" width="74" height="74">
            <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(148,163,184,.2)" strokeWidth="6" />
            <circle cx="38" cy="38" r={R} fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 38 38)" />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-2xl font-extrabold">{gradeL}</div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-extrabold">Score: {fb.score}/5 · {gradeL}</h3>
          <div className="text-[13px] text-mut">Coverage {Math.round(pct * 100)}% · {fb.words} words · Level: {levelById(q.level).name}</div>
        </div>
        {aiAvailable() ? <Chip tone="co">✨ AI coaching on</Chip> : <Chip>Offline engine</Chip>}
      </div>

      <div className="bg-gradient-to-b from-panel to-panel2 px-6 py-5">
        <div className="mb-5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#080c18]/50 p-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-ok">✓ What went well</h4>
            <ul className="space-y-1">
              {fb.strengths.map((s, i) => <li key={i} className="relative pl-4 text-[13.5px] leading-snug text-[#b9e9d6] before:absolute before:left-0 before:top-0 before:text-ok before:content-['✓']">{s}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#080c18]/50 p-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-warn">▲ Watch out</h4>
            <ul className="space-y-1">
              {fb.gaps.map((g, i) => <li key={i} className="relative pl-4 text-[13.5px] leading-snug text-[#f0d9a8] before:absolute before:left-0 before:top-0 before:text-warn before:content-['▲']">{g}</li>)}
            </ul>
          </div>
        </div>

        {aiAvailable() && (
          <div className="mb-5 rounded-xl border border-acc1/30 bg-gradient-to-b from-acc1/10 to-acc2/5 p-4">
            {aiLoading ? (
              <p className="text-[14.5px] text-[#d9dcf5]"><span className="spinner" />Generating AI feedback…</p>
            ) : ai ? (
              <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-[#d9dcf5]">{ai}</p>
            ) : (
              <p className="text-[14.5px] text-fnt">AI feedback unavailable — the offline feedback above still stands.</p>
            )}
          </div>
        )}

        <div className="mb-5">
          <h4 className="mb-2 text-[13px] font-bold uppercase tracking-wider text-mut">📖 Model answer</h4>
          <p className="whitespace-pre-wrap text-[14.5px] leading-[1.7] text-[#d7ddf0]">{q.a}</p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {(q.kp || []).map(k => (
            <Kp key={k} hit={fb.covered.includes(k)}>{k}</Kp>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <button className={btnGhost} onClick={onSkip}>Skip for now</button>
          <button className={btnPrimary} onClick={onNext} autoFocus>
            {isLast ? "See my results 🎉" : "Next question →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight + 2, 420) + "px";
}
