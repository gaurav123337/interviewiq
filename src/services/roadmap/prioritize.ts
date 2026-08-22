/* Priority + progress assignment — assigns P0/P1/P2 to every phase topic */

import type { CareerGoal, SavedSession, SkillProfile } from "../../types";
import { companyById, levelById } from "../../data"
import { tokenize } from "../../engine/scoring";
import { buildPhases, type Phase, type PhaseTopic } from "./phases";
import { buildSignals } from "./signals"
import type { Priority, RoadmapTopic, TopicProgress } from "./types";

/** Most-missed key points from recent low-scoring sessions (same idea as planner weak topics). */
function weakTopics(sessions: SavedSession[], fieldId: string): string[] {
  const counts = new Map<string, number>();
  for (const s of sessions.filter(x => x.meta.fieldId === fieldId).slice(-10)) {
    for (const a of s.answers) {
      if (a.pct >= 0.55) continue;
      const kps = a.missed?.length ? a.missed : a.q.kp;
      for (const kp of kps) counts.set(kp, (counts.get(kp) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k]) => k);
}

function tokensOf(label: string): Set<string> {
  return new Set(tokenize(label).filter(w => w.length > 2));
}

function overlaps(a: string, b: string): boolean {
  const ta = tokensOf(a);
  const tb = tokensOf(b);
  if (!ta.size || !tb.size) return false;
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

/** Assigns P0/P1/P2 and progress to every phase topic, driven by the gap signals. */
export function prioritize(goal: CareerGoal, profile: SkillProfile | null, sessions: SavedSession[]): { phases: Phase[]; topics: RoadmapTopic[] } {
  const signals = buildSignals(goal, profile, sessions);
  const company = companyById(goal.companyId);
  const targetFocus = levelById(goal.targetLevel).focus.split(",").map(s => s.trim());
  const weak = weakTopics(sessions, goal.fieldId);
  const selfOf = (label: string) => signals.self[label] ?? 2; // unknown → conservative
  const measuredOf = (label: string) => signals.measured[label];
  const sessionOf = (label: string) => signals.session[label];

  const phases = buildPhases(goal);
  const topics: RoadmapTopic[] = [];
  const byLabel = new Map<string, RoadmapTopic>();

  const add = (t: PhaseTopic, phase: Phase, idx: number) => {
    const label = t.label;
    const self = selfOf(label);
    const measured = measuredOf(label);
    const sess = sessionOf(label);

    /* base priority by source — measured/session data beats self-report */
    let priority: Priority = "P1";
    const cov = measured ?? sess;
    if (phase.id === "field") {
      priority = cov !== undefined && cov >= 0.8 ? "P2"
        : cov !== undefined && cov < 0.6 ? "P0"
        : self < 3 ? "P0" : "P1";
    } else if (phase.id === "company") {
      const isStack = company.stack.includes(label);
      priority = isStack && (self < 3 || (measured !== undefined && measured < 0.6)) ? "P0" : isStack ? "P1" : "P2";
    } else if (phase.id === "foundations") {
      priority = self < 3 ? "P0" : "P1";
    } else if (phase.id === "jd") {
      priority = "P0"; // the posting's own requirements are must-know
    } else if (phase.id === "behavioral") {
      priority = "P1";
    } else {
      priority = "P2";
    }
    /* target-level focus terms are must-know */
    if (targetFocus.some(f => f === label || overlaps(f, label)) && phase.id !== "exec") priority = "P0";
    /* session weak topics promote one tier */
    if (weak.some(kp => overlaps(kp, label))) {
      priority = priority === "P2" ? "P1" : "P0";
    }

    /* progress */
    let progress: TopicProgress = "new";
    if (cov !== undefined && cov >= 0.8) progress = "mastered";
    else if (self < 3 || (cov !== undefined && cov < 0.6)) progress = "learning";

    const statusNote =
      measured !== undefined && measured >= 0.8 ? `You're at ${Math.round(measured * 100)}% here — review only`
      : measured !== undefined && measured < 0.6 ? `Gap detected — diagnostic shows ${Math.round(measured * 100)}%`
      : sess !== undefined && sess >= 0.8 ? `Your sessions average ${Math.round(sess * 100)}% — review only`
      : weak.some(kp => overlaps(kp, label)) ? "Missed recently — prioritize this"
      : undefined;

    const topic: RoadmapTopic = {
      id: `${phase.id}-${idx}`,
      label,
      priority,
      phase: phase.id,
      estHours: 0,
      progress,
      info: undefined as any, // will be resolved by buildRoadmap
      practice: t.practice,
      statusNote
    };
    topics.push(topic);
    byLabel.set(label, topic);
  };

  phases.forEach((phase, pi) => {
    phase.topics.forEach((t, ti) => add(t, phase, ti));
    void pi;
  });

  return { phases, topics };
}
