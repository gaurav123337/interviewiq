/* System Design Hub — persistence helpers */

import { SYSTEM_DESIGN_CASES } from '../../data/systemDesignBank';
import { storageGet, storageSet } from '../../services/storage';

export type CompletedMap = Record<string, number>;
export function loadCompleted(): CompletedMap {
  return storageGet<CompletedMap>('iq.sysDesignProgress', {});
}
export function markCompleted(caseId: string): CompletedMap {
  const completed = loadCompleted();
  completed[caseId] = Date.now();
  storageSet('iq.sysDesignProgress', completed);
  return completed;
}

export interface QuizState {
  active: boolean;
  caseIds: string[];
  currentIdx: number;
  timePerCase: number;
  startedAt: number;
  caseStartedAt: number;
  score: number;
  answeredCaseIds: string[];
}
export function loadQuiz(): QuizState {
  return storageGet<QuizState>('iq.sysDesignQuiz', {
    active: false, caseIds: [], currentIdx: 0, timePerCase: loadTimerPreset(),
    startedAt: 0, caseStartedAt: 0, score: 0, answeredCaseIds: []
  });
}
export function saveQuiz(q: QuizState) { storageSet('iq.sysDesignQuiz', q); }

export interface QuizHistoryEntry {
  date: number;
  totalCases: number;
  completed: number;
  timePerCase: number;
  durationMs: number;
  categories: string[];
}
export function loadHistory(): QuizHistoryEntry[] {
  return storageGet<QuizHistoryEntry[]>('iq.sysDesignHistory', []);
}
export function saveHistoryEntry(e: QuizHistoryEntry) {
  const h = loadHistory();
  h.unshift(e);
  storageSet('iq.sysDesignHistory', h.slice(0, 50));
}

export type BookmarkMap = Record<string, number>;
export function loadBookmarks(): BookmarkMap {
  return storageGet<BookmarkMap>('iq.sysDesignBookmarks', {});
}

export function loadTimerPreset(): number {
  return storageGet<number>('iq.sysDesignTimer', 45 * 60);
}
export function saveTimerPreset(seconds: number) {
  storageSet('iq.sysDesignTimer', seconds);
}

export interface FlashcardData {
  caseId: string;
  number: string;
  ease: number;
  interval: number;
  nextReview: number;
  streak: number;
}
export type FlashcardMap = Record<string, FlashcardData>;
export function loadFlashcards(): FlashcardMap {
  return storageGet<FlashcardMap>('iq.sysDesignFlashcards', {});
}

export function calculateStreak(completed: CompletedMap): { current: number; best: number } {
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
    if (day === expected) { streak++; expected -= dayMs; }
    else if (day === expected - dayMs) { expected = day - dayMs; streak++; }
    else { best = Math.max(best, streak); streak = 1; expected = day - dayMs; }
  }
  best = Math.max(best, streak);
  current = (todayMs - expected <= dayMs) ? streak : 0;
  return { current, best };
}

export function exportProgress(): string {
  const completed = loadCompleted();
  const history = loadHistory();
  const bookmarks = loadBookmarks();
  const flashcards = loadFlashcards();
  const total = SYSTEM_DESIGN_CASES.length;
  const done = Object.keys(completed).length;
  const streak = calculateStreak(completed);
  const lines = [
    '# System Design Hub — Progress Report',
    'Generated: ' + new Date().toLocaleDateString(),
    '',
    '## Progress: ' + done + '/' + total + ' case studies completed (' + (total > 0 ? Math.round(done / total * 100) : 0) + '%)',
    '## Streak: ' + streak.current + ' days current, ' + streak.best + ' days best',
    '## Bookmarks: ' + Object.keys(bookmarks).length,
    '## Flashcards: ' + Object.keys(flashcards).length + ' cards',
    '',
    '## Completed Case Studies',
  ];
  for (const c of SYSTEM_DESIGN_CASES) {
    if (completed[c.id]) lines.push('- ' + c.title + ' (' + c.category + ')');
  }
  return lines.join(String.fromCharCode(10));
}

export const CATEGORY_META: Record<string, { icon: string; label: string; desc: string }> = {
  core:        { icon: '🏗️', label: 'Core Patterns', desc: 'Classic interview starters' },
  data:        { icon: '🗄️', label: 'Data & Storage', desc: 'Caching, databases, search' },
  distributed: { icon: '🌐', label: 'Distributed Systems', desc: 'Task queues, service mesh' },
  api:         { icon: '🔌', label: 'API & Services', desc: 'Rate limiting, API design' },
  'real-world':{ icon: '🚀', label: 'Real-World Systems', desc: 'Notifications, autocomplete' }
};
