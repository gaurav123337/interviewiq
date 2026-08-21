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


export function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Difficulty ${level}/5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? "grad-bg" : "bg-wht/20"}`} />
      ))}
    </span>
  );
}

