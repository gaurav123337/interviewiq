import type { LevelId } from "../types";
import { COMPANIES, FIELDS } from "../data";
import { tokenize } from "../engine";

export interface JdResult {
  fieldId: string;
  levelId: LevelId;
  companyId: string | null;
  /** High-frequency, meaningful terms from the posting, used for relevance picking. */
  keywords: string[];
}

/* Words too generic to be useful for relevance picking. */
const JD_STOP = new Set(
  ("experience work working team role job ability skills skill including etc company will must required require requirements years year plus strong good excellent knowledge understanding design develop building using within across provide help etc candidate candidates applicants apply join us about our their your what who when where why how should could would may might able opportunity position responsibilities responsible report reports direct directly manage managing manager team's collaborate collaboration cross-functional cross functional stakeholders stakeholder product roadmap roadmaps growth mission values culture remote hybrid onsite office salary benefits equity stock options relocation visa sponsorship full-time full time permanent contract freelance contractor interns internship graduate graduate new technology technologies technical engineering engineer engineers software platform systems system service services application applications customer customers user users users data database databases api apis frontend frontend backend backend product code coding quality qa testing tests test performance scalable scale reliability reliable secure security authentication authorization privacy compliance cloud infrastructure infra server servers client clients browser browsers mobile ios android web internet network networking machine learning ml ai artificial intelligence gen generative llm large language models agile scrum jira sprint standup meeting meetings email slack chat communication written verbal storytelling documentation docs write writing english fluent proficiency good great nice fun friendly fast-paced fast paced dynamic startup established company industry field areas domain specific general modern latest cutting edge build ship launch deliver drive own lead leadership mentor mentoring coaching grow growth learn learning opportunity chance opportunity growth trajectory potential impact ownership autonomy flexibility flexible").split(" ")
);

/* Explicit level signals, checked in priority order (title beats years). */
const LEVEL_PRIORITY: { id: LevelId; words: string[] }[] = [
  { id: "ceo", words: ["chief executive officer", "chief operating officer", "co-founder", "cofounder"] },
  { id: "cto", words: ["chief technology officer", "vp of engineering", "vice president of engineering", "vice president engineering", "head of engineering", "director of engineering"] },
  { id: "principal", words: ["principal engineer", "distinguished engineer", "principal software", "principal"] },
  { id: "staff", words: ["staff engineer", "staff software"] },
  { id: "senior", words: ["senior", "lead engineer", "lead software", "lead developer"] },
  { id: "junior", words: ["junior", "entry-level", "entry level", "new grad", "new graduate", "fresher", "internship", "intern"] }
];

function detectLevel(lower: string, jdTokens: Set<string>): LevelId {
  if (jdTokens.has("ceo")) return "ceo";
  if (jdTokens.has("cto")) return "cto";
  for (const l of LEVEL_PRIORITY) {
    if (l.words.some(w => lower.includes(w))) return l.id;
  }
  /* years of experience as a fallback heuristic */
  const yrs = lower.match(/(\d{1,2})\s*\+?\s*(?:years|yrs)\b/);
  if (yrs) {
    const y = Number(yrs[1]);
    if (y >= 10) return "principal";
    if (y >= 7) return "staff";
    if (y >= 4) return "senior";
    if (y >= 2) return "mid";
    return "junior";
  }
  return "mid";
}

function detectField(jdTokens: Set<string>): string {
  let best = "frontend";
  let bestScore = 0;
  for (const f of FIELDS) {
    let score = 0;
    for (const skill of f.skills) {
      const st = tokenize(skill);
      if (st.length) score += st.filter(t => jdTokens.has(t)).length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = f.id;
    }
  }
  return best;
}

function detectCompany(jdTokens: Set<string>): string | null {
  /* exact company name in the text is the strongest signal */
  for (const c of COMPANIES) {
    const nameTokens = tokenize(c.name);
    if (nameTokens.length && nameTokens.every(t => jdTokens.has(t))) return c.id;
  }
  /* otherwise match on distinctive stack terms */
  let best: string | null = null;
  let bestScore = 0;
  for (const c of COMPANIES) {
    const hits = c.stack.filter(s => s.split(/\s+/).some(word => jdTokens.has(word.toLowerCase()))).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = c.id;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Parses a job description into a structured profile for session tailoring. */
export function analyzeJd(text: string): JdResult {
  const lower = text.toLowerCase();
  const jdTokens = new Set(tokenize(text).filter(w => !JD_STOP.has(w)));
  return {
    levelId: detectLevel(lower, jdTokens),
    fieldId: detectField(jdTokens),
    companyId: detectCompany(jdTokens),
    /* most frequent meaningful tokens, capped for stable relevance scoring */
    keywords: [...jdTokens].slice(0, 40)
  };
}
