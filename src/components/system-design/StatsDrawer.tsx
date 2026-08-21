import { useMemo, useState } from "react";
import { SYSTEM_DESIGN_CASES } from "../../data/systemDesignBank";
import { STORAGE_KEYS, storageGet, storageSet } from "../../services/storage";
import { toast } from "../../toast";
import { btnGhost, btnSm, cardCls, Chip, Drawer, ProgressBar } from "../ui";
import { loadCompleted, markCompleted, loadQuiz, saveQuiz, loadHistory, saveHistoryEntry, loadBookmarks, loadTimerPreset, saveTimerPreset, loadFlashcards, calculateStreak, exportProgress, CATEGORY_META } from "./utils";

export function StatsDrawer({ onClose }: { onClose: () => void }) {
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
                <ProgressBar widthPct={pct} height="h-2" className="w-20" />
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