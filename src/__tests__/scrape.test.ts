import { describe, expect, it } from "vitest";
import { buildUpsertSql, extractFromHtml, extractFromJson, sqlStr } from "../../scripts/scrape-lib.js";

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
