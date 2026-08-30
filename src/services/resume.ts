/* Resume import — extracts skills, experience, and suggested field/level
   from a pasted text or uploaded PDF/txt, then pre-fills the goal wizard.

   Also hosts the resume → career profile pipeline: the uploaded resume is
   turned into a CareerProfile (skills, headline, years, target titles) that
   the job matcher (services/jobs.ts) consumes, so match percentages are
   literally based on the resume. Offline-first; nothing leaves the device. */

import { FIELDS, LEVELS } from "../data";
import type { CareerProfile, LevelId, SkillRating, UploadedResume } from "../types";
import { getCloudState, getSupabaseClient } from "./cloud";
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "./storage";
import { normalizeResume } from "./resumeParser";

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

/** Executive titles are only a level when they appear as a standalone title
    line ("CTO" on its own), never from prose — "worked with the CTO" or
    "Reporting to the CEO" must not promote a senior engineer to a 15-year
    executive and skew the years fallback / match verdicts. */
const EXEC_TITLE_RE = /^(cto|chief technology officer|ceo|chief executive officer|vp of engineering|vice president of engineering|director of engineering)$/i;

/** Years of experience keywords → level mapping (executives handled above). */
const SENIORITY_PATTERNS: [RegExp, LevelId][] = [
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

  /* level detection: a standalone executive title line wins; otherwise match
     patterns in order of seniority (highest match wins) */
  let levelId: LevelId = "mid";
  const titleLine = text.split("\n").map(l => l.trim()).find(l => l.length > 0 && l.length < 50 && EXEC_TITLE_RE.test(l));
  if (titleLine) levelId = "cto";
  else for (const [pattern, lvl] of SENIORITY_PATTERNS) {
    if (pattern.test(lower)) { levelId = lvl; break; }
  }

  /* skills */
  const skills = extractSkills(lower, bestField);
  const snippets = extractSnippets(text);

  return { fieldId: bestField, levelId, skills, snippets };
}

/* ------------------------------------------------------------------ */
/* Resume → career profile (the job matcher's input)                   */
/* ------------------------------------------------------------------ */

/** Common tech skills that appear in resumes but aren't field labels. */
const EXTRA_SKILLS = [
  "GraphQL", "REST APIs", "gRPC", "AWS", "GCP", "Azure", "Docker", "Kubernetes",
  "Terraform", "Ansible", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Kafka",
  "Elasticsearch", "Golang", "Rust", "Java", "Python", "Node.js", "Express",
  "Next.js", "Vue", "Svelte", "Tailwind CSS", "Sass", "CI/CD", "Jenkins",
  "GitHub Actions", "GitLab CI", "Spark", "Airflow", "Pandas", "NumPy",
  "TensorFlow", "PyTorch", "Kotlin", "Swift", "Flutter", "React Native",
  "Redux", "Webpack", "Vite", "Jest", "Cypress", "Playwright", "Django",
  "Flask", "Spring", "SQL", "NoSQL", "Microservices", "Serverless", "Lambda",
  "Prometheus", "Grafana", "Bash", "Linux", "Agile", "Scrum", "Figma", "Storybook"
];

/** All extractable skill names: every field's display labels + curated extras. */
const ALL_SKILL_LABELS: string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of FIELDS) {
    for (const s of f.skills) {
      if (!seen.has(s)) { seen.add(s); out.push(s); }
    }
  }
  for (const s of EXTRA_SKILLS) {
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
})();

/** Word tokens of the resume text (lowercased, punctuation stripped). */
function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9+#]/g, " ").split(/\s+/).filter(Boolean));
}

/** Is any meaningful word of the skill label present in the resume's tokens?
    Plural-tolerant ("databases" ≈ "database") so labels match real prose. */
function labelMentioned(label: string, tokens: Set<string>): boolean {
  const words = label.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);
  return words.some(w => {
    if (tokens.has(w)) return true;
    if (w.length > 3 && w.endsWith("s")) {
      const singular = w.slice(0, -1);
      if (tokens.has(singular)) return true;
    }
    return false;
  });
}

/** Skills the resume mentions, as stable display labels the matcher knows. */
export function extractSkillNames(text: string): string[] {
  const tokens = tokenSet(text);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of ALL_SKILL_LABELS) {
    if (labelMentioned(label, tokens)) {
      /* de-dup near-identical labels (e.g. "Node.js" vs "Go · Java · Node · Python") */
      const key = label.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!seen.has(key)) { seen.add(key); out.push(label); }
    }
  }
  return out.slice(0, 35);
}

/** Years of experience: explicit "N+ years" wins, else a "since YYYY" anchor,
    else a seniority-based fallback. */
function extractYears(text: string, levelId: LevelId): number {
  const lower = text.toLowerCase();
  const matches = [...lower.matchAll(/(\d{1,2})\s*\+?\s*(?:years|yrs)\b/g)].map(m => Number(m[1]));
  if (matches.length) return Math.max(...matches);
  const since = lower.match(/since\s+(19|20)\d{2}/);
  if (since) return Math.max(0, new Date().getFullYear() - Number(since[0].match(/\d{4}/)));
  const fallback: Record<LevelId, number> = { junior: 1, mid: 3, senior: 6, staff: 8, principal: 12, cto: 15, ceo: 15 };
  return fallback[levelId] ?? 3;
}

const ROLE_RE = /(engineer|developer|architect|designer|scientist|analyst|manager|consultant|intern)/i;
const ROLE_HINT_RE = /(senior|staff|principal|lead|junior|mid|frontend|front end|backend|back end|full.?stack|devops|data|mobile|security|software|product|cto|ceo|sre|qa|ios|android)/i;

/** Executive titles that, when jammed together with a role on one line, read
    as a single odd title ("CTO Frontend Engineer"). Split them so the
    headline shows both parts: "CTO / Frontend Engineer". Only bare exec
    titles (no "of X" — "Head of Engineering" and "VP of Engineering" are
    already clean) and only when a role phrase follows. */
const EXEC_HEADLINE_RE = /^(cto|ceo|coo|founder|co-founder)\b[\s,|]+([a-z][^|]*)$/i;

/** "CTO Frontend Engineer" → "CTO / Frontend Engineer" (keeps both parts). */
function normalizeExecHeadline(line: string): string {
  const m = line.match(EXEC_HEADLINE_RE);
  if (!m) return line;
  const exec = m[1].trim();
  const rest = m[2].trim();
  if (!ROLE_RE.test(rest) && !ROLE_HINT_RE.test(rest)) return line;
  const cap = (s: string) => s.replace(/(^|\s)([a-z])/g, (_, sp, c) => sp + c.toUpperCase());
  return `${exec} / ${cap(rest)}`;
}

/** Strip a company/date suffix off a role line ("Senior FE — Acme | 2019–24"). */
function cleanRoleLine(line: string): string {
  return line
    .replace(/[|–—-].*$/, "")
    .replace(/\s+at\s+.*$/i, "")
    .replace(/^[•·\-*\d.\s]+/, "")
    .trim();
}

/** Drop a leading name pair from a role line ("Gaurav Gupta  Frontend
    Architect" → "Frontend Architect"). Only treated as a name when neither
    word is a role/level word and a role word follows, so "Senior Frontend
    Engineer" and "Principal Software Architect" stay untouched. */
function stripNamePrefix(line: string): string {
  const m = line.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+(.+)$/);
  if (!m) return line;
  const a = m[1], b = m[2], rest = m[3];
  if (ROLE_HINT_RE.test(a) || ROLE_HINT_RE.test(b) || ROLE_RE.test(a) || ROLE_RE.test(b)) return line;
  if (!ROLE_RE.test(rest) && !ROLE_HINT_RE.test(rest)) return line;
  return rest.trim();
}

/** First role-looking line (resume header or most recent role) → headline. */
function extractHeadline(lines: string[], fieldName: string, levelName: string): string {
  const roleLines = lines.filter(l => ROLE_RE.test(l) && ROLE_HINT_RE.test(l) && l.length < 90);
  for (const line of roleLines) {
    const cleaned = normalizeExecHeadline(stripNamePrefix(cleanRoleLine(line)));
    if (cleaned.length > 3 && ROLE_RE.test(cleaned)) return cleaned;
  }
  return `${levelName} ${fieldName}`.trim();
}

/** Role-like lines → target titles (used for title-fit scoring). */
function extractTitles(lines: string[]): string[] {
  const titles: string[] = [];
  for (const line of lines) {
    if (!ROLE_RE.test(line)) continue;
    const cleaned = normalizeExecHeadline(stripNamePrefix(cleanRoleLine(line)));
    if (cleaned.length < 4 || cleaned.length > 60 || titles.includes(cleaned)) continue;
    titles.push(cleaned);
    if (titles.length >= 5) break;
  }
  return titles;
}

/** First few substantive lines (contact info filtered) → summary. */
function extractSummary(text: string): string {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 20 && !/^[|•\-*]/.test(l));
  const body = lines.filter(l =>
    !/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(l) &&
    !/^\+?\d[\d\s()-]{7,}$/.test(l) &&
    !/linkedin\.com/i.test(l) &&
    /* header lines that carry the owner's name + title ("Gaurav Gupta  Frontend
       Architect") are contact info, not summary prose */
    stripNamePrefix(l) === l
  );
  return body.slice(0, 3).join(" ").slice(0, 180);
}

/** Skills worth offering when a resume is uploaded: skills the user had
    before but this resume didn't re-mention (so a re-upload doesn't silently
    drop them), topped up with typical skills for the detected field. The
    user opts in — nothing is merged automatically. Pure + testable. */
export function suggestSkills(extracted: string[], prev: string[], fieldId: string): string[] {
  const out: string[] = [];
  const have = new Set(extracted.map(s => s.toLowerCase()));
  for (const s of prev) {
    if (!have.has(s.toLowerCase()) && !out.includes(s)) out.push(s);
  }
  const field = FIELDS.find(f => f.id === fieldId);
  for (const s of field?.skills ?? []) {
    if (have.has(s.toLowerCase()) || out.includes(s)) continue;
    out.push(s);
    if (out.length >= 8) break;
  }
  return out.slice(0, 10);
}

/** True when the stored profile carries more skills than the resume text
    extracts — i.e. it was uploaded before strict resume-based skills and a
    re-upload would tighten the chips. Pure + testable. */
export function profileHasStaleSkills(profile: CareerProfile, resumeText: string): boolean {
  return profile.skills.length > resumeToProfile(resumeText).skills.length;
}

/** Builds a CareerProfile from resume text — the matcher's input. */
export function resumeToProfile(text: string): CareerProfile {
  // Use the robust resume parser for structured extraction
  const normalized = normalizeResume(text);
  
  // Also run the existing analysis for field/level detection
  const r = analyzeResume(text);
  const fieldName = FIELDS.find(f => f.id === (normalized.field !== 'other' ? normalized.field : r.fieldId))?.name ?? "";
  const levelId = normalized.level !== 'mid' ? normalized.level as LevelId : r.levelId;
  const levelName = LEVELS.find(l => l.id === levelId)?.name ?? "";
  
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  /* Skills come from the normalized parser (individual tech keywords, not
     composite field labels). Headline / target titles / years stay on the
     exec-aware extractors below: they strip the owner's name, split
     "CTO Frontend Engineer" into "CTO / Frontend Engineer", and fall back to a
     seniority-based year estimate. The flat normalized parser drops all three
     (normalizeResume hardcodes 3 years and keeps the raw, unsplit title), which
     corrupts the seniority signal the company matcher scores on. */
  const allSkills = normalized.skills;
  const years = extractYears(text, levelId);
  const headline = extractHeadline(lines, fieldName, levelName);
  const targetTitles = extractTitles(lines);
  
  return {
    headline: headline || `${levelName} ${fieldName}`.trim(),
    years,
    location: normalized.name ? "" : "",
    remote: true,
    workAuth: "",
    targetTitles: targetTitles.length ? targetTitles : (fieldName ? [fieldName] : []),
    skills: allSkills.slice(0, 35),
    summary: extractSummary(text),
    updatedAt: Date.now()
  };
}

/* ------------------------------------------------------------------ */
/* Persistence — the uploaded resume stays on the device               */
/* ------------------------------------------------------------------ */

export function getUploadedResume(): UploadedResume | null {
  return storageGet<UploadedResume | null>(STORAGE_KEYS.resume, null);
}

export function saveUploadedResume(r: UploadedResume): void {
  const capped = { ...r, text: r.text.slice(0, 20000) };
  storageSet(STORAGE_KEYS.resume, capped);
  /* best-effort cloud backup — never blocks the UI */
  void saveUploadedResumeToCloud(capped);
}

export function clearUploadedResume(): void {
  storageRemove(STORAGE_KEYS.resume);
}

/* ------------------------------------------------------------------ */
/* Cloud backup (signed in) — same pattern as the career profile       */
/* ------------------------------------------------------------------ */

export async function loadUploadedResumeFromCloud(): Promise<UploadedResume | null> {
  const client = await getSupabaseClient();
  const user = getCloudState().user;
  if (!client || !user) return null;
  const { data, error } = await client.from("uploaded_resumes").select("data").eq("user_id", user.id).maybeSingle();
  if (error || !data) return null;
  return data.data as UploadedResume;
}

export async function saveUploadedResumeToCloud(r: UploadedResume): Promise<void> {
  const client = await getSupabaseClient();
  const user = getCloudState().user;
  if (!client || !user) return;
  await client.from("uploaded_resumes").upsert(
    { user_id: user.id, data: r, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
}
