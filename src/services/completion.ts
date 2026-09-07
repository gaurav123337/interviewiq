/* Completion helpers — surface real Roadmap + Counselor progress in one place
   (Phase 3, item 17). Pure and testable: the counting logic previously lived
   inline in Dashboard.tsx (topics/weeks) and Counselor.tsx (study weeks); this
   is the single source both the Roadmap dashboard and the Progress view read,
   so the two can never diverge.

   Both helpers fail soft — they return null rather than throw — because Progress
   must never crash (Item 16 standing constraint). */

import type { SavedSession } from "../types";
import { getGoal, getProfile, getProgress } from "./goal";
import { buildRoadmap, applyProgress, type Roadmap } from "./roadmap";
import { getSavedStudyPlan, planProgressKey, getPlanProgress } from "./studyPlan";

export interface RoadmapCompletion {
  topicsDone: number;
  topicsTotal: number;
  weeksDone: number;
  weeksTotal: number;
}

export interface CounselorCompletion {
  weeksDone: number;
  weeksTotal: number;
}

/**
 * Roadmap completion (topics + weeks done). Null when there's no goal/profile —
 * buildRoadmap requires both (see Roadmap.tsx). Takes `sessions` because the
 * roadmap allocation is session-aware; the caller passes state.sessions.
 * Any build failure returns null (fail-soft: a malformed goal must not crash
 * the Progress view).
 */
export function roadmapCompletion(sessions: SavedSession[]): RoadmapCompletion | null {
  const goal = getGoal();
  const profile = getProfile();
  if (!goal || !profile) return null;

  let roadmap: Roadmap;
  try {
    const built = buildRoadmap(goal, profile, sessions);
    /* applyProgress mutates in place — work on a defensive copy (Roadmap.tsx) */
    const copy: Roadmap = { ...built, weeks: built.weeks.map(w => ({ ...w, topics: w.topics.map(t => ({ ...t })) })) };
    roadmap = applyProgress(copy, getProgress());
  } catch {
    return null;
  }

  const allTopics = roadmap.weeks.flatMap(w => w.topics);
  return {
    topicsDone: allTopics.filter(t => t.done).length,
    topicsTotal: allTopics.length,
    weeksDone: roadmap.weeks.filter(w => w.status === "done").length,
    weeksTotal: roadmap.weeks.length,
  };
}

/**
 * Counselor 90-day-plan completion (weeks checked off). Null when no plan is
 * saved — or when a persisted/synced blob is malformed (no milestones array);
 * fail-soft so a cross-version or corrupted iq.counselorPlan never crashes the
 * Progress render.
 *
 * weeksDone counts only weeks that belong to the CURRENT plan's milestones. The
 * per-plan progress map is keyed by field/track/band alone (planProgressKey) and
 * is never pruned, so a plan rebuilt with fewer milestones (e.g. same track at
 * more hours/week) can leave stale higher-week ticks behind; counting them would
 * make weeksDone exceed weeksTotal and paint a freshly-rebuilt plan as complete.
 */
export function counselorCompletion(): CounselorCompletion | null {
  const plan = getSavedStudyPlan();
  if (!plan || !Array.isArray(plan.milestones)) return null;
  const progress = getPlanProgress(planProgressKey(plan));
  return {
    weeksDone: plan.milestones.filter(m => progress[m.week]).length,
    weeksTotal: plan.milestones.length,
  };
}
