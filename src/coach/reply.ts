/* Offline coach reply pipeline — the "Socratic tutor" behind Knowledge mode.
   No network, no API key. Built in layers:
     1. Understand — concept-aware matching + intent classification (concepts.ts)
     2. Compare — per-key-point coverage (covered / partial / missing) + structural signals
     3. Respond — dialogue memory (never repeat a covered point), misconception
        guard, always ends with one probing question about the highest-value gap
     4. Grade — "grade my answer" runs the SAME engine the session uses for its
        final score, so coach advice and the submission grade always agree. */

import { fieldById } from "../data";
import { deepDiveCards } from "../data/deepDive";
import { grade, scoreAnswer } from "../engine";
import { publishedFor } from "../services/remoteConfig";
import type { LevelId, SessionQuestion } from "../types";
import {
  classifyIntent, conceptOverlap, cumulativeCoverage,
  detectMisconception, structuralSignals, textMatches, tokenize,
  type CoachIntent
} from "./concepts";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface CoachMsg { role: "user" | "assistant"; text: string }

export interface CoachContext {
  prompt: string;
  answer: string;
  kp: string[];
  fieldId?: string | null;
  levelId?: LevelId | null;
  /** Goal company id — used to rank the next-problem suggestion. */
  companyId?: string | null;
  /** Called with a problem id when the candidate accepts a suggestion. */
  onPractice?: (problemId: string) => void;
}

/* ------------------------------------------------------------------ */
/* Retrieval (the offline tutor's knowledge base)                      */
/* ------------------------------------------------------------------ */

const tokens = (s: string): Set<string> =>
  new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3));

/** Number of shared meaningful tokens between two strings. */
function overlap(a: string, b: string): number {
  const wa = tokens(a);
  let n = 0;
  for (const w of tokens(b)) if (wa.has(w)) n++;
  return n;
}

/** Retrieval pool — the current field's questions, the curated deep-dive
    knowledge base, and admin-published bank updates. */
function retrievalPool(ctx: CoachContext): { q: string; a: string }[] {
  const pool: { q: string; a: string }[] = [];
  const seen = new Set<string>();
  const push = (qa: { q: string; a: string }) => {
    if (qa.q && !seen.has(qa.q)) { seen.add(qa.q); pool.push(qa); }
  };
  if (ctx.fieldId) {
    const field = fieldById(ctx.fieldId);
    const levels = ctx.levelId ? [ctx.levelId] : field ? (Object.keys(field.questions) as LevelId[]) : [];
    for (const lv of levels) {
      for (const qa of field?.questions[lv] ?? []) push({ q: qa.q, a: qa.a });
      if (ctx.levelId) for (const qa of publishedFor(ctx.fieldId, ctx.levelId)) push({ q: qa.q, a: qa.a });
    }
  }
  for (const c of deepDiveCards()) push({ q: c.q, a: c.a });
  return pool;
}

function relatedQuestions(ctx: CoachContext, text: string, limit: number): { q: string; a: string }[] {
  return retrievalPool(ctx)
    .map(qa => ({ qa, s: overlap(qa.q, text) + overlap(qa.a, text) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(x => x.qa);
}

/* ------------------------------------------------------------------ */
/* Reply builder                                                       */
/* ------------------------------------------------------------------ */

/** Terms of the user's message echoed back so it feels like the coach read it. */
function echoTerms(text: string): string[] {
  const banned = new Set("about your their with have this that will would could there what when from into using just also then than some them they been were should think going like make really much because after before while where which these those other another first second need needs want wants things thing way ways look looks new good bad work works code app system data time".split(" "));
  return [...new Set(
    tokenize(text).filter(w => w.length > 3 && !banned.has(w))
  )].slice(0, 4);
}

/** True when the message carries real content beyond pleasantries. */
function hasContent(text: string): boolean {
  return text.replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter(w => w.length > 3).length >= 3;
}

/** The official session question shape for the current coach context —
    lets the coach grade with the exact same engine as a submission. */
function asSessionQuestion(ctx: CoachContext): SessionQuestion {
  return {
    q: ctx.prompt,
    a: ctx.answer,
    kp: ctx.kp ?? [],
    cat: "field",
    catLabel: "Technical",
    catColor: "#22d3ee",
    level: ctx.levelId ?? "mid",
    src: "coach"
  };
}

/** Prefixes each key point by its cumulative coverage state. */
function stateList(kp: string[], cov: ReturnType<typeof cumulativeCoverage>): string[] {
  const done = new Set(cov.covered);
  const partial = new Set(cov.partial);
  const out: string[] = [];
  for (const k of kp) {
    if (done.has(k)) out.push("✅ " + k + " — you've got this");
    else if (partial.has(k)) out.push("🟡 " + k + " — touched, not nailed");
    else out.push("· " + k);
  }
  return out;
}

const firstOf = (arr: string[], fallback = ""): string => arr[0] ?? fallback;

/* Quick-action commands (hint / grade / debate / next) aren't answers — when
   grading, walk back to the candidate's last real answer. */
const INTENT_CMD: CoachIntent[] = ["grade", "hint", "next", "explain", "compare"];
function lastRealAnswer(userMsgs: string[]): string {
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    if (INTENT_CMD.includes(classifyIntent(userMsgs[i]))) continue;
    return userMsgs[i];
  }
  return "";
}

/** The offline coach's reply — deterministic, grounded, stateful.
    `history` carries the conversation (including the current message) so the
    coach remembers what's already been covered, never repeats it, and probes
    the highest-value gap. */
export function coachReply(text: string, ctx: CoachContext, history: CoachMsg[] = []): string {
  const t = text.trim();
  const kp = ctx.kp ?? [];
  const prompt = ctx.prompt ?? "";
  const answer = (ctx.answer ?? "").trim();

  const userMsgs = history.filter(m => m.role === "user").map(m => m.text);
  const latestUser = lastRealAnswer(userMsgs);
  const cov = cumulativeCoverage([...userMsgs, t], kp, prompt);
  const intent = classifyIntent(t);
  const miscon = detectMisconception(t);
  const signals = structuralSignals(latestUser, ctx.levelId);
  const levelName = ctx.levelId ? ctx.levelId.charAt(0).toUpperCase() + ctx.levelId.slice(1) : "Mid";
  const terms = echoTerms(t);

  const lines: string[] = [];
  const probe = (gap: string): string => `What would “${gap}” look like in your answer?`;

  if (miscon) {
    lines.push("⚠️ Let me stop you there — " + miscon);
  }

  switch (intent) {
    case "grade": {
      const sq = asSessionQuestion(ctx);
      const r = scoreAnswer(latestUser, sq);
      const g = grade(r.pct);
      lines.push(`📊 If you submitted that now, the session engine scores it **${r.score}/5 · ${g}** (${Math.round(r.pct * 100)}% coverage, ${r.words} words).`);
      lines.push("Coverage per key point (concept-aware):");
      lines.push(stateList(kp, cov).join("\n"));
      const sig: string[] = [];
      sig.push(`${signals.words}w (${levelName} expects ~${signals.expected}+)`);
      sig.push(signals.structured ? "structure ✅" : "structure ❌");
      sig.push(signals.example ? "example ✅" : "example ❌");
      sig.push(signals.tradeoffs ? "tradeoffs ✅" : "tradeoffs ❌");
      sig.push(`${signals.vocab} concepts named`);
      lines.push("Signals: " + sig.join(" · "));
      if (r.missed.length) {
        lines.push(`To reach a 4+, add: ${firstOf(r.missed)}.`);
        lines.push(probe(firstOf(r.missed)));
      } else {
        lines.push("You're covering everything on the checklist — push further: what trade-off would you defend if the interviewer pushed back?");
      }
      break;
    }

    case "hint": {
      lines.push("🧭 Hint — break the question into parts before answering. A strong reply covers:");
      lines.push(stateList(kp, cov).join("\n"));
      if (answer) lines.push("Work toward the outline: " + answer.slice(0, 220) + (answer.length > 220 ? "…" : ""));
      lines.push("Which of those feels hardest for you?");
      break;
    }

    case "explain": {
      lines.push("Here's the core idea: " + (answer || "see the key points below."));
      if (kp.length) lines.push("Interviewers at this level listen for: " + kp.join(" · "));
      lines.push("Want me to unpack any one of those in more depth?");
      break;
    }

    case "compare": {
      lines.push(`Your take is on: ${terms.length ? terms.join(" · ") : "your approach"}. The model answer's opening move: ${firstOf(kp) || answer.slice(0, 160)}.`);
      if (cov.missing.length) lines.push("Where they diverge — you haven't hit: " + cov.missing.join(" · "));
      if (answer) lines.push("The model answer reasons through: " + answer.slice(0, 240) + (answer.length > 240 ? "…" : ""));
      lines.push(probe(firstOf(cov.missing, "the main trade-off")));
      break;
    }

    case "debate": {
      lines.push("🤔 Fair challenge. The model answer's position: " + (answer.slice(0, 300) || "see the key points — that's the position interviewers expect."));
      if (kp.length) lines.push("What it's graded on: " + kp.join(" · "));
      if (cov.missing.length) lines.push("Your version doesn't yet cover: " + cov.missing.join(" · "));
      lines.push("What's your strongest counter — and the trade-off behind it?");
      break;
    }

    case "approach":
    case "other": {
      if (intent === "other" && !hasContent(t)) {
        lines.push("Tell me your approach and I'll compare it with the model answer — or ask for a hint if you're stuck.");
        if (answer) lines.push("Reference outline: " + answer.slice(0, 200) + (answer.length > 200 ? "…" : ""));
        break;
      }
      lines.push("✅ I read that you're thinking about: " + (terms.length ? terms.join(" · ") : "your approach") + ". Let's stress-test it against what this question is graded on.");
      if (cov.covered.length) lines.push("✅ Covered: " + cov.covered.join(" · "));
      if (cov.partial.length) lines.push("🟡 Touched but not nailed: " + cov.partial.join(" · "));
      if (cov.missing.length) lines.push("Don't miss: " + cov.missing.join(" · "));
      if (answer) lines.push("The model answer reasons through: " + answer.slice(0, 240) + (answer.length > 240 ? "…" : ""));
      if (cov.missing.length) lines.push(probe(firstOf(cov.missing)));
      else if (cov.partial.length) lines.push(probe(firstOf(cov.partial)));
      else lines.push("What trade-off would you call out if the interviewer pushed back?");
      break;
    }

    case "next": {
      lines.push("🎯 From this discussion, the highest-value topics are:");
      lines.push((cov.missing.length ? cov.missing : kp).slice(0, 4).map((k, i) => `${i + 1}. ${k}`).join("\n"));
      lines.push("Study them in that order, then come back and I'll drill you on the first one.");
      break;
    }

    case "thanks": {
      lines.push("Anytime — keep going!");
      if (cov.missing.length) lines.push(probe(firstOf(cov.missing)));
      break;
    }

    case "greeting": {
      lines.push("Hi! I'm your coach for this question — " + prompt.slice(0, 120) + (prompt.length > 120 ? "…" : ""));
      lines.push("Tell me your approach and I'll compare it with the model answer — or ask for a hint if you're stuck.");
      break;
    }
  }

  const related = relatedQuestions(ctx, t, 2);
  if (related.length) {
    lines.push("📚 Related practice: " + related.map(r => "“" + r.q + "”").join(" · "));
  }

  return lines.join("\n\n");
}

/** Backward-compatible single-turn entry point (used by tests). */
export function localCoachReply(text: string, ctx: CoachContext): string {
  return coachReply(text, ctx, [{ role: "user", text }]);
}

/* Small re-export so graders outside this module stay in sync with the
   concept-aware matcher (the session engine uses textMatches directly). */
export { textMatches, conceptOverlap };
