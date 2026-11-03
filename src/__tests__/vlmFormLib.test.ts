import { describe, expect, it } from "vitest";
import { MAX_VLM_FIELDS, MAX_VLM_FILLS_PER_ATTEMPT, parseVlmFields, vlmFieldsPrompt, vlmFillEligible } from "../../scripts/vlm-form-lib.js";

describe("vlm-form-lib gate", () => {
  it("attempts only when it can help: needs AI, needs an empty DOM extraction, owner rule can veto", () => {
    expect(vlmFillEligible({ fieldsCount: 0, hasAi: true })).toMatchObject({ ok: true });
    expect(vlmFillEligible({ fieldsCount: 0, hasAi: false }).ok).toBe(false); // no provider — nothing to call
    expect(vlmFillEligible({ fieldsCount: 3, hasAi: true }).ok).toBe(false); // DOM path owns it
    expect(vlmFillEligible({ fieldsCount: 0, hasAi: true, rules: { vlmFill: false } }))
      .toMatchObject({ ok: false, reason: "site rule vlmFill=false" });
  });
});

describe("vlm-form-lib prompt contract", () => {
  it("demands metadata ONLY — values are never the model's to supply", () => {
    const p = vlmFieldsPrompt("Killer Apply Co — Careers");
    expect(p.system).toContain("JSON array");
    expect(p.system).toContain("VERBATIM");
    expect(p.system).toContain("NEVER invent or suggest answer values");
    expect(p.user).toContain("Page title: Killer Apply Co — Careers");
    expect(vlmFieldsPrompt().user).not.toContain("Page title:"); // empty title → no line
  });
});

describe("vlm-form-lib reply parser", () => {
  const good = '[{"label":"First name","type":"text","required":true},{"label":"Notice period","type":"select","required":false,"options":["Immediate","30 days"]},{"label":"Portfolio","type":"other"}]';

  it("parses fenced or embedded JSON arrays", () => {
    expect(parseVlmFields("```json\n" + good + "\n```").fields).toHaveLength(3);
    expect(parseVlmFields("Here are the fields:\n" + good).fields[0]).toMatchObject({ label: "First name", fillable: true, required: true });
    expect(parseVlmFields("no json here").fields).toHaveLength(0);
    expect(parseVlmFields("[unclosed").fields).toHaveLength(0);
    expect(parseVlmFields(null).fields).toHaveLength(0);
  });

  it("marks act-on-able kinds fillable and routes risky kinds to needs-review, never fills them", () => {
    const { fields } = parseVlmFields(good);
    expect(fields[0].fillable).toBe(true); // text
    expect(fields[1].fillable).toBe(true); // select with options
    expect(fields[1].options).toEqual(["Immediate", "30 days"]);
    expect(fields[2].fillable).toBe(false); // "other" — untouched, honest skip
  });

  it("caps and sanitizes the reply (field ceiling, option list, malformed entries)", () => {
    const many = JSON.stringify(Array.from({ length: MAX_VLM_FIELDS + 5 }, (_, i) => ({ label: `F${i}`, type: "text" })));
    expect(parseVlmFields(many).fields).toHaveLength(MAX_VLM_FIELDS);
    const junk = '[{},{"label":123},{"label":"","type":"text"},{"label":"Ok","type":"text"},{"label":"NoOps","type":"select","options":"not an array"},{"label":"Capped","type":"text","options":["' + "x".repeat(200) + '","  ","Y",null,5,"Z"]}]';
    const parsed = parseVlmFields(junk);
    const capped = parsed.fields.find((f) => f.label === "Capped");
    expect(capped?.options).toEqual(["Y", "Z"]); // junk/drop/oversized options gone
    expect(parsed.fields.find((f) => f.label === "Ok")).toBeTruthy();
    expect(parsed.fields.find((f) => f.label === "")).toBeUndefined();
    expect(parsed.fields.find((f) => f.label === "NoOps")?.options ?? "missing").toEqual([]);
  });

  it("fill budget bounds per-attempt work (prompt-injection ceiling on fake painted fields)", () => {
    expect(MAX_VLM_FILLS_PER_ATTEMPT).toBeLessThanOrEqual(25);
    expect(MAX_VLM_FIELDS).toBeLessThanOrEqual(40);
  });
});
