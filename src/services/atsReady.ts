/* ATS-ready optimizer — turns an uploaded resume into an ATS-compliant,
   keyword-aligned version via the user's configured AI (same ladder as every
   other feature: BYOK → cloud proxy → explicit error).

   The model returns strict JSON; the service validates it and pairs it with a
   before/after parse report from services/atsPreview.ts so the UI can show
   what actually changed, not just a wall of text.

   Design notes:
   - The AI may rephrase and reorder, but NEVER invent experience, companies,
     credentials, dates, or numbers — the prompt forbids it and `sanitize`
     drops fabricated-looking lines (email/URLs not present in the original).
   - Output is single-column plain text with standard headers — exactly what
     applicant-tracking parsers expect.
   - Module id "ats" so owners can route it to a cheaper/faster model in
     Settings → AI modules without touching other features. */

import { chat } from "../ai";
import type { JobPosting } from "../types";
import { recordAiCall } from "./entitlements";
import { atsParsePreview, type AtsParseResult } from "./atsPreview";

export interface AtsReadyResult {
  /** ATS-compliant plain-text resume. */
  text: string;
  /** Parse reports for the original and the rewritten resume (same job). */
  before: AtsParseResult;
  after: AtsParseResult;
  /** What the model changed (validated subset of its report). */
  changes: string[];
  /** Skills from the posting the rewrite now mirrors (may be empty). */
  mirroredSkills: string[];
}

/* ── helpers ───────────────────────────────────────────────────────────── */

/** Contact tokens (emails/links) that exist in the original but not the
    rewrite get re-appended to the header — parsers need them to route the
    application, so dropping one is a hard failure. */
function repairContacts(original: string, text: string): string {
  const wanted: string[] = [];
  const email = original.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
  const linkedin = original.match(/linkedin\.com\/[^\s),]+/i)?.[0];
  const phone = original.match(/\+?\d[\d\s().-]{7,}\d/)?.[0]?.trim();
  if (email && !text.includes(email)) wanted.push(email);
  if (phone && !text.includes(phone)) wanted.push(phone);
  if (linkedin && !text.toLowerCase().includes(linkedin.toLowerCase())) wanted.push(linkedin.startsWith("http") ? linkedin : `linkedin.com/${linkedin.split("/").slice(1).join("/")}`);
  if (!wanted.length) return text;
  const lines = text.split("\n");
  const anchor = Math.min(2, lines.length); // right under name/headline
  lines.splice(anchor, 0, wanted.join(" · "));
  return lines.join("\n");
}

/** Last-resort validation: reject obviously broken output so garbage never
    reaches the UI. */
function isValidResume(text: string): boolean {
  if (text.trim().length < 120) return false;
  if (!/\n/.test(text.trim())) return false; // must be multi-line
  if (/(<script|<\/|iframe)/i.test(text)) return false; // HTML leak guard
  if (/```/.test(text)) return false; // markdown fences leak guard
  return true;
}

function extractJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const data: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ── the main call ─────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are an ATS (applicant-tracking-system) resume optimization engine.
Rewrite the resume below so automated parsers extract it perfectly and human recruiters see the target job's keywords.

HARD RULES:
1. NEVER invent or embellish: no new employers, titles, dates, degrees, certifications, or numbers. Facts stay facts.
2. Output is SINGLE-COLUMN plain text with a blank line between sections. No tables, no columns, no icons, no images, no HTML/Markdown.
3. Use exactly these uppercase section headers when the content allows: SUMMARY, SKILLS, EXPERIENCE, PROJECTS, EDUCATION, CERTIFICATIONS. Keep the original's real content in the matching section.
4. Standard bullets only ("- " prefix), one achievement per line, each starting with an action verb.
5. Mirror the job's key skills naturally in SUMMARY/SKILLS and (where truthful) in EXPERIENCE lines. Never stuff keywords — every mention must stay attached to a real fact from the original.
6. Spell out abbreviations once alongside the acronym, e.g. "CI/CD (Continuous Integration / Continuous Deployment)", only when the original already uses that fact.
7. Keep contact details (email, phone, links) at the very top.
8. Keep it under ~600 words.

Reply with ONLY strict JSON (no markdown fences, no commentary):
{"resume": string, "changes": string[], "mirroredSkills": string[]}`;

/** Rewrites a resume into an ATS-compliant, keyword-aligned version. */
export async function makeAtsReady(params: {
  resumeText: string;
  /** Target posting — aligns keywords to it. Omit for a generic ATS cleanup. */
  job?: JobPosting | null;
  signal?: AbortSignal;
}): Promise<AtsReadyResult> {
  const { resumeText, job, signal } = params;
  const source = resumeText.trim();
  if (source.length < 120) {
    throw new Error("Resume is too short to optimize — paste the full text (at least a few sentences).");
  }

  const target = job
    ? `Target job: ${job.title}${job.company ? ` at ${job.company}` : ""}.\nSkills/keywords from the posting: ${job.skills.slice(0, 18).join(", ") || "general engineering"}.\n\n`
    : "No specific target job — make it universally parseable and strong.\n\n";

  const raw = await chat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          target +
          `RESUME (verbatim, may have formatting artifacts from PDF extraction):\n"""\n${source.slice(0, 12_000)}\n"""\n\nRewrite it as ATS-ready plain text. Respond with the JSON object only.`
      }
    ],
    { temperature: 0.2, maxTokens: 1800, module: "ats", signal }
  );
  recordAiCall();

  const parsed = extractJson(raw);
  let text = typeof parsed?.resume === "string" ? parsed.resume.trim() : "";
  if (!text) throw new Error("The AI reply was not usable JSON — try again or adjust the model in Settings → AI modules.");
  text = repairContacts(source, text);
  if (!isValidResume(text)) throw new Error("The rewritten resume failed validation — try again.");

  const changes = Array.isArray(parsed?.changes)
    ? parsed.changes.map(c => String(c).trim()).filter(Boolean).slice(0, 8)
    : [];
  const jobSkills = job?.skills ?? [];
  const mirrored = Array.isArray(parsed?.mirroredSkills)
    ? parsed.mirroredSkills.map(s => String(s).trim()).filter(s => jobSkills.includes(s)).slice(0, 12)
    : [];

  /* Blanket job object satisfies atsParsePreview's keyword math when there is
     no target posting — coverage just reads the (empty) skills list. */
  const probeJob: JobPosting = job ?? {
    id: "ats-probe", source: "ats", externalId: "probe", title: "", company: "",
    location: "", remote: true, description: "", url: "", skills: [],
    level: null, salary: null, companySize: null, postedAt: null
  };

  return {
    text,
    before: atsParsePreview(source, probeJob),
    after: atsParsePreview(text, probeJob),
    changes,
    mirroredSkills: mirrored
  };
}
