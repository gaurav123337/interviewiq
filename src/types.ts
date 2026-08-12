export type LevelId = "junior" | "mid" | "senior" | "staff" | "principal" | "cto" | "ceo";

export type View = "landing" | "onboard" | "interview" | "results" | "drill" | "bank" | "history" | "settings" | "planner" | "roadmap" | "playground" | "admin" | "progress" | "team" | "account" | "legal" | "jobs";

export interface Level {
  id: LevelId;
  name: string;
  icon: string;
  years: string;
  blurb: string;
  focus: string;
}

/** One interview question with model answer and scoring key points */
export interface QA {
  q: string;
  a: string;
  kp: string[];
}

export interface Field {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  skills: string[];
  questions: Partial<Record<LevelId, QA[]>>;
}

export interface Company {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  hq: string;
  difficulty: number;
  stack: string[];
  values: string[];
  style: string;
  sample: QA[];
}

export type Cat = "company" | "field" | "behavioral" | "sysdesign" | "cto" | "ceo";

export interface SessionQuestion extends QA {
  cat: Cat;
  catLabel: string;
  catColor: string;
  level: LevelId;
  src: string;
}

export interface SessionMeta {
  field: string;
  fieldId: string;
  company: string;
  companyId: string;
  level: string;
  levelId: LevelId;
  mode: Config["mode"];
}

export interface Session {
  questions: SessionQuestion[];
  meta: SessionMeta;
}

export interface Feedback {
  score: number;
  pct: number;
  covered: string[];
  missed: string[];
  strengths: string[];
  gaps: string[];
  words: number;
}

export interface Answer {
  q: SessionQuestion;
  user: string;
  fb: Feedback;
}

export interface Config {
  count: number;
  mode: "standard" | "journey" | "mock" | "diagnostic" | "behavioral";
  timing: "none" | "relaxed" | "strict";
  voice: boolean;
}

export interface SavedAnswer {
  q: SessionQuestion;
  user: string;
  score: number;
  pct: number;
  /** Key points the answer missed — powers weak-topic follow-ups and the adaptive planner. */
  missed?: string[];
}

export interface SavedSession {
  id: string;
  date: number;
  meta: SessionMeta;
  config: Config;
  agg: { score: number; pct: number; grade: string };
  answers: SavedAnswer[];
}

/* ---------------- Career roadmap (target role + skill gap) ---------------- */

/** Where the user is, where they're going, and by when — drives the roadmap. */
export interface CareerGoal {
  currentLevel: LevelId;
  targetLevel: LevelId;
  fieldId: string;
  companyId: string; // "general" when none
  targetDate: string; // yyyy-mm-dd
  hoursPerWeek: number;
  createdAt: number;
  /** Raw job description when the goal was built from a posting. */
  jd?: string;
  /** High-frequency JD terms, added to the roadmap as tailored topics. */
  jdKeywords?: string[];
}

/** One skill with the self-assessed level (0-5) and optional diagnostic measurement (0-5). */
export interface SkillRating {
  skill: string;
  self: number; // 0-5 (novice → strong)
  measured?: number; // 0-5 from the diagnostic, when taken
}

/** Outcome of the optional skill-gap diagnostic quiz. */
export interface DiagnosticResult {
  date: number;
  level: LevelId; // measured level (highest level averaged ≥ 60%)
  pct: number; // overall coverage
  perSkill: Record<string, number>; // skill → coverage 0..1
}

/** Persisted skill assessment: self-report always, diagnostic optional. */
export interface SkillProfile {
  goal: CareerGoal;
  skills: SkillRating[];
  diagnostic?: DiagnosticResult;
  skippedAt?: number; // set when the user skipped the diagnostic
}

/* ------------------------------------------------------------------ */
/* Jobs & career profile (Phase 1 — the apply-kit foundation)          */
/* ------------------------------------------------------------------ */

/** The user's professional profile — the single source of truth for the
    job matcher and, later, resume/cover-letter generation. */
export interface CareerProfile {
  headline: string;
  years: number;
  location: string;
  /** Prefers remote-only roles. */
  remote: boolean;
  workAuth: string;
  targetTitles: string[];
  /** Skill names the user claims (prefilled from the diagnostic/roadmap). */
  skills: string[];
  summary: string;
  updatedAt: number;
}

/** A job posting pulled from an ATS board (Greenhouse / Lever / Ashby). */
export interface JobPosting {
  /** Storage id — `${source}:${externalId}`. */
  id: string;
  source: string;
  externalId: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  description: string;
  url: string;
  /** Skills extracted from the description by the jobs-fetch function. */
  skills: string[];
  level: string | null;
  postedAt: string | null;
}

/** Match verdict tiers — the "good match or not" suggestion. */
export type MatchVerdict = "strong" | "good" | "moderate" | "stretch" | "no";

/** Result of matching a career profile against a job. */
export interface JobMatch {
  score: number;
  verdict: MatchVerdict;
  matched: string[];
  missing: string[];
  blockers: string[];
}

export interface CatStat {
  label: string;
  score: number;
  pct: number;
}

export interface Aggregate {
  score: number;
  pct: number;
  grade: string;
  cats: CatStat[];
}
