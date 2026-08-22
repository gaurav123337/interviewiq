/* Week allocation and roadmap building */

import type { CareerGoal, SavedSession, SkillProfile } from "../../types";
import { LEVEL_INDEX, levelById } from "../../data";
import { getTopicInfo } from "../../data/resources";
import { prioritize } from "./prioritize";
import type { Priority, Roadmap, RoadmapWeek, WeekStatus } from "./types";
import { DAY, MAX_WEEKS, MIN_WEEKS, fmtDate, parseDate, todayIso } from "./types";

export function baseHours(p: Priority): number {
  return p === "P0" ? 3.5 : p === "P1" ? 2.25 : 1.25;
}

/** Splits `total` weeks across phases by weight — each phase ≥ 1 week when feasible, never more than `total`.
    Floors first, then hands the remaining weeks to the phases with the largest fractional parts. */
export function allocateWeeks(total: number, phases: { weight: number }[]): number[] {
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

  /* resolve topic info (getTopicInfo) */
  for (const t of topics) {
    t.info = getTopicInfo(t.label, undefined);
  }

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
