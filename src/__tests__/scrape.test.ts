import { describe, expect, it } from "vitest";
import {
  buildUpsertSql, extractCompanyList, extractFromHn, extractFromHtml,
  extractFromJson, extractFromMarkdown, sqlStr
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

  it("builds an idempotent upsert keyed on question text with provenance", () => {
    const sql = buildUpsertSql([
      { fieldId: "frontend", level: "senior", question: "What's hoisting?", answer: "A", keyPoints: ["scope"], sourceId: "src-a", sourceUrl: "https://example.com/a", meta: { company: "Google" } },
      { fieldId: "frontend", level: "senior", question: "What's hoisting?", answer: "A", keyPoints: ["scope"] }
    ]);
    expect(sql).toContain("on conflict (question) do nothing");
    expect(sql).toContain("source_id");
    expect(sql).toContain("source_url");
    expect(sql).toContain("meta");
    expect(sqlStr("it's fine")).toBe("'it''s fine'");
  });

  it("extracts company-grouped problem titles from bullets (facts only)", () => {
    const md = [
      "## Amazon",
      "- [Two Sum](https://leetcode.com/problems/two-sum/) Easy",
      "- [1. Two Sum](https://leetcode.com/problems/two-sum/) Easy",
      "- [LRU Cache](https://leetcode.com/problems/lru-cache/) Hard",
      "This is prose about the section, not a problem."
    ].join("\n");
    const items = extractCompanyList(md, { ...source, groupAs: "company" });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ question: "Two Sum", answer: "" });
    expect(items[0].meta).toMatchObject({ group: "Amazon", groupType: "company", difficulty: 1 });
    expect(items[1]?.meta?.difficulty).toBe(3);
    expect(items[1]?.question).toBe("LRU Cache");
  });

  it("extracts company-grouped problem titles from markdown table rows", () => {
    const md = [
      "## Amazon",
      "| Occurence | Problem | Difficulty | Solution |",
      "|---:|:---|:---|:---|",
      "| 117 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | [Java](https://example.com/x) |",
      "| 103 | [Number of Islands](https://leetcode.com/problems/number-of-islands/) | Medium | [Java](https://example.com/y) |",
      "[[back to top]](#company-index)"
    ].join("\n");
    const items = extractCompanyList(md, { ...source, groupAs: "company" });
    expect(items).toHaveLength(2);
    expect(items[0]?.question).toBe("Two Sum");
    expect(items[0]?.meta?.difficulty).toBe(1);
    expect(items[1]?.meta).toMatchObject({ group: "Amazon", difficulty: 2 });
  });

  it("extracts HN hits (official Algolia API) with provenance, filtering noise", () => {
    const body = {
      hits: [
        { objectID: "1", title: "Ask HN: Best interview questions to ask a company?", url: "https://news.ycombinator.com/item?id=1", points: 42, num_comments: 8, author: "alice" },
        { objectID: "2", title: "Show HN: My new todo app", url: "https://example.com", points: 5, num_comments: 0, author: "bob" },
        { objectID: "3", title: "A senior engineer's guide to the system design interview", url: "https://example.com/guide", points: 200, num_comments: 45, author: "carol" }
      ]
    };
    const items = extractFromHn(body, { ...source, fieldId: "fullstack" });
    expect(items).toHaveLength(2);
    expect(items[0].question).toContain("Ask HN");
    expect(items[0].meta).toMatchObject({ hnId: "1", points: 42, comments: 8, source: "hackernews" });
    expect(items[1].question).toContain("system design");
  });

  it("extracts `### Design X` topics heading-only (system-design-primer style)", () => {
    const md = [
      "# System Design Primer",
      "## Motivation",
      "Learn how to design large-scale systems.",
      "### Design Pastebin.com (or Bit.ly)",
      "A pastebin is a web application that stores text for sharing...",
      "### Step 1: Outline use cases, constraints, and assumptions",
      "Collect the use cases and constraints.",
      "### Design a web crawler",
      "A crawler downloads pages and extracts links..."
    ].join("\n");
    const items = extractFromMarkdown(md, { ...source, headingDepth: 3, questionFromHeading: true, headingPrefix: "Design " });
    const titles = items.map((i) => i.question);
    expect(titles).toContain("Design Pastebin.com (or Bit.ly)");
    expect(titles).toContain("Design a web crawler");
    /* junk instruction headings never become questions */
    expect(titles.some((t) => /Step 1|Motivation/.test(t))).toBe(false);
    /* body text is never copied into the question */
    expect(items[0].answer).toBe("");
  });
});
