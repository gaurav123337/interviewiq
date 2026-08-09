import type { Answer, Config, LevelId, QA, SavedSession, Session, SessionMeta } from "../types";
import { composeSession, grade } from "../engine";
import { fieldById, levelById } from "../data";
import { uid } from "../util";

export interface OnboardingSelection {
  level: LevelId | null;
  field: string | null;
  company: string | null;
}

/** Builds the main interview session from the user's onboarding choices. */
export function buildInterviewSession(ob: OnboardingSelection, config: Config): Session {
  return composeSession({
    fieldId: ob.field,
    companyId: ob.company,
    levelId: ob.level,
    count: config.count,
    mode: config.mode
  });
}

/** Builds a single-question session for practicing one bank item. */
export function buildPracticeSession(fieldId: string, q: QA & { lvl: LevelId }): Session {
  const field = fieldById(fieldId);
  return {
    questions: [{ ...q, cat: "field", catLabel: "Technical", catColor: "#22d3ee", level: q.lvl, src: "bank" }],
    meta: {
      field: field?.name ?? "Question Bank", fieldId,
      company: "Question Bank", companyId: "bank",
      level: levelById(q.lvl).name, levelId: q.lvl, mode: "standard"
    }
  };
}

/** Rebuilds a session object from a saved history record (read-only replay). */
export function buildReplaySession(saved: SavedSession): Session {
  return { questions: saved.answers.map(a => a.q), meta: saved.meta };
}

/** Persists a completed session as an immutable history record. Pure — returns null when nothing to save. */
export function makeSavedSession(meta: SessionMeta, config: Config, answers: Answer[]): SavedSession | null {
  if (!answers.length) return null;
  const sum = answers.reduce((acc, a) => acc + a.fb.score, 0);
  const pct = sum / (answers.length * 5);
  return {
    id: uid(),
    date: Date.now(),
    meta,
    config,
    agg: { score: +(pct * 5).toFixed(1), pct, grade: grade(pct) },
    answers: answers.map(a => ({ q: a.q, user: a.user, score: a.fb.score, pct: a.fb.pct }))
  };
}
