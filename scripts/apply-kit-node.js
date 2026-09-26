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

async function chatOnce(ai, messages, maxTokens) {
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
    return body.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/** Rewrite the template resume for this JD. Fallback: template (never throws). */
export async function tailorResume(ai, profile, job) {
  const template = templateResume(profile, job);
  if (!ai?.key) return { text: template, ai: false, note: "no AI provider configured" };
  const sys = "You are an expert resume writer for tech roles. Rewrite the given resume to be sharper, more concrete, and tailored to the target job. Keep the same sections and facts — never invent experience, companies, or credentials. Use action verbs and quantify impact where the facts allow. Under ~320 words. Output ONLY the resume text.";
  const usr = `Target job: ${job.title} at ${job.company}.\nKey requirements: ${(job.skills ?? []).join(", ") || "general engineering"}.\n\nCurrent resume:\n${template}\n\nRewrite it tailored to this job.`;
  try {
    const out = await chatOnce(ai, [{ role: "system", content: sys }, { role: "user", content: usr }], 800);
    if (!out || out.trim().length < 50 || /```/.test(out)) return { text: template, ai: false, note: "AI output rejected — template used" };
    return { text: out.trim() + "\n", ai: true };
  } catch (e) {
    return { text: template, ai: false, note: e.message.slice(0, 120) };
  }
}

/** Rewrite the template cover letter for this JD. Fallback: template. */
export async function tailorCoverLetter(ai, profile, job) {
  const template = templateCoverLetter(profile, job);
  if (!ai?.key) return { text: template, ai: false, note: "no AI provider configured" };
  const sys = "You are an expert cover-letter writer for tech roles. Rewrite the given cover letter to be warmer, more specific, and clearly tailored to the target job and company. Never invent facts, companies, or credentials. Under ~220 words. Output ONLY the letter text.";
  const usr = `Target job: ${job.title} at ${job.company}.\nKey requirements: ${(job.skills ?? []).join(", ") || "general engineering"}.\n\nTemplate letter:\n${template}\n\nRewrite it for this application.`;
  try {
    const out = await chatOnce(ai, [{ role: "system", content: sys }, { role: "user", content: usr }], 500);
    if (!out || out.trim().length < 50 || /```/.test(out)) return { text: template, ai: false, note: "AI output rejected — template used" };
    return { text: out.trim(), ai: true };
  } catch (e) {
    return { text: template, ai: false, note: e.message.slice(0, 120) };
  }
}

/** Both documents for one job (called per application). */
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
