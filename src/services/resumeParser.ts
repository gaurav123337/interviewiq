/* Normalized Resume Parser — handles any resume format and extracts
   structured data. The single source of truth for resume content.

   Pipeline: Raw text → Preprocess → Parse → Normalize → ResumeDocument */

export interface ResumeContact {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  location: string;
  website: string;
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

export interface ResumeDocument {
  contact: ResumeContact;
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  otherSections: ResumeSection[];
  rawText: string;
  parsedLines: number;
}

/* ── Contact Info Detection ────────────────────────────────────────── */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/;
const LINKEDIN_RE = /linkedin\.com\/in\/[\w-]+/i;
const GITHUB_RE = /github\.com\/[\w-]+/i;

/* ── Section Header Detection ──────────────────────────────────────── */

const SECTION_ALIASES: Record<string, string> = {
  'summary': 'Summary', 'professional summary': 'Summary', 'profile': 'Summary',
  'about': 'Summary', 'about me': 'Summary', 'objective': 'Summary',
  'career objective': 'Summary', 'career summary': 'Summary',
  'professional profile': 'Summary', 'personal statement': 'Summary',
  'experience': 'Experience', 'work experience': 'Experience',
  'employment': 'Experience', 'employment history': 'Experience',
  'work history': 'Experience', 'professional experience': 'Experience',
  'career history': 'Experience', 'positions held': 'Experience',
  'education': 'Education', 'educational background': 'Education',
  'academic background': 'Education', 'qualifications': 'Education',
  'skills': 'Skills', 'technical skills': 'Skills', 'core skills': 'Skills',
  'competencies': 'Skills', 'core competencies': 'Skills',
  'key skills': 'Skills', 'technologies': 'Skills', 'tech stack': 'Skills',
  'technical competencies': 'Skills', 'proficiencies': 'Skills',
  'projects': 'Projects', 'key projects': 'Projects', 'notable projects': 'Projects',
  'personal projects': 'Projects', 'side projects': 'Projects',
  'certifications': 'Certifications', 'certificates': 'Certifications',
  'licenses': 'Certifications', 'credentials': 'Certifications',
  'languages': 'Languages', 'spoken languages': 'Languages',
  'interests': 'Interests', 'hobbies': 'Interests',
  'awards': 'Awards', 'achievements': 'Awards', 'honors': 'Awards',
  'recognition': 'Awards',
  'publications': 'Publications', 'papers': 'Publications', 'articles': 'Publications',
  'references': 'References',
};

function classifySectionHeader(line: string): string | null {
  const lower = line.toLowerCase().trim();
  if (SECTION_ALIASES[lower]) return SECTION_ALIASES[lower];
  if (line === line.toUpperCase() && line.length > 2 && line.length < 40) {
    const expanded = SECTION_ALIASES[lower];
    if (expanded) return expanded;
    return line;
  }
  return null;
}

/* ── Date Detection ────────────────────────────────────────────────── */

const DATE_RANGE_RE = /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{4})\s*[-–—to]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{4}|present|current|now)/i;
const SIMPLE_DATE_RE = /\b(?:19|20)\d{2}\b/;

/* ── Preprocessing ─────────────────────────────────────────────────── */

/**
 * All known section headers sorted longest-first for regex alternation.
 * The regex engine tries alternatives in order, so "Professional Summary"
 * matches before "Summary" — preventing the double-split bug.
 */
const SECTION_HEADERS_SORTED = [
  'Professional Summary', 'Professional Profile', 'Career Summary', 'Career Objective',
  'Core Competencies', 'Technical Skills', 'Key Skills', 'Professional Experience',
  'Employment History', 'Work Experience', 'Work History', 'Career History',
  'Positions Held', 'Educational Background', 'Academic Background',
  'Spoken Languages', 'Key Projects', 'Notable Projects', 'Personal Projects',
  'Side Projects', 'About Me', 'Personal Statement',
  'Objective', 'Summary', 'Profile', 'Competencies', 'Technologies',
  'Tech Stack', 'Proficiencies', 'Skills', 'Experience', 'Employment',
  'Education', 'Certifications', 'Licenses', 'Credentials',
  'Projects', 'Awards', 'Achievements', 'Honors', 'Recognition',
  'Languages', 'Publications', 'Papers', 'Articles', 'References',
  'Interests', 'Hobbies', 'Qualifications',
];

/** Build the header-matching regex (longest-first alternation). */
function buildHeaderRe(): RegExp {
  const escaped = SECTION_HEADERS_SORTED.map(h =>
    h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  // Match header preceded by whitespace/start, followed by whitespace/colon/end
  return new RegExp(`(?:^|(?<=\\s))(${escaped.join('|')})(?=\\s|:|$)`, 'gi');
}

/** Split a line that starts with a section header into [header, rest] */
function splitLineAtHeader(line: string): [string, string] | null {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();
  // Try each header alias longest-first
  for (const alias of Object.keys(SECTION_ALIASES).sort((a, b) => b.length - a.length)) {
    if (lower === alias || lower.startsWith(alias + ' ') || lower.startsWith(alias + ':')) {
      const headerText = trimmed.substring(0, alias.length);
      const rest = trimmed.substring(alias.length).replace(/^[\s:]+/, '');
      return [headerText, rest];
    }
  }
  // Also check ALL CAPS
  const allCapsMatch = trimmed.match(/^([A-Z][A-Z0-9 &]{2,30})[\s:](.+)/);
  if (allCapsMatch) {
    const headerLower = allCapsMatch[1].toLowerCase();
    if (SECTION_ALIASES[headerLower]) {
      return [allCapsMatch[1], allCapsMatch[2]];
    }
  }
  return null;
}

/**
 * Insert newlines into continuous text at section boundaries.
 *
 * Strategy:
 * 1. Single-pass regex inserts `\n` before each section header
 * 2. Post-process: for lines starting with header + content, split header onto its own line
 * 3. Split contact info on pipe separators
 */
function preprocessResumeText(text: string): string {
  const existingLines = text.split('\n');
  if (existingLines.length > 5) return text;

  // Step 1: Insert \n before every section header (single-pass, longest-first)
  const headerRe = buildHeaderRe();
  let result = text.replace(headerRe, '\n$1');

  // Step 2: For each line that starts with a section header followed by content,
  //         put the header on its own line.
  result = result.split('\n').map(line => {
    const split = splitLineAtHeader(line);
    if (split) {
      const [header, rest] = split;
      return rest ? `${header}\n${rest}` : header;
    }
    return line;
  }).join('\n');

  // Step 3: Split contact info on pipe separators
  result = result.split('\n').map(line => {
    if (line.length < 200 && (EMAIL_RE.test(line) || LINKEDIN_RE.test(line) || /Mobile:|Phone:|Tel:/i.test(line))) {
      const parts = line.split(/\s*[|·]\s*/);
      if (parts.length > 1) return parts.join('\n');
    }
    return line;
  }).join('\n');

  return result;
}

/* ── Main Parser ───────────────────────────────────────────────────── */

export function parseResume(rawText: string): ResumeDocument {
  const preprocessed = preprocessResumeText(rawText);
  const lines = preprocessed.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const contact = extractContact(lines.slice(0, 10));
  const sections = splitIntoSections(lines);

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

  return { contact, summary, skills, experience, education, otherSections, rawText, parsedLines: lines.length };
}

/* ── Contact Extraction ────────────────────────────────────────────── */

function extractContact(lines: string[]): ResumeContact {
  const contact: ResumeContact = {
    name: '', email: '', phone: '', linkedin: '', github: '', location: '', website: '', other: [],
  };

  for (const line of lines) {
    const emailMatch = line.match(EMAIL_RE);
    if (emailMatch) contact.email = emailMatch[0];

    const phoneMatch = line.match(PHONE_RE);
    if (phoneMatch && !contact.phone) contact.phone = phoneMatch[0].trim();

    const linkedinMatch = line.match(LINKEDIN_RE);
    if (linkedinMatch) contact.linkedin = linkedinMatch[0];

    const githubMatch = line.match(GITHUB_RE);
    if (githubMatch) contact.github = githubMatch[0];

    if (!contact.name) {
      const hasContact = emailMatch || phoneMatch || linkedinMatch || githubMatch;
      const isSection = classifySectionHeader(line) !== null;
      if (!hasContact && !isSection && line.length > 1 && line.length < 60) {
        let nameOnly = line.split(/\s*[|·,]\s*/)[0].trim();
        // Also stop before common job title keywords
        const titleKeywords = /^(.+?)\s+(?:Senior|Junior|Lead|Principal|Staff|Director|Manager|Architect|Engineer|Developer|Specialist|Consultant|Analyst|Frontend|Backend|Full.?Stack|DevOps|SRE|QA|UI|UX|Product|Data|ML|AI|Cloud|Software|IT|Technical|Systems|Network|Security|Solutions|Staff|VP|Head|Chief|Officer)/i;
        const titleMatch = nameOnly.match(titleKeywords);
        if (titleMatch) nameOnly = titleMatch[1];
        if (nameOnly.length > 1) contact.name = nameOnly;
      }
    }
  }

  for (const line of lines) {
    if (/^[A-Z][a-z]+(?:,\s*[A-Z]{2})?$/.test(line) ||
        /^[A-Z][a-z]+,\s*[A-Z][a-z]+$/.test(line) ||
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
    const sectionType = classifySectionHeader(line);
    if (sectionType) {
      if (current) sections.push(current);
      current = { title: line, content: [] };
    } else if (current) {
      current.content.push(line);
    }
  }
  if (current) sections.push(current);

  return sections;
}

/* ── Skills Extraction ─────────────────────────────────────────────── */

function extractSkills(lines: string[]): string[] {
  const text = lines.join(' ');
  const parts = text.split(/[,;•·|–—\n]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 80);
  const seen = new Set<string>();
  return parts.filter(s => {
    const lower = s.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

/* ── Experience Extraction ─────────────────────────────────────────── */

/** Split a continuous experience block into individual job entries.
    Looks for patterns like "Title | Company | Location | Dates" or
    "Title – Company, Location | Dates". */
function extractExperience(lines: string[]): ResumeExperience[] {
  const experiences: ResumeExperience[] = [];
  let current: ResumeExperience | null = null;

  // First pass: join all lines and find pipe-separated job entries
  const fullText = lines.join(' ');

  // Split on pipes that are followed by a date pattern — these mark job boundaries
  // e.g. "TCS Digital | Bangalore, India | Jan 2022 - Present"
  const parts = fullText.split(/\|\s*(?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{4})/gi);
  
  // Group parts into job entries: each entry ends with a date range
  const entries: string[] = [];
  let currentEntry = '';
  
  for (const part of parts) {
    currentEntry += (currentEntry ? ' | ' : '') + part.trim();
    if (DATE_RANGE_RE.test(part)) {
      entries.push(currentEntry.trim());
      currentEntry = '';
    }
  }
  if (currentEntry.trim()) entries.push(currentEntry.trim());
  
  // Parse each entry
  for (const entry of entries) {
    const exp = parseExperienceEntry(entry);
    if (exp && (exp.title || exp.dates)) experiences.push(exp);
  }
  
  // Fallback: try line-by-line extraction
  if (experiences.length === 0) {
    for (const line of lines) {
      const hasDate = DATE_RANGE_RE.test(line) || SIMPLE_DATE_RE.test(line);
      if (hasDate && line.length < 120) {
        if (current) experiences.push(current);
        current = parseExperienceLine(line);
      } else if (current) {
        if (/^[•·\-*▪▸]\s/.test(line)) {
          current.bullets.push(line.replace(/^[•·\-*▪▸]\s*/, ''));
        } else if (line.length > 0) {
          current.bullets.push(line);
        }
      }
    }
    if (current) experiences.push(current);
  }

  if (experiences.length === 0 && lines.length > 0) {
    experiences.push({ title: '', company: '', location: '', dates: '', bullets: lines.filter(l => l.length > 0) });
  }

  return experiences;
}

/** Parse a single experience entry like "Title | Company | Location | Dates Description..." */
function parseExperienceEntry(entry: string): ResumeExperience | null {
  const dateMatch = entry.match(DATE_RANGE_RE);
  const dates = dateMatch ? dateMatch[0] : '';
  
  // Split on pipe to get parts
  const pipeParts = entry.split(/\s*\|\s*/);
  
  if (pipeParts.length >= 3) {
    // Format: Title | Company | Location | Dates Description...
    const title = pipeParts[0].trim();
    const company = pipeParts[1].trim();
    const location = pipeParts[2].trim();
    
    // Extract description after the date
    const datePart = pipeParts[pipeParts.length - 1].trim();
    const descMatch = datePart.match(/(?:present|current|now|\d{4})\s+(.*)/i);
    const description = descMatch ? descMatch[1].trim() : '';
    
    // Split description into bullets
    const bullets = description
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
    
    return { title, company, location, dates, bullets };
  }
  
  if (pipeParts.length === 2) {
    // Format: Title | Company Dates Description...
    const title = pipeParts[0].trim();
    const rest = pipeParts[1].trim();
    
    // Try to extract company from the beginning of rest
    const companyMatch = rest.match(/^(.+?)\s*\|/);
    const company = companyMatch ? companyMatch[1].trim() : '';
    
    // Extract description after the date
    const descMatch = rest.match(/(?:present|current|now|\d{4})\s+(.*)/i);
    const description = descMatch ? descMatch[1].trim() : '';
    
    const bullets = description
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
    
    return { title, company, location: '', dates, bullets };
  }
  
  return parseExperienceLine(entry);
}

function parseExperienceLine(line: string): ResumeExperience {
  const dateMatch = line.match(DATE_RANGE_RE) || line.match(SIMPLE_DATE_RE);
  const dates = dateMatch ? dateMatch[0] : '';
  const withoutDates = line.replace(DATE_RANGE_RE, '').replace(SIMPLE_DATE_RE, '').replace(/[-–—|,]/g, ' ').trim();
  const parts = withoutDates.split(/\s{2,}/).filter(Boolean);
  return { title: parts[0] || '', company: parts[1] || '', location: parts[2] || '', dates, bullets: [] };
}

/* ── Education Extraction ──────────────────────────────────────────── */

function extractEducation(lines: string[]): ResumeEducation[] {
  const educations: ResumeEducation[] = [];
  let current: ResumeEducation | null = null;

  for (const line of lines) {
    const hasDate = SIMPLE_DATE_RE.test(line);
    if (hasDate && line.length < 120) {
      if (current) educations.push(current);
      const dateMatch = line.match(SIMPLE_DATE_RE);
      const dates = dateMatch ? dateMatch[0] : '';
      const withoutDates = line.replace(SIMPLE_DATE_RE, '').replace(/[-–—|,]/g, ' ').trim();
      const parts = withoutDates.split(/\s{2,}/).filter(Boolean);
      current = { degree: parts[0] || '', school: parts[1] || '', location: parts[2] || '', dates, details: [] };
    } else if (current) {
      current.details.push(line);
    }
  }
  if (current) educations.push(current);

  if (educations.length === 0) {
    for (const line of lines) {
      if (/\b(?:bachelor|master|ph\.?d|b\.?s\.?|m\.?s\.?|b\.?tech|m\.?tech|mba|bca|mca|b\.?e\.?|m\.?e\.?)\b/i.test(line)) {
        educations.push({ degree: line, school: '', location: '', dates: '', details: [] });
      }
    }
  }

  return educations;
}

/* ── Normalized Resume Output ──────────────────────────────────────── */

/** Normalized resume data for job matching. Extracts clean, individual
    skills, experience titles/companies, education degrees, and years. */
export interface NormalizedResume {
  /** Individual skill names (e.g. ["React", "TypeScript", "Node.js"]) */
  skills: string[];
  /** Job titles held (e.g. ["Frontend Architect", "Senior Frontend Developer"]) */
  titles: string[];
  /** Companies worked at (e.g. ["TCS Digital", "Infosys"]) */
  companies: string[];
  /** Degrees earned (e.g. ["Master of Computer Applications"]) */
  degrees: string[];
  /** Estimated years of experience */
  years: number;
  /** Primary field: frontend, backend, fullstack, data, devops, etc. */
  field: string;
  /** Seniority level: junior, mid, senior, staff, principal */
  level: string;
  /** Full name */
  name: string;
  /** Email */
  email: string;
  /** Phone */
  phone: string;
  /** LinkedIn */
  linkedin: string;
}

/** Known skill keywords to extract from resume text */
const SKILL_KEYWORDS: Record<string, string[]> = {
  // Frontend
  'React': ['react', 'reactjs', 'react.js'],
  'Vue': ['vue', 'vuejs', 'vue.js', 'vue3'],
  'Angular': ['angular', 'angularjs', 'angular.js'],
  'Next.js': ['next.js', 'nextjs', 'next js'],
  'TypeScript': ['typescript', 'ts '],
  'JavaScript': ['javascript', 'es6', 'es2015', 'es2020'],
  'HTML': ['html', 'html5'],
  'CSS': ['css', 'css3', 'sass', 'scss', 'less', 'tailwind'],
  'Redux': ['redux', 'mobx', 'zustand', 'recoil'],
  'GraphQL': ['graphql', 'gql'],
  'REST APIs': ['rest', 'restful', 'rest api', 'rest apis'],
  'Webpack': ['webpack'],
  'Vite': ['vite'],
  'Tailwind CSS': ['tailwind', 'tailwindcss'],
  'Styled Components': ['styled components', 'css-in-js', 'emotion'],
  'Testing': ['jest', 'cypress', 'playwright', 'testing library', 'mocha', 'vitest', 'enzyme'],
  'Accessibility': ['accessibility', 'a11y', 'wcag', 'wai-aria', 'aria'],
  'Performance': ['performance', 'lighthouse', 'web vitals', 'core web vitals', 'code splitting', 'lazy loading'],
  'Responsive Design': ['responsive', 'mobile-first', 'fluid'],
  'Design Systems': ['design system', 'storybook', 'figma'],
  'Micro Frontends': ['micro frontend', 'micro frontends', 'module federation'],
  'PWA': ['pwa', 'progressive web app', 'service worker'],
  'SSR': ['ssr', 'server-side rendering', 'server side rendering'],
  'SSG': ['ssg', 'static site generation', 'static site'],
  // Backend
  'Node.js': ['node.js', 'nodejs', 'node js', 'express', 'expressjs'],
  'Python': ['python', 'django', 'flask', 'fastapi'],
  'Java': ['java ', 'spring', 'springboot', 'spring boot'],
  'Go': ['golang', 'go '],
  'Rust': ['rust'],
  'PHP': ['php', 'laravel'],
  'Ruby': ['ruby', 'rails', 'ruby on rails'],
  // Database
  'PostgreSQL': ['postgresql', 'postgres'],
  'MySQL': ['mysql'],
  'MongoDB': ['mongodb', 'mongo'],
  'Redis': ['redis'],
  'Elasticsearch': ['elasticsearch', 'elastic'],
  'SQL': ['sql', 'database', 'databases'],
  // Cloud & DevOps
  'AWS': ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'cloudfront'],
  'GCP': ['gcp', 'google cloud'],
  'Azure': ['azure', 'microsoft cloud'],
  'Docker': ['docker', 'containerization', 'containers'],
  'Kubernetes': ['kubernetes', 'k8s'],
  'CI/CD': ['ci/cd', 'cicd', 'jenkins', 'github actions', 'gitlab ci', 'circleci'],
  'Terraform': ['terraform', 'infrastructure as code', 'iac'],
  'Linux': ['linux', 'bash', 'shell'],
  // Data & ML
  'TensorFlow': ['tensorflow', 'tf '],
  'PyTorch': ['pytorch'],
  'Pandas': ['pandas', 'numpy'],
  'Spark': ['spark', 'pyspark'],
  'Airflow': ['airflow'],
  // Mobile
  'React Native': ['react native'],
  'Flutter': ['flutter', 'dart'],
  'Swift': ['swift', 'ios'],
  'Kotlin': ['kotlin', 'android'],
  // Practices
  'Agile': ['agile', 'scrum', 'kanban', 'sprint'],
  'Git': ['git', 'github', 'gitlab', 'bitbucket'],
  'Microservices': ['microservice', 'microservices'],
  'Serverless': ['serverless', 'lambda', 'faas'],
  'State Management': ['state management', 'context api', 'redux', 'mobx'],
};

/** Extract individual skills from resume text by matching known keywords. */
function extractNormalizedSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  
  for (const [skill, keywords] of Object.entries(SKILL_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        found.add(skill);
        break;
      }
    }
  }
  
  return [...found];
}

/** Classify resume into a primary field based on skill distribution. */
function classifyField(skills: string[]): string {
  const frontend = ['React', 'Vue', 'Angular', 'Next.js', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Redux', 'Webpack', 'Responsive Design', 'Design Systems', 'Accessibility', 'Performance'];
  const backend = ['Node.js', 'Python', 'Java', 'Go', 'Rust', 'PHP', 'Ruby', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'SQL'];
  const devops = ['Docker', 'Kubernetes', 'CI/CD', 'Terraform', 'AWS', 'GCP', 'Azure', 'Linux'];
  const data = ['TensorFlow', 'PyTorch', 'Pandas', 'Spark', 'Airflow', 'Python'];
  const mobile = ['React Native', 'Flutter', 'Swift', 'Kotlin'];
  
  const score = (list: string[]) => skills.filter(s => list.includes(s)).length;
  
  const scores = [
    { field: 'frontend', score: score(frontend) },
    { field: 'backend', score: score(backend) },
    { field: 'devops', score: score(devops) },
    { field: 'data', score: score(data) },
    { field: 'mobile', score: score(mobile) },
  ];
  
  // If frontend + backend both high, it's fullstack
  const fe = scores.find(s => s.field === 'frontend')?.score ?? 0;
  const be = scores.find(s => s.field === 'backend')?.score ?? 0;
  if (fe >= 3 && be >= 3) return 'fullstack';
  
  return scores.sort((a, b) => b.score - a.score)[0]?.field ?? 'other';
}

/** Detect seniority from resume text. */
function detectLevel(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(?:principal|distinguished|fellow|chief architect)\b/.test(lower)) return 'principal';
  if (/\b(?:staff|lead|tech lead|architect)\b/.test(lower)) return 'staff';
  if (/\b(?:senior|sr\.?)\b/.test(lower)) return 'senior';
  if (/\b(?:mid.?level|midlevel)\b/.test(lower)) return 'mid';
  if (/\b(?:junior|jr\.?|entry.level|intern)\b/.test(lower)) return 'junior';
  return 'mid';
}

/** Extract years of experience from resume text. */
function extractYearsFromText(text: string): number {
  const lower = text.toLowerCase();
  const matches = [...lower.matchAll(/(\d{1,2})\s*\+?\s*(?:years|yrs)\b/g)].map(m => Number(m[1]));
  if (matches.length) return Math.max(...matches);
  const since = lower.match(/since\s+(19|20)\d{2}/);
  if (since) return Math.max(0, new Date().getFullYear() - Number(since[0].match(/\d{4}/)));
  return 3;
}

/** Normalize any resume text into a structured format for job matching.
    This is the single source of truth for resume → matching pipeline. */
export function normalizeResume(rawText: string): NormalizedResume {
  const doc = parseResume(rawText);
  
  // Extract skills from the full text (not just the skills section)
  const skills = extractNormalizedSkills(rawText);
  
  // Extract titles and companies from experience
  const titles = doc.experience
    .map(e => e.title)
    .filter(t => t.length > 3 && t.length < 60 && !/^(?:in|at|for|the|and|of|with)\b/i.test(t) && /[a-z]/i.test(t))
    .slice(0, 5);
  
  const companies = doc.experience
    .map(e => e.company)
    .filter(c => c.length > 2 && c.length < 60 && !/^(?:in|at|for|the|and|of|with)\b/i.test(c))
    .slice(0, 5);
  
  // Extract degrees
  const degrees = doc.education
    .map(e => e.degree)
    .filter(d => d.length > 2)
    .slice(0, 3);
  
  // If no titles from experience, try to extract from the raw text
  if (titles.length === 0) {
    const titlePatterns = [
      /(?:senior|lead|principal|staff|junior|mid)\s+(?:frontend|backend|full.?stack|software|mobile|data|devops|cloud|security|platform|infrastructure|site reliability)\s+(?:engineer|developer|architect|scientist|analyst)/gi,
      /(?:frontend|backend|full.?stack|software|mobile|data|devops|cloud|security|platform|infrastructure|site reliability)\s+(?:engineer|developer|architect|scientist|analyst)/gi,
    ];
    for (const pattern of titlePatterns) {
      const matches = rawText.match(pattern);
      if (matches) {
        for (const m of matches) {
          const cleaned = m.trim();
          if (!titles.includes(cleaned)) titles.push(cleaned);
        }
      }
    }
  }
  
  return {
    skills,
    titles,
    companies,
    degrees,
    years: extractYearsFromText(rawText),
    field: classifyField(skills),
    level: detectLevel(rawText),
    name: doc.contact.name,
    email: doc.contact.email,
    phone: doc.contact.phone,
    linkedin: doc.contact.linkedin,
  };
}

/* ── ResumeDocument → Plain Text ───────────────────────────────────── */

export function resumeToText(doc: ResumeDocument): string {
  const lines: string[] = [];

  if (doc.contact.name) lines.push(doc.contact.name);
  const contactParts = [doc.contact.email, doc.contact.phone, doc.contact.linkedin, doc.contact.github, doc.contact.location].filter(Boolean);
  if (contactParts.length) lines.push(contactParts.join(' | '));
  lines.push('');

  if (doc.summary) { lines.push('SUMMARY'); lines.push(doc.summary); lines.push(''); }
  if (doc.skills.length) { lines.push('SKILLS'); lines.push(doc.skills.join(' · ')); lines.push(''); }

  if (doc.experience.length) {
    lines.push('EXPERIENCE');
    for (const exp of doc.experience) {
      const header = [exp.title, exp.company, exp.location, exp.dates].filter(Boolean).join(' — ');
      if (header) lines.push(header);
      for (const bullet of exp.bullets) lines.push(`• ${bullet}`);
      lines.push('');
    }
  }

  if (doc.education.length) {
    lines.push('EDUCATION');
    for (const edu of doc.education) {
      const header = [edu.degree, edu.school, edu.location, edu.dates].filter(Boolean).join(' — ');
      if (header) lines.push(header);
      for (const detail of edu.details) lines.push(detail);
      lines.push('');
    }
  }

  for (const section of doc.otherSections) {
    lines.push(section.title.toUpperCase());
    for (const line of section.content) lines.push(line);
    lines.push('');
  }

  return lines.join('\n').trim();
}

/* ── ResumeDocument → HTML ─────────────────────────────────────────── */

export function resumeToHtml(doc: ResumeDocument, accent = '#4f46e5'): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const INK = '#111827';
  const MUT = '#6b7280';
  const LINE = '#e5e7eb';

  const contactParts = [doc.contact.email, doc.contact.phone, doc.contact.linkedin, doc.contact.github, doc.contact.location].filter(Boolean);

  let body = '';

  if (doc.contact.name) {
    body += `<div class="header">
      <div class="name">${esc(doc.contact.name)}</div>
      ${contactParts.length ? `<div class="sub">${esc(contactParts.join(' · '))}</div>` : ''}
    </div>`;
  }

  if (doc.summary) {
    body += `<section><h2>Summary</h2><p class="para">${esc(doc.summary)}</p></section>`;
  }

  if (doc.skills.length) {
    body += `<section><h2>Skills</h2><p class="para">${esc(doc.skills.join(' · '))}</p></section>`;
  }

  if (doc.experience.length) {
    body += `<section><h2>Experience</h2>`;
    for (const exp of doc.experience) {
      const header = [exp.title, exp.company, exp.location, exp.dates].filter(Boolean).join(' — ');
      if (header) body += `<div class="exp-header">${esc(header)}</div>`;
      if (exp.bullets.length) {
        body += '<ul>';
        for (const bullet of exp.bullets) body += `<li>${esc(bullet)}</li>`;
        body += '</ul>';
      }
    }
    body += '</section>';
  }

  if (doc.education.length) {
    body += `<section><h2>Education</h2>`;
    for (const edu of doc.education) {
      const header = [edu.degree, edu.school, edu.location, edu.dates].filter(Boolean).join(' — ');
      if (header) body += `<div class="exp-header">${esc(header)}</div>`;
      for (const detail of edu.details) body += `<p class="para">${esc(detail)}</p>`;
    }
    body += '</section>';
  }

  for (const section of doc.otherSections) {
    body += `<section><h2>${esc(section.title)}</h2>`;
    for (const line of section.content) body += `<p class="para">${esc(line)}</p>`;
    body += '</section>';
  }

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(doc.contact.name || 'Resume')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif; color: ${INK}; background: #fff; line-height: 1.6; font-size: 14px; }
  .page { max-width: 800px; margin: 0 auto; padding: 48px 64px; }
  .header { border-bottom: 3px solid ${accent}; padding-bottom: 20px; margin-bottom: 24px; }
  .name { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; color: ${INK}; line-height: 1.2; }
  .sub { margin-top: 8px; font-size: 14px; color: ${MUT}; line-height: 1.4; }
  section { margin-bottom: 24px; }
  h2 { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
       color: ${accent}; border-bottom: 2px solid ${LINE}; padding-bottom: 6px; margin-bottom: 10px; }
  ul { list-style: none; }
  li { font-size: 14px; color: ${INK}; margin-bottom: 6px; padding-left: 18px; position: relative; line-height: 1.6; }
  li::before { content: "▸"; position: absolute; left: 0; color: ${accent}; font-size: 12px; top: 2px; }
  .para { font-size: 14px; color: ${INK}; margin-bottom: 8px; line-height: 1.6; }
  .exp-header { font-size: 14px; font-weight: 700; color: ${INK}; margin-bottom: 6px; }
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
