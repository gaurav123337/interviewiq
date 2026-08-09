import { describe, expect, it } from "vitest";
import {
  buildUpsertSql, extractFromHtml, extractFromJson, extractFromMarkdown, sqlStr
} from "../../scripts/scrape-lib.js";

const source = { fieldId: "frontend", level: "senior", keyPoints: [] };

describe("scraper extraction", () => {
  it("extracts from a JSON array and applies source defaults", () => {
    const items = extractFromJson({ questions: [{ question: "What is hoisting?", answer: "Names resolve before execution." }] }, source);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ fieldId: "frontend", level: "senior", question: "What is hoisting?" });
  });

  it("lets items override field/level", () => {
    const [item] = extractFromJson([{ fieldId: "backend", level: "junior", question: "Q?", answer: "A" }], source);
    expect(item?.fieldId).toBe("backend");
    expect(item?.level).toBe("junior");
  });

  it("drops items without a question or with an unknown shape", () => {
    expect(extractFromJson([{ question: "" }, { foo: 1 }], source)).toHaveLength(0);
    expect(extractFromJson({ notAnArray: true }, source)).toHaveLength(0);
  });

  it("extracts question-like lines from HTML", () => {
    const items = extractFromHtml(
      "<h1>Questions</h1><ul><li>How would you design a URL shortener?</li><li>This is just prose.</li></ul>",
      source
    );
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].question).toContain("URL shortener");
  });

  it("parses numbered `N. ### Q` + answer-body markdown (sudheerj style)", () => {
    const md = [
      "# JS Questions",
      "",
      "1. ### What is a prototype chain",
      "Every object has an internal link to another object, its prototype.",
      "#### Note",
      "This subheading belongs to the answer.",
      "",
      "2. ### What is JSON",
      "A lightweight data-interchange format."
    ].join("\n");
    const items = extractFromMarkdown(md, source);
    expect(items).toHaveLength(2);
    expect(items[0].question).toBe("What is a prototype chain");
    expect(items[0].answer).toContain("Every object has an internal link");
    /* answer subheadings must not spawn new questions in numbered mode */
    expect(items[0].answer).toContain("This subheading");
    expect(items[1].question).toBe("What is JSON");
  });

  it("parses `#### Topic` + question sentence markdown (backend style)", () => {
    const md = [
      "### <a name='patterns'>Questions about Design Patterns:</a>",
      "#### Globals Are Evil",
      "Why are global and static objects evil? Can you show it with a code example?",
      "",
      "#### Law of Demeter",
      "Each unit should only talk to its immediate friends.",
      "",
      "## Some Other Section",
      "Prose that is not a question."
    ].join("\n");
    const items = extractFromMarkdown(md, source);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0].question).toContain("Globals Are Evil");
    expect(items[0].question).toContain("Why are global and static objects evil");
    expect(items[0].answer).toBe("");
    expect(items[1].question).toContain("Law of Demeter");
    expect(items[1].question).toContain("Each unit should only talk to its immediate friends");
  });

  it("falls back to line-based `?` questions and strips difficulty emoji", () => {
    const md = [
      "## Supervised machine learning",
      "",
      "**What is supervised machine learning? 👶**",
      "**Explain the bias-variance tradeoff? 🚀**",
      "* Legend: 👶 easy ⭐️ medium"
    ].join("\n");
    const items = extractFromMarkdown(md, source);
    expect(items).toHaveLength(2);
    expect(items[0].question).toBe("What is supervised machine learning?");
    expect(items[1].question).toBe("Explain the bias-variance tradeoff?");
  });

  it("builds an idempotent upsert keyed on question text", () => {
    const sql = buildUpsertSql([
      { fieldId: "frontend", level: "senior", question: "What's hoisting?", answer: "A", keyPoints: ["scope"] },
      { fieldId: "frontend", level: "senior", question: "What's hoisting?", answer: "A", keyPoints: ["scope"] }
    ]);
    expect(sql).toContain("on conflict (question) do nothing");
    expect(sql.match(/values/g)).not.toBeNull();
    expect(sqlStr("it's fine")).toBe("'it''s fine'");
  });
});
