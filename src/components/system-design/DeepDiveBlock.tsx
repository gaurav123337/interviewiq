import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aiAvailable } from '../../ai';
import { getDeepDive } from '../../data/deepDive';
import { LEVELS, LEVEL_INDEX } from '../../data';
import { SYSTEM_DESIGN_CASES, getCategories, casesByCategory, type SystemDesignCase, type WhiteboardFlow } from '../../data/systemDesignBank';
import { explainSystemDesign, systemDesignChat } from '../../services/systemDesignTutor';
import { lexicalSearch, documentTitles, ragTuningInfo } from '../../services/rag';
import { getPrereqExplanation } from '../../data/prerequisiteKnowledge';
import { CitationChip } from '../CitationChip';
import { GroundingNote } from '../GroundingNote';
import { getGoal } from '../../services/goal';
import { storageGet, storageSet } from '../../services/storage';
import type { CoachTopicContext } from '../../contexts/CoachContext';
import { toast } from '../../toast';
import { btnGhost, btnPrimary, btnSm, cardCls, Chip, Drawer, ProgressBar } from '../ui';
import { loadCompleted, markCompleted, loadQuiz, saveQuiz, loadHistory, saveHistoryEntry, loadBookmarks, loadTimerPreset, saveTimerPreset, loadFlashcards, calculateStreak, exportProgress, CATEGORY_META, type CompletedMap, type QuizState, type QuizHistoryEntry, type BookmarkMap, type FlashcardData, type FlashcardMap } from './helpers';


export function DeepDiveBlock({ title }: { title: string }) {
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

