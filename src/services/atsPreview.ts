/* ATS parse preview — simulates what an applicant-tracking parser would
   extract from a resume export. Pure + testable: sections, contact lines,
   keyword presence, and the same coverage math as the ATS chip. */

import type { JobPosting } from "../types";
import { parseResumeSections } from "./resumeHtml";

export interface AtsParseResult {
  /** Section titles detected (SUMMARY, SKILLS, HIGHLIGHTS…). */
  sections: string[];
  /** Header lines (name/headline/contact) — what a parser uses for identity. */
  header: string[];
  /** Likely email / phone / LinkedIn found (or empty). */
  contact: { email: string | null; phone: string | null; linkedin: string | null };
  /** Total words — parsers often reject files under ~50 words. */
  wordCount: number;
  /** Format quirks that hurt parse accuracy. */
  flags: string[];
  /** Keyword coverage against the posting (same math as the ATS chip). */
  coverage: { score: number; found: string[]; missing: string[] };
}

export function atsParsePreview(text: string, job: JobPosting): AtsParseResult {
  const { header, sections } = parseResumeSections(text);
  const flags: string[] = [];
  if (!text.trim()) flags.push("Empty document — nothing to parse");

  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? null;
  /* lenient — handles +91 98765 43210 and +1 (415) 555-0123 */
  const phone = text.match(/\+?\d[\d\s().-]{7,}\d/)?.[0]?.trim() ?? null;
  const linkedin = /linkedin\.com\/[^\s)]+/.test(text) ? "present" : null;

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > 0 && words < 50) flags.push(`Only ${words} words — under the ~50-word floor many ATS require`);
  if (words > 900) flags.push(`${words} words — longer than a typical one-pager; parser may truncate`);

  /* tables/columns hurt ATS reading — our exports are single-column by design */
  if (/table|column-count|flex/.test(text)) flags.push("Multi-column layout detected — parsers may read out of order");
  if (/\u25b8|➤|→/.test(text)) flags.push("Non-standard bullets present — parsers generally handle them, but keep it simple");

  /* coverage — same token logic as the ATS chip in the kit modal */
  const lower = text.toLowerCase();
  const found: string[] = [];
  const missing: string[] = [];
  for (const skill of job.skills) {
    const tokens = skill.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean);
    const present = tokens.length > 0 && tokens.every(t => lower.includes(t));
    (present ? found : missing).push(skill);
  }
  const total = job.skills.length;

  return {
    sections: sections.map(s => s.title),
    header,
    contact: { email, phone, linkedin },
    wordCount: words,
    flags,
    coverage: { score: total ? Math.round((found.length / total) * 100) : 0, found, missing }
  };
}
