/* Roadmap types, constants, and date utilities */

import type { CareerGoal, LevelId, QA } from "../../types";
import { type TopicInfo } from "../../data/resources";

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

export const DAY = 86_400_000;
export const MIN_WEEKS = 2;
export const MAX_WEEKS = 26;

export const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const fmtDate = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
export const todayIso = () => fmtDate(new Date());
