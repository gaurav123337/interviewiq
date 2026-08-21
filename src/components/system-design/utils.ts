import { storageGet, storageSet } from "../../services/storage";
import { SYSTEM_DESIGN_CASES, getCategories, casesByCategory } from "../../data/systemDesignBank";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type CompletedMap = Record<string, number>; // caseId -> timestamp

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

interface QuizHistoryEntry {
  date: number;
  totalCases: number;
  completed: number;
  timePerCase: number;
  durationMs: number; // wall-clock time
  categories: string[];
}

interface FlashcardData {
  caseId: string;
  number: string;
  ease: number; // SM-2 ease factor (1.3-2.5)
  interval: number; // days until next review
  nextReview: number; // timestamp
  streak: number;
}

type FlashcardMap = Record<string, FlashcardData>; // key = `${caseId}|${number}`

/* ------------------------------------------------------------------ */
/* Persistence helpers                                                  */
/* ------------------------------------------------------------------ */

function loadCompleted(): CompletedMap {
  return storageGet<CompletedMap>("iq.sysDesignCompleted", {});
}

function markCompleted(caseId: string): CompletedMap {
  const c = loadCompleted();
  c[caseId] = Date.now();
  storageSet("iq.sysDesignCompleted", c);
  return c;
}

function loadQuiz(): QuizState {
  return storageGet<QuizState>("iq.sysDesignQuiz", {
    active: false,
    caseIds: [],
    currentIdx: 0,
    timePerCase: 300,
    startedAt: 0,
    caseStartedAt: 0,
    score: 0,
    answeredCaseIds: [],
  });
}

function saveQuiz(q: QuizState) { storageSet("iq.sysDesignQuiz", q); }

function loadHistory(): QuizHistoryEntry[] {
  return storageGet<QuizHistoryEntry[]>("iq.sysDesignHistory", []);
}


function saveHistoryEntry(e: QuizHistoryEntry) {
  const h = loadHistory();
  h.push(e);
  storageSet("iq.sysDesignHistory", h);
}

function loadBookmarks(): Record<string, boolean> {
  return storageGet<Record<string, boolean>>("iq.sysDesignBookmarks", {});
}

function loadTimerPreset(): number {
  return storageGet<number>("iq.sysDesignTimer", 300);
}

function saveTimerPreset(seconds: number) {
  storageSet("iq.sysDesignTimer", seconds);
}

function loadFlashcards(): FlashcardMap {
  return storageGet<FlashcardMap>("iq.sysDesignFlashcards", {});
}

function calculateStreak(completed: CompletedMap): { current: number; best: number } {
  const days = Object.values(completed)
    .map(ts => new Date(ts).toDateString())
    .filter((d, i, a) => a.indexOf(d) === i)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  if (!days.length) return { current: 0, best: 0 };
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  if (days[0] !== today && days[0] !== yesterday) return { current: 0, best: days.length };
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]).getTime();
    const cur = new Date(days[i]).getTime();
    if (prev - cur === 86_400_000) streak++;
    else break;
  }
  return { current: streak, best: Math.max(streak, days.length) };
}

function exportProgress(): string {
  const completed = loadCompleted();
  const history = loadHistory();
  const bookmarks = loadBookmarks();
  const flashcards = loadFlashcards();
  return JSON.stringify({ completed, history, bookmarks, flashcards, exportedAt: Date.now() }, null, 2);
}

/* ------------------------------------------------------------------ */
/* Category metadata                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<string, { icon: string; label: string; desc: string }> = {
  "all": { icon: "📋", label: "All Topics", desc: "Every system design case" },
  ...Object.fromEntries(getCategories().map(c => [c, { icon: SYSTEM_DESIGN_CASES.find(cs => cs.category === c)?.icon ?? "🏗️", label: c, desc: casesByCategory(c).length + " cases" }])),
};

export { loadCompleted, markCompleted, loadQuiz, saveQuiz, loadHistory, saveHistoryEntry, loadBookmarks, loadTimerPreset, saveTimerPreset, loadFlashcards, calculateStreak, exportProgress, CATEGORY_META };
export type { QuizState, QuizHistoryEntry, FlashcardData, FlashcardMap, CompletedMap };
