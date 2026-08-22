/* Roadmap service — barrel re-export (zero import changes for consumers) */

export type { Priority, TopicProgress, WeekStatus, RoadmapTopic, RoadmapWeek, Roadmap } from "./types";
export type { PhaseId, PhaseTopic, Phase } from "./phases";
export type { Signals } from "./signals";

export { DAY, MIN_WEEKS, MAX_WEEKS, parseDate, fmtDate, todayIso } from "./types";
export { buildPhases } from "./phases";
export { sessionSkillCoverage, buildSignals } from "./signals";
export { prioritize } from "./prioritize";
export { baseHours, allocateWeeks, buildRoadmap } from "./allocation";
export { applyProgress, applySessionToProgress } from "./progress";
export { exportRoadmapMarkdown, downloadRoadmapMarkdown } from "./export";
