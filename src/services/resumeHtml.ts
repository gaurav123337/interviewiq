/* Designed, brandable resume — renders the same profile/job/match data as a
   styled one-pager (inline CSS, system fonts, indigo accent, print-friendly),
   then hands it to the browser's print dialog so the user can "Save as PDF".
   Dependency-free: no canvas, no PDF lib — the browser does the rendering. */

import type { CareerProfile, JobMatch, JobPosting } from "../types";
import { buildResume } from "./applyKit";
import { parseResume, resumeToHtml, type ResumeDocument } from "./resumeParser";

const ACCENT = "#4f46e5";

/** A brandable accent override — future-proof seam for per-company branding. */
export interface ResumeBrand {
  accent?: string;
  fontFamily?: string;
}

/** Parse the plain-text resume template into sections for styled rendering.
    Now delegates to the robust resumeParser for real-world formats. */
export function parseResumeSections(text: string): { header: string[]; sections: { title: string; items: string[] }[] } {
  const doc = parseResume(text);
  const header = [doc.contact.name, [doc.contact.email, doc.contact.phone, doc.contact.linkedin].filter(Boolean).join(' · ')].filter(Boolean);
  const sections: { title: string; items: string[] }[] = [];

  if (doc.summary) sections.push({ title: 'Summary', items: [doc.summary] });
  if (doc.skills.length) sections.push({ title: 'Skills', items: doc.skills });
  for (const exp of doc.experience) {
    const title = [exp.title, exp.company].filter(Boolean).join(' — ') || 'Experience';
    sections.push({ title, items: exp.bullets });
  }
  for (const edu of doc.education) {
    const title = [edu.degree, edu.school].filter(Boolean).join(' — ') || 'Education';
    sections.push({ title, items: edu.details });
  }
  for (const section of doc.otherSections) {
    sections.push({ title: section.title, items: section.content });
  }

  return { header, sections };
}

export function buildResumeHtml(
  profile: CareerProfile,
  job: JobPosting,
  match: JobMatch | null,
  brand: ResumeBrand = {},
  textOverride?: string
): string {
  const accent = brand.accent ?? ACCENT;
  const text = textOverride ?? buildResume(profile, job, match);

  // Use the robust parser to handle any resume format
  const doc: ResumeDocument = parseResume(text);

  // Render using the normalized document
  return resumeToHtml(doc, accent);
}

/** Opens the designed resume in a new window and triggers the print dialog
    ("Save as PDF"). Returns false if the popup was blocked. */
export function openResumePrint(profile: CareerProfile, job: JobPosting, match: JobMatch | null, brand: ResumeBrand = {}, textOverride?: string): boolean {
  const html = buildResumeHtml(profile, job, match, brand, textOverride);
  const w = window.open("", "_blank", "width=860,height=1100");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* popup closed */ } }, 350);
  return true;
}
