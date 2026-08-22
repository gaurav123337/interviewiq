/* Progress tracking — applies user progress and practice feedback to roadmaps */

import type { CareerGoal, SavedAnswer, SavedSession } from "../../types";
import { relatesToSkill } from "../../engine/scoring";
import { getProfile, goalFingerprint, getProgress, saveProgress, type RoadmapProgress } from "../goal";
import { STORAGE_KEYS, storageGet } from "../storage";
import { buildRoadmap } from "./allocation";
import type { Roadmap, RoadmapTopic } from "./types";

/** Applies user progress to a roadmap:
     - marks checked-off topics as done;
     - a fully-done current week pulls up to 2 pending topics forward (never idle);
     - fully-done (or emptied) weeks are marked done. */
export function applyProgress(roadmap: Roadmap, progress: RoadmapProgress): Roadmap {
  if (progress.fingerprint !== goalFingerprint(roadmap.goal)) return roadmap; // stale goal
  const done = new Set(progress.completed);
  for (const w of roadmap.weeks) {
    for (const t of w.topics) t.done = done.has(t.id);
  }

  /* fully-done current week: pull pending topics from later weeks so you're never idle */
  for (const w of roadmap.weeks) {
    if (w.status !== "current") continue;
    if (!w.topics.length || !w.topics.every(t => t.done)) continue;
    const remaining = roadmap.weeks.flatMap(o => o.topics).filter(t => !t.done);
    const need = Math.min(2, remaining.length);
    if (!need) break;
    const pulled: RoadmapTopic[] = [];
    for (const o of roadmap.weeks) {
      if (o.week <= w.week) continue;
      for (const t of o.topics) {
        if (!t.done && !pulled.includes(t)) {
          pulled.push(t);
          if (pulled.length >= need) break;
        }
      }
      if (pulled.length >= need) break;
    }
    for (const t of pulled) {
      for (const o of roadmap.weeks) if (o !== w) o.topics = o.topics.filter(x => x !== t);
    }
    w.topics = [...w.topics, ...pulled];
    break;
  }

  /* fully-done or emptied weeks are marked done */
  for (const w of roadmap.weeks) {
    if (w.status === "passed") continue;
    if (!w.topics.length || w.topics.every(t => t.done)) w.status = "done";
  }
  return roadmap;
}

/** Marks roadmap topics done when the just-finished session answered their
    questions well (≥70% coverage) — practice feeds progress back so the plan
    re-balances automatically. No-op when there's no goal or nothing matched. */
export function applySessionToProgress(goal: CareerGoal, answers: SavedAnswer[]): void {
  if (!goal || !answers.length) return;
  const profile = getProfile();
  if (!profile) return;
  const sessions = storageGet<SavedSession[]>(STORAGE_KEYS.sessions, []);
  let roadmap: Roadmap;
  try {
    roadmap = buildRoadmap(goal, profile, sessions);
  } catch {
    return; // malformed goal/profile — never block a session save
  }
  const current = getProgress();
  const fp = goalFingerprint(goal);
  const completed = new Set(current.fingerprint === fp ? current.completed : []);
  let changed = false;
  for (const w of roadmap.weeks) {
    for (const t of w.topics) {
      if (completed.has(t.id)) continue;
      const hit = answers.some(a => a.pct >= 0.7 && (t.label === a.q.q || relatesToSkill(t.label, a.q.q, a.q.a)));
      if (hit) { completed.add(t.id); changed = true; }
    }
  }
  if (changed) {
    saveProgress({
      fingerprint: fp,
      completed: [...completed],
      completedAt: {
        ...(current.fingerprint === fp ? current.completedAt : {}),
        ...Object.fromEntries([...completed].filter(id => !(current.fingerprint === fp && id in current.completedAt)).map(id => [id, Date.now()]))
      },
      updatedAt: Date.now()
    });
  }
}
