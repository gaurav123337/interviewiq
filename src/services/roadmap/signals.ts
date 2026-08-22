/* Skill signals — self-report, diagnostic, and session coverage */

import type { CareerGoal, SavedSession, SkillProfile } from "../../types";
import { fieldById } from "../../data";
import { relatesToSkill } from "../../engine/scoring";

export interface Signals {
  self: Record<string, number>; // skill label → self 0..5
  measured: Record<string, number>; // skill label → diagnostic coverage 0..1
  session: Record<string, number>; // skill label → session coverage 0..1
}

export function sessionSkillCoverage(sessions: SavedSession[], fieldId: string, skill: string): number | null {
  const rel = sessions
    .filter(s => s.meta.fieldId === fieldId)
    .flatMap(s => s.answers)
    .filter(a => relatesToSkill(skill, a.q.q, ...(a.q.kp ?? [])));
  if (!rel.length) return null;
  return rel.reduce((sum, a) => sum + a.pct, 0) / rel.length;
}

export function buildSignals(goal: CareerGoal, profile: SkillProfile | null, sessions: SavedSession[]): Signals {
  const self: Record<string, number> = {};
  const measured: Record<string, number> = {};
  for (const s of profile?.skills ?? []) self[s.skill] = s.self;
  for (const [k, v] of Object.entries(profile?.diagnostic?.perSkill ?? {})) measured[k] = v;
  const session: Record<string, number> = {};
  const field = fieldById(goal.fieldId);
  for (const skill of field?.skills ?? []) {
    const cov = sessionSkillCoverage(sessions, goal.fieldId, skill);
    if (cov !== null) session[skill] = cov;
  }
  return { self, measured, session };
}
