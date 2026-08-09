/* Career roadmap engine — pure functions, fully testable (mirrors planner.ts).
   Turns a target role + duration + skill profile into a phased, priority-ranked,
   week-by-week plan that adapts to the diagnostic result and session history. */

import type { CareerGoal, LevelId, QA, SavedAnswer, SavedSession, SkillProfile } from "../types";
import {
  BEHAVIORAL, CEO_POOL, CTO_POOL, GENERAL_COMPANY, LEVEL_INDEX,
  SYSTEM_DESIGN, companyById, fieldById, levelById
} from "../data";
import { getTopicInfo, type TopicInfo } from "../data/resources";
import { relatesToSkill, tokenize } from "../engine/scoring";
import { getProfile, goalFingerprint, getProgress, saveProgress, type RoadmapProgress } from "./goal";
import { STORAGE_KEYS, storageGet } from "./storage";

export type Priority = "P0" | "P1" | "P2";
export type TopicProgress = "new" | "learning" | "mastered";
export type WeekStatus = "passed" | "current" | "upcoming" | "done";

export interface RoadmapTopic {
  id: string;
  label: string;
  priority: Priority;
  phase: string;
  estHours: number;
  progress: TopicProgress;
  info: TopicInfo;
  /** A question to practice (pool-derived topics). */
  practice?: QA;
  statusNote?: string;
  /** Checked off by the user (progress tracking). */
  done?: boolean;
}

export interface RoadmapWeek {
  week: number;
  start: string;
  end: string;
  phase: string;
  phaseLabel: string;
  goal: string;
  topics: RoadmapTopic[];
  status: WeekStatus;
  totalHours: number;
}

export interface Roadmap {
  goal: CareerGoal;
  weeks: RoadmapWeek[];
  gapLevels: number;
  measuredLevel: LevelId | null;
  source: "diagnostic" | "self";
  summary: string;
}

const DAY = 86_400_000;
const MIN_WEEKS = 2;
const MAX_WEEKS = 26;

const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmtDate = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const todayIso = () => fmtDate(new Date());

/* ------------------------------------------------------------------ */
/* Skill signals                                                       */
/* ------------------------------------------------------------------ */

interface Signals {
  self: Record<string, number>; // skill label → self 0..5
  measured: Record<string, number>; // skill label → diagnostic coverage 0..1
  session: Record<string, number>; // skill label → session coverage 0..1
}

function sessionSkillCoverage(sessions: SavedSession[], fieldId: string, skill: string): number | null {
  const rel = sessions
    .filter(s => s.meta.fieldId === fieldId)
    .flatMap(s => s.answers)
    .filter(a => relatesToSkill(skill, a.q.q, ...(a.q.kp ?? [])));
  if (!rel.length) return null;
  return rel.reduce((sum, a) => sum + a.pct, 0) / rel.length;
}

function buildSignals(goal: CareerGoal, profile: SkillProfile | null, sessions: SavedSession[]): Signals {
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

/* ------------------------------------------------------------------ */
/* Phases                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Priority + progress                                                 */
/* ------------------------------------------------------------------ */

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
      info: getTopicInfo(label, t.pool),
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

/* ------------------------------------------------------------------ */
/* Week allocation                                                     */
/* ------------------------------------------------------------------ */

/** Splits `total` weeks across phases by weight — each phase ≥ 1 week when feasible, never more than `total`.
    Floors first, then hands the remaining weeks to the phases with the largest fractional parts. */
export function allocateWeeks(total: number, phases: Phase[]): number[] {
  const sum = phases.reduce((s, p) => s + p.weight, 0);
  const raw = phases.map(p => (total * p.weight) / sum);
  const min = total >= phases.length ? 1 : 0;
  const alloc = raw.map(r => Math.max(min, Math.floor(r)));
  let remaining = total - alloc.reduce((s, n) => s + n, 0);
  if (remaining > 0) {
    const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remaining; k++) alloc[order[k % order.length].i] += 1;
  }
  return alloc;
}

/** Builds the full week-by-week roadmap, adapted to profile + history. */
export function buildRoadmap(goal: CareerGoal, profile: SkillProfile | null, sessions: SavedSession[] = []): Roadmap {
  const today = parseDate(todayIso());
  const end = parseDate(goal.targetDate);
  const spanDays = Math.max(1, Math.round((end.getTime() - today.getTime()) / DAY));
  const totalWeeks = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.ceil(spanDays / 7)));
  const { phases, topics } = prioritize(goal, profile, sessions);
  const usedPhases = phases.filter(p => topics.some(t => t.phase === p.id));
  /* every phase gets at least one week — clamp the total up if the duration is very short */
  const effectiveWeeks = Math.min(MAX_WEEKS, Math.max(totalWeeks, usedPhases.length));
  const alloc = allocateWeeks(effectiveWeeks, usedPhases);

  /* round-robin: topics of each phase spread across that phase's weeks (balanced, no empty weeks) */
  const weeks: RoadmapWeek[] = [];
  let weekNo = 0;
  const scale = Math.max(1, goal.hoursPerWeek / 5);
  const todayI = todayIso();

  usedPhases.forEach((phase, pi) => {
    const phaseTopics = topics.filter(t => t.phase === phase.id);
    const nWeeks = alloc[pi];
    const shells: RoadmapWeek[] = [];
    for (let w = 0; w < nWeeks; w++) {
      weekNo++;
      const startIso = fmtDate(new Date(today.getTime() + (weekNo - 1) * 7 * DAY));
      const endIso = fmtDate(new Date(parseDate(startIso).getTime() + 6 * DAY));
      const status: WeekStatus = endIso < todayI ? "passed" : startIso <= todayI && todayI <= endIso ? "current" : "upcoming";
      shells.push({
        week: weekNo, start: startIso, end: endIso,
        phase: phase.id, phaseLabel: phase.label, goal: phase.goal,
        topics: [], status, totalHours: goal.hoursPerWeek
      });
    }
    phaseTopics.forEach((t, ti) => {
      t.estHours = +(baseHours(t.priority) * scale).toFixed(1);
      shells[ti % nWeeks].topics.push(t);
    });
    weeks.push(...shells);
  });

  const measuredLevel = profile?.diagnostic?.level ?? null;
  const gapLevels = LEVEL_INDEX[goal.targetLevel] - LEVEL_INDEX[measuredLevel ?? goal.currentLevel];
  const source: "diagnostic" | "self" = measuredLevel ? "diagnostic" : "self";
  const summary =
    `${measuredLevel ? `Diagnostic: you're at ${levelById(measuredLevel).name} ` : `Starting from ${levelById(goal.currentLevel).name} `}` +
    `→ ${levelById(goal.targetLevel).name} · ${effectiveWeeks} weeks · ${goal.hoursPerWeek}h/wk`;

  return { goal, weeks, gapLevels, measuredLevel, source, summary };
}

function baseHours(p: Priority): number {
  return p === "P0" ? 3.5 : p === "P1" ? 2.25 : 1.25;
}

/* ------------------------------------------------------------------ */
/* Progress tracking                                                   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Practice → progress feedback loop                                   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Export (markdown / print)                                           */
/* ------------------------------------------------------------------ */

const PRIORITY_ICON: Record<Priority, string> = { P0: "🔴", P1: "🟡", P2: "🟢" };

/** Renders the roadmap as portable markdown (weeks, priorities, resources). */
export function exportRoadmapMarkdown(roadmap: Roadmap): string {
  const g = roadmap.goal;
  const company = companyById(g.companyId);
  const field = fieldById(g.fieldId);
  const lines: string[] = [];
  lines.push(`# 🧭 InterviewIQ Career Roadmap`);
  lines.push(``);
  lines.push(`**${levelById(g.currentLevel).name} → ${levelById(g.targetLevel).name}** · ${field?.name ?? ""}${company.id !== GENERAL_COMPANY.id ? ` · ${company.name}` : ""} · target ${g.targetDate} · ${g.hoursPerWeek}h/week`);
  lines.push(``);
  lines.push(`> ${roadmap.summary}`);
  if (g.jdKeywords?.length) lines.push(`> 📋 Tailored from a job description — ${g.jdKeywords.length} keyword topics.`);
  lines.push(``);

  const all = roadmap.weeks.flatMap(w => w.topics);
  const done = all.filter(t => t.done).length;
  const p0 = all.filter(t => t.priority === "P0" && !t.done).length;
  lines.push(`## Progress`);
  lines.push(`- ${done}/${all.length} topics done · ${p0} P0 remaining · ${roadmap.weeks.filter(w => w.status === "done").length}/${roadmap.weeks.length} weeks done`);
  lines.push(``);

  for (const w of roadmap.weeks) {
    const badge = w.status === "done" ? "✅ " : w.status === "current" ? "🔥 " : "";
    lines.push(`## ${badge}Week ${w.week} — ${w.phaseLabel} (${w.start} → ${w.end})`);
    lines.push(`> ${w.goal}`);
    lines.push(``);
    for (const t of w.topics) {
      const mark = t.done ? "- [x]" : "- [ ]";
      const res = t.info.links.map(l => `[${l.label}](${l.url})`).join(" · ");
      lines.push(`${mark} ${PRIORITY_ICON[t.priority]} **${t.label}** (~${t.estHours}h)${t.statusNote ? ` — ${t.statusNote}` : ""}`);
      lines.push(`    ${t.info.primer}`);
      if (res) lines.push(`    Resources: ${res}`);
    }
    lines.push(``);
  }

  const gp = roadmap.weeks.flatMap(w => w.topics).filter(t => t.practice);
  if (gp.length) {
    lines.push(`## Practice questions`);
    for (const t of gp.slice(0, 12)) {
      if (t.practice) lines.push(`- **${t.label}** — ${t.practice.q}`);
    }
    lines.push(``);
  }
  lines.push(`---`);
  lines.push(`Generated by InterviewIQ · ${new Date().toISOString().slice(0, 10)}`);
  return lines.join("\n");
}

/** Downloads the roadmap as a .md file. */
export function downloadRoadmapMarkdown(roadmap: Roadmap): void {
  const md = exportRoadmapMarkdown(roadmap);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `interviewiq-roadmap-${roadmap.goal.targetDate || "plan"}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
