import { describe, expect, it } from "vitest";
import { applyClean, buildCleanPrompt, parseCleanJson } from "../../scripts/ai-clean-lib.js";

const item = { question: "Design Pastebin.com", fieldId: "backend", level: "senior", meta: { topicOnly: true } };

describe("ai-clean-lib", () => {
  it("prompt embeds the no-verbatim-copying rule and the strict JSON contract", () => {
    const prompt = buildCleanPrompt(item);
    expect(prompt).toContain("NEVER reproduce any source text verbatim");
    expect(prompt).toContain('"question": string');
    expect(prompt).toContain("Design Pastebin.com");
  });

  it("parses strict JSON replies (with or without code fences)", () => {
    const good = '{"question":"Q","answer":"A","keyPoints":["k"],"difficulty":2,"company":null}';
    expect(parseCleanJson(good)).toMatchObject({ question: "Q", answer: "A", difficulty: 2 });
    expect(parseCleanJson("```json\n" + good + "\n```")).toMatchObject({ question: "Q" });
    expect(parseCleanJson("Here you go: " + good)).toMatchObject({ question: "Q" });
    expect(parseCleanJson("no json here")).toBeNull();
    expect(parseCleanJson("{broken")).toBeNull();
  });

  it("validates and normalizes the clean object", () => {
    const applied = applyClean(item, {
      question: "  Design Pastebin  ", answer: "  Explain trade-offs.  ",
      keyPoints: ["a", "b", "c", "d", "e", "f"], difficulty: "2", company: " "
    });
    expect(applied).toMatchObject({ question: "Design Pastebin", answer: "Explain trade-offs.", difficulty: 2, company: null });
    expect(applied?.keyPoints).toHaveLength(5);
  });

  it("rejects unusable output — never writes unparsable content", () => {
    expect(applyClean(item, null)).toBeNull();
    expect(applyClean(item, { question: "", answer: "A" })).toBeNull();
    expect(applyClean(item, { question: "Q", answer: "" })).toBeNull();
    /* out-of-range difficulty degrades to null rather than failing the whole item */
    expect(applyClean(item, { question: "Q", answer: "A", difficulty: 9 })?.difficulty).toBeNull();
  });
});
