import type { Feedback, LevelId, SessionQuestion } from "../types";
import { scoreAnswer } from "./scoring";
import { STAR_ELEMENTS, scoreStar } from "./star";
import { pickN } from "./random";

const LEVEL_TIPS: Record<LevelId, string> = {
  junior: "At junior level, showing a clear, correct reasoning process matters more than perfect answers.",
  mid: "At mid level, interviewers want structured answers: approach, implementation, and tradeoffs.",
  senior: "At senior level, lead with the tradeoffs — interviewers are evaluating judgment, not just correctness.",
  staff: "At staff level, connect your answer to org-level impact: leverage, risk, and how the decision scales.",
  principal: "At principal level, frame answers around org-wide strategy and high-leverage bets.",
  cto: "At CTO level, answers should land in business terms: cost, risk, people, and outcomes.",
  ceo: "At CEO level, everything ties back to strategy, markets, and the people who execute it."
};

/* STAR coach — behavioral answers are scored on story structure, not key points. */
function buildStarFeedback(userText: string, _question: SessionQuestion): Feedback {
  const r = scoreStar(userText);
  const strengths: string[] = [];
  const gaps: string[] = [];
  if (r.present.includes("S")) strengths.push("You set the scene — the situation is concrete and easy to follow.");
  if (r.present.includes("T")) strengths.push("You named your task or goal — what you were responsible for.");
  if (r.present.includes("A")) strengths.push("You described your actions in first person — specific and ownable.");
  if (r.present.includes("R")) strengths.push("You closed with a result — impact, outcome, or a lesson learned.");
  if (!strengths.length) strengths.push("You engaged with the question — now let's structure it as a STAR story.");
  if (r.words > 0 && r.words < 40) gaps.push(`Your answer was brief (${r.words} words) — a behavioral answer needs a full story arc, not a summary.`);
  for (const e of STAR_ELEMENTS) {
    if (r.missing.includes(e.id)) gaps.push(`${e.label}: ${e.hint}`);
  }
  if (r.missing.includes("A")) gaps.push("Lead with first-person actions ('I built…', 'I drove…') — interviewers want to hear what YOU did.");
  if (r.missing.includes("R") && r.present.length >= 3) gaps.push("Close with a measured result — numbers or a concrete outcome beat 'it went well'.");
  if (!r.missing.includes("A") && !r.missing.includes("R")) {
    gaps.push("One more level: reflect on what you learned — self-awareness separates strong stories from great ones.");
  }
  return { ...r, covered: r.present.map(id => id + " present"), missed: r.missing.map(id => id + " missing"), strengths, gaps };
}

/** Turns a scored answer into actionable coaching feedback. */
export function buildFeedback(userText: string, question: SessionQuestion): Feedback {
  if (question.cat === "behavioral") {
    return buildStarFeedback(userText, question);
  }
  const r = scoreAnswer(userText, question);
  const strengths: string[] = [];
  const gaps: string[] = [];
  if (r.score === 0) {
    strengths.push("You submitted an empty answer — every answer, even a partial one, is a chance to show your reasoning.");
    gaps.push("Structure your answer: state your approach, walk through it, then summarize the tradeoffs.");
  } else {
    if (r.covered.length) {
      pickN(r.covered, Math.min(2, r.covered.length)).forEach(kp => strengths.push(`You touched on: ${kp}.`));
    } else {
      strengths.push("You engaged with the question — keep building the habit of structuring answers (approach → reasoning → tradeoffs).");
    }
    if (r.missed.length) {
      pickN(r.missed, Math.min(3, r.missed.length)).forEach(kp => gaps.push(`Consider covering: ${kp}.`));
    }
    if (r.words < 25 && r.score >= 1) {
      gaps.push(`Your answer was brief (${r.words} words). Interviewers reward concrete detail — add an example or walk through your reasoning step by step.`);
    }
    if (r.words >= 25 && r.score <= 2) {
      gaps.push("Length isn't the issue — coverage is. Re-read the model answer and note which key points you missed.");
    }
    gaps.push(LEVEL_TIPS[question.level]);
  }
  return { ...r, strengths, gaps };
}
