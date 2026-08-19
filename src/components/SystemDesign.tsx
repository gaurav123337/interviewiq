/* System Design Hub — dedicated view for system design topics, architecture
   case studies, whiteboard flows, and the system-design AI tutor.
   Includes timed practice mode and progress tracking. */

import { useCallback, useEffect, useRef, useState } from "react";

import { aiAvailable } from "../ai";
import { getDeepDive } from "../data/deepDive";
import { LEVELS, LEVEL_INDEX } from "../data";
import {
  SYSTEM_DESIGN_CASES, getCategories, casesByCategory,
  type SystemDesignCase, type WhiteboardFlow
} from "../data/systemDesignBank";
import { explainSystemDesign, systemDesignChat } from "../services/systemDesignTutor";
import { getGoal } from "../services/goal";
import { storageGet, storageSet } from "../services/storage";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip, Drawer } from "./ui";

/* ------------------------------------------------------------------ */
/* Progress persistence                                                 */
/* ------------------------------------------------------------------ */

const PROGRESS_KEY = "iq.sysDesignProgress";
const QUIZ_KEY = "iq.sysDesignQuiz";

type CompletedMap = Record<string, number>; // caseId → timestamp

function loadCompleted(): CompletedMap {
  return storageGet<CompletedMap>(PROGRESS_KEY, {});
}

function markCompleted(caseId: string): CompletedMap {
  const completed = loadCompleted();
  completed[caseId] = Date.now();
  storageSet(PROGRESS_KEY, completed);
  return completed;
}

/* ------------------------------------------------------------------ */
/* Quiz state persistence                                              */
/* ------------------------------------------------------------------ */

interface QuizState {
  active: boolean;
  caseIds: string[];
  currentIdx: number;
  timePerCase: number; // seconds
  startedAt: number;
  caseStartedAt: number;
  score: number; // cases completed within time
  answeredCaseIds: string[];
}

function loadQuiz(): QuizState {
  return storageGet<QuizState>(QUIZ_KEY, {
    active: false, caseIds: [], currentIdx: 0, timePerCase: 45 * 60,
    startedAt: 0, caseStartedAt: 0, score: 0, answeredCaseIds: []
  });
}

function saveQuiz(q: QuizState) { storageSet(QUIZ_KEY, q); }

/* ------------------------------------------------------------------ */
/* Category metadata                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<string, { icon: string; label: string; desc: string }> = {
  core:       { icon: "🏗️", label: "Core Patterns", desc: "Classic interview starters — URL shortener, chat, feed" },
  data:       { icon: "🗄️", label: "Data & Storage", desc: "Caching, databases, search, and storage patterns" },
  distributed:{ icon: "🌐", label: "Distributed Systems", desc: "Task queues, service mesh, consistency, and coordination" },
  api:        { icon: "🔌", label: "API & Services", desc: "Rate limiting, API design, and microservices" },
  "real-world":{ icon: "🚀", label: "Real-World Systems", desc: "Notifications, autocomplete, and production systems" }
};

/* ------------------------------------------------------------------ */
/* Main hub                                                             */
/* ------------------------------------------------------------------ */

export function SystemDesign() {
  const [category, setCategory] = useState<string>("core");
  const [selected, setSelected] = useState<SystemDesignCase | null>(null);
  const [completed, setCompleted] = useState<CompletedMap>(() => loadCompleted());
  const [showPractice, setShowPractice] = useState(false);
  const goal = getGoal();

  const categories = getCategories();
  const cases = casesByCategory(category);
  const totalArchCases = SYSTEM_DESIGN_CASES.length;
  const completedCount = Object.keys(completed).length;
  const progressPct = totalArchCases > 0 ? Math.round((completedCount / totalArchCases) * 100) : 0;

  const handleMarkComplete = useCallback((caseId: string) => {
    const updated = markCompleted(caseId);
    setCompleted(updated);
    toast("✓ Case study marked as completed!");
  }, []);

  return (
    <div className="anim-view mx-auto max-w-[960px]">
      {/* Hero */}
      <div className={`${cardCls} mt-6 overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-5 p-6">
          <div className="grid h-16 w-16 flex-none place-items-center rounded-2xl grad-bg text-[32px] shadow-[0_12px_30px_rgba(99,102,241,.4)]">🏗️</div>
          <div className="min-w-[280px] flex-1">
            <h1 className="text-[22px] font-extrabold tracking-tight">System Design Hub</h1>
            <p className="mt-1 text-[14px] leading-relaxed text-mut">
              {totalArchCases} curated case studies with 45-minute whiteboard flows, architecture deep dives, and an AI tutor that understands system design.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip tone="co">🎯 Interview-ready</Chip>
              <Chip tone="ok">📐 Architecture diagrams</Chip>
              <Chip tone="lvl">🔢 Numbers to memorize</Chip>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="border-t border-line/10 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12.5px] font-bold text-mut">📈 Your Progress</span>
            <span className="text-[12.5px] font-extrabold text-acctxt">{completedCount}/{totalArchCases} completed ({progressPct}%)</span>
          </div>
          <div className="h-2 w-full rounded-full bg-wht/10 overflow-hidden">
            <div
              className="h-full rounded-full grad-bg transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => setShowPractice(true)}
          className="flex items-center gap-2 rounded-xl border border-acc1/50 bg-acc1/15 px-4 py-2.5 text-[13px] font-bold text-acctxt transition-all hover:bg-acc1/30"
        >
          <span>⏱️</span>
          <span>Start Timed Practice</span>
        </button>
        <button
          onClick={() => {
            setCompleted({});
            storageSet(PROGRESS_KEY, {});
            toast("Progress reset");
          }}
          className="flex items-center gap-2 rounded-xl border border-line/15 bg-wht/5 px-4 py-2.5 text-[13px] font-bold text-fnt transition-all hover:bg-wht/10"
        >
          <span>🔄</span>
          <span>Reset Progress</span>
        </button>
      </div>

      {/* Category tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map(cat => {
          const meta = CATEGORY_META[cat] ?? { icon: "📁", label: cat, desc: "" };
          const catCases = casesByCategory(cat);
          const catCompleted = catCases.filter(c => completed[c.id]).length;
          return (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setSelected(null); }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-bold transition-all ${
                category === cat
                  ? "border-acc1/50 bg-acc1/15 text-acctxt shadow-[0_4px_12px_rgba(99,102,241,.2)]"
                  : "border-line/15 bg-wht/5 text-fnt hover:bg-wht/10"
              }`}
            >
              <span className="text-[15px]">{meta.icon}</span>
              <span>{meta.label}</span>
              <span className="rounded-full bg-wht/10 px-2 py-0.5 text-[11px] text-mut">
                {catCompleted}/{catCases.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category description */}
      {CATEGORY_META[category] && (
        <p className="mt-3 text-[13px] text-mut">{CATEGORY_META[category].desc}</p>
      )}

      {/* Case study cards */}
      <div className="mt-5 space-y-3">
        {cases.map(c => (
          <CaseCard
            key={c.id}
            caseData={c}
            isCompleted={!!completed[c.id]}
            onSelect={() => setSelected(c)}
          />
        ))}
      </div>

      {/* Quick links — all architecture case studies from deepDive */}
      <DeepDiveArchitectures goal={goal} />

      {/* Footer tip */}
      <div className={`${cardCls} mt-6 px-5 py-4 text-center text-[12.5px] text-mut`}>
        💡 Click any case study to see the full whiteboard flow, numbers to memorize, and common mistakes.
        {goal && <> Your target level is <strong>{LEVELS[LEVEL_INDEX[goal.targetLevel]]?.name ?? goal.targetLevel}</strong> — adjust your depth accordingly.</>}
      </div>

      {/* Detail drawer */}
      {selected && (
        <CaseDrawer
          caseData={selected}
          goal={goal}
          isCompleted={!!completed[selected.id]}
          onClose={() => setSelected(null)}
          onMarkComplete={handleMarkComplete}
        />
      )}

      {/* Timed practice mode */}
      {showPractice && (
        <TimedPractice
          onComplete={() => { setShowPractice(false); setCompleted(loadCompleted()); }}
          onMarkComplete={handleMarkComplete}
          onClose={() => setShowPractice(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Timed practice mode                                                  */
/* ------------------------------------------------------------------ */

function TimedPractice({
  onComplete,
  onMarkComplete,
  onClose
}: {
  onComplete: () => void;
  onMarkComplete: (id: string) => void;
  onClose: () => void;
}) {
  const [quiz, setQuiz] = useState<QuizState>(() => {
    const saved = loadQuiz();
    if (saved.active) return saved;
    // Start fresh: shuffle all cases, pick up to 5 random ones
    const shuffled = [...SYSTEM_DESIGN_CASES].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(5, shuffled.length));
    const fresh: QuizState = {
      active: true,
      caseIds: picked.map(c => c.id),
      currentIdx: 0,
      timePerCase: 45 * 60, // 45 minutes per case (real interview time)
      startedAt: Date.now(),
      caseStartedAt: Date.now(),
      score: 0,
      answeredCaseIds: []
    };
    saveQuiz(fresh);
    return fresh;
  });

  const [secondsLeft, setSecondsLeft] = useState(quiz.timePerCase);
  const [viewing, setViewing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentCase = SYSTEM_DESIGN_CASES.find(c => c.id === quiz.caseIds[quiz.currentIdx]);

  // Timer countdown
  useEffect(() => {
    if (!quiz.active || viewing) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          // Time's up for this case
          clearInterval(intervalRef.current!);
          return 0;
        }
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
      // Quiz finished
      updated.active = false;
      saveQuiz(updated);
      toast(`🎉 Practice complete! You finished ${updated.score}/${totalCases} case studies.`);
      onComplete();
    } else {
      // Next case
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
      toast(`Practice finished — ${quiz.score}/${totalCases} completed.`);
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
    const updated = { ...quiz, active: false };
    saveQuiz(updated);
    toast(`Practice ended — ${quiz.score}/${totalCases} completed.`);
    onClose();
  };

  if (!currentCase) {
    return (
      <Drawer onClose={handleEnd} title="⏱️ Timed Practice" desc="No cases available">
        <p className="text-[13px] text-mut">No case studies found. Close and try again.</p>
      </Drawer>
    );
  }

  return (
    <Drawer onClose={handleEnd} title={`⏱️ Practice: ${currentCase.icon} ${currentCase.title}`} desc={`Case ${quiz.currentIdx + 1} of ${totalCases}`}>
      {/* Timer */}
      <div className={`mb-4 rounded-xl border p-4 text-center ${
        isOvertime ? "border-warn/50 bg-warn/10" : secondsLeft < 300 ? "border-amber-500/50 bg-amber-500/10" : "border-acc1/25 bg-acc1/10"
      }`}>
        <div className={`text-[36px] font-extrabold font-mono ${
          isOvertime ? "text-warn" : secondsLeft < 300 ? "text-amber-500" : "text-acctxt"
        }`}>
          {isOvertime ? "+" : "-"}{String(Math.abs(minutes)).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        <div className="mt-1 text-[12px] font-bold text-mut">
          {isOvertime ? "⏰ Time's up — wrap your answer!" : `⏱️ ${quiz.timePerCase / 60} minutes per case`}
        </div>
        <div className="mt-2 flex justify-center gap-1">
          {quiz.caseIds.map((id, i) => (
            <div
              key={id}
              className={`h-1.5 w-6 rounded-full ${
                i < quiz.currentIdx ? "bg-ok" :
                i === quiz.currentIdx ? "grad-bg" :
                "bg-wht/20"
              }`}
            />
          ))}
        </div>
        <div className="mt-1 text-[11px] text-mut">
          Score: {quiz.score}/{totalCases} completed
        </div>
      </div>

      {/* Case study overview */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <DifficultyDots level={currentCase.difficulty} />
          <span className="text-[13px] font-bold text-mut">Difficulty {currentCase.difficulty}/5</span>
          <Chip tone="cat">{currentCase.category}</Chip>
        </div>
        <p className="text-[13px] text-mut leading-relaxed">{currentCase.blurb}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {currentCase.prerequisites.map(p => (
            <span key={p} className="rounded-full border border-line/10 bg-wht/5 px-2 py-0.5 text-[11px] font-semibold text-fnt">
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Key numbers hint */}
      {currentCase.keyNumbers.length > 0 && (
        <div className="mb-4 rounded-xl border border-acc1/25 bg-acc1/10 p-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">🔢 Key Numbers (hint)</div>
          <ul className="space-y-1">
            {currentCase.keyNumbers.slice(0, 2).map((n, i) => (
              <li key={i} className="flex gap-2 text-[13px]">
                <span className="flex-none text-acctxt font-mono">•</span>
                <span className="text-ink">{n}</span>
              </li>
            ))}
            {currentCase.keyNumbers.length > 2 && (
              <li className="text-[12px] text-mut italic">+ {currentCase.keyNumbers.length - 2} more numbers…</li>
            )}
          </ul>
        </div>
      )}

      {/* Whiteboard phases (shown when viewing) */}
      {viewing && (
        <div className="mb-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">📋 Whiteboard Flow</div>
          <div className="space-y-3">
            {currentCase.phases.map((phase, i) => (
              <WhiteboardPhase key={i} phase={phase} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Common mistakes (shown when viewing) */}
      {viewing && currentCase.commonMistakes.length > 0 && (
        <div className="mb-4 rounded-xl border border-warn/25 bg-warn/10 p-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-warn">⚠️ Common Mistakes</div>
          <ul className="space-y-1.5">
            {currentCase.commonMistakes.map((m, i) => (
              <li key={i} className="flex gap-2 text-[13px]">
                <span className="flex-none text-warn">•</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {!viewing && (
          <button
            onClick={() => setViewing(true)}
            className={btnGhost + btnSm}
          >
            👁️ View solution
          </button>
        )}
        <button
          onClick={handleComplete}
          className={btnPrimary + btnSm}
        >
          ✓ Mark as done {quiz.currentIdx + 1 < totalCases ? "→ Next" : "→ Finish"}
        </button>
        <button
          onClick={handleSkip}
          className={btnGhost + btnSm}
        >
          ⏭️ Skip
        </button>
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Case card                                                            */
/* ------------------------------------------------------------------ */

function CaseCard({
  caseData: c,
  isCompleted,
  onSelect
}: {
  caseData: SystemDesignCase;
  isCompleted: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`${cardCls} w-full text-left transition-all hover:border-acc1/40 hover:shadow-[0_8px_24px_rgba(99,102,241,.15)] ${isCompleted ? "border-ok/30 bg-ok/5" : ""}`}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-wht/5 text-[24px]">
          {isCompleted ? "✅" : c.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-extrabold">{c.title}</span>
            <DifficultyDots level={c.difficulty} />
            <Chip tone="cat">{c.category}</Chip>
            {isCompleted && <Chip tone="ok">Completed</Chip>}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-mut">{c.blurb}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.prerequisites.map(p => (
              <span key={p} className="rounded-full border border-line/10 bg-wht/5 px-2 py-0.5 text-[11px] font-semibold text-fnt">
                {p}
              </span>
            ))}
          </div>
        </div>
        <span className="flex-none text-[13px] font-bold text-acctxt">→</span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Difficulty dots                                                      */
/* ------------------------------------------------------------------ */

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Difficulty ${level}/5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? "grad-bg" : "bg-wht/20"}`} />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Case study detail drawer                                             */
/* ------------------------------------------------------------------ */

function CaseDrawer({ caseData: c, goal, isCompleted, onClose, onMarkComplete }: {
  caseData: SystemDesignCase;
  goal: ReturnType<typeof getGoal>;
  isCompleted: boolean;
  onClose: () => void;
  onMarkComplete: (id: string) => void;
}) {
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatBusy, setChatBusy] = useState(false);

  const handleExplain = async () => {
    if (!goal) { toast("Set a career goal in Roadmap first"); return; }
    setAiLoading(true);
    try {
      const reply = await explainSystemDesign(c.title, goal);
      setAiResult(reply);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "AI unavailable"));
    } finally { setAiLoading(false); }
  };

  const handleChat = async () => {
    if (!goal || !chatInput.trim() || chatBusy) return;
    const msg = chatInput.trim();
    setChatInput("");
    const userMsg = { role: "user" as const, content: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatBusy(true);
    try {
      const history = [...chatMessages, userMsg];
      const reply = await systemDesignChat(c.title, goal, history);
      setChatMessages(prev => [...prev, { role: "assistant", content: reply.text }]);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "AI unavailable"));
    } finally { setChatBusy(false); }
  };

  return (
    <Drawer onClose={onClose} title={`${c.icon} ${c.title}`} desc={`${c.blurb}`}>
      {/* Difficulty + completion */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DifficultyDots level={c.difficulty} />
        <span className="text-[13px] font-bold text-mut">Difficulty {c.difficulty}/5</span>
        <Chip tone="cat">{c.category}</Chip>
        {isCompleted && <Chip tone="ok">✓ Completed</Chip>}
        {!isCompleted && (
          <button
            onClick={() => onMarkComplete(c.id)}
            className="rounded-lg border border-ok/50 bg-ok/15 px-3 py-1 text-[12px] font-bold text-ok transition-all hover:bg-ok/25"
          >
            ✓ Mark as done
          </button>
        )}
      </div>

      {/* Key numbers to memorize */}
      {c.keyNumbers.length > 0 && (
        <div className="mb-4 rounded-xl border border-acc1/25 bg-acc1/10 p-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">🔢 Numbers to Memorize</div>
          <ul className="space-y-1">
            {c.keyNumbers.map((n, i) => (
              <li key={i} className="flex gap-2 text-[13px]">
                <span className="flex-none text-acctxt font-mono">•</span>
                <span className="text-ink">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prerequisites */}
      {c.prerequisites.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-mut">📚 Prerequisites</div>
          <div className="flex flex-wrap gap-1.5">
            {c.prerequisites.map(p => (
              <span key={p} className="rounded-full border border-line/15 bg-wht/10 px-2.5 py-1 text-[12px] font-semibold text-fnt">{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Whiteboard flow */}
      <div className="mb-4">
        <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">📋 45-Minute Whiteboard Flow</div>
        <div className="space-y-3">
          {c.phases.map((phase, i) => (
            <WhiteboardPhase key={i} phase={phase} index={i} />
          ))}
        </div>
      </div>

      {/* Common mistakes */}
      {c.commonMistakes.length > 0 && (
        <div className="mb-4 rounded-xl border border-warn/25 bg-warn/10 p-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-warn">⚠️ Common Mistakes</div>
          <ul className="space-y-1.5">
            {c.commonMistakes.map((m, i) => (
              <li key={i} className="flex gap-2 text-[13px]">
                <span className="flex-none text-warn">•</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Follow-up topics */}
      {c.followUpTopics.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-mut">🔗 Related Topics</div>
          <div className="flex flex-wrap gap-1.5">
            {c.followUpTopics.map(t => (
              <span key={t} className="rounded-full border border-acc1/30 bg-acc1/10 px-2.5 py-1 text-[12px] font-bold text-acctxt">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* AI Tutor */}
      {aiAvailable() && (
        <div className="rounded-xl border border-line/10 bg-deep/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12.5px] font-bold uppercase tracking-wider text-mut">✨ AI System Design Tutor</span>
            <button className={btnGhost + btnSm} onClick={handleExplain} disabled={aiLoading}>
              {aiLoading ? "Explaining…" : "Explain this design"}
            </button>
          </div>
          {aiResult && (
            <div className="mb-3 whitespace-pre-wrap rounded-lg border border-line/10 bg-wht/5 p-3 text-[13px] leading-relaxed text-ink">{aiResult}</div>
          )}
          {chatMessages.length > 0 && (
            <div className="mb-3 max-h-[240px] space-y-2 overflow-y-auto pr-1">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                    m.role === "user" ? "grad-bg text-white" : "border border-line/10 bg-wht/10 text-ink"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatBusy && <p className="text-[12.5px] text-fnt"><span className="spinner" />Thinking…</p>}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={e => { e.preventDefault(); handleChat(); }}
          >
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Ask about this design…"
              className="min-w-0 flex-1 rounded-xl border border-line/25 bg-deep/60 px-3 py-2 text-[13px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
            />
            <button type="submit" className={btnPrimary + btnSm} disabled={chatBusy || !chatInput.trim()}>Send</button>
          </form>
        </div>
      )}

      {/* Deep dive from content library */}
      <DeepDiveBlock title={c.title} />
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Whiteboard phase                                                     */
/* ------------------------------------------------------------------ */

function WhiteboardPhase({ phase, index }: { phase: WhiteboardFlow; index: number }) {
  return (
    <div className="rounded-xl border border-line/10 bg-wht/5 p-4">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg grad-bg text-[12px] font-extrabold text-white">{index + 1}</div>
        <span className="text-[14px] font-extrabold">{phase.phase}</span>
        <span className="text-[12px] text-mut">({phase.duration})</span>
      </div>
      <ul className="mt-2 space-y-1">
        {phase.talkingPoints.map((tp, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed">
            <span className="flex-none text-acctxt">→</span>
            <span className="text-ink">{tp}</span>
          </li>
        ))}
      </ul>
      {phase.numbers && phase.numbers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {phase.numbers.map((n, i) => (
            <span key={i} className="rounded-full border border-acc1/25 bg-acc1/10 px-2 py-0.5 text-[11px] font-bold text-acctxt font-mono">
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deep dive block (architecture UI for case studies)                   */
/* ------------------------------------------------------------------ */

function DeepDiveBlock({ title }: { title: string }) {
  const dd = getDeepDive(title);
  const archs = (dd as { architectures?: { name: string; blurb: string; components: string[]; tradeoffs: string[]; scaleNotes: string; failureModes: string[]; followUpQa: { q: string; a: string }[] }[] }).architectures;
  if (!archs?.length) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">🏗️ Architecture Case Studies</div>
      <div className="space-y-2">
        {archs.map(arch => (
          <details key={arch.name} className="group rounded-xl border border-line/15 bg-wht/5">
            <summary className="cursor-pointer px-4 py-3 text-[13px] font-bold text-acctxt">{arch.name}</summary>
            <div className="border-t border-line/10 px-4 py-3 space-y-2.5">
              <p className="text-[13px] text-ink leading-relaxed">{arch.blurb}</p>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Components</div>
                {arch.components.map((c, i) => (
                  <div key={i} className="mt-1 font-mono text-[12px] text-fnt bg-deep/50 rounded-lg px-3 py-2 whitespace-pre-wrap">{c}</div>
                ))}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-warn">⚖️ Trade-offs</div>
                <ul className="mt-1 space-y-1">
                  {arch.tradeoffs.map((t, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px]"><span className="flex-none text-warn">•</span><span>{t}</span></li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-acc1/25 bg-acc1/10 px-3 py-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-acc3">📐 Scale Notes</div>
                <p className="mt-1 text-[12.5px] text-ink">{arch.scaleNotes}</p>
              </div>
              {arch.followUpQa.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-acc3">🎯 Follow-up Questions</div>
                  <div className="mt-1 space-y-1.5">
                    {arch.followUpQa.map((qa, i) => (
                      <details key={i} className="group rounded-lg border border-line/15 bg-deep/50">
                        <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-bold text-acctxt">Q{i + 1}. {qa.q}</summary>
                        <div className="border-t border-line/10 px-3 py-2 text-[12px] leading-relaxed text-mut">{qa.a}</div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deep dive architecture overview (below the category tabs)            */
/* ------------------------------------------------------------------ */

function DeepDiveArchitectures(_p: { goal: ReturnType<typeof getGoal> }) {
  const [expanded, setExpanded] = useState(false);

  /* Gather all deep dives that have architectures */
  const allTopics = ["system design", "databases & caching", "distributed systems", "apis & services"];
  const topicsWithArchs = allTopics
    .map(label => {
      const dd = getDeepDive(label);
      const archs = (dd as { architectures?: { name: string; blurb: string; components: string[]; tradeoffs: string[]; scaleNotes: string; failureModes: string[]; followUpQa: { q: string; a: string }[] }[] }).architectures;
      return archs?.length ? { label, archs } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  if (!topicsWithArchs.length) return null;

  const totalCases = topicsWithArchs.reduce((s, t) => s + t.archs.length, 0);

  return (
    <div className="mt-6">
      <button
        onClick={() => setExpanded(e => !e)}
        className={`${cardCls} w-full text-left transition-all hover:border-acc1/40`}
      >
        <div className="flex items-center gap-3 p-4">
          <span className="text-[20px]">🏛️</span>
          <div className="flex-1">
            <span className="text-[14px] font-extrabold">All Architecture Case Studies from Deep Dives</span>
            <span className="ml-2 text-[12.5px] text-mut">({totalCases} across {topicsWithArchs.length} topics)</span>
          </div>
          <span className={`text-[13px] text-acctxt transition-transform ${expanded ? "rotate-90" : ""}`}>→</span>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 space-y-3 pl-2">
          {topicsWithArchs.map(({ label, archs }) => (
            <div key={label}>
              <div className="mb-1.5 text-[13px] font-extrabold text-ink">{label}</div>
              <div className="space-y-2">
                {archs.map(arch => (
                  <details key={arch.name} className="group rounded-xl border border-line/15 bg-wht/5">
                    <summary className="cursor-pointer px-4 py-3 text-[13px] font-bold text-acctxt">{arch.name}</summary>
                    <div className="border-t border-line/10 px-4 py-3 space-y-2.5">
                      <p className="text-[13px] text-ink leading-relaxed">{arch.blurb}</p>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Components</div>
                        {arch.components.map((c, i) => (
                          <div key={i} className="mt-1 font-mono text-[12px] text-fnt bg-deep/50 rounded-lg px-3 py-2 whitespace-pre-wrap">{c}</div>
                        ))}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-warn">⚖️ Trade-offs</div>
                        <ul className="mt-1 space-y-1">
                          {arch.tradeoffs.map((t, i) => (
                            <li key={i} className="flex gap-2 text-[12.5px]"><span className="flex-none text-warn">•</span><span>{t}</span></li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-acc1/25 bg-acc1/10 px-3 py-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-acc3">📐 Scale Notes</div>
                        <p className="mt-1 text-[12.5px] text-ink">{arch.scaleNotes}</p>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
