/* Normalized Resume Parser — handles any resume format and extracts
   structured data. The single source of truth for resume content.

   Pipeline: Raw text → Parse → Normalize → ResumeDocument
   ResumeDocument is used for: AI tailoring, PDF rendering, ATS scoring */

export interface ResumeContact {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  location: string;
  website: string;
  /** Any other contact lines we found */
  other: string[];
}

export interface ResumeSection {
  title: string;
  content: string[];
}

export interface ResumeExperience {
  title: string;
  company: string;
  location: string;
  dates: string;
  bullets: string[];
}

export interface ResumeEducation {
  degree: string;
  school: string;
  location: string;
  dates: string;
  details: string[];
}

/** Normalized resume — the single source of truth after parsing */
export interface ResumeDocument {
  contact: ResumeContact;
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  /** Sections we couldn't classify (certifications, projects, etc.) */
  otherSections: ResumeSection[];
  /** The original raw text, preserved for reference */
  rawText: string;
  /** Lines that were parsed (for debugging) */
  parsedLines: number;
}

/* ── Contact Info Detection ────────────────────────────────────────── */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/;
const LINKEDIN_RE = /linkedin\.com\/in\/[\w-]+/i;
const GITHUB_RE = /github\.com\/[\w-]+/i;


/* ── Section Header Detection ──────────────────────────────────────── */

/** Known section headers — case-insensitive matching */
const SECTION_ALIASES: Record<string, string> = {
  // Summary
  'summary': 'Summary', 'professional summary': 'Summary', 'profile': 'Summary',
  'about': 'Summary', 'about me': 'Summary', 'objective': 'Summary',
  'career objective': 'Summary', 'career summary': 'Summary',
  'professional profile': 'Summary', 'personal statement': 'Summary',
  // Experience
  'experience': 'Experience', 'work experience': 'Experience',
  'employment': 'Experience', 'employment history': 'Experience',
  'work history': 'Experience', 'professional experience': 'Experience',
  'career history': 'Experience', 'positions held': 'Experience',
  // Education
  'education': 'Education', 'educational background': 'Education',
  'academic background': 'Education', 'qualifications': 'Education',
  // Skills
  'skills': 'Skills', 'technical skills': 'Skills', 'core skills': 'Skills',
  'competencies': 'Skills', 'core competencies': 'Skills',
  'key skills': 'Skills', 'technologies': 'Skills', 'tech stack': 'Skills',
  'technical competencies': 'Skills', 'proficiencies': 'Skills',
  // Projects
  'projects': 'Projects', 'key projects': 'Projects', 'notable projects': 'Projects',
  'personal projects': 'Projects', 'side projects': 'Projects',
  // Certifications
  'certifications': 'Certifications', 'certificates': 'Certifications',
  'licenses': 'Certifications', 'credentials': 'Certifications',
  // Languages
  'languages': 'Languages', 'spoken languages': 'Languages',
  // Interests
  'interests': 'Interests', 'hobbies': 'Interests',
  // Awards
  'awards': 'Awards', 'achievements': 'Awards', 'honors': 'Awards',
  'recognition': 'Awards',
  // Publications
  'publications': 'Publications', 'papers': 'Publications',
  'articles': 'Publications',
  // References
  'references': 'References',
};

/** Is this line a section header? */
function classifySectionHeader(line: string): string | null {
  const lower = line.toLowerCase().trim();
  // Direct match
  if (SECTION_ALIASES[lower]) return SECTION_ALIASES[lower];
  // All caps check (e.g., "SUMMARY", "WORK EXPERIENCE")
  if (line === line.toUpperCase() && line.length > 2 && line.length < 40) {
    const expanded = SECTION_ALIASES[lower];
    if (expanded) return expanded;
    // Unknown all-caps section — keep as-is
    return line;
  }
  return null;
}

/* ── Date Detection ────────────────────────────────────────────────── */

const DATE_RANGE_RE = /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{4})\s*[-–—to]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{4}|present|current|now)/i;
const SIMPLE_DATE_RE = /\b(?:19|20)\d{2}\b/;

/* ── Preprocessing ─────────────────────────────────────────────────── */

/** Split continuous text at section boundaries when there are no line breaks */
function preprocessResumeText(text: string): string {
  // If text already has line breaks, use it as-is
  if (text.split('\n').length > 5) return text;

  // Section header patterns that might be embedded in continuous text
  const sectionPatterns = [
    'Professional Summary', 'Professional Profile', 'Career Summary', 'Career Objective',
    'Summary', 'Profile', 'About Me', 'Objective',
    'Core Competencies', 'Technical Skills', 'Key Skills', 'Skills', 'Competencies',
    'Technologies', 'Tech Stack', 'Proficiencies',
    'Work Experience', 'Employment History', 'Professional Experience', 'Experience', 'Employment',
    'Education', 'Educational Background', 'Academic Background',
    'Certifications', 'Licenses', 'Credentials',
    'Projects', 'Key Projects', 'Notable Projects',
    'Awards', 'Achievements', 'Honors', 'Recognition',
    'Languages', 'Spoken Languages',
    'Publications', 'Papers', 'Articles',
    'References',
  ];

  let result = text;

  // Insert newlines before section headers
  for (const section of sectionPatterns) {
    // Case-insensitive match, insert newline before
    const regex = new RegExp(`(?<!\n)(${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(regex, '\n$1');
  }

  // Also split on ALL CAPS headers followed by content
  result = result.replace(/(?<!\n)([A-Z][A-Z0-9 &]{2,30})\s+(?=[A-Z][a-z])/g, '\n$1 ');

  // Split on email/phone/LinkedIn lines (contact info)
  result = result.replace(/(?<!\n)([\w.+-]+@[\w-]+\.[\w.]+)/g, '\n$1');
  result = result.replace(/(?<!\n)(LinkedIn:\s*linkedin\.com\/in\/[\w-]+)/gi, '\n$1');
  result = result.replace(/(?<!\n)(Mobile:\s*\+?[\d\s()-]+)/gi, '\n$1');

  return result;
}

/* ── Main Parser ───────────────────────────────────────────────────── */

export function parseResume(rawText: string): ResumeDocument {
  // Preprocess: split continuous text at section boundaries
  const preprocessed = preprocessResumeText(rawText);
  const lines = preprocessed.split('\n').map(l => l.trim());
  const nonEmpty = lines.filter(l => l.length > 0);

  // Step 1: Extract contact info from the first ~5 lines
  const contact = extractContact(nonEmpty.slice(0, 8));

  // Step 2: Split into sections
  const sections = splitIntoSections(nonEmpty);

  // Step 3: Classify and extract each section
  let summary = '';
  let skills: string[] = [];
  const experience: ResumeExperience[] = [];
  const education: ResumeEducation[] = [];
  const otherSections: ResumeSection[] = [];

  for (const section of sections) {
    const type = classifySectionHeader(section.title);
    if (!type) {
      otherSections.push(section);
      continue;
    }
    switch (type) {
      case 'Summary':
        summary = section.content.join(' ').trim();
        break;
      case 'Skills':
        skills = extractSkills(section.content);
        break;
      case 'Experience':
        experience.push(...extractExperience(section.content));
        break;
      case 'Education':
        education.push(...extractEducation(section.content));
        break;
      default:
        otherSections.push(section);
    }
  }

  return {
    contact,
    summary,
    skills,
    experience,
    education,
    otherSections,
    rawText,
    parsedLines: nonEmpty.length,
  };
}

/* ── Contact Extraction ────────────────────────────────────────────── */

function extractContact(lines: string[]): ResumeContact {
  const contact: ResumeContact = {
    name: '', email: '', phone: '', linkedin: '', github: '', location: '', website: '', other: [],
  };

  for (const line of lines) {
    // Email
    const emailMatch = line.match(EMAIL_RE);
    if (emailMatch) contact.email = emailMatch[0];

    // Phone
    const phoneMatch = line.match(PHONE_RE);
    if (phoneMatch && !contact.phone) contact.phone = phoneMatch[0].trim();

    // LinkedIn
    const linkedinMatch = line.match(LINKEDIN_RE);
    if (linkedinMatch) contact.linkedin = linkedinMatch[0];

    // GitHub
    const githubMatch = line.match(GITHUB_RE);
    if (githubMatch) contact.github = githubMatch[0];

    // Name: first line that doesn't look like contact info
    if (!contact.name && !emailMatch && !phoneMatch && !linkedinMatch && !githubMatch) {
      // Skip lines that are clearly not names
      if (line.length > 2 && line.length < 60 && !/^(?:summary|experience|education|skills|profile|objective)/i.test(line)) {
        contact.name = line;
      }
    }
  }

  // Location: look for city/state patterns
  for (const line of lines) {
    if (/^[A-Z][a-z]+(?:,\s*[A-Z]{2})?$/.test(line) || // "San Francisco, CA"
        /^[A-Z][a-z]+,\s*[A-Z][a-z]+$/.test(line) ||   // "London, UK"
        /\b(?:india|usa|uk|canada|germany|australia|remote)\b/i.test(line)) {
      contact.location = line;
      break;
    }
  }

  return contact;
}

/* ── Section Splitting ─────────────────────────────────────────────── */

function splitIntoSections(lines: string[]): { title: string; content: string[] }[] {
  const sections: { title: string; content: string[] }[] = [];
  let current: { title: string; content: string[] } | null = null;

  for (const line of lines) {
    // Try to find a section header embedded in the line
    const embedded = findEmbeddedSectionHeader(line);
    if (embedded) {
      // Line has header + content (e.g., "Professional Summary Results-driven...")
      if (current) sections.push(current);
      current = { title: embedded.header, content: embedded.rest ? [embedded.rest] : [] };
    } else {
      const sectionType = classifySectionHeader(line);
      if (sectionType) {
        // Header on its own line
        if (current) sections.push(current);
        current = { title: line, content: [] };
      } else if (current) {
        current.content.push(line);
      }
    }
  }
  if (current) sections.push(current);

  return sections;
}

/** Find a section header embedded at the start of a line.
    E.g., "Professional Summary Results-driven..." → { header: "Professional Summary", rest: "Results-driven..." } */
function findEmbeddedSectionHeader(line: string): { header: string; rest: string } | null {
  // Check common section headers that might be followed by content on the same line
  const patterns = [
    /^(Professional Summary|Professional Profile|Career Summary|Career Objective|Objective|Summary|Profile|About Me)\s+(.+)/i,
    /^(Core Competencies|Technical Skills|Key Skills|Skills|Competencies|Technologies|Tech Stack)\s*[:\-]?\s*(.+)/i,
    /^(Work Experience|Employment History|Professional Experience|Experience|Employment)\s*$/i,
    /^(Education|Educational Background|Academic Background)\s*$/i,
    /^(Certifications?|Licenses?|Credentials?)\s*[:\-]?\s*(.+)/i,
    /^(Projects?|Key Projects?|Notable Projects?)\s*[:\-]?\s*(.+)/i,
    /^(Awards?|Achievements?|Honors?|Recognition)\s*[:\-]?\s*(.+)/i,
    /^(Languages?|Spoken Languages?)\s*[:\-]?\s*(.+)/i,
    /^(Publications?|Papers?|Articles?)\s*[:\-]?\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return { header: match[1], rest: match[2]?.trim() || '' };
    }
  }

  // Also check ALL CAPS headers followed by content (e.g., "SUMMARY Results-driven...")
  const allCapsMatch = line.match(/^([A-Z][A-Z0-9 &]{2,30})\s+(.+)/);
  if (allCapsMatch) {
    const header = allCapsMatch[1];
    const sectionType = classifySectionHeader(header);
    if (sectionType) {
      return { header, rest: allCapsMatch[2] };
    }
  }

  return null;
}

/* ── Skills Extraction ─────────────────────────────────────────────── */

function extractSkills(lines: string[]): string[] {
  const text = lines.join(' ');
  // Split on common delimiters
  const parts = text.split(/[,;•·|–—\n]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 60);
  // Deduplicate
  const seen = new Set<string>();
  return parts.filter(s => {
    const lower = s.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

/* ── Experience Extraction ─────────────────────────────────────────── */

function extractExperience(lines: string[]): ResumeExperience[] {
  const experiences: ResumeExperience[] = [];
  let current: ResumeExperience | null = null;

  for (const line of lines) {
    const hasDate = DATE_RANGE_RE.test(line) || SIMPLE_DATE_RE.test(line);

    if (hasDate && line.length < 100) {
      // This line likely contains title + company + dates
      if (current) experiences.push(current);
      current = parseExperienceLine(line);
    } else if (current) {
      // Bullet point or continuation
      if (/^[•·\-*▪▸]\s/.test(line)) {
        current.bullets.push(line.replace(/^[•·\-*▪▸]\s*/, ''));
      } else if (line.length > 0) {
        current.bullets.push(line);
      }
    }
  }
  if (current) experiences.push(current);

  // If no experiences found, treat all lines as one experience
  if (experiences.length === 0 && lines.length > 0) {
    experiences.push({
      title: '',
      company: '',
      location: '',
      dates: '',
      bullets: lines.filter(l => l.length > 0),
    });
  }

  return experiences;
}

function parseExperienceLine(line: string): ResumeExperience {
  const dateMatch = line.match(DATE_RANGE_RE) || line.match(SIMPLE_DATE_RE);
  const dates = dateMatch ? dateMatch[0] : '';

  // Remove dates to parse the rest
  const withoutDates = line.replace(DATE_RANGE_RE, '').replace(SIMPLE_DATE_RE, '').replace(/[-–—|,]/g, ' ').trim();
  const parts = withoutDates.split(/\s{2,}/).filter(Boolean);

  return {
    title: parts[0] || '',
    company: parts[1] || '',
    location: parts[2] || '',
    dates,
    bullets: [],
  };
}

/* ── Education Extraction ──────────────────────────────────────────── */

function extractEducation(lines: string[]): ResumeEducation[] {
  const educations: ResumeEducation[] = [];
  let current: ResumeEducation | null = null;

  for (const line of lines) {
    const hasDate = SIMPLE_DATE_RE.test(line);
    if (hasDate && line.length < 100) {
      if (current) educations.push(current);
      const dateMatch = line.match(SIMPLE_DATE_RE);
      const dates = dateMatch ? dateMatch[0] : '';
      const withoutDates = line.replace(SIMPLE_DATE_RE, '').replace(/[-–—|,]/g, ' ').trim();
      const parts = withoutDates.split(/\s{2,}/).filter(Boolean);
      current = {
        degree: parts[0] || '',
        school: parts[1] || '',
        location: parts[2] || '',
        dates,
        details: [],
      };
    } else if (current) {
      current.details.push(line);
    }
  }
  if (current) educations.push(current);

  // If no education found with dates, try to find degree patterns
  if (educations.length === 0) {
    for (const line of lines) {
      if (/\b(?:bachelor|master|ph\.?d|b\.?s\.?|m\.?s\.?|b\.?tech|m\.?tech|mba|bca|mca|b\.?e\.?|m\.?e\.?)\b/i.test(line)) {
        educations.push({
          degree: line,
          school: '',
          location: '',
          dates: '',
          details: [],
        });
      }
    }
  }

  return educations;
}

/* ── ResumeDocument → Plain Text (for AI tailoring) ────────────────── */

export function resumeToText(doc: ResumeDocument): string {
  const lines: string[] = [];

  // Contact header
  if (doc.contact.name) lines.push(doc.contact.name);
  const contactParts = [doc.contact.email, doc.contact.phone, doc.contact.linkedin, doc.contact.github, doc.contact.location].filter(Boolean);
  if (contactParts.length) lines.push(contactParts.join(' | '));
  lines.push('');

  // Summary
  if (doc.summary) {
    lines.push('SUMMARY');
    lines.push(doc.summary);
    lines.push('');
  }

  // Skills
  if (doc.skills.length) {
    lines.push('SKILLS');
    lines.push(doc.skills.join(' · '));
    lines.push('');
  }

  // Experience
  if (doc.experience.length) {
    lines.push('EXPERIENCE');
    for (const exp of doc.experience) {
      const header = [exp.title, exp.company, exp.location, exp.dates].filter(Boolean).join(' — ');
      if (header) lines.push(header);
      for (const bullet of exp.bullets) {
        lines.push(`• ${bullet}`);
      }
      lines.push('');
    }
  }

  // Education
  if (doc.education.length) {
    lines.push('EDUCATION');
    for (const edu of doc.education) {
      const header = [edu.degree, edu.school, edu.location, edu.dates].filter(Boolean).join(' — ');
      if (header) lines.push(header);
      for (const detail of edu.details) {
        lines.push(detail);
      }
      lines.push('');
    }
  }

  // Other sections
  for (const section of doc.otherSections) {
    lines.push(section.title.toUpperCase());
    for (const line of section.content) {
      lines.push(line);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/* ── ResumeDocument → HTML (for PDF rendering) ─────────────────────── */

export function resumeToHtml(doc: ResumeDocument, accent = '#4f46e5'): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const INK = '#111827';
  const MUT = '#6b7280';
  const LINE = '#e5e7eb';

  const contactParts = [doc.contact.email, doc.contact.phone, doc.contact.linkedin, doc.contact.github, doc.contact.location].filter(Boolean);

  let body = '';

  // Header
  if (doc.contact.name) {
    body += `<div class="header">
      <div class="name">${esc(doc.contact.name)}</div>
      ${contactParts.length ? `<div class="sub">${esc(contactParts.join(' · '))}</div>` : ''}
    </div>`;
  }

  // Summary
  if (doc.summary) {
    body += `<section><h2>Summary</h2><p class="para">${esc(doc.summary)}</p></section>`;
  }

  // Skills
  if (doc.skills.length) {
    body += `<section><h2>Skills</h2><p class="para">${esc(doc.skills.join(' · '))}</p></section>`;
  }

  // Experience
  if (doc.experience.length) {
    body += `<section><h2>Experience</h2>`;
    for (const exp of doc.experience) {
      const header = [exp.title, exp.company, exp.location, exp.dates].filter(Boolean).join(' — ');
      if (header) body += `<div class="exp-header">${esc(header)}</div>`;
      if (exp.bullets.length) {
        body += '<ul>';
        for (const bullet of exp.bullets) {
          body += `<li>${esc(bullet)}</li>`;
        }
        body += '</ul>';
      }
    }
    body += '</section>';
  }

  // Education
  if (doc.education.length) {
    body += `<section><h2>Education</h2>`;
    for (const edu of doc.education) {
      const header = [edu.degree, edu.school, edu.location, edu.dates].filter(Boolean).join(' — ');
      if (header) body += `<div class="exp-header">${esc(header)}</div>`;
      for (const detail of edu.details) {
        body += `<p class="para">${esc(detail)}</p>`;
      }
    }
    body += '</section>';
  }

  // Other sections
  for (const section of doc.otherSections) {
    body += `<section><h2>${esc(section.title)}</h2>`;
    for (const line of section.content) {
      body += `<p class="para">${esc(line)}</p>`;
    }
    body += '</section>';
  }

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(doc.contact.name || 'Resume')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; color: ${INK}; background: #fff; line-height: 1.6; font-size: 13px; }
  .page { max-width: 800px; margin: 0 auto; padding: 48px 64px; }
  .header { border-bottom: 3px solid ${accent}; padding-bottom: 20px; margin-bottom: 24px; }
  .name { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; color: ${INK}; line-height: 1.2; }
  .sub { margin-top: 8px; font-size: 13px; color: ${MUT}; line-height: 1.4; }
  section { margin-bottom: 20px; }
  h2 { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
       color: ${accent}; border-bottom: 2px solid ${LINE}; padding-bottom: 4px; margin-bottom: 8px; }
  ul { list-style: none; }
  li { font-size: 13px; color: ${INK}; margin-bottom: 4px; padding-left: 16px; position: relative; line-height: 1.5; }
  li::before { content: "▸"; position: absolute; left: 0; color: ${accent}; font-size: 11px; top: 1px; }
  .para { font-size: 13px; color: ${INK}; margin-bottom: 6px; line-height: 1.5; }
  .exp-header { font-size: 13px; font-weight: 700; color: ${INK}; margin-bottom: 4px; }
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
</div></body></html>`;
}
