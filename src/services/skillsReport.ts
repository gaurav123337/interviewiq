/* Skills-to-job report — a printable, PDF-friendly snapshot of the Skill
   Counselor's plan: target, current level, gaps, what changes, the 90-day
   milestones, and the app-suggested resources. Zero dependencies: renders a
   self-contained HTML document and calls the browser's print (→ Save as PDF).
   buildSkillsReportHtml is pure so it's unit-testable. */

export interface SkillsReportInput {
  candidate?: string;
  email?: string;
  fieldLabel: string;
  trackLabel: string;
  targetLabel: string;
  currentBandLabel: string;
  years: number | null;
  skills: string[];
  gaps: {
    name: string;
    bandLabel: string;
    difficulty: number;
    why: string;
    prerequisites?: string[];
    trend?: string;
  }[];
  deltaLines: string[];
  weeks: { week: number; title: string; hours: number; skillNames: string[]; done: boolean }[];
  resources: { skill: string; title: string; url: string; kind: string; free: boolean }[];
  generatedAt?: string;
}

const esc = (s: string): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildSkillsReportHtml(input: SkillsReportInput): string {
  const when = input.generatedAt ?? new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const dots = (d: number) => "●".repeat(Math.max(1, Math.min(3, d))) + "○".repeat(3 - Math.max(1, Math.min(3, d)));

  const skillsChips = input.skills.length
    ? input.skills.slice(0, 24).map(s => `<span class="chip">${esc(s)}</span>`).join("")
    : `<span class="muted">— add skills to your resume/profile to see them here</span>`;

  const gapsRows = input.gaps.length
    ? input.gaps.map(g => `
      <tr>
        <td><b>${esc(g.name)}</b>${g.prerequisites?.length ? `<div class="muted small">needs: ${esc(g.prerequisites.join(", "))}</div>` : ""}</td>
        <td class="nowrap">${esc(g.bandLabel)}</td>
        <td class="nowrap">${dots(g.difficulty)}</td>
        <td class="small">${esc(g.why)}</td>
        <td class="nowrap">${g.trend ? `<span class="trend">${esc(g.trend)}</span>` : "—"}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="muted">No gaps — you own every skill on this path. 🎉</td></tr>`;

  const deltaHtml = input.deltaLines.length
    ? input.deltaLines.map(l => `<li>${esc(l)}</li>`).join("")
    : `<li class="muted">No structural changes for this jump — focus on the gap skills above.</li>`;

  const weeksHtml = input.weeks.length
    ? input.weeks.map(w => `
      <div class="week ${w.done ? "done" : ""}">
        <span class="w-num">W${String(w.week).padStart(2, "0")}</span>
        <div class="w-body">
          <div class="w-title">${w.done ? "☑" : "☐"} ${esc(w.title)}</div>
          <div class="muted small">~${w.hours}h · ${esc(w.skillNames.join(" · "))}</div>
        </div>
      </div>`).join("")
    : `<p class="muted">Generate the 90-day plan in the Skill Counselor to include milestones here.</p>`;

  const resBySkill = new Map<string, typeof input.resources>();
  for (const r of input.resources) {
    const list = resBySkill.get(r.skill) ?? [];
    list.push(r);
    resBySkill.set(r.skill, list);
  }
  const resHtml = resBySkill.size
    ? [...resBySkill.entries()].map(([skill, list]) => `
      <div class="res-group">
        <div class="res-skill">${esc(skill)}</div>
        ${list.map(r => `
          <div class="res">
            <a href="${esc(r.url)}">${esc(r.title)}</a>
            <span class="muted small"> · ${esc(r.kind)} · ${r.free ? "free" : "paid"}</span>
          </div>`).join("")}
      </div>`).join("")
    : `<p class="muted">App-suggested resources for each gap skill will appear here.</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Skills-to-Job Report — InterviewIQ</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 40px 48px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 24px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
  .sub { color: #475569; font-size: 12.5px; }
  .muted { color: #64748b; }
  .small { font-size: 11.5px; }
  .nowrap { white-space: nowrap; }
  .trend { display: inline-block; padding: 1px 8px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-weight: 700; font-size: 11px; }
  .chip { display: inline-block; margin: 2px 3px 2px 0; padding: 2px 9px; border-radius: 999px; background: #f1f5f9; border: 1px solid #e2e8f0; font-size: 11.5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; }
  td { padding: 7px 8px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
  .week { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #eef2f7; }
  .week.done .w-title { color: #94a3b8; text-decoration: line-through; }
  .w-num { flex: none; font-weight: 800; color: #4f46e5; width: 34px; }
  .w-body { flex: 1; }
  .res-group { margin-bottom: 12px; }
  .res-skill { font-weight: 700; font-size: 12px; margin-bottom: 3px; }
  .res a { color: #4f46e5; text-decoration: none; }
  .foot { margin-top: 36px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; }
  @media print { body { padding: 20px 8px; } .no-print { display: none; } }
</style></head>
<body>
  <h1>Skills-to-Job Report</h1>
  <div class="sub">InterviewIQ · generated ${esc(when)}${input.candidate ? ` · ${esc(input.candidate)}` : ""}${input.email ? ` · ${esc(input.email)}` : ""}</div>

  <h2>🎯 Target</h2>
  <p><b>${esc(input.fieldLabel)} → ${esc(input.trackLabel)}</b> at <b>${esc(input.targetLabel)}</b>
  ${input.years != null ? ` · from ${esc(input.currentBandLabel)} (${input.years} yrs experience)` : ""}</p>
  <p class="small muted">Your profile skills:</p>
  <p>${skillsChips}</p>

  <h2>○ Gap analysis — ${input.gaps.length} skills to learn</h2>
  <table>
    <tr><th>Skill</th><th>Level</th><th>Difficulty</th><th>Why it matters</th><th>Market trend</th></tr>
    ${gapsRows}
  </table>

  <h2>✨ What changes at ${esc(input.targetLabel)}</h2>
  <ul>${deltaHtml}</ul>

  <h2>📅 90-day plan — ${input.weeks.length} weeks</h2>
  ${weeksHtml}

  <h2>🔗 App-suggested resources</h2>
  ${resHtml}

  <div class="foot">Generated by InterviewIQ — app-suggested links are safety-guarded and community-reviewed. Skills and gaps are derived strictly from your resume/profile.</div>
</body></html>`;
}

/** Opens the report in a print-ready window (Save as PDF). */
export function openSkillsReport(input: SkillsReportInput): void {
  const html = buildSkillsReportHtml(input);
  const w = window.open("", "_blank", "noopener");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  /* give the browser a beat to lay out the document, then offer print */
  setTimeout(() => { try { w.print(); } catch { /* popup blocked print — user can Ctrl+P */ } }, 400);
}
