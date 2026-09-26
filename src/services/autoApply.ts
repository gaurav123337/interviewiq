/* autoApply — Platinum-tier bridge to the LOCAL auto-apply engine
   (scripts/auto-apply-jobs.js). The engine runs on the owner's machine
   (headed Chromium + persistent job-board logins) — the app's job here is:
     1. GATE the feature to Platinum (server-verified via serverPlatinum()).
     2. EXPORT the app's career profile into the engine's apply-profile.json
        shape (contacts from the canonical aggregate; the engine leaves
        anything absent blank → required-and-blank marks needs-review,
        fail-closed).
     3. Emit ready-to-paste run commands per job board.
   Pure + unit-tested; no Playwright, no filesystem, no cloud calls. */

import { getCanonicalProfile, toCareerProfile } from "./profileStore";
import { adminUnlockedActive, getTier } from "./entitlements";
import { serverAutoApply, serverPlatinum } from "./entitlement";

/* ── contact extraction from the uploaded resume text ──────────────────── */

export interface ResumeContacts { name?: string; email?: string; phone?: string }

/** Pulls name/email/phone out of the raw resume text. Best-effort and
    conservative: the email/phone regexes are strict; the name heuristic only
    accepts a short letters-only line near the top (never lines with digits,
    emails, or URLs). Anything it can't find stays undefined — the engine
    fail-closes on required fields rather than guessing. */
export function extractContacts(resumeText: string): ResumeContacts {
  const t = String(resumeText ?? "");
  if (!t) return {};
  const email = t.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)?.[0];
  /* Indian + international formats: +91 98765 43210, 9876543210, (555) 123-4567… */
  const phone = t.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?){2,3}\d{3,4}(?!\d)/)?.[0]?.trim();
  let name: string | undefined;
  const lines = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const l of lines.slice(0, 6)) {
    if (/[@\d]|https?:|resume|curriculum/i.test(l)) continue;
    const words = l.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 4) continue;
    if (!/^[A-Za-z][A-Za-z.'-]*(\s+[A-Za-z][A-Za-z.'-]*)+$/.test(l)) continue;
    name = l.replace(/\s+/g, " ");
    break;
  }
  return { name, email, phone };
}

/** The engine's apply-profile.json shape (content/apply-profile.example.json). */
export interface ApplyProfileJson {
  name?: string;
  email?: string;
  phone?: string;
  headline?: string;
  years?: number;
  locations?: string[];
  noticePeriod?: string;
  salaryExpectation?: string;
  openToRelocate?: boolean | null;
  openToRemote?: boolean | null;
  portfolio?: string;
  linkedin?: string;
  reasonLeaving?: string;
  summary?: string;
  skills?: string[];
  experience?: { role?: string; company?: string; period?: string; highlights?: string[] }[];
  projects?: { name?: string; description?: string }[];
  education?: string;
}

/** True when auto-apply is usable: the ADD-ON purchased on any plan, the
    Platinum bundle — or the viewer is an ADMIN ("admins have ALL
    restrictions lifted" is independent of the entitlements row, which most
    admins never have — the gate must honor the bypass like every other
    paywalled surface). */
export function platinumActive(): boolean {
  return adminUnlockedActive() || serverAutoApply() || serverPlatinum() || getTier() === "platinum";
}

/** Builds the engine profile from the app's canonical aggregate. Never
    invents: fields the app doesn't hold are omitted. workAuth is deliberately
    NOT exported — the engine's classifier flags work-authorization questions
    as fail-closed review; a stale resume claim shouldn't auto-answer them. */
export function buildEngineProfile(): ApplyProfileJson {
  const canonical = getCanonicalProfile();
  if (!canonical) return {};
  const career = toCareerProfile(canonical);

  const p: ApplyProfileJson = {
    headline: career.headline || undefined,
    years: career.years != null ? career.years : undefined,
    locations: [career.location, career.remote ? "Remote" : ""].filter(Boolean),
    openToRemote: career.remote,
    summary: career.summary || undefined,
    skills: career.skills?.length ? [...career.skills] : undefined,
  };
  /* contact fields: the career form doesn't hold them — parse them from the
     uploaded resume's stored TEXT (the engine requires name/email/phone and
     fail-closes when missing; the card warns so they can be checked) */
  const parsed = extractContacts(canonical.resume?.text ?? "");
  if (parsed.name) p.name = parsed.name;
  if (parsed.email) p.email = parsed.email;
  if (parsed.phone) p.phone = parsed.phone;
  const extras = canonical as unknown as {
    name?: string; email?: string; phone?: string;
    noticePeriod?: string; salaryExpectation?: string; openToRelocate?: boolean;
    portfolio?: string; linkedin?: string; reasonLeaving?: string;
    experience?: ApplyProfileJson["experience"]; projects?: ApplyProfileJson["projects"]; education?: string;
  };
  if (extras.name) p.name = extras.name;
  if (extras.email) p.email = extras.email;
  if (extras.phone) p.phone = extras.phone;
  if (extras.noticePeriod) p.noticePeriod = extras.noticePeriod;
  if (extras.salaryExpectation) p.salaryExpectation = extras.salaryExpectation;
  if (extras.openToRelocate != null) p.openToRelocate = extras.openToRelocate;
  if (extras.portfolio) p.portfolio = extras.portfolio;
  if (extras.linkedin) p.linkedin = extras.linkedin;
  if (extras.reasonLeaving) p.reasonLeaving = extras.reasonLeaving;
  if (extras.experience?.length) p.experience = extras.experience;
  if (extras.projects?.length) p.projects = extras.projects;
  if (extras.education) p.education = extras.education;
  return p;
}

export const APPLY_SITES = [
  { id: "instahyre", label: "Instahyre", url: "https://www.instahyre.com/candidate/opportunities/?matching=true", submit: "auto" },
  { id: "naukri", label: "Naukri", url: "https://www.naukri.com/mnjuser/recommendedjobs", submit: "auto" },
  { id: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/jobs/", submit: "review" },
] as const;

export interface ApplyCommand {
  site: string;
  label: string;
  submit: "auto" | "review";
  /** The exact CLI line the owner pastes into a terminal on their machine. */
  command: string;
}

/** Ready-to-run commands for one site (one-time login, real run, dry run). */
export function engineCommands(siteId: string, max = 10): ApplyCommand[] {
  const site = APPLY_SITES.find(s => s.id === siteId) ?? APPLY_SITES[0];
  return [
    { site: site.id, label: `${site.label} — one-time login`, submit: site.submit, command: `node scripts/auto-apply-jobs.js --url "${site.url}" --login-only` },
    { site: site.id, label: `${site.label} — apply to ${max} (${site.submit === "auto" ? "auto-submit" : "you click Submit"})`, submit: site.submit, command: `node scripts/auto-apply-jobs.js --url "${site.url}" --max ${max}` },
    { site: site.id, label: `${site.label} — dry run (fills, never submits)`, submit: site.submit, command: `node scripts/auto-apply-jobs.js --url "${site.url}" --max ${max} --dry-run` },
  ];
}

/** JSON.stringify with a trailing newline — exactly what the engine expects
    in apply-profile.json (the owner saves this to the repo root). */
export function exportProfileJson(): string {
  return JSON.stringify(buildEngineProfile(), null, 2) + "\n";
}
