import { beforeEach, describe, expect, it } from "vitest";
import type { CareerGoal, SavedAnswer, SavedSession } from "../types";
import { getProgress, saveGoal, saveProfile } from "../services/goal";
import { applySessionToProgress, buildRoadmap, exportRoadmapMarkdown } from "../services/roadmap";

const GOAL: CareerGoal = {
  currentLevel: "senior",
  targetLevel: "staff",
  fieldId: "backend",
  companyId: "general",
  targetDate: "2026-12-01",
  hoursPerWeek: 5,
  createdAt: 0
};

beforeEach(() => {
  localStorage.clear();
  saveGoal(GOAL);
  saveProfile({ goal: GOAL, skills: [] });
});

const qa = (q: string): SavedAnswer => ({
  q: { q, a: "answer", kp: [], cat: "field", catLabel: "Field", catColor: "", level: "staff", src: "x" },
  user: "good answer",
  score: 4,
  pct: 0.8
});

describe("roadmap markdown export", () => {
  it("renders the goal, weeks, priorities, and resources", () => {
    const sessions: SavedSession[] = [];
    const roadmap = buildRoadmap(GOAL, { goal: GOAL, skills: [] }, sessions);
    const md = exportRoadmapMarkdown(roadmap);
    expect(md).toContain("Career Roadmap");
    expect(md).toContain("Week 1");
    expect(md).toContain("- [ ]");
    expect(md).toContain("🔴");
    expect(md).toContain("Resources:");
    expect(md).toContain(GOAL.targetDate);
  });
});

describe("practice feedback loop", () => {
  it("marks matching roadmap topics done when answered well", () => {
    const sessions: SavedSession[] = [];
    const roadmap = buildRoadmap(GOAL, { goal: GOAL, skills: [] }, sessions);
    const architecture = roadmap.weeks.flatMap(w => w.topics).find(t => t.label.toLowerCase().includes("architectur"));
    expect(architecture).toBeTruthy();

    /* answering an architecture question at 80% marks the topic done */
    applySessionToProgress(GOAL, [qa("Explain microservices architecture tradeoffs for a payments platform")]);
    const progress = getProgress();
    expect(progress.completed).toContain(architecture!.id);
  });

  it("ignores weak answers (below 70%)", () => {
    const weak: SavedAnswer = { ...qa("Explain microservices architecture tradeoffs"), pct: 0.4, score: 2 };
    applySessionToProgress(GOAL, [weak]);
    expect(getProgress().completed).toHaveLength(0);
  });
});
