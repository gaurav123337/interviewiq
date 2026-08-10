/* Resume import — extracts skills, experience, and suggested field/level
   from a pasted text or uploaded PDF/txt, then pre-fills the goal wizard. */

import { FIELDS } from "../data";
import type { LevelId, SkillRating } from "../types";

export interface ResumeResult {
  fieldId: string;
  levelId: LevelId;
  skills: SkillRating[];
  /** Extracted experience snippets (years, tech, roles). */
  snippets: string[];
}

/** Weighted field detection: count keyword matches per field's skills. */
const FIELD_KEYWORDS: Record<string, string[]> = {
  frontend: ["react", "vue", "angular", "css", "typescript", "html", "ui", "ux", "javascript", "frontend", "webpack", "accessibility", "a11y", "responsive", "sass", "tailwind"],
  backend: ["api", "rest", "microservice", "database", "sql", "postgres", "mongodb", "cache", "distributed", "go", "golang", "java", "spring", "node", "backend", "server", "kubernetes", "docker"],
  fullstack: ["fullstack", "full stack", "frontend", "backend", "react", "node", "api", "database", "typescript"],
  devops: ["devops", "ci/cd", "kubernetes", "docker", "terraform", "ansible", "aws", "gcp", "azure", "infrastructure", "monitoring", "prometheus", "grafana", "pipeline", "deployment"],
  data: ["data science", "machine learning", "ml", "ai", "python", "tensorflow", "pytorch", "statistics", "analytics", "sql", "pandas", "numpy", "data engineering", "etl", "spark", "hadoop"],
  security: ["security", "cybersecurity", "penetration", "threat", "vulnerability", "auth", "oauth", "encryption", "firewall", "compliance", "zero trust", "siem", "incident response"],
  mobile: ["mobile", "android", "ios", "swift", "kotlin", "react native", "flutter", "dart", "app development", "mobile dev"],
  product: ["product management", "product strategy", "roadmap", "stakeholder", "user research", "a/b testing", "metrics", "kpi", "agile", "scrum", "backlog", "user stories"]
};

/** Years of experience keywords → level mapping. */
const SENIORITY_PATTERNS: [RegExp, LevelId][] = [
  [/(?:cto|chief technology officer|vp of engineering|director of engineering)/i, "cto"],
  [/(?:principal|distinguished|fellow|chief architect)/i, "principal"],
  [/(?:staff|lead|tech lead|architect)/i, "staff"],
  [/(?:senior|sr\.?|lead|5\+|6\+|7\+|8\+) (?:years|yr)/i, "senior"],
  [/(?:senior|sr\.?)/i, "senior"],
  [/(?:mid.?level|midlevel|2\+|3\+|4\+)/i, "mid"],
  [/(?:junior|jr\.?|entry.level|graduate|intern|0\+|1\+)/i, "junior"]
];

/** Word counts for field detection. */
function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((sum, kw) => sum + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0);
}

/** Extract skill self-ratings from skill keywords found in the text. */
function extractSkills(text: string, fieldId: string): SkillRating[] {
  const field = FIELDS.find(f => f.id === fieldId);
  if (!field) return [];
  return field.skills.map(skill => {
    const lower = text.toLowerCase();
    const found = lower.includes(skill.toLowerCase().slice(0, 8));
    return { skill, self: found ? 3 : 1 };
  });
}

/** Extract snippets relevant to experience. */
function extractSnippets(text: string): string[] {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 5);
  const snippets: string[] = [];
  for (const line of lines) {
    if (/(?:years|yr|experience|engineer|developer|architect|lead|senior|manager|tech lead)/i.test(line) && line.length < 200) {
      snippets.push(line);
    }
  }
  return snippets.slice(0, 8);
}

/** Main entry point — analyze resume text and return a suggestion. */
export function analyzeResume(text: string): ResumeResult {
  const lower = text.toLowerCase();

  /* field detection: best match by keyword density */
  let bestField = "backend";
  let bestScore = 0;
  for (const [id, kws] of Object.entries(FIELD_KEYWORDS)) {
    const score = countMatches(lower, kws);
    if (score > bestScore) { bestScore = score; bestField = id; }
  }

  /* level detection: match patterns in order of seniority (highest match wins) */
  let levelId: LevelId = "mid";
  for (const [pattern, lvl] of SENIORITY_PATTERNS) {
    if (pattern.test(lower)) { levelId = lvl; break; }
  }

  /* skills */
  const skills = extractSkills(lower, bestField);
  const snippets = extractSnippets(text);

  return { fieldId: bestField, levelId, skills, snippets };
}