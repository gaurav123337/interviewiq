/* System Design Hub — dedicated view for system design topics, architecture
   case studies, whiteboard flows, and the system-design AI tutor.
   Includes: timed practice mode, progress tracking, quiz analytics,
   case study bookmarking, and spaced-repetition flashcards. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
/* Persistence helpers                                                  */
/* ------------------------------------------------------------------ */

type CompletedMap = Record<string, number>; // caseId → timestamp

function loadCompleted(): CompletedMap {
  return storageGet<CompletedMap>("iq.sysDesignProgress", {});
}
function markCompleted(caseId: string): CompletedMap {
  const completed = loadCompleted();
  completed[caseId] = Date.now();
  storageSet("iq.sysDesignProgress", completed);
  return completed;
}

/* ---- Quiz state ---- */
interface QuizState {
  active: boolean;
  caseIds: string[];
  currentIdx: number;
  timePerCase: number; // seconds
  startedAt: number;
  caseStartedAt: number;
  score: number;
  answeredCaseIds: string[];
}
function loadQuiz(): QuizState {
  return storageGet<QuizState>("iq.sysDesignQuiz", {
    active: false, caseIds: [], currentIdx: 0, timePerCase: loadTimerPreset(),
    startedAt: 0, caseStartedAt: 0, score: 0, answeredCaseIds: []
  });
}
function saveQuiz(q: QuizState) { storageSet("iq.sysDesignQuiz", q); }

/* ---- Quiz history (analytics) ---- */
interface QuizHistoryEntry {
  date: number;
  totalCases: number;
  completed: number;
  timePerCase: number;
  durationMs: number; // wall-clock time
  categories: string[];
}
function loadHistory(): QuizHistoryEntry[] {
  return storageGet<QuizHistoryEntry[]>("iq.sysDesignHistory", []);
}
function saveHistoryEntry(e: QuizHistoryEntry) {
  const h = loadHistory();
  h.unshift(e);
  storageSet("iq.sysDesignHistory", h.slice(0, 50)); // keep last 50
}

/* ---- Bookmarks ---- */
type BookmarkMap = Record<string, number>; // caseId → timestamp
function loadBookmarks(): BookmarkMap {
  return storageGet<BookmarkMap>("iq.sysDesignBookmarks", {});
}

/* ---- Timer preset ---- */
function loadTimerPreset(): number {
  return storageGet<number>("iq.sysDesignTimer", 45 * 60);
}
function saveTimerPreset(seconds: number) {
  storageSet("iq.sysDesignTimer", seconds);
}

/* ---- Flashcards (spaced repetition) ---- */
interface FlashcardData {
  caseId: string;
  number: string;
  ease: number; // SM-2 ease factor (1.3–2.5)
  interval: number; // days until next review
  nextReview: number; // timestamp
  streak: number;
}
type FlashcardMap = Record<string, FlashcardData>; // key = `${caseId}|${number}`

function loadFlashcards(): FlashcardMap {
  return storageGet<FlashcardMap>("iq.sysDesignFlashcards", {});
}

/* ---- Practice streaks ---- */
function calculateStreak(completed: CompletedMap): { current: number; best: number } {
  const timestamps = Object.values(completed).sort((a, b) => b - a);
  if (timestamps.length === 0) return { current: 0, best: 0 };
  const dayMs = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  let current = 0;
  let best = 0;
  let streak = 0;
  let expected = todayMs;
  const allDays = [...new Set(timestamps.map(t => {
    const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime();
  }))].sort((a, b) => b - a);
  for (const day of allDays) {
    if (day === expected) {
      streak++;
      expected -= dayMs;
    } else if (day === expected - dayMs) {
      expected = day - dayMs;
      streak++;
    } else {
      best = Math.max(best, streak);
      streak = 1;
      expected = day - dayMs;
    }
  }
  best = Math.max(best, streak);
  current = (todayMs - expected <= dayMs) ? streak : 0;
  return { current, best };
}

/* ---- Export progress ---- */
function exportProgress(): string {
  const completed = loadCompleted();
  const history = loadHistory();
  const bookmarks = loadBookmarks();
  const flashcards = loadFlashcards();
  const total = SYSTEM_DESIGN_CASES.length;
  const done = Object.keys(completed).length;
  const streak = calculateStreak(completed);
  const lines = [
    "# System Design Hub — Progress Report",
    `Generated: ${new Date().toLocaleDateString()}`,
    "",
    `## Progress: ${done}/${total} case studies completed (${total > 0 ? Math.round(done / total * 100) : 0}%)`,
    `## Streak: ${streak.current} days current, ${streak.best} days best`,
    `## Bookmarks: ${Object.keys(bookmarks).length}`,
    `## Flashcards: ${Object.keys(flashcards).length} cards, ${Object.values(flashcards).filter(f => f.streak > 0).length} reviewed`,
    "",
    "## Completed Case Studies",
  ];
  for (const c of SYSTEM_DESIGN_CASES) {
    if (completed[c.id]) {
      lines.push(`- ✅ ${c.title} (${c.category}, difficulty ${c.difficulty}/5)`);
    }
  }
  if (history.length > 0) {
    lines.push("", "## Practice Sessions");
    for (const h of history.slice(0, 10)) {
      lines.push(`- ${new Date(h.date).toLocaleDateString()}: ${h.completed}/${h.totalCases} completed, ${Math.round(h.durationMs / 60000)}min`);
    }
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Category metadata                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<string, { icon: string; label: string; desc: string }> = {
  core:        { icon: "🏗️", label: "Core Patterns", desc: "Classic interview starters — URL shortener, chat, feed" },
  data:        { icon: "🗄️", label: "Data & Storage", desc: "Caching, databases, search, and storage patterns" },
  distributed: { icon: "🌐", label: "Distributed Systems", desc: "Task queues, service mesh, consistency, and coordination" },
  api:         { icon: "🔌", label: "API & Services", desc: "Rate limiting, API design, and microservices" },
  "real-world":{ icon: "🚀", label: "Real-World Systems", desc: "Notifications, autocomplete, and production systems" }
};

/* ================================================================== */
/* Main hub                                                             */
/* ================================================================== */

export function SystemDesign() {
  const [category, setCategory] = useState<string>("core");
  const [selected, setSelected] = useState<SystemDesignCase | null>(null);
  const [completed, setCompleted] = useState<CompletedMap>(() => loadCompleted());
  const [showPractice, setShowPractice] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkMap>(() => loadBookmarks());
  const [timerPreset, setTimerPreset] = useState(loadTimerPreset);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const goal = getGoal();

  const categories = getCategories();
  const streak = useMemo(() => calculateStreak(completed), [completed]);
  const cases = useMemo(() => {
    let list = casesByCategory(category);
    if (difficultyFilter !== null) list = list.filter(c => c.difficulty === difficultyFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q) || c.blurb.toLowerCase().includes(q) || c.prerequisites.some(p => p.toLowerCase().includes(q)));
    }
    return list;
  }, [category, difficultyFilter, searchQuery]);
  const totalArchCases = SYSTEM_DESIGN_CASES.length;
  const completedCount = Object.keys(completed).length;
  const progressPct = totalArchCases > 0 ? Math.round((completedCount / totalArchCases) * 100) : 0;
  const bookmarkedCases = SYSTEM_DESIGN_CASES.filter(c => bookmarks[c.id]);

  const handleMarkComplete = useCallback((caseId: string) => {
    const updated = markCompleted(caseId);
    setCompleted(updated);
    toast("✓ Case study marked as completed!");
  }, []);

  const toggleBookmark = useCallback((caseId: string) => {
    const bm = loadBookmarks();
    if (bm[caseId]) {
      delete bm[caseId];
      toast("Bookmark removed");
    } else {
      bm[caseId] = Date.now();
      toast("🔖 Bookmarked!");
    }
    storageSet("iq.sysDesignBookmarks", bm);
    setBookmarks({ ...bm });
  }, []);

  const handleTimerChange = useCallback((seconds: number) => {
    saveTimerPreset(seconds);
    setTimerPreset(seconds);
    toast(`Timer set to ${seconds / 60} minutes`);
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
              {totalArchCases} curated case studies with whiteboard flows, architecture deep dives, and an AI tutor.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip tone="co">🎯 Interview-ready</Chip>
              <Chip tone="ok">📐 Architecture diagrams</Chip>
              <Chip tone="lvl">🔢 Numbers to memorize</Chip>
            </div>
          </div>
        </div>

        {/* Streaks */}
        {streak.current > 0 && (
          <div className="flex items-center gap-3 border-t border-line/10 px-6 py-2.5">
            <span className="text-[14px]">🔥</span>
            <span className="text-[13px] font-extrabold text-amber-400">{streak.current} day streak</span>
            <span className="text-[11px] text-mut">• Best: {streak.best} days</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="border-t border-line/10 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12.5px] font-bold text-mut">📈 Your Progress</span>
            <span className="text-[12.5px] font-extrabold text-acctxt">{completedCount}/{totalArchCases} completed ({progressPct}%)</span>
          </div>
          <div className="h-2 w-full rounded-full bg-wht/10 overflow-hidden">
            <div className="h-full rounded-full grad-bg transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={() => setShowPractice(true)} className="flex items-center gap-2 rounded-xl border border-acc1/50 bg-acc1/15 px-4 py-2.5 text-[13px] font-bold text-acctxt transition-all hover:bg-acc1/30">
          <span>⏱️</span><span>Start Timed Practice</span>
        </button>
        <button onClick={() => setShowFlashcards(true)} className="flex items-center gap-2 rounded-xl border border-purple-500/50 bg-purple-500/15 px-4 py-2.5 text-[13px] font-bold text-purple-400 transition-all hover:bg-purple-500/25">
          <span>🃏</span><span>Flashcards</span>
        </button>
        <button onClick={() => setShowStats(true)} className="flex items-center gap-2 rounded-xl border border-line/15 bg-wht/5 px-4 py-2.5 text-[13px] font-bold text-fnt transition-all hover:bg-wht/10">
          <span>📊</span><span>Stats</span>
        </button>
        <button onClick={() => setShowBookmarks(!showBookmarks)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-bold transition-all ${showBookmarks ? "border-amber-500/50 bg-amber-500/15 text-amber-400" : "border-line/15 bg-wht/5 text-fnt hover:bg-wht/10"}`}>
          <span>🔖</span><span>Bookmarks{bookmarkedCases.length > 0 ? ` (${bookmarkedCases.length})` : ""}</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="mt-4">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Search case studies by title, description, or prerequisites…"
          className="w-full rounded-xl border border-line/25 bg-deep/60 px-4 py-2.5 text-[13px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
        />
      </div>

      {/* Difficulty filter + Timer preset */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[12.5px] font-bold text-mut">🎯 Difficulty:</span>
        <button onClick={() => setDifficultyFilter(null)} className={`rounded-lg border px-3 py-1 text-[12px] font-bold transition-all ${difficultyFilter === null ? "border-acc1/50 bg-acc1/15 text-acctxt" : "border-line/15 bg-wht/5 text-fnt hover:bg-wht/10"}`}>All</button>
        {[1, 2, 3, 4, 5].map(d => (
          <button key={d} onClick={() => setDifficultyFilter(d)} className={`rounded-lg border px-3 py-1 text-[12px] font-bold transition-all ${difficultyFilter === d ? "border-acc1/50 bg-acc1/15 text-acctxt" : "border-line/15 bg-wht/5 text-fnt hover:bg-wht/10"}`}>{'⭐'.repeat(d)}</button>
        ))}
        <span className="flex-1" />
        <span className="text-[12.5px] font-bold text-mut">⏱️ Timer:</span>
        <span className="text-[12.5px] font-bold text-mut">⏱️ Timer:</span>
        {[25, 35, 45].map(m => (
          <button
            key={m}
            onClick={() => handleTimerChange(m * 60)}
            className={`rounded-lg border px-3 py-1 text-[12px] font-bold transition-all ${
              timerPreset === m * 60
                ? "border-acc1/50 bg-acc1/15 text-acctxt"
                : "border-line/15 bg-wht/5 text-fnt hover:bg-wht/10"
            }`}
          >
            {m} min
          </button>
        ))}
        <span className="flex-1" />
        <button onClick={() => { const txt = exportProgress(); navigator.clipboard.writeText(txt).then(() => toast("📋 Progress copied to clipboard!")).catch(() => toast("Copy failed")); }} className="flex items-center gap-1.5 rounded-lg border border-line/15 bg-wht/5 px-3 py-1 text-[12px] font-bold text-fnt transition-all hover:bg-wht/10">
          📋 Export
        </button>
      </div>

      {/* Bookmarked section */}
      {showBookmarks && (
        <div className="mt-6">
          <h2 className="text-[16px] font-extrabold mb-3">🔖 Bookmarked Case Studies</h2>
          {bookmarkedCases.length === 0 ? (
            <p className="text-[13px] text-mut">No bookmarks yet. Click the bookmark icon on any case study to save it here.</p>
          ) : (
            <div className="space-y-3">
              {bookmarkedCases.map(c => (
                <CaseCard
                  key={c.id}
                  caseData={c}
                  isCompleted={!!completed[c.id]}
                  isBookmarked={!!bookmarks[c.id]}
                  onSelect={() => setSelected(c)}
                  onToggleBookmark={toggleBookmark}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
              <span className="rounded-full bg-wht/10 px-2 py-0.5 text-[11px] text-mut">{catCompleted}/{catCases.length}</span>
            </button>
          );
        })}
      </div>

      {CATEGORY_META[category] && <p className="mt-3 text-[13px] text-mut">{CATEGORY_META[category].desc}</p>}

      {/* Case study cards */}
      <div className="mt-5 space-y-3">
        {cases.map(c => (
          <CaseCard
            key={c.id}
            caseData={c}
            isCompleted={!!completed[c.id]}
            isBookmarked={!!bookmarks[c.id]}
            onSelect={() => setSelected(c)}
            onToggleBookmark={toggleBookmark}
          />
        ))}
      </div>

      <DeepDiveArchitectures goal={goal} />

      <div className={`${cardCls} mt-6 px-5 py-4 text-center text-[12.5px] text-mut`}>
        💡 Click any case study to see the full whiteboard flow, numbers to memorize, and common mistakes.
        {goal && <> Your target level is <strong>{LEVELS[LEVEL_INDEX[goal.targetLevel]]?.name ?? goal.targetLevel}</strong> — adjust your depth accordingly.</>}
      </div>

      {/* Drawers */}
      {selected && (
        <CaseDrawer
          caseData={selected}
          goal={goal}
          isCompleted={!!completed[selected.id]}
          isBookmarked={!!bookmarks[selected.id]}
          onClose={() => setSelected(null)}
          onMarkComplete={handleMarkComplete}
          onToggleBookmark={toggleBookmark}
        />
      )}
      {showPractice && (
        <TimedPractice
          timePerCase={timerPreset}
          onComplete={() => { setShowPractice(false); setCompleted(loadCompleted()); }}
          onMarkComplete={handleMarkComplete}
          onClose={() => setShowPractice(false)}
        />
      )}
      {showStats && <StatsDrawer onClose={() => setShowStats(false)} />}
      {showFlashcards && <FlashcardDrawer onClose={() => setShowFlashcards(false)} />}
    </div>
  );
}

/* ================================================================== */
/* Timed practice mode                                                  */
/* ================================================================== */

function TimedPractice({
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

/* ================================================================== */
/* Stats drawer (analytics)                                             */
/* ================================================================== */

function StatsDrawer({ onClose }: { onClose: () => void }) {
  const completed = loadCompleted();
  const history = loadHistory();
  const totalCases = SYSTEM_DESIGN_CASES.length;
  const completedCount = Object.keys(completed).length;

  const totalQuizzes = history.length;
  const avgScore = totalQuizzes > 0 ? Math.round(history.reduce((s, h) => s + (h.totalCases > 0 ? (h.completed / h.totalCases) * 100 : 0), 0) / totalQuizzes) : 0;
  const totalTimeMin = Math.round(history.reduce((s, h) => s + h.durationMs, 0) / 60000);

  // Per-category stats
  const catStats = useMemo(() => {
    const cats = getCategories();
    return cats.map(cat => {
      const catCases = casesByCategory(cat);
      const catCompleted = catCases.filter(c => completed[c.id]).length;
      return { cat, total: catCases.length, completed: catCompleted, pct: catCases.length > 0 ? Math.round((catCompleted / catCases.length) * 100) : 0 };
    });
  }, [completed]);

  // Recent sessions
  const recentSessions = history.slice(0, 10);

  return (
    <Drawer onClose={onClose} title="📊 Practice Analytics" desc="Your system design practice statistics">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border border-acc1/25 bg-acc1/10 p-4 text-center">
          <div className="text-[28px] font-extrabold text-acctxt">{completedCount}</div>
          <div className="text-[12px] font-bold text-mut">Cases Completed</div>
          <div className="text-[11px] text-acctxt">of {totalCases} total</div>
        </div>
        <div className="rounded-xl border border-ok/25 bg-ok/10 p-4 text-center">
          <div className="text-[28px] font-extrabold text-ok">{totalQuizzes}</div>
          <div className="text-[12px] font-bold text-mut">Practice Sessions</div>
        </div>
        <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 p-4 text-center">
          <div className="text-[28px] font-extrabold text-purple-400">{avgScore}%</div>
          <div className="text-[12px] font-bold text-mut">Avg Score</div>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-center">
          <div className="text-[28px] font-extrabold text-amber-400">{totalTimeMin}</div>
          <div className="text-[12px] font-bold text-mut">Minutes Practiced</div>
        </div>
      </div>

      {/* Per-category breakdown */}
      <div className="mb-6">
        <h3 className="text-[14px] font-extrabold mb-3">📁 Category Breakdown</h3>
        <div className="space-y-2">
          {catStats.map(({ cat, total, completed: c, pct }) => {
            const meta = CATEGORY_META[cat] ?? { icon: "📁", label: cat };
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-[15px]">{meta.icon}</span>
                <span className="flex-1 text-[13px] font-bold text-ink">{meta.label}</span>
                <span className="text-[12px] text-mut">{c}/{total}</span>
                <div className="h-2 w-20 rounded-full bg-wht/10 overflow-hidden">
                  <div className="h-full rounded-full grad-bg transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[12px] font-bold text-acctxt w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div>
          <h3 className="text-[14px] font-extrabold mb-3">🕐 Recent Sessions</h3>
          <div className="space-y-2">
            {recentSessions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-line/10 bg-wht/5 px-4 py-3">
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-ink">
                    {s.completed}/{s.totalCases} completed
                  </div>
                  <div className="text-[11px] text-mut">
                    {new Date(s.date).toLocaleDateString()} • {Math.round(s.durationMs / 60000)}min • {s.categories.join(", ")}
                  </div>
                </div>
                <div className={`text-[14px] font-extrabold ${s.completed === s.totalCases ? "text-ok" : s.completed > 0 ? "text-acctxt" : "text-mut"}`}>
                  {s.totalCases > 0 ? Math.round((s.completed / s.totalCases) * 100) : 0}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <p className="text-[13px] text-mut text-center mt-4">No practice sessions yet. Start a timed practice to see your stats!</p>
      )}
    </Drawer>
  );
}

/* ================================================================== */
/* Flashcard drawer (spaced repetition for key numbers)                */
/* ================================================================== */

function FlashcardDrawer({ onClose }: { onClose: () => void }) {
  const [cards, setCards] = useState<FlashcardMap>(() => loadFlashcards());
  const [showAnswer, setShowAnswer] = useState(false);
  const [flipped, setFlipped] = useState(false);

  // Build deck: gather all key numbers from all cases, create cards as needed
  const deck = useMemo(() => {
    const allCards: { caseId: string; caseTitle: string; caseIcon: string; number: string; key: string; data: FlashcardData | null }[] = [];
    for (const c of SYSTEM_DESIGN_CASES) {
      for (const n of c.keyNumbers) {
        const key = `${c.id}|${n}`;
        allCards.push({ caseId: c.id, caseTitle: c.title, caseIcon: c.icon, number: n, key, data: cards[key] ?? null });
      }
    }
    return allCards;
  }, [cards]);

  // Due cards (nextReview <= now)
  const now = Date.now();
  const dueCards = useMemo(() => deck.filter(c => !c.data || c.data.nextReview <= now), [deck, now]);
  const newCards = useMemo(() => deck.filter(c => !c.data), [deck]);
  const reviewedCards = useMemo(() => deck.filter(c => c.data && c.data.nextReview > now), [deck, now]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const current = dueCards[currentIdx];

  const handleRating = (quality: number) => {
    if (!current) return;
    const key = current.key;
    const existing = cards[key] ?? { caseId: current.caseId, number: current.number, ease: 2.5, interval: 0, nextReview: 0, streak: 0 };

    // SM-2 algorithm
    let { ease, interval, streak } = existing;
    if (quality >= 3) {
      // Correct
      streak += 1;
      if (streak === 1) interval = 1;
      else if (streak === 2) interval = 3;
      else interval = Math.round(interval * ease);
      ease = Math.min(2.5, ease + 0.1);
    } else {
      // Incorrect — reset
      streak = 0;
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
    }

    const updated: FlashcardData = {
      ...existing, ease, interval, streak,
      nextReview: Date.now() + interval * 24 * 60 * 60 * 1000
    };

    const newCards = { ...cards, [key]: updated };
    setCards(newCards);
    storageSet("iq.sysDesignFlashcards", newCards);
    setShowAnswer(false);
    setFlipped(false);

    // Move to next
    if (currentIdx + 1 < dueCards.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setCurrentIdx(0);
      toast("🎉 All due cards reviewed!");
    }
  };

  return (
    <Drawer onClose={onClose} title="🃏 Flashcards — Key Numbers" desc="Spaced repetition for memorizing system design numbers">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="rounded-xl border border-warn/25 bg-warn/10 px-4 py-2 text-center">
          <div className="text-[18px] font-extrabold text-warn">{dueCards.length}</div>
          <div className="text-[11px] font-bold text-mut">Due</div>
        </div>
        <div className="rounded-xl border border-acc1/25 bg-acc1/10 px-4 py-2 text-center">
          <div className="text-[18px] font-extrabold text-acctxt">{newCards.length}</div>
          <div className="text-[11px] font-bold text-mut">New</div>
        </div>
        <div className="rounded-xl border border-ok/25 bg-ok/10 px-4 py-2 text-center">
          <div className="text-[18px] font-extrabold text-ok">{reviewedCards.length}</div>
          <div className="text-[11px] font-bold text-mut">Reviewed</div>
        </div>
        <div className="rounded-xl border border-line/15 bg-wht/5 px-4 py-2 text-center">
          <div className="text-[18px] font-extrabold text-fnt">{deck.length}</div>
          <div className="text-[11px] font-bold text-mut">Total</div>
        </div>
      </div>

      {dueCards.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-[32px] mb-2">🎉</div>
          <p className="text-[14px] font-bold text-ink">All caught up!</p>
          <p className="text-[13px] text-mut mt-1">No cards are due for review right now. Come back later or reset your progress.</p>
        </div>
      ) : current ? (
        <div>
          {/* Card */}
          <button
            onClick={() => { setFlipped(!flipped); setShowAnswer(!showAnswer); }}
            className={`w-full rounded-2xl border p-6 text-center transition-all ${
              flipped ? "border-ok/40 bg-ok/10" : "border-acc1/40 bg-acc1/10 hover:shadow-[0_8px_24px_rgba(99,102,241,.15)]"
            }`}
          >
            <div className="text-[12px] font-bold text-mut mb-2">
              {current.caseIcon} {current.caseTitle}
            </div>
            {flipped ? (
              <div className="text-[16px] font-extrabold text-ink leading-relaxed">{current.number}</div>
            ) : (
              <div className="text-[14px] text-mut">Tap to reveal the key number</div>
            )}
          </button>

          {/* Rating buttons */}
          {flipped && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              <button onClick={() => handleRating(1)} className="rounded-xl border border-warn/50 bg-warn/15 px-3 py-3 text-[12px] font-bold text-warn transition-all hover:bg-warn/25">
                😣 Again
              </button>
              <button onClick={() => handleRating(3)} className="rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-3 text-[12px] font-bold text-amber-400 transition-all hover:bg-amber-500/25">
                🤔 Hard
              </button>
              <button onClick={() => handleRating(4)} className="rounded-xl border border-ok/50 bg-ok/15 px-3 py-3 text-[12px] font-bold text-ok transition-all hover:bg-ok/25">
                👍 Good
              </button>
              <button onClick={() => handleRating(5)} className="rounded-xl border border-acc1/50 bg-acc1/15 px-3 py-3 text-[12px] font-bold text-acctxt transition-all hover:bg-acc1/25">
                🔥 Easy
              </button>
            </div>
          )}

          <div className="mt-3 text-center text-[11px] text-mut">
            Card {currentIdx + 1} of {dueCards.length} due • {current.data ? `Streak: ${current.data.streak}` : "New card"}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

/* ================================================================== */
/* Case card                                                            */
/* ================================================================== */

function CaseCard({
  caseData: c,
  isCompleted,
  isBookmarked,
  onSelect,
  onToggleBookmark
}: {
  caseData: SystemDesignCase;
  isCompleted: boolean;
  isBookmarked: boolean;
  onSelect: () => void;
  onToggleBookmark: (id: string) => void;
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
              <span key={p} className="rounded-full border border-line/10 bg-wht/5 px-2 py-0.5 text-[11px] font-semibold text-fnt">{p}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onToggleBookmark(c.id); }}
            className={`text-[16px] transition-all ${isBookmarked ? "text-amber-400" : "text-mut hover:text-amber-400"}`}
            title={isBookmarked ? "Remove bookmark" : "Bookmark this case"}
          >
            {isBookmarked ? "🔖" : "🏷️"}
          </button>
          <span className="text-[13px] font-bold text-acctxt">→</span>
        </div>
      </div>
    </button>
  );
}

/* ================================================================== */
/* Difficulty dots                                                      */
/* ================================================================== */

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Difficulty ${level}/5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? "grad-bg" : "bg-wht/20"}`} />
      ))}
    </span>
  );
}

/* ================================================================== */
/* Case study detail drawer                                             */
/* ================================================================== */

function CaseDrawer({ caseData: c, goal, isCompleted, isBookmarked, onClose, onMarkComplete, onToggleBookmark }: {
  caseData: SystemDesignCase;
  goal: ReturnType<typeof getGoal>;
  isCompleted: boolean;
  isBookmarked: boolean;
  onClose: () => void;
  onMarkComplete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
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
      {/* Actions row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DifficultyDots level={c.difficulty} />
        <span className="text-[13px] font-bold text-mut">Difficulty {c.difficulty}/5</span>
        <Chip tone="cat">{c.category}</Chip>
        {isCompleted && <Chip tone="ok">✓ Completed</Chip>}
        {!isCompleted && (
          <button onClick={() => onMarkComplete(c.id)} className="rounded-lg border border-ok/50 bg-ok/15 px-3 py-1 text-[12px] font-bold text-ok transition-all hover:bg-ok/25">
            ✓ Mark as done
          </button>
        )}
        <button
          onClick={() => onToggleBookmark(c.id)}
          className={`rounded-lg border px-3 py-1 text-[12px] font-bold transition-all ${isBookmarked ? "border-amber-500/50 bg-amber-500/15 text-amber-400" : "border-line/15 bg-wht/5 text-mut hover:border-amber-500/50 hover:text-amber-400"}`}
        >
          {isBookmarked ? "🔖 Bookmarked" : "🏷️ Bookmark"}
        </button>
      </div>

      {c.keyNumbers.length > 0 && (
        <div className="mb-4 rounded-xl border border-acc1/25 bg-acc1/10 p-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">🔢 Numbers to Memorize</div>
          <ul className="space-y-1">
            {c.keyNumbers.map((n, i) => (
              <li key={i} className="flex gap-2 text-[13px]"><span className="flex-none text-acctxt font-mono">•</span><span className="text-ink">{n}</span></li>
            ))}
          </ul>
        </div>
      )}

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

      <div className="mb-4">
        <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">📋 Whiteboard Flow</div>
        <div className="space-y-3">
          {c.phases.map((phase, i) => <WhiteboardPhase key={i} phase={phase} index={i} />)}
        </div>
      </div>

      {c.commonMistakes.length > 0 && (
        <div className="mb-4 rounded-xl border border-warn/25 bg-warn/10 p-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-warn">⚠️ Common Mistakes</div>
          <ul className="space-y-1.5">
            {c.commonMistakes.map((m, i) => (
              <li key={i} className="flex gap-2 text-[13px]"><span className="flex-none text-warn">•</span><span>{m}</span></li>
            ))}
          </ul>
        </div>
      )}

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
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed ${m.role === "user" ? "grad-bg text-white" : "border border-line/10 bg-wht/10 text-ink"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatBusy && <p className="text-[12.5px] text-fnt"><span className="spinner" />Thinking…</p>}
            </div>
          )}
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); handleChat(); }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about this design…"
              className="min-w-0 flex-1 rounded-xl border border-line/25 bg-deep/60 px-3 py-2 text-[13px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20" />
            <button type="submit" className={btnPrimary + btnSm} disabled={chatBusy || !chatInput.trim()}>Send</button>
          </form>
        </div>
      )}

      <DeepDiveBlock title={c.title} />
    </Drawer>
  );
}

/* ================================================================== */
/* Whiteboard phase                                                     */
/* ================================================================== */

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
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed"><span className="flex-none text-acctxt">→</span><span className="text-ink">{tp}</span></li>
        ))}
      </ul>
      {phase.numbers && phase.numbers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {phase.numbers.map((n, i) => (
            <span key={i} className="rounded-full border border-acc1/25 bg-acc1/10 px-2 py-0.5 text-[11px] font-bold text-acctxt font-mono">{n}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* Deep dive block                                                      */
/* ================================================================== */

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

/* ================================================================== */
/* Deep dive architecture overview                                      */
/* ================================================================== */

function DeepDiveArchitectures(_p: { goal: ReturnType<typeof getGoal> }) {
  const [expanded, setExpanded] = useState(false);
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
      <button onClick={() => setExpanded(e => !e)} className={`${cardCls} w-full text-left transition-all hover:border-acc1/40`}>
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
