import type { Answer, Session } from "./types";

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );

export const fmtTime = (s: number): string => {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60);
  const r = t % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

export function exportMd(session: Session, answers: Answer[]): string {
  const sum = answers.reduce((a, b) => a + b.fb.score, 0);
  const pct = answers.length ? sum / (answers.length * 5) : 0;
  const g = pct >= 0.9 ? "A" : pct >= 0.8 ? "B" : pct >= 0.65 ? "C" : pct >= 0.5 ? "D" : "F";
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
