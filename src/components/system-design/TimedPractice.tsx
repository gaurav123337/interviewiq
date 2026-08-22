import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SYSTEM_DESIGN_CASES, getCategories, casesByCategory, type SystemDesignCase, type WhiteboardFlow } from '../../data/systemDesignBank';
import { toast } from '../../toast';
import { btnGhost, btnPrimary, btnSm, cardCls, Chip, Drawer, ProgressBar } from '../ui';
import { DifficultyDots } from './DifficultyDots';
import { WhiteboardPhase } from './WhiteboardPhase';
import { loadCompleted, markCompleted, loadQuiz, saveQuiz, loadHistory, saveHistoryEntry, loadBookmarks, loadTimerPreset, saveTimerPreset, loadFlashcards, calculateStreak, exportProgress, CATEGORY_META, type CompletedMap, type QuizState, type QuizHistoryEntry, type BookmarkMap, type FlashcardData, type FlashcardMap } from './helpers';


export function TimedPractice({
  timePerCase,
  onComplete,
  onMarkComplete,
  onClose
}: {
  timePerCase: number;
  onComplete: () => void;
  onMarkComplete: (id: string) => void;
  onClose: () => void;
}) {
  const [quiz, setQuiz] = useState<QuizState>(() => {
    const saved = loadQuiz();
    if (saved.active) return saved;
    const shuffled = [...SYSTEM_DESIGN_CASES].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(5, shuffled.length));
    const fresh: QuizState = {
      active: true, caseIds: picked.map(c => c.id), currentIdx: 0,
      timePerCase, startedAt: Date.now(), caseStartedAt: Date.now(),
      score: 0, answeredCaseIds: []
    };
    saveQuiz(fresh);
    return fresh;
  });

  const [secondsLeft, setSecondsLeft] = useState(quiz.timePerCase);
  const [viewing, setViewing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentCase = SYSTEM_DESIGN_CASES.find(c => c.id === quiz.caseIds[quiz.currentIdx]);

  useEffect(() => {
    if (!quiz.active || viewing) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [quiz.active, quiz.currentIdx, viewing]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isOvertime = secondsLeft <= 0;
  const totalCases = quiz.caseIds.length;

  const handleComplete = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const updated = { ...quiz, score: quiz.score + 1, answeredCaseIds: [...quiz.answeredCaseIds, quiz.caseIds[quiz.currentIdx]] };
    if (currentCase) onMarkComplete(currentCase.id);
    if (quiz.currentIdx + 1 >= totalCases) {
      updated.active = false;
      saveQuiz(updated);
      saveHistoryEntry({
        date: Date.now(), totalCases, completed: updated.score, timePerCase: quiz.timePerCase,
        durationMs: Date.now() - quiz.startedAt,
        categories: [...new Set(quiz.caseIds.map(id => SYSTEM_DESIGN_CASES.find(c => c.id === id)?.category ?? ""))]
      });
      toast(`🎉 Practice complete! ${updated.score}/${totalCases} completed.`);
      onComplete();
    } else {
      updated.currentIdx = quiz.currentIdx + 1;
      updated.caseStartedAt = Date.now();
      saveQuiz(updated);
      setQuiz(updated);
      setSecondsLeft(quiz.timePerCase);
      setViewing(false);
    }
  };

  const handleSkip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (quiz.currentIdx + 1 >= totalCases) {
      const updated = { ...quiz, active: false };
      saveQuiz(updated);
      saveHistoryEntry({
        date: Date.now(), totalCases, completed: quiz.score, timePerCase: quiz.timePerCase,
        durationMs: Date.now() - quiz.startedAt,
        categories: [...new Set(quiz.caseIds.map(id => SYSTEM_DESIGN_CASES.find(c => c.id === id)?.category ?? ""))]
      });
      toast(`Practice finished — ${quiz.score}/${totalCases}.`);
      onComplete();
    } else {
      const updated = { ...quiz, currentIdx: quiz.currentIdx + 1, caseStartedAt: Date.now() };
      saveQuiz(updated);
      setQuiz(updated);
      setSecondsLeft(quiz.timePerCase);
      setViewing(false);
    }
  };

  const handleEnd = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    saveHistoryEntry({
      date: Date.now(), totalCases, completed: quiz.score, timePerCase: quiz.timePerCase,
      durationMs: Date.now() - quiz.startedAt,
      categories: [...new Set(quiz.caseIds.map(id => SYSTEM_DESIGN_CASES.find(c => c.id === id)?.category ?? ""))]
    });
    const updated = { ...quiz, active: false };
    saveQuiz(updated);
    toast(`Practice ended — ${quiz.score}/${totalCases}.`);
    onClose();
  };

  if (!currentCase) {
    return <Drawer onClose={handleEnd} title="⏱️ Timed Practice" desc="No cases available"><p className="text-[13px] text-mut">No case studies found.</p></Drawer>;
  }

  return (
    <Drawer onClose={handleEnd} title={`⏱️ Practice: ${currentCase.icon} ${currentCase.title}`} desc={`Case ${quiz.currentIdx + 1} of ${totalCases}`}>
      <div className={`mb-4 rounded-xl border p-4 text-center ${isOvertime ? "border-warn/50 bg-warn/10" : secondsLeft < 300 ? "border-amber-500/50 bg-amber-500/10" : "border-acc1/25 bg-acc1/10"}`}>
        <div className={`text-[36px] font-extrabold font-mono ${isOvertime ? "text-warn" : secondsLeft < 300 ? "text-amber-500" : "text-acctxt"}`}>
          {isOvertime ? "+" : "-"}{String(Math.abs(minutes)).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        <div className="mt-1 text-[12px] font-bold text-mut">{isOvertime ? "⏰ Time's up!" : `⏱️ ${quiz.timePerCase / 60} min per case`}</div>
        <div className="mt-2 flex justify-center gap-1">
          {quiz.caseIds.map((id, i) => (
            <div key={id} className={`h-1.5 w-6 rounded-full ${i < quiz.currentIdx ? "bg-ok" : i === quiz.currentIdx ? "grad-bg" : "bg-wht/20"}`} />
          ))}
        </div>
        <div className="mt-1 text-[11px] text-mut">Score: {quiz.score}/{totalCases}</div>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <DifficultyDots level={currentCase.difficulty} />
          <span className="text-[13px] font-bold text-mut">Difficulty {currentCase.difficulty}/5</span>
          <Chip tone="cat">{currentCase.category}</Chip>
        </div>
        <p className="text-[13px] text-mut leading-relaxed">{currentCase.blurb}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {currentCase.prerequisites.map(p => (
            <span key={p} className="rounded-full border border-line/10 bg-wht/5 px-2 py-0.5 text-[11px] font-semibold text-fnt">{p}</span>
          ))}
        </div>
      </div>

      {currentCase.keyNumbers.length > 0 && (
        <div className="mb-4 rounded-xl border border-acc1/25 bg-acc1/10 p-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">🔢 Key Numbers (hint)</div>
          <ul className="space-y-1">
            {currentCase.keyNumbers.slice(0, 2).map((n, i) => (
              <li key={i} className="flex gap-2 text-[13px]"><span className="flex-none text-acctxt font-mono">•</span><span className="text-ink">{n}</span></li>
            ))}
            {currentCase.keyNumbers.length > 2 && <li className="text-[12px] text-mut italic">+ {currentCase.keyNumbers.length - 2} more…</li>}
          </ul>
        </div>
      )}

      {viewing && (
        <>
          <div className="mb-4">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">📋 Whiteboard Flow</div>
            <div className="space-y-3">
              {currentCase.phases.map((phase, i) => <WhiteboardPhase key={i} phase={phase} index={i} />)}
            </div>
          </div>
          {currentCase.commonMistakes.length > 0 && (
            <div className="mb-4 rounded-xl border border-warn/25 bg-warn/10 p-4">
              <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-warn">⚠️ Common Mistakes</div>
              <ul className="space-y-1.5">
                {currentCase.commonMistakes.map((m, i) => (
                  <li key={i} className="flex gap-2 text-[13px]"><span className="flex-none text-warn">•</span><span>{m}</span></li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-3">
        {!viewing && <button onClick={() => setViewing(true)} className={btnGhost + btnSm}>👁️ View solution</button>}
        <button onClick={handleComplete} className={btnPrimary + btnSm}>✓ Mark as done {quiz.currentIdx + 1 < totalCases ? "→ Next" : "→ Finish"}</button>
        <button onClick={handleSkip} className={btnGhost + btnSm}>⏭️ Skip</button>
      </div>
    </Drawer>
  );
}

