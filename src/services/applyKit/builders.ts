/* Pure builders — resume, cover letter, and helper functions */

import type { CareerProfile, JobMatch, JobPosting } from "../../types";
import { salaryInCurrency } from "../currency";
import { fmtAmount } from "../salaryBench";
import { jdKeywords, jdResponsibilities } from "./jdMining";

export const yearLabel = (years: number): string => (years > 0 ? `${years}+ years` : "entry-level");

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

/** A single tailored achievement bullet mirroring a JD requirement. */
function bulletFor(skill: string, title: string, claim?: string): string {
  const s = skill.trim();
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  return claim
    ? `\u2022 ${cap} \u2014 shipped and maintained in production for a ${title} role. ${claim.trim()}`
    : `\u2022 ${cap} \u2014 shipped and maintained in production for a ${title} role, with measurable impact on delivery, quality, or team velocity.`;
}

/** Builds a plain-text resume tailored to the job posting. Pure + testable. */
export function buildResume(profile: CareerProfile, job: JobPosting, match: JobMatch | null, claimsOverride?: string[]): string {
  const skills = prioritizedSkills(profile, match);
  const head = [
    profile.headline || job.title,
    [profile.location, `${yearLabel(profile.years)} experience`].filter(Boolean).join(" \u00b7 "),
    profile.workAuth ? `Work authorization: ${profile.workAuth}` : ""
  ]
    .filter(Boolean)
    .join("\n");

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
    skills.length ? skills.join(" \u00b7 ") : "\u2014",
    ""
  ];

  const resp = jdResponsibilities(job, 4);
  const claims = claimsOverride ?? quantifiedClaims(profile, 2);
  lines.push("HIGHLIGHTS");
  if (resp.length) {
    const anchors = (match?.matched.length ? match.matched : skills).slice(0, resp.length);
    resp.forEach((r, i) => {
      const cap = r.charAt(0).toUpperCase() + r.slice(1);
      const anchor = (anchors[i] ?? "hands-on engineering").toLowerCase();
      const ev = claims[i] ? ` ${claims[i].trim()}` : "";
      lines.push(`\u2022 ${cap} \u2014 I bring ${anchor} and production experience to exactly this work${ev ? "." + ev : ", with measurable impact on delivery, quality, and team velocity."}`);
    });
  } else {
    lines.push(...(match?.matched.length ? match.matched.slice(0, 5) : skills.slice(0, 5)).map((s, i) => bulletFor(s, job.title, claims[i])));
  }

  if (keywords.length) {
    lines.push("", "ROLE KEYWORDS", keywords.join(", "));
  }

  const topGap = match?.missing[0];
  if (topGap) {
    lines.push(
      "",
      "GROWTH",
      `Actively closing a gap in ${topGap} \u2014 currently working through a structured plan with weekly milestones and hands-on practice.`
    );
  }

  return lines.join("\n");
}

/** Human-readable salary band for the cover letter. */
function salaryRange(s: NonNullable<JobPosting["salary"]>, displayCurrency?: string): string {
  const band = displayCurrency && displayCurrency !== s.currency ? salaryInCurrency(s, displayCurrency) : s;
  return `${fmtAmount(band.min, band.currency)}\u2013${fmtAmount(band.max, band.currency)}`;
}

/** Builds a plain-text cover letter tailored to the job. Pure + testable. */
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
    `I'm writing to apply for the ${job.title} role at ${job.company}${specifics ? ` \u2014 ${specifics}` : ""}.`,
    "",
    resp.length
      ? `Your posting emphasizes ${resp[0].length > 90 ? resp[0].slice(0, 87) + "\u2026" : resp[0]}. That's exactly the kind of work I do hands-on: I bring ${yearLabel(profile.years)} of experience across ${stack || "modern software development"}, with ${strengths} applied in production settings \u2014 not just in tutorials.`
      : `My background fits what you're building: I bring ${yearLabel(profile.years)} of experience across ${stack || "modern software development"}. ` +
        `In particular, my hands-on work with ${strengths} maps directly to the responsibilities in your posting \u2014 I've applied these in production settings, not just in tutorials.`,
    "",
    profile.summary
      ? `${profile.summary} I'm looking for a place where that experience can compound, and ${job.company}'s mission and the scope of this role are exactly that kind of opportunity.`
      : `I'm looking for a place where that experience can compound, and ${job.company}'s mission and the scope of this role are exactly that kind of opportunity.`
  ];

  if (topGap) {
    body.push(
      "",
      `One honest note: I'm actively strengthening ${topGap}, and I have a concrete weekly plan for it \u2014 I'd welcome the chance to talk through how I'm approaching it.`
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
