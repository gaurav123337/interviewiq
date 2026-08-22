/* Phases — builds the ordered phase list for a career goal */

import type { CareerGoal, LevelId, QA } from "../../types";
import {
  BEHAVIORAL, CEO_POOL, CTO_POOL, GENERAL_COMPANY, LEVEL_INDEX,
  SYSTEM_DESIGN, companyById, fieldById, levelById
} from "../../data";

export type PhaseId = "foundations" | "field" | "jd" | "company" | "sysdesign" | "behavioral" | "exec";

export interface PhaseTopic {
  label: string;
  pool?: "sysdesign" | "behavioral" | "cto" | "ceo";
  practice?: QA;
}

export interface Phase {
  id: PhaseId;
  label: string;
  goal: string;
  weight: number;
  topics: PhaseTopic[];
}

function qaAsTopic(q: QA, pool: PhaseTopic["pool"]): PhaseTopic {
  return { label: q.q, pool, practice: q };
}

/** Builds the phase list for a goal: foundations → field → company → design → behavioral → exec. */
export function buildPhases(goal: CareerGoal): Phase[] {
  const field = fieldById(goal.fieldId);
  const company = companyById(goal.companyId);
  const targetIdx = LEVEL_INDEX[goal.targetLevel];
  const currentIdx = LEVEL_INDEX[goal.currentLevel];
  const gap = targetIdx - currentIdx;
  const phases: Phase[] = [];

  phases.push({
    id: "foundations",
    label: "Foundations",
    goal: `Reinforce ${levelById(goal.currentLevel).name.toLowerCase()} fundamentals: core concepts, clean answers, common traps.`,
    weight: 20,
    topics: levelById(goal.currentLevel).focus.split(",").map(s => ({ label: s.trim() })).filter(t => t.label)
  });

  phases.push({
    id: "field",
    label: `Field deep dive — ${field?.name ?? "your field"}`,
    goal: `Go deep on ${field?.name ?? "your field"} bread-and-butter: aim for tradeoff-rich answers at ${levelById(goal.targetLevel).name.toLowerCase()} depth.`,
    weight: 28,
    topics: (field?.skills ?? []).map(s => ({ label: s }))
  });

  if (goal.jdKeywords?.length) {
    phases.push({
      id: "jd",
      label: "Job description fit",
      goal: `Tailored to your posting: ${goal.jdKeywords.slice(0, 4).join(" · ")}${goal.jdKeywords.length > 4 ? "…" : ""}`,
      weight: 14,
      topics: goal.jdKeywords.slice(0, 10).map(k => ({ label: k }))
    });
  }

  if (company.id !== GENERAL_COMPANY.id) {
    phases.push({
      id: "company",
      label: `Company fit — ${company.name}`,
      goal: `Study ${company.name}'s stack and culture values; practice answering in their style (${company.style.slice(0, 90)}…).`,
      weight: 16,
      topics: [
        ...company.stack.map(s => ({ label: s })),
        ...company.values.map(v => ({ label: v }))
      ]
    });
  }

  if (targetIdx >= 3) { // staff+
    const tiers: LevelId[] = targetIdx === 3 ? ["senior", "staff"] : targetIdx === 4 ? ["staff", "principal"] : ["principal"];
    const topics: PhaseTopic[] = [];
    for (const tier of tiers) {
      (SYSTEM_DESIGN[tier] ?? []).forEach(q => topics.push(qaAsTopic(q, "sysdesign")));
    }
    phases.push({
      id: "sysdesign",
      label: "System design",
      goal: "Practice system design: requirements → scale → components → data → tradeoffs → failure modes.",
      weight: 14,
      topics: topics.slice(0, 6)
    });
  }

  if (targetIdx >= 1 || gap >= 1) {
    phases.push({
      id: "behavioral",
      label: "Behavioral & leadership",
      goal: "Polish STAR stories: situation, task, action, result — with measurable outcomes.",
      weight: 12,
      topics: BEHAVIORAL.slice(0, 4).map(q => qaAsTopic(q, "behavioral"))
    });
  }

  if (targetIdx >= 5) { // cto / ceo
    const pool = goal.targetLevel === "ceo" ? CEO_POOL : CTO_POOL;
    const n = goal.targetLevel === "ceo" ? 6 : 4;
    phases.push({
      id: "exec",
      label: goal.targetLevel === "ceo" ? "Executive & business" : "Executive & leadership",
      goal: goal.targetLevel === "ceo"
        ? "Strategy, markets, fundraising and culture — every answer ties back to outcomes, risk and the people who execute."
        : "Org building, technical vision, budget and board communication — land answers in business terms.",
      weight: 12,
      topics: pool.slice(0, n).map(q => qaAsTopic(q, goal.targetLevel === "ceo" ? "ceo" : "cto"))
    });
  }

  return phases;
}
