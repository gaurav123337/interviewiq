/* Resume-vs-JD scan — paste a job description, score the saved career profile
   against it. Pure composition of existing offline pieces: analyzeJd (jd.ts)
   classifies the posting (level/field/company), normalizeResume (resumeParser)
   mines its skills as atomic labels in the SAME vocabulary the career profile
   uses, we synthesize a JobPosting, and matchJob (jobs/match.ts) produces the
   same verdict vocabulary the live feed uses. No network, no embeddings —
   deterministic and unit-testable. */

import type { CareerProfile, JdScan, JobMatch, JobPosting, LevelId } from "../../types";
import { COMPANIES, FIELDS, LEVELS } from "../../data";
import { analyzeJd } from "../jd";
import { normalizeResume } from "../resumeParser";
import { STORAGE_KEYS, storageGet, storageSet } from "../storage";
import { matchJob } from "./match";

/** Cap on stored JD text — long enough for any real posting, bounded storage. */
const MAX_JD = 12_000;
/** How many scans to keep (newest first). */
const MAX_SCANS = 20;

/** analyzeJd's LevelId → the matcher's LEVEL_ORDER key.
    ceo/cto/principal/staff all collapse to "principal" (the matcher's ceiling):
    LEVEL_ORDER only ranks junior<mid<senior<lead<principal, and an exec/staff
    posting is unambiguously at-or-above any IC candidate — mapping "staff" to a
    key the matcher doesn't know (→ neutral) or below "senior" would wrongly
    suppress the "role is above you — great target" signal, or worse fire a
    below-seniority blocker. */
export function mapLevel(levelId: LevelId): string {
  switch (levelId) {
    case "junior": return "junior";
    case "mid": return "mid";
    case "senior": return "senior";
    case "staff":
    case "principal":
    case "cto":
    case "ceo": return "principal";
  }
}

const ROLE_RE = /(engineer|developer|architect|designer|scientist|analyst|manager|consultant|specialist|lead|director|recruiter|marketer|intern)/i;

/** Best-effort job title from the JD — the first short, role-looking line.
    Falls back to a synthesized "<Level> <Field>" so matchJob's domain
    inference and title-fit always have something to work with. */
export function extractJobTitle(jdText: string, fallback: string): string {
  const lines = jdText.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    const words = line.split(/\s+/);
    if (words.length <= 8 && line.length >= 4 && line.length <= 80 && ROLE_RE.test(line)) {
      /* strip a trailing company/location clause ("Senior FE — Acme, Remote")
         and a "… at Company" suffix, leaving just the role */
      return line.replace(/\s*[|–—•].*$/, "").replace(/\s+at\s+.*$/i, "").trim();
    }
  }
  return fallback;
}

/* Explicit on-site / hybrid signals — if none appear we assume the role is
   remote-friendly rather than emit a false "on-site" blocker for a JD that
   simply never mentions location. */
const NON_REMOTE_RE = /(on-?site|on site|in-office|in office|in person|hybrid|no remote|not remote|relocation required)/i;

/** Build a synthetic JobPosting from a pasted JD (no persistence). */
export function jdToJob(jdText: string, id: string): { job: JobPosting; detected: JdScan["detected"] } {
  const text = jdText.slice(0, MAX_JD);
  const a = analyzeJd(text);
  const fieldName = FIELDS.find(f => f.id === a.fieldId)?.name ?? a.fieldId;
  const levelName = LEVELS.find(l => l.id === a.levelId)?.name ?? "";
  const company = a.companyId ? (COMPANIES.find(c => c.id === a.companyId)?.name ?? null) : null;
  const title = extractJobTitle(text, `${levelName} ${fieldName}`.trim());
  /* skills as atomic labels in the SAME vocabulary as the profile's skills:
     resumeToProfile builds profile.skills from normalizeResume(resumeText),
     so mining the JD the same way lets the matcher compare like-for-like
     ("React" vs "React", not "React · Vue · Angular" vs "React"). */
  const skills = normalizeResume(text).skills;
  const job: JobPosting = {
    id,
    source: "scan",
    externalId: id.replace(/^scan:/, ""),
    title,
    company: company ?? "Pasted job description",
    location: "",
    remote: !NON_REMOTE_RE.test(text),
    description: text,
    url: "",
    skills,
    level: mapLevel(a.levelId),
    salary: null,
    companySize: null,
    postedAt: null
  };
  return { job, detected: { fieldId: a.fieldId, levelId: a.levelId, companyId: a.companyId } };
}

/** Deterministic content hash (djb2) → stable scan id, so re-scanning the same
    JD text replaces (not duplicates) the earlier scan. */
function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Turn pasted JD text into a JdScan. `now` is injected (not read from the
    clock) so the function stays pure and testable; the id is derived from the
    text alone, so the same JD always yields the same id regardless of `now`. */
export function scanResumeAgainstJd(jdText: string, now: number): JdScan {
  const trimmed = jdText.trim().slice(0, MAX_JD);
  const id = `scan:${hashText(trimmed)}`;
  const { job, detected } = jdToJob(trimmed, id);
  return { id, createdAt: now, updatedAt: now, jdText: trimmed, job, detected };
}

/** The verdict for a scan against the current profile — recomputed live (not
    persisted), so adding a missing skill re-scores the saved scan just like the
    live feed re-scores its jobs. */
export function matchScan(profile: CareerProfile | null, scan: JdScan): JobMatch {
  return matchJob(profile, scan.job);
}

/* ------------------------------------------------------------------ */
/* Persistence — scans stay on the device                              */
/* ------------------------------------------------------------------ */

export function listJdScans(): JdScan[] {
  return storageGet<JdScan[]>(STORAGE_KEYS.jdScans, []);
}

/** Insert or replace a scan (same id = same JD text → replace, keeping the
    original createdAt but taking the new updatedAt), newest first, capped. */
export function saveJdScan(scan: JdScan): JdScan[] {
  const prev = listJdScans();
  const existing = prev.find(s => s.id === scan.id);
  const merged: JdScan = existing ? { ...scan, createdAt: existing.createdAt } : scan;
  const next = [merged, ...prev.filter(s => s.id !== scan.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SCANS);
  storageSet(STORAGE_KEYS.jdScans, next);
  return next;
}

export function deleteJdScan(id: string): JdScan[] {
  const next = listJdScans().filter(s => s.id !== id);
  storageSet(STORAGE_KEYS.jdScans, next);
  return next;
}
