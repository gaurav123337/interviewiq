import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SYSTEM_DESIGN_CASES, getCategories, casesByCategory, type SystemDesignCase } from '../data/systemDesignBank';
import { getGoal } from '../services/goal';
import { storageGet, storageSet } from '../services/storage';
import type { CoachTopicContext } from '../contexts/CoachContext';
import { toast } from '../toast';
import { btnGhost, btnPrimary, btnSm, cardCls, Chip } from './ui';
import { TimedPractice, StatsDrawer, FlashcardDrawer, CaseCard, CaseDrawer, DeepDiveArchitectures } from './system-design';
import { loadCompleted, markCompleted, loadBookmarks, loadTimerPreset, saveTimerPreset, calculateStreak, exportProgress, CATEGORY_META, type CompletedMap, type BookmarkMap } from './system-design/helpers';


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
  const lastCaseRef = useRef<SystemDesignCase | null>(null);

  /* Notify the floating AI coach when a case study is selected.
     Keep the context sticky — don't clear when the drawer closes,
     so the coach always knows what the user was last studying.
     Also track drawer open state and topic history. */
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setter = (window as any).__setCoachTopic;
    if (!setter) return;
    if (selected && selected.id !== lastCaseRef.current?.id) {
      lastCaseRef.current = selected;
      setter({ caseId: selected.id, title: selected.title, icon: selected.icon, blurb: selected.blurb, drawerOpen: true });
      // Track topic history
      const hist = storageGet<string[]>("iq.coachTopicHistory", []);
      const updated = [selected.id, ...hist.filter(id => id !== selected.id)].slice(0, 8);
      storageSet("iq.coachTopicHistory", updated);
    } else if (selected) {
      setter((prev: CoachTopicContext) => ({ ...prev, drawerOpen: true }));
    } else {
      setter((prev: CoachTopicContext) => ({ ...prev, drawerOpen: false }));
    }
  }, [selected]);

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
          <ProgressBar widthPct={progressPct} height="h-2" className="w-full" />
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
                  onPrerequisiteClick={(_cid, prereq) => { setSelected(c); toast(`📘 Opening ${prereq} in ${c.title}…`); }}
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
            onPrerequisiteClick={(_caseId, prereq) => {
              /* Open the case study drawer and send a prerequisite question to the inline chat */
              const matched = SYSTEM_DESIGN_CASES.find(cs => cs.id === _caseId);
              if (matched) {
                setSelected(matched);
              }
              /* Post a message to the floating coach with the prereq context */
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const coachSetter = (window as any).__setCoachTopic;
              if (coachSetter) {
                coachSetter({ caseId: matched?.id ?? null, title: matched?.title ?? null, icon: matched?.icon ?? null, blurb: matched?.blurb ?? null, drawerOpen: false });
              }
              toast(`📘 Opening ${prereq} in ${matched?.title ?? 'context'}…`);
            }}
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

