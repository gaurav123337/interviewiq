import type { LevelId } from "../types";
import { companyById, fieldById, levelById } from "../data";

export type PlanKind = "foundations" | "field" | "company" | "design" | "behavioral" | "mock";

export interface PlanDay {
  day: number;
  date: string;
  title: string;
  focus: string;
  kind: PlanKind;
}

export interface PlanInput {
  levelId: LevelId;
  fieldId: string;
  companyId: string;
  /** ISO date (yyyy-mm-dd) of the interview. */
  targetDate: string;
  /** ISO date of "today" — overridable for tests. */
  today?: string;
}

const DAY = 86_400_000;

const parseDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const fmtDate = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

const todayIso = () => {
  const n = new Date();
  return fmtDate(n);
};

/** Allocates each day of a plan to a phase (foundations → field → company → design → behavioral → mocks). */
function kindFor(t: number): PlanKind {
  if (t < 0.25) return "foundations";
  if (t < 0.5) return "field";
  if (t < 0.65) return "company";
  if (t < 0.78) return "design";
  if (t < 0.88) return "behavioral";
  return "mock";
}

function titleFor(kind: PlanKind, fieldName: string, companyName: string): string {
  switch (kind) {
    case "foundations": return `Foundations — ${fieldName}`;
    case "field": return `Field deep dive — ${fieldName}`;
    case "company": return `Company fit — ${companyName}`;
    case "design": return "System design";
    case "behavioral": return "Behavioral & leadership";
    case "mock": return "Full mock interview";
  }
}

function focusFor(kind: PlanKind, levelName: string): string {
  switch (kind) {
    case "foundations": return `Reinforce ${levelName.toLowerCase()} fundamentals: core concepts, clean answers, common traps.`;
    case "field": return "Go deep on your field's bread-and-butter questions — aim for tradeoff-rich answers.";
    case "company": return "Study their stack and culture values; practice answering in their style.";
    case "design": return "Practice system design: requirements → scale → components → tradeoffs.";
    case "behavioral": return "Polish STAR stories: situation, task, action, result — plus leadership scenarios.";
    case "mock": return "Simulate the real thing end-to-end, timed, with a hire/no-hire verdict.";
  }
}

/** Builds a day-by-day prep plan from today (or `today`) up to the interview date (clamped to 3–28 days). */
export function buildPlan(input: PlanInput): PlanDay[] {
  const start = parseDate(input.today ?? todayIso());
  const end = parseDate(input.targetDate);
  const spanMs = end.getTime() - start.getTime();
  const days = Math.max(3, Math.min(28, Math.round(spanMs / DAY) + 1));
  const fieldName = fieldById(input.fieldId)?.name ?? "your field";
  const companyName = companyById(input.companyId).name;
  const levelName = levelById(input.levelId).name;

  return Array.from({ length: days }, (_, i) => {
    const kind = kindFor(i / days);
    return {
      day: i + 1,
      date: fmtDate(new Date(start.getTime() + i * DAY)),
      kind,
      title: titleFor(kind, fieldName, companyName),
      focus: focusFor(kind, levelName)
    };
  });
}
