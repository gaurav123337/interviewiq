/* AI tailoring — rewrite templates with generative polish */

import { chat } from "../../ai";
import type { CareerProfile, JobMatch, JobPosting } from "../../types";
import { withGrounding } from "../tutor";
import { recordAiCall } from "../entitlements";
import { yearLabel, buildResume, buildCoverLetter } from "./builders";

/** Rewrites the template resume with generative polish. Falls back to the
    template when no key is configured. */
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
  const out = await chat([{ role: "system", content: sysGrounded }, { role: "user", content: usr }], { maxTokens: 800, module: "coach" });
  recordAiCall();
  // Validate output - must have meaningful content
  if (!out || out.trim().length < 50) {
    console.warn("AI resume polish returned too short output:", out?.substring(0, 100));
    return template; // Fall back to template
  }
  return out;
}

/** Rewrites the template cover letter with generative polish. */
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
  const out = await chat([{ role: "system", content: sysGrounded }, { role: "user", content: usr }], { maxTokens: 600, module: "coach" });
  recordAiCall();
  // Validate output - must have meaningful content
  if (!out || out.trim().length < 30) {
    console.warn("AI cover letter polish returned too short output:", out?.substring(0, 100));
    return template; // Fall back to template
  }
  return out;
}
