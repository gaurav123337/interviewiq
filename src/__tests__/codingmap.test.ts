import { describe, expect, it } from "vitest";
import { CODING_PROBLEMS } from "../data/coding";
import { codingForTopicLabels } from "../data/codingMap";

const ids = (labels: string[]) => codingForTopicLabels(labels).map(p => p.id);

describe("roadmap → coding mapping", () => {
  it("data structures maps to the curated problems", () => {
    const got = ids(["data structures"]);
    expect(got).toContain("two-sum");
    expect(got).toContain("valid-parens");
    expect(got).toContain("binary-search");
    expect(codingForTopicLabels(["data structures"], 6).some(p => p.id === "fn-lru-cache")).toBe(true);
  });

  it("JavaScript topics map to function challenges", () => {
    const got = ids(["JavaScript / TypeScript"]);
    expect(got).toContain("fn-debounce");
    expect(got).toContain("fn-throttle");
    expect(got).toContain("fn-deep-clone");
    expect(codingForTopicLabels(["JavaScript / TypeScript"], 6).some(p => p.id === "fn-promise-all")).toBe(true);
  });

  it("CSS/accessibility topics map to UI problems", () => {
    const got = ids(["CSS & accessibility"]);
    expect(got).toContain("ui-tooltip");
    expect(got).toContain("ui-theme-toggle");
  });

  it("React/Vue weeks surface framework challenges", () => {
    const got = codingForTopicLabels(["React · Vue · Angular"], 6).map(p => p.id);
    expect(got).toContain("ui-react-counter");
    expect(got).toContain("ui-vue-todo");
  });

  it("advanced UI problems reach the code-focus card via their topics", () => {
    expect(codingForTopicLabels(["DOM & browser APIs"], 6).some(p => p.id === "ui-toast")).toBe(true);
    expect(codingForTopicLabels(["DOM & browser APIs"], 6).some(p => p.id === "ui-drag-drop")).toBe(true);
    expect(codingForTopicLabels(["Web performance"], 6).some(p => p.id === "ui-virtual-list")).toBe(true);
  });

  it("web performance maps to the virtual list + throttling", () => {
    const got = codingForTopicLabels(["Web performance"], 4).map(p => p.id);
    expect(got).toContain("ui-virtual-list");
    expect(got).toContain("fn-throttle");
  });

  it("respects the limit", () => {
    expect(codingForTopicLabels(["data structures"], 2).length).toBe(2);
  });

  it("never returns unknown problems", () => {
    const known = new Set(CODING_PROBLEMS.map(p => p.id));
    for (const p of codingForTopicLabels(["data structures", "JavaScript / TypeScript", "system design", "random unknown topic"])) {
      expect(known.has(p.id)).toBe(true);
    }
  });

  it("falls back to a non-empty pick for unmapped topics", () => {
    const got = codingForTopicLabels(["unmapped topic zzz"]);
    expect(got.length).toBeGreaterThan(0);
  });

  it("no duplicate problems across a week", () => {
    const got = codingForTopicLabels(["data structures", "algorithms", "JavaScript / TypeScript", "Web performance"], 10);
    expect(new Set(got.map(p => p.id)).size).toBe(got.length);
  });
});
