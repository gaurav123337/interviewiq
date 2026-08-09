import type { Feedback, LevelId, SessionQuestion } from "../types";
import { scoreAnswer } from "./scoring";
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

/** Turns a scored answer into actionable coaching feedback. */
export function buildFeedback(userText: string, question: SessionQuestion): Feedback {
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
