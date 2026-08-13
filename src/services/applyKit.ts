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

export interface ApplyKit {
  jobId: string;
  jobTitle: string;
  company: string;
  resume: string;
  coverLetter: string;
  /** True when AI-tailored, false when template-generated. */
  ai: boolean;
  createdAt: number;
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

/** A single tailored achievement bullet mirroring a JD requirement. */
function bulletFor(skill: string, title: string): string {
  const s = skill.trim();
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  return `• ${cap} — shipped and maintained in production for a ${title} role, with measurable impact on delivery, quality, or team velocity.`;
}

/** Builds a plain-text resume tailored to the job posting. Pure + testable. */
export function buildResume(profile: CareerProfile, job: JobPosting, match: JobMatch | null): string {
  const skills = prioritizedSkills(profile, match);
  const head = [
    profile.headline || job.title,
    [profile.location, `${yearLabel(profile.years)} experience`].filter(Boolean).join(" · "),
    profile.workAuth ? `Work authorization: ${profile.workAuth}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  /* Summary mirrors the JD's own language: role, company, and the matched stack. */
  const stack = (match?.matched.length ? match.matched.slice(0, 6) : skills.slice(0, 6)).join(", ");
  const summary =
    `${profile.summary || profile.headline || "Software engineer"} focused on ${job.title} at ${job.company}. ` +
    `Hands-on with ${stack || "modern tooling"}, delivering production software that moves ${job.company}'s product and engineering goals forward.`;

  const lines: string[] = [
    head,
    "",
    "SUMMARY",
    summary,
    "",
    "SKILLS",
    skills.length ? skills.join(" · ") : "—",
    "",
    "HIGHLIGHTS",
    ...(match?.matched.length ? match.matched.slice(0, 5) : skills.slice(0, 5)).map(s => bulletFor(s, job.title))
  ];

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

/** Builds a plain-text cover letter tailored to the job. Pure + testable. */
export function buildCoverLetter(profile: CareerProfile, job: JobPosting, match: JobMatch | null): string {
  const stack = (match?.matched.length ? match.matched.slice(0, 4) : profile.skills.slice(0, 4)).join(", ");
  const strengths = match?.matched.length
    ? match.matched.slice(0, 3).map(s => s.trim()).join(", ")
    : profile.skills.slice(0, 3).join(", ");
  const topGap = match?.missing[0];

  const body = [
    `I'm writing to apply for the ${job.title} role at ${job.company}.`,
    "",
    `My background fits what you're building: I bring ${yearLabel(profile.years)} of experience across ${stack || "modern software development"}. ` +
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
