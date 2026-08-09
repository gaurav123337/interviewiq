import type { Answer, Session } from "../types";
import { grade } from "../engine";

/** Renders a finished session (questions + answers + model answers) as Markdown for export. */
export function exportMd(session: Session, answers: Answer[]): string {
  const sum = answers.reduce((a, b) => a + b.fb.score, 0);
  const pct = answers.length ? sum / (answers.length * 5) : 0;
  const g = grade(pct);
  let md = `# InterviewIQ — ${session.meta.company} · ${session.meta.field} · ${session.meta.level}\n\n`;
  md += `**Score:** ${(pct * 5).toFixed(1)}/5 (${(pct * 100).toFixed(0)}%, grade ${g})\n\n`;
  answers.forEach((a, i) => {
    md += `## Q${i + 1}. ${a.q.q}\n\n`;
    md += `**Score:** ${a.fb.score}/5\n\n`;
    md += `**Your answer:**\n${a.user || "(no answer)"}\n\n`;
    md += `**Model answer:**\n${a.q.a}\n\n`;
    md += `**Key points:** ${(a.q.kp || []).join("; ")}\n\n---\n\n`;
  });
  return md;
}
