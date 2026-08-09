import type { LevelId, SavedSession } from "../types";
import { companyById, fieldById, levelById } from "../data";

export type PlanKind = "foundations" | "field" | "company" | "design" | "behavioral" | "mock";

export type PlanStatus = "done" | "today" | "upcoming" | "skipped";

export interface PlanDay {
  day: number;
  date: string;
  title: string;
  focus: string;
  kind: PlanKind;
  status: PlanStatus;
  /** This day drills the key points you missed in earlier sessions. */
  weak?: boolean;
  /** The specific weak topics to practice (for weak days). */
  topics?: string[];
  /** Why the day was skipped or repurposed. */
  note?: string;
}

export interface PlanInput {
  levelId: LevelId;
  fieldId: string;
  companyId: string;
  /** ISO date (yyyy-mm-dd) of the interview. */
  targetDate: string;
  /** ISO date of "today" — overridable for tests. */
  today?: string;
  /** Completed sessions — when provided, the plan adapts to actual progress. */
  sessions?: SavedSession[];
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

/* local calendar date of a timestamp — keeps comparisons consistent across timezones */
const dayOf = (t: number) => {
  const d = new Date(t);
  return fmtDate(d);
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

/** Builds the static day-by-day prep plan from today (or `today`) up to the interview date (clamped to 3–28 days). */
export function buildPlan(input: PlanInput): PlanDay[] {
  const start = parseDate(input.today ?? todayIso());
  const end = parseDate(input.targetDate);
  const spanMs = end.getTime() - start.getTime();
  const days = Math.max(3, Math.min(28, Math.round(spanMs / DAY) + 1));
  const today = input.today ?? todayIso();
  const fieldName = fieldById(input.fieldId)?.name ?? "your field";
  const companyName = companyById(input.companyId).name;
  const levelName = levelById(input.levelId).name;

  return Array.from({ length: days }, (_, i) => {
    const kind = kindFor(i / days);
    const date = fmtDate(new Date(start.getTime() + i * DAY));
    return {
      day: i + 1,
      date,
      kind,
      title: titleFor(kind, fieldName, companyName),
      focus: focusFor(kind, levelName),
      status: (date < today ? "skipped" : date === today ? "today" : "upcoming") as PlanStatus
    };
  });
}

/** Which category a phase's questions fall under, for mastery measurement. */
function catFor(kind: PlanKind): string | null {
  switch (kind) {
    case "foundations":
    case "field":
      return "Technical";
    case "company":
      return "Company Fit";
    case "design":
      return "System Design";
    case "behavioral":
      return "Behavioral";
    default:
      return null;
  }
}

/** Turns a repurposed day into a weak-topic drill. */
function weakDay(d: PlanDay, topics: string[], fieldId: string): PlanDay {
  const fieldName = fieldById(fieldId)?.name ?? "your field";
  return {
    ...d,
    kind: "field",
    title: "Weak topics drill",
    focus: `Review what you missed in ${fieldName}: ${topics.slice(0, 4).join(" · ")}${topics.length > 4 ? "…" : ""}`,
    weak: true,
    topics: topics.slice(0, 6),
    note: "Rescheduled from your recent sessions",
    status: "upcoming"
  };
}

/**
 * Adapts a plan to actual progress:
 *  - days with a completed session are marked done;
 *  - upcoming phases you've already mastered (avg ≥ 80% in that category) are skipped;
 *  - up to two freed slots become weak-topic drills built from key points you missed.
 */
export function adaptPlan(input: PlanInput): PlanDay[] {
  const base = buildPlan(input);
  const sessions = input.sessions ?? [];
  const today = input.today ?? todayIso();
  const fieldSessions = sessions.filter(s => s.meta.fieldId === input.fieldId);

  const sessionsOn = (date: string) => sessions.some(s => dayOf(s.date) === date);

  /* average coverage in one category across this field's history (null when none) */
  const mastery = (label: string): number | null => {
    const ans = fieldSessions.flatMap(s => s.answers).filter(a => a.q.catLabel === label);
    if (!ans.length) return null;
    return ans.reduce((sum, a) => sum + a.pct, 0) / ans.length;
  };

  /* most-missed key points from recent low-scoring answers (falls back to question key points) */
  const weakTopics = (): string[] => {
    const counts = new Map<string, number>();
    for (const s of fieldSessions.slice(-10)) {
      for (const a of s.answers) {
        if (a.pct >= 0.55) continue;
        const kps = a.missed?.length ? a.missed : a.q.kp;
        for (const kp of kps) counts.set(kp, (counts.get(kp) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k]) => k);
  };

  /* 1) mark days done / skipped from completion and mastery */
  const days = base.map(d => {
    if (sessionsOn(d.date)) return { ...d, status: "done" as PlanStatus };
    if (d.date < today) return { ...d, status: "skipped" as PlanStatus, note: "No session recorded that day" };
    const cat = catFor(d.kind);
    const m = cat ? mastery(cat) : null;
    if (d.status === "upcoming" && m !== null && m >= 0.8) {
      return { ...d, status: "skipped" as PlanStatus, note: `You're at ${Math.round(m * 100)}% here — skip` };
    }
    return d;
  });

  /* 2) repurpose up to two freed slots (skipped days, falling back to the first non-mock upcoming day) into weak-topic drills */
  const topics = weakTopics();
  if (!topics.length) return days;

  let used = 0;
  let fallbackUsed = false;
  return days.map(d => {
    if (used >= 2 || d.date <= today || d.weak) return d;
    const isSkipped = d.status === "skipped";
    const isFallback = !fallbackUsed && d.status === "upcoming" && d.kind !== "mock";
    if (!isSkipped && !isFallback) return d;
    if (isFallback) fallbackUsed = true;
    used++;
    return weakDay(d, topics, input.fieldId);
  });
}
