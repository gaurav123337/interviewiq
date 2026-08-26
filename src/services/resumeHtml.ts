/* Designed, brandable resume — renders the same profile/job/match data as a
   styled one-pager (inline CSS, system fonts, indigo accent, print-friendly),
   then hands it to the browser's print dialog so the user can "Save as PDF".
   Dependency-free: no canvas, no PDF lib — the browser does the rendering. */

import type { CareerProfile, JobMatch, JobPosting } from "../types";
import { buildResume } from "./applyKit";

const ACCENT = "#4f46e5";
const INK = "#111827";
const MUT = "#6b7280";
const LINE = "#e5e7eb";

/** A brandable accent override — future-proof seam for per-company branding. */
export interface ResumeBrand {
  accent?: string;
  fontFamily?: string;
}

/** Parsed resume sections: the header block plus ALL-CAPS sections with items. */
export interface ResumeSections {
  header: string[];
  sections: { title: string; items: string[] }[];
}

/** Detect section headers in real-world resume formats. */
const SECTION_HEADER_RE = /^(?:[A-Z0-9 .•·+&#-]{3,}|(?:Professional |Core |Technical |Key |Work |Education|Experience|Summary|Skills|Competencies|Qualifications|Certifications|Projects|Achievements|Highlights|Responsibilities|Awards|Publications|Languages|Interests)[\w &/-]*)$/i;

/** Parse the plain-text resume template into sections for styled rendering. */
export function parseResumeSections(text: string): ResumeSections {
  const lines = text.split("\n");
  const header: string[] = [];
  const sections: { title: string; items: string[] }[] = [];
  let cur: { title: string; items: string[] } | null = null;
  
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    
    if (SECTION_HEADER_RE.test(t) && t.length < 60) {
      cur = { title: t, items: [] };
      sections.push(cur);
    } else if (cur) {
      cur.items.push(t);
    } else if (header.length < 4) {
      header.push(t);
    } else {
      header.push(t);
    }
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
  const font = brand.fontFamily ?? "'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif";
  const text = textOverride ?? buildResume(profile, job, match);
  const { header, sections } = parseResumeSections(text);

  const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Check if parser found meaningful sections
  const hasRealSections = sections.length > 0 && sections.some(s => s.items.length > 0);

  let body: string;
  
  if (hasRealSections) {
    // Structured rendering — parsed sections with headers and items
    const nameLine = header[0] || profile.headline || job.title;
    const contactLines = header.slice(1).join(" · ");
    const headerBlock = `
      <div class="header">
        <div class="name">${esc(nameLine)}</div>
        ${contactLines ? `<div class="sub">${esc(contactLines)}</div>` : ""}
      </div>`;
    body = headerBlock + sections.map(sec => {
      const items = sec.items.map(i => {
        const cleaned = i.replace(/^[•·\-*]\s*/, "");
        if (cleaned.length > 80 && !cleaned.includes("•")) {
          return `<p class="para">${esc(cleaned)}</p>`;
        }
        return `<li>${esc(cleaned)}</li>`;
      });
      const hasBullets = sec.items.some(i => /^[•·\-*]\s/.test(i));
      return `
        <section>
          <h2>${esc(sec.title)}</h2>
          ${hasBullets ? `<ul>${items.join("")}</ul>` : items.join("")}
        </section>`;
    }).join("");
  } else {
    // Fallback: render raw text as styled paragraphs (handles real-world resumes)
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    body = lines.map(line => {
      const isSectionLike = line.length < 60 && (
        line === line.toUpperCase() ||
        /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(line) ||
        /^(?:Professional|Core|Technical|Key|Work|Education|Experience|Summary|Skills|Competencies|Qualifications|Certifications|Projects|Achievements|Highlights)/i.test(line)
      );
      if (isSectionLike) {
        return `<h2>${esc(line)}</h2>`;
      }
      return `<p class="para">${esc(line)}</p>`;
    }).join("\n");
  }

  const meta = `${esc([profile.location, profile.workAuth].filter(Boolean).join(" · "))}`;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(profile.headline || job.title)} — ${esc(job.company)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${font}; color: ${INK}; background: #fff; line-height: 1.6; font-size: 14px; }
  .page { max-width: 800px; margin: 0 auto; padding: 48px 64px; }
  .header { border-bottom: 3px solid ${accent}; padding-bottom: 20px; margin-bottom: 28px; }
  .name { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; color: ${INK}; line-height: 1.2; }
  .sub { margin-top: 8px; font-size: 13px; color: ${MUT}; line-height: 1.4; }
  section { margin-bottom: 24px; }
  h2 { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
       color: ${accent}; border-bottom: 2px solid ${LINE}; padding-bottom: 6px; margin-bottom: 10px; }
  ul { list-style: none; }
  li { font-size: 13px; color: ${INK}; margin-bottom: 6px; padding-left: 16px; position: relative; line-height: 1.5; }
  li::before { content: "▸"; position: absolute; left: 0; color: ${accent}; font-size: 11px; top: 1px; }
  .para { font-size: 13px; color: ${INK}; margin-bottom: 6px; line-height: 1.5; }
  .meta { font-size: 12px; color: ${MUT}; margin-top: 16px; padding-top: 12px; border-top: 1px solid ${LINE}; }
  @media print {
    body { padding: 0; font-size: 10pt; }
    .page { padding: 24px 48px; max-width: 100%; }
    .name { font-size: 20pt; }
    h2 { font-size: 9pt; }
    li, .para { font-size: 10pt; }
  }
</style></head>
<body><div class="page">
  ${body}
  <div class="meta">Generated by InterviewIQ · tailored to ${esc(job.company)} · ${meta}</div>
</div>
</body></html>`;
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
