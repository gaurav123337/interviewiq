/* Line diff for the resume kit's "compare vs previous job" view. */

import { describe, expect, it } from "vitest";
import { diffLines } from "../services/diff";

describe("diffLines", () => {
  it("identical texts produce all 'same' lines", () => {
    const out = diffLines("a\nb\nc", "a\nb\nc");
    expect(out.every(l => l.type === "same")).toBe(true);
    expect(out.map(l => l.text)).toEqual(["a", "b", "c"]);
  });

  it("a line added at the end is an 'add'", () => {
    const out = diffLines("a\nb", "a\nb\nc");
    expect(out.map(l => l.type)).toEqual(["same", "same", "add"]);
    expect(out[2].text).toBe("c");
  });

  it("a removed line is a 'del'", () => {
    const out = diffLines("a\nb\nc", "a\nc");
    expect(out.map(l => l.type)).toEqual(["same", "del", "same"]);
    expect(out[1].text).toBe("b");
  });

  it("interleaves additions and removals in order", () => {
    const out = diffLines("a\nx\nb", "a\ny\nb");
    expect(out.filter(l => l.type === "del").map(l => l.text)).toEqual(["x"]);
    expect(out.filter(l => l.type === "add").map(l => l.text)).toEqual(["y"]);
    /* x (del) comes before y (add) in the walk */
    const order = out.map(l => l.type);
    expect(order.indexOf("del")).toBeLessThan(order.indexOf("add"));
  });

  it("a full rewrite is all del then all add", () => {
    const out = diffLines("old line", "new line");
    expect(out.map(l => l.type)).toEqual(["del", "add"]);
  });

  it("is safe with empty inputs", () => {
    expect(diffLines("", "")).toEqual([]);
    expect(diffLines("a", "").map(l => l.type)).toEqual(["del"]);
    expect(diffLines("", "a").map(l => l.type)).toEqual(["add"]);
  });
});
