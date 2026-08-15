import { describe, it, expect } from "vitest";
import { buildSkillsReportHtml, type SkillsReportInput } from "../../src/services/skillsReport";

const input: SkillsReportInput = {
  candidate: "Aarav Kumar",
  email: "aarav@example.com",
  fieldLabel: "Frontend",
  trackLabel: "React Specialist",
  targetLabel: "Senior",
  currentBandLabel: "Mid",
  years: 3,
  skills: ["React", "TypeScript", "CSS"],
  gaps: [
    { name: "Web Performance", bandLabel: "Senior", difficulty: 2, why: "Speed is a senior-level signal.", trend: "🔥 Growing" }
  ],
  deltaLines: ["Own architecture decisions for a team's frontend."],
  weeks: [{ week: 1, title: "Performance foundations", hours: 4, skillNames: ["Web Performance"], done: false }],
  resources: [{ skill: "Web Performance", title: "web.dev Learn Performance", url: "https://web.dev/learn", kind: "guide", free: true }],
  generatedAt: "15 Aug 2026"
};

describe("skills report", () => {
  it("renders every section", () => {
    const html = buildSkillsReportHtml(input);
    expect(html).toContain("Skills-to-Job Report");
    expect(html).toContain("Frontend → React Specialist");
    expect(html).toContain("Gap analysis — 1 skills to learn");
    expect(html).toContain("Web Performance");
    expect(html).toContain("What changes at Senior");
    expect(html).toContain("90-day plan — 1 weeks");
    expect(html).toContain("App-suggested resources");
  });

  it("escapes user content", () => {
    const evil = buildSkillsReportHtml({
      ...input,
      candidate: "<img src=x onerror=alert(1)>",
      skills: ["<script>alert(1)</script>"]
    });
    expect(evil).not.toContain("<img src=x onerror=alert(1)>");
    expect(evil).not.toContain("<script>alert(1)</script>");
    expect(evil).toContain("&lt;script&gt;");
  });

  it("handles empty states gracefully", () => {
    const empty = buildSkillsReportHtml({
      ...input,
      gaps: [],
      weeks: [],
      resources: [],
      deltaLines: []
    });
    expect(empty).toContain("No gaps — you own every skill on this path");
    expect(empty).toContain("Generate the 90-day plan");
  });
});
