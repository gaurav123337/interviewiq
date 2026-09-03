/* Study Planner — the day-level *view* of the Career Roadmap.
 *
 * Item 13 (consolidate planning surfaces): the Roadmap is the one planning
 * engine. This module no longer builds its own parallel phase plan; it explodes
 * the roadmap's weeks into a near-term day-by-day list. One goal, one phase
 * engine, one progress namespace — the Planner is purely a projection. */

import type { Roadmap } from "./roadmap";
import type { PhaseId } from "./roadmap/phases";
import { fmtDate, parseDate, todayIso } from "./roadmap/types";

export type PlanKind = "foundations" | "field" | "company" | "design" | "behavioral" | "mock";

export type PlanStatus = "done" | "today" | "upcoming" | "skipped";

export interface PlanDay {
  day: number;
  date: string;
  title: string;
  focus: string;
  kind: PlanKind;
  status: PlanStatus;
  /** The specific topics to practice that day (drives the session keywords). */
  topics?: string[];
  /** Why the day was skipped or repurposed. */
  note?: string;
}

export interface PlanFromRoadmapOpts {
  /** ISO date (yyyy-mm-dd) of "today" — overridable for tests. */
  today?: string;
  /** Cap the near-term window so the day list stays actionable (default 28). */
  maxDays?: number;
  /** Append a closing full-mock day (default true) — the "ends with you ready" promise. */
  capstone?: boolean;
}

/** Maps a roadmap phase to a Planner day kind (Planner has no `jd`/`sysdesign`/`exec` kinds). */
const KIND_FROM_PHASE: Record<PhaseId, PlanKind> = {
  foundations: "foundations",
  field: "field",
  jd: "field",
  company: "company",
  sysdesign: "design",
  behavioral: "behavioral",
  exec: "behavioral"
};

const DEFAULT_MAX_DAYS = 28;

/**
 * Explodes a roadmap into a near-term day-by-day plan.
 *
 * Each week is a contiguous 7-day block (`buildRoadmap` sets `week1.start ===
 * today`, so there is no leading gap). A week's topics are spread round-robin
 * across its days (`topic[i] → day i % 7`), mirroring allocation's own
 * `shells[ti % n]` idiom, so the 7-day union of a week's day-topics equals that
 * week's topics with no empty-day special-casing. The list is then windowed to
 * `maxDays` and clipped at `goal.targetDate`, and (by default) a closing mock
 * day is appended so the plan still "ends with you ready" like the old one.
 */
export function planFromRoadmap(roadmap: Roadmap, opts: PlanFromRoadmapOpts = {}): PlanDay[] {
  const today = opts.today ?? todayIso();
  const maxDays = Math.max(1, opts.maxDays ?? DEFAULT_MAX_DAYS);
  const capstone = opts.capstone ?? true;
  const targetDate = roadmap.goal.targetDate;

  /* 1) explode weeks → one entry per (week, day-offset), in date order.
        Step by CALENDAR days (`new Date(y, m, d + off)`), not by adding `off * DAY`
        ms: across a DST fall-back a +24h ms step lands at 23:00 of the *same* local
        day, which `fmtDate` re-emits as a duplicate date (silently dropping the
        week's 7th calendar day). The date-component constructor normalizes at local
        midnight and is DST-safe. */
  const exploded: { date: string; phase: PhaseId; phaseLabel: string; goal: string; topics: string[] }[] = [];
  for (const week of roadmap.weeks) {
    const base = parseDate(week.start);
    const labels = week.topics.map(t => t.label);
    for (let off = 0; off < 7; off++) {
      const date = fmtDate(new Date(base.getFullYear(), base.getMonth(), base.getDate() + off));
      /* round-robin: this day owns labels at indices off, off+7, off+14, … */
      const dayTopics = labels.filter((_, i) => i % 7 === off);
      exploded.push({ date, phase: week.phase as PhaseId, phaseLabel: week.phaseLabel, goal: week.goal, topics: dayTopics });
    }
  }

  /* 2) window: from today, at most maxDays, tail clipped at the interview date */
  const windowed = exploded
    .filter(e => e.date >= today && e.date <= targetDate)
    .slice(0, maxDays);

  const days: PlanDay[] = windowed.map((e, i) => {
    const focus = e.topics.length ? e.topics.join(" · ") : e.goal;
    return {
      day: i + 1,
      date: e.date,
      kind: KIND_FROM_PHASE[e.phase] ?? "field",
      title: e.phaseLabel,
      focus,
      topics: e.topics,
      status: (e.date < today ? "skipped" : e.date === today ? "today" : "upcoming") as PlanStatus
    };
  });

  /* 3) closing mock — dated at the last windowed day (already clipped ≤ target),
        or today when the window is empty (a target-date-is-today edge). */
  if (capstone) {
    const last = days[days.length - 1];
    const mockDate = last ? last.date : (today <= targetDate ? today : targetDate);
    days.push({
      day: days.length + 1,
      date: mockDate,
      kind: "mock",
      title: "Full mock interview",
      focus: "Simulate the real thing end-to-end, timed, with a hire/no-hire verdict.",
      topics: [],
      status: (mockDate < today ? "skipped" : mockDate === today ? "today" : "upcoming") as PlanStatus
    });
  }

  return days;
}
