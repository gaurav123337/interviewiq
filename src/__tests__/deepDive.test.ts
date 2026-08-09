import { describe, expect, it } from "vitest";
import { getDeepDive, hasDeepDive } from "../data/deepDive";

describe("topic deep-dive knowledge base", () => {
  it("resolves core topics to authored content with all sections", () => {
    for (const label of [
      "language basics",
      "testing fundamentals",
      "data structures",
      "debugging",
      "communication",
      "JavaScript / TypeScript",
      "React · Vue · Angular",
      "CSS & accessibility",
      "Web performance",
      "APIs & services",
      "Databases & caching",
      "system design",
      "Distributed systems",
      "design patterns",
      "code review",
    ]) {
      const dd = getDeepDive(label);
      expect(dd.concepts.length, `${label}: concepts`).toBeGreaterThanOrEqual(3);
      expect(dd.points.length, `${label}: points`).toBeGreaterThanOrEqual(3);
      expect(dd.traps.length, `${label}: traps`).toBeGreaterThanOrEqual(2);
      expect(dd.qa.length, `${label}: qa`).toBeGreaterThanOrEqual(1);
      expect(hasDeepDive(label), `${label}: hasDeepDive`).toBe(true);
    }
  });

  it("maps behavioral question strings to the STAR deep-dive", () => {
    for (const label of [
      "Tell me about a time you had a conflict with a teammate. How did you resolve it?",
      "Tell me about a time you failed.",
      "Describe a project you're most proud of.",
    ]) {
      const dd = getDeepDive(label);
      expect(dd.qa.length).toBeGreaterThanOrEqual(1);
      expect(hasDeepDive(label)).toBe(true);
    }
  });

  it("maps leadership/architecture labels to the leadership deep-dive", () => {
    for (const label of ["org-wide architecture", "technical strategy", "hiring bar"]) {
      const dd = getDeepDive(label);
      expect(dd.points.length).toBeGreaterThanOrEqual(3);
      expect(hasDeepDive(label)).toBe(true);
    }
  });

  it("never returns an empty panel — unknown topics get a structured fallback", () => {
    const dd = getDeepDive("some exotic topic that is not mapped");
    expect(dd.concepts.length).toBeGreaterThanOrEqual(3);
    expect(dd.points.length).toBeGreaterThanOrEqual(3);
    expect(dd.traps.length).toBeGreaterThanOrEqual(3);
    expect(dd.qa.length).toBe(1);
    expect(hasDeepDive("some exotic topic that is not mapped")).toBe(false);
  });

  it("author content is genuinely specific, not template filler", () => {
    const language = getDeepDive("language basics");
    expect(language.concepts.some(c => c.name.toLowerCase().includes("scope"))).toBe(true);
    expect(language.qa[0].a.length).toBeGreaterThan(80);
  });
});
