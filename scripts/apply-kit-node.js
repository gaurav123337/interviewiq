#!/usr/bin/env node
/* apply-kit-node — per-JD resume + cover letter generation for the auto-apply
 * engine. Node twin of src/services/applyKit/ai.ts: talks DIRECTLY to the
 * admin-configured OpenAI-compatible provider (via ai-config.js — the same
 * Supabase-saved provider the cron scripts use), because the browser chat()
 * ladder (BYOK → ai-chat edge fn) isn't reachable from a plain node script.
 *
 * Fallback contract (same as the app): any AI failure or too-short output →
 * the deterministic template. The engine NEVER blocks on AI.
 */

import { loadAiProviderConfig } from "./ai-config.js";
import { judgeMessages, parseJudgeReply, ownerExemplarFor, auditAuthenticity } from "./apply-engine-lib.js";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** AI JUDGE — reads the real JD and renders apply/skip with JSON reason.
    Fail-open: any error/absent provider returns { verdict: "unknown" } and
    the engine proceeds to the deterministic backstops. Cheap call (short
    prompt, small max_tokens) made ONCE per candidate posting, BEFORE kit
    generation — a skip here saves two AI calls plus form-filling. */
export async function judgeFit(ai, job, profile, exemplars = null) {
  if (!ai?.key) return { verdict: "unknown", reason: "no AI provider" };
  /* the owner already 👍-ed this posting: their verdict outranks any judge
     reasoning (that override IS the learn-from-the-owner loop) */
  const ownerHit = ownerExemplarFor(job, exemplars);
  if (ownerHit) return { verdict: "apply", confidence: 1, reason: "owner-confirmed relevant (exemplar)", missingCore: [] };
  const { system, user } = judgeMessages(job, profile, exemplars);
  try {
    const raw = await chatOnce(ai, [{ role: "system", content: system }, { role: "user", content: user }], 220);
    return parseJudgeReply(raw);
  } catch (e) {
    return { verdict: "unknown", reason: e.message.slice(0, 100) };
  }
}

/* ---- template builders (logic mirrored from src/services/applyKit/builders.ts
   in plain JS — small enough to keep in sync; the tests pin the shape) ---- */

export function templateResume(profile, job) {
  const p = profile || {};
  const j = job || {};
  const name = p.name || "Candidate";
  const head = [p.headline || j.title || "Software Engineer", p.locations?.[0], p.email, p.phone]
    .filter(Boolean).join(" · ");
  const skills = (p.skills?.length ? p.skills : ["JavaScript", "TypeScript", "React", "Node.js"]).join(", ");
  const matched = (j.skills ?? []).slice(0, 6);
  const lines = [
    name.toUpperCase(),
    head,
    "",
    "SUMMARY",
    p.summary || `${p.headline || j.title || "Engineer"} with ${p.years ?? "several"} years of experience building and shipping production software.` +
      (matched.length ? ` Strongest with: ${matched.join(", ")}.` : ""),
    "",
    "SKILLS",
    skills,
    "",
    "EXPERIENCE",
    ...(p.experience ?? []).map(e => [
      `${e.role ?? ""} — ${e.company ?? ""} (${e.period ?? ""})`,
      ...(e.highlights ?? []).map(h => `• ${h}`),
      "",
    ]).flat(),
    ...(p.projects ?? []).length ? ["PROJECTS"] : [],
    ...p.projects.map(pr => `• ${pr.name ?? ""}${pr.description ? " — " + pr.description : ""}`),
    "",
    "EDUCATION",
    p.education ?? "—",
  ];
  return lines.filter(l => l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function templateCoverLetter(profile, job) {
  const p = profile || {};
  const skills = (job?.skills ?? p.skills ?? []).slice(0, 4).join(", ");
  return [
    p.name || "Candidate",
    "",
    `Dear Hiring Team at ${job?.company || "your company"},`,
    "",
    `I'm applying for the ${job?.title || "engineering"} role. ${p.headline ? `As a ${p.headline}` : "As an engineer"}`
    + `${p.years != null ? ` with ${p.years}+ years of experience` : ""}, I work daily with ${skills || "modern web technologies"}.`,
    "",
    p.summary || "I ship production software, own outcomes end to end, and enjoy turning ambiguous problems into simple, reliable systems.",
    "",
    `I'd love to discuss how my experience maps to ${job?.company || "the team"}'s goals for this role.`,
    "",
    "Sincerely,",
    p.name || "Candidate",
    p.email ?? "",
  ].join("\n");
}

/* ---- AI tailoring (mirrors aiTailorResume / aiTailorCoverLetter) ---- */

const TIMEOUT_MS = 45_000;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function chatAttempt(ai, messages, maxTokens) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ai.base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: ai.model, messages, max_tokens: maxTokens, temperature: 0.4 }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${JSON.stringify(body).slice(0, 140)}`);
    return (body.choices?.[0]?.message?.content ?? "").replace(/^SKIP\s*$/i, "__SKIP__").trim();
  } finally {
    clearTimeout(timer);
  }
}

/* The OmniRoute provider intermittently answers 502 — a single blip used to
   degrade the WHOLE kit to templates (and the judge to keyword-only). Retry
   the transient failures with backoff before giving up: 3 attempts, +2s/+6s
   worst case 8s extra per call — invisible in a 12-min-per-site run. */
const RETRY_DELAYS_MS = [2_000, 6_000];
const isTransientAiError = (e) => {
  if (e?.name === "AbortError") return false; // 45s provider timeout — a retry just stalls the run
  const m = String(e?.message ?? e ?? "");
  return /AI HTTP (429|5\d\d)/.test(m) || /fetch failed|network|ECONN|ENOTFOUND|EAI_AGAIN|socket/i.test(m);
};

/** chatOnce — one provider call with transient-failure retries. */
async function chatOnce(ai, messages, maxTokens) {
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    try {
      return await chatAttempt(ai, messages, maxTokens);
    } catch (e) {
      lastErr = e;
      if (!isTransientAiError(e)) throw e;
      console.log(dim(`  ↻ AI provider blip (${String(e.message).slice(0, 80)}) — retry ${attempt}/${RETRY_DELAYS_MS.length}`));
    }
  }
  throw lastErr;
}

/** Rewrite the template resume for this JD. Fallback: template (never throws). */
export async function tailorResume(ai, profile, job) {
  const template = templateResume(profile, job);
  if (!ai?.key) return { text: template, ai: false, note: "no AI provider configured" };
  const sys = "You are an expert resume writer for tech roles. Rewrite the given resume to be sharper, more concrete, and tailored to the target job. Emphasize the candidate's real skills that transfer to this role (even adjacent ones — a frontend engineer applying to backend roles DOES have API, data-modeling and systems experience worth highlighting). Keep the same sections and facts — never invent experience, companies, titles, or credentials. The input may lack employment history or other data: that is EXPECTED — work with what is provided, never refuse or comment on missing data. Only if the role is in a genuinely unrelated field where NO honest mapping exists, reply with exactly: SKIP. Use action verbs and quantify impact where the facts allow. Under ~320 words. Output ONLY the resume text.";
  const usr = `Target job: ${job.title} at ${job.company}.\nKey requirements: ${(job.skills ?? []).join(", ") || "general engineering"}.\n\nCurrent resume:\n${template}\n\nRewrite it tailored to this job.`;
  try {
    const out = await chatOnce(ai, [{ role: "system", content: sys }, { role: "user", content: usr }], 800);
    if (!out || out.trim().length < 50 || /```/.test(out)) return { text: template, ai: false, note: "AI output rejected — template used" };
    /* Authenticity Guard: audit the tailored resume for hallucinations */
    const audit = await auditAuthenticity(ai, out.trim(), profile, job);
    if (!audit.ok) {
      const note = `AI output rejected — authenticity audit failed: ${audit.hallucinations.slice(0, 3).join(", ")}`;
      return { text: template, ai: false, note };
    }
    return { text: out.trim() + "\n", ai: true };
  } catch (e) {
    return { text: template, ai: false, note: e.message.slice(0, 120) };
  }
}

/** Rewrite the template cover letter for this JD. Fallback: template. */
export async function tailorCoverLetter(ai, profile, job) {
  const template = templateCoverLetter(profile, job);
  if (!ai?.key) return { text: template, ai: false, note: "no AI provider configured" };
  const sys = "You are an expert cover-letter writer for tech roles. Rewrite the given cover letter to be warmer, more specific, and clearly tailored to the target job and company. Never invent facts, companies, or credentials. The input may lack some data: that is EXPECTED — work with what is provided, never refuse or comment on missing data. Only if the role is in a genuinely unrelated field where NO honest mapping exists, reply with exactly: SKIP. Under ~220 words. Output ONLY the letter text.";
  const usr = `Target job: ${job.title} at ${job.company}.\nKey requirements: ${(job.skills ?? []).join(", ") || "general engineering"}.\n\nTemplate letter:\n${template}\n\nRewrite it for this application.`;
  try {
    const out = await chatOnce(ai, [{ role: "system", content: sys }, { role: "user", content: usr }], 500);
    if (!out || out.trim().length < 50 || /```/.test(out)) return { text: template, ai: false, note: "AI output rejected — template used" };
    /* Authenticity Guard: audit the cover letter for hallucinations */
    const audit = await auditAuthenticity(ai, out.trim(), profile, job);
    if (!audit.ok) {
      const note = `AI output rejected — authenticity audit failed: ${audit.hallucinations.slice(0, 3).join(", ")}`;
      return { text: template, ai: false, note };
    }
    return { text: out.trim(), ai: true };
  } catch (e) {
    return { text: template, ai: false, note: e.message.slice(0, 120) };
  }
}

/* ─────────────────── 7-slot Archetype Resume Library ───────────────────
   Keeps max 7 tailored resumes — one per job archetype — so the user
   always has the best version for each career segment without drowning
   in hundreds of files. When a new tailored resume scores significantly
   better (+15% fit) than the slot's current resident, it replaces it.

   Archetypes are derived from the JD's core requirements:
     0: Frontend Heavy   (React/TypeScript/CSS/UI focus)
     1: Backend Heavy    (Node/Python/Java/databases focus)
     2: Fullstack Generalist (balanced frontend + backend)
     3: Lead/Management  (leadership, architecture, planning)
     4: Product-Focused  (product sense, UX, user outcomes)
     5: DevOps/Infra     (cloud, CI/CD, containers, infra)
     6: Data/ML          (analytics, ML, AI, data engineering)
*/

const ARCHETYPE_SLOTS = 7;
const REPLACEMENT_THRESHOLD = 0.15; // new must beat old by ≥15% fit

const ARCHETYPE_KEYWORDS = [
  [/react|typescript|css|html|javascript|vue|angular|svelte|tailwind|frontend|ui\/ux|webpack|vite/i, 0], // Frontend Heavy
  [/python|django|flask|java|spring|node\.js|express|sql|database|api|backend|java/i, 1],             // Backend Heavy
  [/full.?stack|react.*node|node.*react|next\.js|nest\.js|graphql|rest.*api/i, 2],                   // Fullstack Generalist
  [/lead|manager|architect|principal|staff|tech lead|engineering manager|cto/i, 3],                   // Lead/Management
  [/product|ux|user experience|design|user.*research|pm|product owner|agile|scrum/i, 4],              // Product-Focused
  [/devops|docker|kubernetes|k8s|terraform|ansible|cicd|ci\/cd|aws|gcp|azure|cloud|infrastructure/i, 5], // DevOps/Infra
  [/machine learning|ml|ai|data science|data analyst|spark|hadoop|tensorflow|pytorch|analytics/i, 6],  // Data/ML
];

/**
 * Determine the archetype slot (0-6) for a job based on its title + JD skills.
 * Falls back to -1 (unspecialized — stored in a general slot).
 */
export function classifyArchetype(job) {
  const text = `${job?.title || ''} ${(job?.skills || []).join(' ')} ${job?.description || ''}`.toLowerCase();
  let bestSlot = -1;
  let bestScore = 0;
  for (const [re, slot] of ARCHETYPE_KEYWORDS) {
    const matches = text.match(re);
    if (matches) {
      const score = matches.length;
      if (score > bestScore) { bestScore = score; bestSlot = slot; }
    }
  }
  return bestSlot; // -1 if no archetype keywords found
}

/**
 * Resume library entry: { slot, fitScore, text, jobTitle, company, at }
 */
function libraryPath() {
  return path.join(process.cwd(), 'freebuff-resume-library.json');
}

function loadLibrary() {
  try { return JSON.parse(readFileSync(libraryPath(), 'utf8')); } catch { return []; }
}

function saveLibrary(lib) {
  try { writeFileSync(libraryPath(), JSON.stringify(lib, null, 2)); } catch { /* best effort */ }
}

/**
 * Store a tailored resume in the library. If the slot is empty, add it.
 * If the slot is occupied, replace only if the new resume scores ≥15% better.
 * Returns the library entry that was stored (or null if rejected).
 */
export function storeResumeInLibrary(tailoredText, slot, fitScore, jobTitle, company) {
  if (slot < 0 || slot >= ARCHETYPE_SLOTS) return null;
  const lib = loadLibrary();
  const existing = lib.find(e => e.slot === slot);
  const entry = { slot, fitScore, text: tailoredText, jobTitle, company, at: Date.now() };
  if (!existing) {
    lib.push(entry);
  } else if (fitScore && existing.fitScore && fitScore > existing.fitScore * (1 + REPLACEMENT_THRESHOLD)) {
    // New resume is significantly better — replace
    lib[lib.indexOf(existing)] = entry;
  } else {
    return null; // Not good enough to replace
  }
  // Keep only the best per slot (max 7 entries total)
  const bestPerSlot = new Map();
  for (const e of lib) {
    const prev = bestPerSlot.get(e.slot);
    if (!prev || (e.fitScore || 0) > (prev.fitScore || 0)) {
      bestPerSlot.set(e.slot, e);
    }
  }
  const updated = [...bestPerSlot.values()].slice(0, ARCHETYPE_SLOTS);
  saveLibrary(updated);
  return entry;
}

/** Get the current library (max 7 entries) for user reference. */
export function getResumeLibrary() {
  return loadLibrary();
}

/**
 * Find the best resume in the library for a given job.
 * Returns the entry or null if no matching slot.
 */
export function findBestResumeForJob(job) {
  const slot = classifyArchetype(job);
  if (slot < 0) return null;
  const lib = loadLibrary();
  const entry = lib.find(e => e.slot === slot);
  return entry || null;
}

/** Both documents for one job (called per application). Now also stores in library. */
export async function buildKit(ai, profile, job) {
  const [resume, cover] = await Promise.all([tailorResume(ai, profile, job), tailorCoverLetter(ai, profile, job)]);
  return { resume: resume.text, coverLetter: cover.text, ai: resume.ai || cover.ai, notes: [resume.note, cover.note].filter(Boolean) };
}

/** Loads the admin-configured provider; exits cleanly when none is set. */
export async function loadAi({ token, projectRef }) {
  try {
    const cfg = await loadAiProviderConfig({ token, projectRef });
    if (cfg?.key && cfg?.base && cfg?.model) return cfg;
  } catch { /* fall through */ }
  return null;
}
