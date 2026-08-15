/* Apply Kit Phase 3 — tailored resume + cover letter generator.
   The builders are pure and offline-first: given the career profile, a job,
   and its match verdict, they produce a resume and cover letter that mirror
   the JD's own keywords. AI tailoring (optional, user's own key) rewrites
   the same content with generative polish through the existing chat()
   provider, grounded on the knowledge base. Everything is persisted per
   job so it survives re-opens and works offline. */

import { chat } from "../ai";
import type { CareerProfile, JobMatch, JobPosting } from "../types";
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";
import { withGrounding } from "./tutor";
import { recordAiCall } from "./entitlements";
import { salaryInCurrency } from "./currency";
import { fmtAmount } from "./salaryBench";

export interface ApplyKit {
  jobId: string;
  jobTitle: string;
  company: string;
  resume: string;
  coverLetter: string;
  /** True when AI-tailored, false when template-generated. */
  ai: boolean;
  createdAt: number;
  /** The last AI-polished version of each document — the baseline for the
      “vs AI” diff after the user hand-edits the text. */
  aiResume?: string;
  aiCover?: string;
}

/* ------------------------------------------------------------------ */
/* JD-aware mining — keywords + responsibilities pulled from the        */
/* posting itself, so two jobs never produce identical documents even   */
/* when the extracted skills list is empty (most live feed roles).      */
/* ------------------------------------------------------------------ */

const JD_STOP = new Set([
  "the","a","an","and","or","of","to","in","for","with","on","at","by","as","is","are","be","been","will","can","should","must","have","has","had","from","that","this","these","those","it","its","not","but","about","into","over","under","between","out","up","down","off","we","you","your","their","they","our","us","who","what","when","where","how","all","any","each","more","most","some","such","than","then","there","here","which","while","through","within","across","using","use","used","including","include","etc","able","ability","strong","join","team","role","job","work","company","experience","skills","help","make","making","building","looking","someone","day","year","years","new","great","plus","well","like","also","one","two","would","could","may","might","per","via","ready","want","need","succeed","excited","impact","every","other","first","way","things","thing","really","much","many","s","t","ll","ve","re","senior","staff","lead","principal","junior","sr","mid","entry","contract","full","time","remote","hybrid","onsite","location","salary","benefits","culture","mission","product","products","customers","customer","users","user","people","build","built","builds","develop","development","design","designs","designing","create","creating","manage","managing","support","supporting","own","owns","drive","driving","scale","scaling","ship","shipping","improve","improving","optimize","optimizing","partner","partnering","collaborate","collaborating","implement","implementing","leading","mentor","mentoring","grow","growing","launch","launching","define","defining","operate","operating","measure","measuring","write","writing","review","reviewing","test","testing","deploy","deploying","automate","automating","integrate","integrating","prototype","prototyping","research","researching","analyze","analyzing","architect","architecting","maintain","maintaining","deliver","delivering","solve","solving","problem","problems","solution","solutions","process","processes","systems","system","data","tool","tools","stack","tech","technical","technology","engineering","engineers","engineer","software","platform","infrastructure","modern","best","practices","quality","high","performance","fast","speed","reliable","scalable","secure","security","global","international","environment","environments","opportunity","opportunities","candidate","candidates","position","positions","posting","open","roles","description","above","below","please",  "apply","applying","application","resume","email","contact","reach","questions","feel","free","let","know","thanks","thank","regards","best","usa","us","uk","nyc","sf","la","tokyo","london","toronto","japan","india","bengaluru","berlin","paris","amsterdam","united","states","city","cities","office","offices","region","regions","country","countries","world","worldwide"
]);

/** Role-specific keywords: title tokens + ATS skills + frequent JD words,
    ranked by how much the posting leans on them. Pure + testable. */
export function jdKeywords(job: JobPosting, max = 8): string[] {
  const counts = new Map<string, number>();
  const add = (t: string) => {
    /* strip leading/trailing dots — the split class keeps `.` for c++/c#,
       so sentence-final punctuation would otherwise become part of the token */
    const k = t.toLowerCase().trim().replace(/^\.+|\.+$/g, "");
    if (k.length < 3 || JD_STOP.has(k) || /^[0-9+#.]+$/.test(k)) return;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const w of (job.title ?? "").toLowerCase().split(/[^a-z0-9+#.]+/)) add(w);
  for (const s of job.skills) for (const w of s.toLowerCase().split(/[^a-z0-9+#.]+/)) add(w);
  for (const w of (job.description ?? "").toLowerCase().split(/[^a-z0-9+#.]+/)) add(w);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, max);
}

const JD_ACTION = /(build|design|develop|own|lead|drive|scale|ship|maintain|partner|collaborate|implement|improve|optimize|create|manage|support|research|analyze|architect|mentor|grow|launch|define|evolve|operate|write|review|test|deploy|automate|integrate|prototype|measure|monitor|troubleshoot|investigate|coach|advise|communicate)/i;

/** Substantive lines from the JD (action-verb bullets preferred) that the
    resume/letter can mirror back. Pure + testable. */
export function jdResponsibilities(job: JobPosting, max = 4): string[] {
  if (!job.description) return [];
  /* normalize whitespace first, then turn bullet glyphs into sentence
     breaks — doing it the other way round collapses bulleted lists into
     one giant sentence (the whitespace pass eats the bullet newlines) */
  const sentences = (job.description
    .replace(/\s+/g, " ")
    .replace(/[\u2022\u00b7\u2023\u25aa\u25cf]/g, ".")
    .replace(/\.\s*\./g, ".")
    .split(/(?<=[.!?])\s+/))
    .map(s => s.trim().replace(/^[-*.]\s*/, ""))
    .filter(s => s.length >= 40 && s.length <= 200)
    .filter(s => !/who we are|about us|our mission|what we offer|benefits include|perks|equal opportunity|e-?verify|we ('re| are) looking|apply today|learn more|visit our|how to apply/i.test(s))
    /* skip generic intros — “Join our team”, “We are…”, section headings — so
       the mined responsibilities are the actual work, not the pitch */
    .filter(s => !/^(join|come|we('re| are| care| value| believe| love| think| know| hope| pride)|about (us|the role)|our (team|mission|company|story)|as a|become|want to|help us|apply if|you will|what you'?ll|your day|the role|this role|in this role|overview|responsibilities|requirements|qualifications|preferred|bonus|who we are)/i.test(s))
    /* drop lines that are just the posting header — the title, location, or a
       “Remote, USA”-style tag — so highlights never mirror the header back */
    .filter(s => {
      const t = s.toLowerCase();
      if (job.title && t.includes(job.title.toLowerCase().slice(0, 40))) return false;
      if (/^(remote|united states|usa|uk|canada|india|japan|tokyo|london|berlin|paris|amsterdam|singapore|australia|new york|san francisco|seattle|austin|bengaluru|toronto|vancouver)[, .\-]?/i.test(s)) return false;
      return true;
    });
  const action = sentences.filter(s => JD_ACTION.test(s));
  const pool = action.length >= max ? action : [...action, ...sentences];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of pool) {
    if (seen.has(s) || out.length >= max) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Pure builders                                                       */
/* ------------------------------------------------------------------ */

const yearLabel = (years: number): string => (years > 0 ? `${years}+ years` : "entry-level");

/** Skills the candidate actually has, in the order the job cares about. */
function prioritizedSkills(profile: CareerProfile, match: JobMatch | null): string[] {
  const claim = profile.skills.filter(s => s.trim());
  const matched = match?.matched ?? [];
  const rest = claim.filter(s => !matched.includes(s));
  return [...matched, ...rest];
}

/** Quantified achievements the profile already claims (summary/headline) —
    reused verbatim in bullets so the resume never invents numbers it can't
    back up. Pure + testable. */
export function quantifiedClaims(profile: CareerProfile, max = 2): string[] {
  const src = `${profile.summary || ""} ${profile.headline || ""}`;
  const sentences = src.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  const claims = sentences.filter(s =>
    /\d/.test(s) &&
    /(users|uptime|latency|requests|queries|revenue|conversion|cost|deploy|deploys|percent|%|×|reduced|improved|cut|grew|scaled|served|handled|million|thousand|p95|p99|rps|\bk\b|\bm\b)/i.test(s)
  );
  return claims.slice(0, max);
}

/** A single tailored achievement bullet mirroring a JD requirement, paired
    with a skill the candidate actually has and — when the profile states
    one — a quantified outcome (reused verbatim, never invented). */
function bulletFor(skill: string, title: string, claim?: string): string {
  const s = skill.trim();
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  return claim
    ? `• ${cap} — shipped and maintained in production for a ${title} role. ${claim.trim()}`
    : `• ${cap} — shipped and maintained in production for a ${title} role, with measurable impact on delivery, quality, or team velocity.`;
}

/** Builds a plain-text resume tailored to the job posting. Pure + testable.
    `claimsOverride` swaps the quantified-claims extraction (used by the kit's
    editable evidence lines). */
export function buildResume(profile: CareerProfile, job: JobPosting, match: JobMatch | null, claimsOverride?: string[]): string {
  const skills = prioritizedSkills(profile, match);
  const head = [
    profile.headline || job.title,
    [profile.location, `${yearLabel(profile.years)} experience`].filter(Boolean).join(" · "),
    profile.workAuth ? `Work authorization: ${profile.workAuth}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  /* Summary mirrors the JD's own language: role, company, keywords, and stack. */
  const stack = (match?.matched.length ? match.matched.slice(0, 6) : skills.slice(0, 6)).join(", ");
  const keywords = jdKeywords(job, 8);
  const focus = keywords.length ? ` The role centers on ${keywords.slice(0, 3).join(", ")}.` : "";
  const summary =
    `${profile.summary || profile.headline || "Software engineer"} focused on ${job.title} at ${job.company}.${focus} ` +
    `Hands-on with ${stack || "modern tooling"}, delivering production software that moves ${job.company}'s product and engineering goals forward.`;

  const lines: string[] = [
    head,
    "",
    "SUMMARY",
    summary,
    "",
    "SKILLS",
    skills.length ? skills.join(" · ") : "—",
    ""
  ];

  /* HIGHLIGHTS mirror the posting's own responsibilities when we can mine
     them (so two jobs never read the same); otherwise fall back to the
     skill-anchored bullets. */
  const resp = jdResponsibilities(job, 4);
  const claims = claimsOverride ?? quantifiedClaims(profile, 2);
  lines.push("HIGHLIGHTS");
  if (resp.length) {
    const anchors = (match?.matched.length ? match.matched : skills).slice(0, resp.length);
    resp.forEach((r, i) => {
      const cap = r.charAt(0).toUpperCase() + r.slice(1);
      const anchor = (anchors[i] ?? "hands-on engineering").toLowerCase();
      const ev = claims[i] ? ` ${claims[i].trim()}` : "";
      lines.push(`• ${cap} — I bring ${anchor} and production experience to exactly this work${ev ? "." + ev : ", with measurable impact on delivery, quality, and team velocity."}`);
    });
  } else {
    lines.push(...(match?.matched.length ? match.matched.slice(0, 5) : skills.slice(0, 5)).map((s, i) => bulletFor(s, job.title, claims[i])));
  }

  /* ROLE KEYWORDS — the posting's own vocabulary, ATS-facing. */
  if (keywords.length) {
    lines.push("", "ROLE KEYWORDS", keywords.join(", "));
  }

  /* Honest closing-the-gap line ties the resume to the gap plan (Phase 2). */
  const topGap = match?.missing[0];
  if (topGap) {
    lines.push(
      "",
      "GROWTH",
      `Actively closing a gap in ${topGap} — currently working through a structured plan with weekly milestones and hands-on practice.`
    );
  }

  return lines.join("\n");
}

/** Builds a plain-text cover letter tailored to the job. Pure + testable.
    When displayCurrency is given the salary band is converted so the
    letter matches what the rest of the app shows. */
export function buildCoverLetter(profile: CareerProfile, job: JobPosting, match: JobMatch | null, displayCurrency?: string): string {
  const stack = (match?.matched.length ? match.matched.slice(0, 4) : profile.skills.slice(0, 4)).join(", ");
  const strengths = match?.matched.length
    ? match.matched.slice(0, 3).map(s => s.trim()).join(", ")
    : profile.skills.slice(0, 3).join(", ");
  const topGap = match?.missing[0];
  const resp = jdResponsibilities(job, 2);
  const salary = job.salary ? salaryRange(job.salary, displayCurrency) : null;
  const specifics = [
    job.remote ? "remote-friendly" : job.location ? `based in ${job.location}` : null,
    job.level ? `a ${job.level}-level opening` : null,
    salary ? `with a ${salary} band` : null
  ].filter(Boolean).join(", ");

  const body = [
    `I'm writing to apply for the ${job.title} role at ${job.company}${specifics ? ` — ${specifics}` : ""}.`,
    "",
    resp.length
      ? `Your posting emphasizes ${resp[0].length > 90 ? resp[0].slice(0, 87) + "…" : resp[0]}. That's exactly the kind of work I do hands-on: I bring ${yearLabel(profile.years)} of experience across ${stack || "modern software development"}, with ${strengths} applied in production settings — not just in tutorials.`
      : `My background fits what you're building: I bring ${yearLabel(profile.years)} of experience across ${stack || "modern software development"}. ` +
        `In particular, my hands-on work with ${strengths} maps directly to the responsibilities in your posting — I've applied these in production settings, not just in tutorials.`,
    "",
    profile.summary
      ? `${profile.summary} I'm looking for a place where that experience can compound, and ${job.company}'s mission and the scope of this role are exactly that kind of opportunity.`
      : `I'm looking for a place where that experience can compound, and ${job.company}'s mission and the scope of this role are exactly that kind of opportunity.`
  ];

  if (topGap) {
    body.push(
      "",
      `One honest note: I'm actively strengthening ${topGap}, and I have a concrete weekly plan for it — I'd welcome the chance to talk through how I'm approaching it.`
    );
  }

  body.push(
    "",
    "I'd welcome the chance to discuss how I can contribute to your team.",
    "",
    "Best regards,",
    profile.headline || "Candidate"
  );

  return body.join("\n");
}

/** Human-readable salary band for the cover letter, e.g. "$120k–$150k".
    Converted to the display currency first (₹-style L/Cr formatting). */
function salaryRange(s: NonNullable<JobPosting["salary"]>, displayCurrency?: string): string {
  const band = displayCurrency && displayCurrency !== s.currency ? salaryInCurrency(s, displayCurrency) : s;
  return `${fmtAmount(band.min, band.currency)}–${fmtAmount(band.max, band.currency)}`;
}

/* ------------------------------------------------------------------ */
/* ATS keyword coverage                                                */
/* ------------------------------------------------------------------ */

/** Normalize a skill name into lowercase word tokens (for matching). */
function skillTokens(skill: string): string[] {
  return skill.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean);
}

/** What fraction of the posting's required skills appear verbatim (as
    normalized word sets) in the generated document. Pure + testable. */
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

/** One row of the ATS keyword drill-down — a posting skill or a mined
    JD keyword, and whether it appears in the generated document. */
export interface AtsKeywordRow {
  keyword: string;
  present: boolean;
  source: "skill" | "jd";
}

export interface AtsDrilldown {
  /** The posting's own required-skills rows (empty when it lists none). */
  skills: AtsKeywordRow[];
  /** Role keywords mined from the posting's title + description. */
  jd: AtsKeywordRow[];
  /** Coverage score against required skills (0 when none are listed). */
  score: number;
  found: string[];
  missing: string[];
  /** Aggregates across every row — the actionable number even when the
      posting lists no skills, because the JD vocabulary is still scored. */
  hits: number;
  total: number;
}

/** Per-keyword ATS drill-down: every required skill AND the posting's own
    mined vocabulary (jdKeywords) matched against the generated document.
    Skill-less postings still get a real, actionable number — the posting's
    vocabulary coverage — instead of a blank score. Pure + testable. */
export function atsKeywordDrilldown(text: string, job: JobPosting): AtsDrilldown {
  const lower = text.toLowerCase();
  const present = (k: string) => {
    const tokens = k.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean).map(t => t.replace(/^\.+|\.+$/g, ""));
    return tokens.length > 0 && tokens.every(t => t.length >= 2 && lower.includes(t));
  };
  const skills: AtsKeywordRow[] = job.skills.map(s => ({ keyword: s, present: present(s), source: "skill" }));
  const jd: AtsKeywordRow[] = jdKeywords(job, 12)
    /* skip mined keywords that duplicate a listed skill — the skills row already shows them */
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

/* ------------------------------------------------------------------ */
/* Persistence (offline-first, per job)                                */
/* ------------------------------------------------------------------ */

type ApplyKitMap = Record<string, ApplyKit>;

export function getApplyKit(jobId: string): ApplyKit | null {
  return storageGet<ApplyKitMap>(STORAGE_KEYS.applyKit, {})[jobId] ?? null;
}

export function saveApplyKit(kit: ApplyKit): void {
  const map = storageGet<ApplyKitMap>(STORAGE_KEYS.applyKit, {});
  map[kit.jobId] = kit;
  storageSet(STORAGE_KEYS.applyKit, map);
}

/* ------------------------------------------------------------------ */
/* AI tailoring (user's own key, grounded on the knowledge base)       */
/* ------------------------------------------------------------------ */

/** Rewrites the template resume with generative polish. Falls back to the
    template when no key is configured. Pro-gated at the UI; metered the
    same way as the coach (unlimited for Pro). */
export async function aiTailorResume(profile: CareerProfile, job: JobPosting, match: JobMatch | null): Promise<string> {
  const template = buildResume(profile, job, match);
  const sys =
    "You are an expert resume writer for tech roles. Rewrite the given resume to be sharper, more concrete, " +
    "and tailored to the target job. Keep the same sections and facts — never invent experience, companies, " +
    "or credentials. Use action verbs and quantify impact where the facts allow. Under ~320 words.";
  const usr =
    `Target job: ${job.title} at ${job.company}.\n` +
    `Candidate headline: ${profile.headline || job.title} (${yearLabel(profile.years)}).\n` +
    `Key requirements from the posting: ${job.skills.join(", ") || "general engineering"}.\n\n` +
    `Current resume:\n${template}\n\nRewrite it tailored to this job.`;
  const { sys: sysGrounded } = await withGrounding(sys, `${job.title} ${job.skills.join(" ")}`);
  const out = await chat([{ role: "system", content: sysGrounded }, { role: "user", content: usr }], { maxTokens: 800 });
  recordAiCall();
  return out;
}

/** Rewrites the template cover letter with generative polish. Same rules as
    the resume — never invent facts. */
export async function aiTailorCoverLetter(profile: CareerProfile, job: JobPosting, match: JobMatch | null): Promise<string> {
  const template = buildCoverLetter(profile, job, match);
  const sys =
    "You are an expert cover-letter writer for tech roles. Rewrite the given cover letter to be warmer, " +
    "more specific, and clearly tailored to the target job and company. Never invent facts, companies, " +
    "or credentials. Under ~220 words.";
  const usr =
    `Target job: ${job.title} at ${job.company}.\n` +
    `Candidate headline: ${profile.headline || job.title} (${yearLabel(profile.years)}).\n` +
    `Job location: ${job.location || "remote"}.\n\n` +
    `Current cover letter:\n${template}\n\nRewrite it tailored to this job.`;
  const { sys: sysGrounded } = await withGrounding(sys, `${job.title} ${job.company}`);
  const out = await chat([{ role: "system", content: sysGrounded }, { role: "user", content: usr }], { maxTokens: 600 });
  recordAiCall();
  return out;
}
