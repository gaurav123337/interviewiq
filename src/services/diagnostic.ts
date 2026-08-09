/* Skill-gap diagnostic: a short level-ramped quiz that measures the user's real level,
   so the roadmap's gap analysis is data-driven (with self-assessment as the fallback). */

import type { Answer, Cat, DiagnosticResult, LevelId, QA, Session, SessionQuestion } from "../types";
import { CTO_POOL, CEO_POOL, fieldById, levelById } from "../data";
import { pickN } from "../engine/random";
import { relatesToSkill } from "../engine/scoring";
import { getProfile, saveProfile } from "./goal";

export const RAMP: LevelId[] = ["junior", "mid", "senior", "staff", "principal", "cto", "ceo"];
/** A level counts as reached when its questions average at least this coverage. */
export const PASS_BAR = 0.6;

const CAT: Record<Cat, { label: string; color: string }> = {
  company: { label: "Company Fit", color: "#6366f1" },
  field: { label: "Technical", color: "#22d3ee" },
  behavioral: { label: "Behavioral", color: "#34d399" },
  sysdesign: { label: "System Design", color: "#a855f7" },
  cto: { label: "Leadership", color: "#fbbf24" },
  ceo: { label: "Business", color: "#fb7185" }
};

/** Builds the diagnostic quiz: ~2 field questions per level ramping from junior up to the
    target level, plus one above it to find the ceiling (executive pools for CTO/CEO targets). */
export function composeDiagnostic(fieldId: string, targetLevel: LevelId): Session {
  const field = fieldById(fieldId);
  const targetIdx = RAMP.indexOf(targetLevel);
  const list: SessionQuestion[] = [];
  const seen = new Set<string>();
  const add = (q: QA | undefined, cat: Cat, qlevel: LevelId, src: string) => {
    if (!q || seen.has(q.q)) return;
    seen.add(q.q);
    list.push({ ...q, cat, catLabel: CAT[cat].label, catColor: CAT[cat].color, level: qlevel, src });
  };

  /* ramp field questions: 2 per level up to the target, 1 above it (the ceiling probe).
     Executive targets use 1 per level so the pool probes fit in the 10-question cap. */
  const perLevel = targetIdx >= 5 ? 1 : 2;
  const topField = Math.min(targetIdx + 1, 4); // field banks top out at principal
  for (let i = 0; i <= topField; i++) {
    const lvl = RAMP[i];
    const n = i <= targetIdx ? perLevel : 1;
    pickN(field?.questions[lvl] ?? [], n).forEach(q => add(q, "field", lvl, "field"));
  }
  /* executive targets probe the leadership/business pools as the ceiling */
  if (targetIdx >= 5) pickN(CTO_POOL, 2).forEach(q => add(q, "cto", "cto", "cto"));
  if (targetIdx === 6) pickN(CEO_POOL, 3).forEach(q => add(q, "ceo", "ceo", "ceo"));

  return {
    questions: list.slice(0, 10),
    meta: {
      field: field?.name ?? "General", fieldId: field?.id ?? "general",
      company: "Skill Diagnostic", companyId: "diagnostic",
      level: levelById(targetLevel).name, levelId: targetLevel,
      mode: "diagnostic"
    }
  };
}

/** Measures the level: the highest rung whose answers averaged ≥ PASS_BAR coverage. */
export function scoreDiagnostic(answers: Answer[], fieldId: string): DiagnosticResult {
  const byLevel: Partial<Record<LevelId, number[]>> = {};
  for (const a of answers) {
    (byLevel[a.q.level] ??= []).push(a.fb.pct);
  }
  let measured: LevelId = "junior";
  for (const lvl of RAMP) {
    const arr = byLevel[lvl];
    if (!arr?.length) continue;
    const avg = arr.reduce((s, p) => s + p, 0) / arr.length;
    if (avg >= PASS_BAR) measured = lvl;
    else break; // first rung below the bar = the ceiling
  }
  const all = answers.map(a => a.fb.pct);
  return {
    date: Date.now(),
    level: measured,
    pct: all.length ? all.reduce((s, p) => s + p, 0) / all.length : 0,
    perSkill: skillCoverage(answers, fieldId)
  };
}

/** Per-skill coverage 0..1 from the answers whose question/key points relate to the skill (unknown = omitted). */
export function skillCoverage(answers: Answer[], fieldId: string): Record<string, number> {
  const field = fieldById(fieldId);
  const out: Record<string, number> = {};
  for (const skill of field?.skills ?? []) {
    const related = answers.filter(a => relatesToSkill(skill, a.q.q, ...(a.q.kp ?? [])));
    if (!related.length) continue;
    out[skill] = related.reduce((s, a) => s + a.fb.pct, 0) / related.length;
  }
  return out;
}

/** Persists the diagnostic result into the skill profile (merge, keeps self-assessment). */
export function persistDiagnostic(answers: Answer[], fieldId: string): DiagnosticResult {
  const res = scoreDiagnostic(answers, fieldId);
  const profile = getProfile();
  if (profile) {
    saveProfile({
      ...profile,
      diagnostic: res,
      skippedAt: undefined,
      skills: profile.skills.map(s => ({ ...s, measured: res.perSkill[s.skill] ?? s.measured }))
    });
  }
  return res;
}
