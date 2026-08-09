export type LevelId = "junior" | "mid" | "senior" | "staff" | "principal" | "cto" | "ceo";

export type View = "onboard" | "interview" | "results" | "drill" | "bank" | "history" | "settings";

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
  mode: "standard" | "journey";
  timing: "none" | "relaxed" | "strict";
  voice: boolean;
}

export interface SavedAnswer {
  q: SessionQuestion;
  user: string;
  score: number;
  pct: number;
}

export interface SavedSession {
  id: string;
  date: number;
  meta: SessionMeta;
  config: Config;
  agg: { score: number; pct: number; grade: string };
  answers: SavedAnswer[];
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
