/* ATS keyword coverage — score + drill-down against posting skills */

import type { JobPosting } from "../../types";
import { jdKeywords } from "./jdMining";

/** Normalize a skill name into lowercase word tokens (for matching). */
function skillTokens(skill: string): string[] {
  return skill.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean);
}

/** What fraction of the posting's required skills appear verbatim in the document. */
export function atsCoverage(text: string, job: JobPosting): { score: number; found: string[]; missing: string[] } {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const missing: string[] = [];
  for (const skill of job.skills) {
    const tokens = skillTokens(skill);
    const present = tokens.length > 0 && tokens.every(t => lower.includes(t));
    (present ? found : missing).push(skill);
  }
  const total = job.skills.length;
  return { score: total ? Math.round((found.length / total) * 100) : 0, found, missing };
}

export interface AtsKeywordRow {
  keyword: string;
  present: boolean;
  source: "skill" | "jd";
}

export interface AtsDrilldown {
  skills: AtsKeywordRow[];
  jd: AtsKeywordRow[];
  score: number;
  found: string[];
  missing: string[];
  hits: number;
  total: number;
}

/** Per-keyword ATS drill-down: every required skill AND the posting's own
    mined vocabulary matched against the generated document. */
export function atsKeywordDrilldown(text: string, job: JobPosting): AtsDrilldown {
  const lower = text.toLowerCase();
  const present = (k: string) => {
    const tokens = k.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean).map(t => t.replace(/^\.+|\.+$/g, ""));
    return tokens.length > 0 && tokens.every(t => t.length >= 2 && lower.includes(t));
  };
  const skills: AtsKeywordRow[] = job.skills.map(s => ({ keyword: s, present: present(s), source: "skill" }));
  const jd: AtsKeywordRow[] = jdKeywords(job, 12)
    .filter(k => !job.skills.some(s => skillTokens(s).includes(k)))
    .map(k => ({ keyword: k, present: present(k), source: "jd" }));
  const found = skills.filter(r => r.present).map(r => r.keyword);
  const missing = skills.filter(r => !r.present).map(r => r.keyword);
  const rows = [...skills, ...jd];
  return {
    skills,
    jd,
    score: skills.length ? Math.round((found.length / skills.length) * 100) : 0,
    found,
    missing,
    hits: rows.filter(r => r.present).length,
    total: rows.length
  };
}
