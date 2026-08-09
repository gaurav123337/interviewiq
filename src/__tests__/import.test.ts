import { describe, expect, it } from "vitest";
import { parseQuestionBatch } from "../services/import";

describe("bulk question import parser", () => {
  it("parses a JSON array of questions", () => {
    const { ok, skipped } = parseQuestionBatch(JSON.stringify([
      { fieldId: "frontend", level: "senior", question: "How do you handle state?", answer: "Keep it close.", keyPoints: ["state", "trade-offs"] },
      { fieldId: "backend", level: "mid", question: "Design a rate limiter?", answer: "Token bucket.", keyPoints: ["token bucket", "backpressure"] }
    ]));
    expect(skipped).toEqual([]);
    expect(ok).toHaveLength(2);
    expect(ok[0]).toMatchObject({ fieldId: "frontend", level: "senior" });
    expect(ok[1].keyPoints).toHaveLength(2);
  });

  it("parses pipe-separated CSV lines", () => {
    const { ok, skipped } = parseQuestionBatch([
      "frontend|junior|What is the box model?|Content, padding, border, margin|box model, layout",
      "frontend|senior|Explain flexbox vs grid?|One axis vs two axes|layout, flexbox"
    ].join("\n"));
    expect(skipped).toEqual([]);
    expect(ok).toHaveLength(2);
    expect(ok[0].answer).toContain("padding");
    expect(ok[0].keyPoints).toEqual(["box model", "layout"]);
  });

  it("skips invalid rows with reasons, never silently drops", () => {
    const { ok, skipped } = parseQuestionBatch([
      "frontend|senior|A valid question?|answer",
      "bogus-field|senior|What is this?|answer",
      "frontend|director|What is this?|answer",
      "frontend|senior||answer"
    ].join("\n"));
    expect(ok).toHaveLength(1);
    expect(skipped).toHaveLength(3);
    expect(skipped[0].reason).toContain("unknown field");
    expect(skipped[1].reason).toContain("unknown level");
    expect(skipped[2].reason).toContain("missing question");
  });

  it("falls back to CSV when JSON fails to parse", () => {
    const { ok } = parseQuestionBatch("{ not valid json but has a question?");
    expect(Array.isArray(ok)).toBe(true);
  });
});
