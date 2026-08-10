// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { deepEqual, runFnTests } from "../services/runner";

describe("deepEqual", () => {
  it("compares primitives and NaN", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(1, "1")).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(undefined, undefined)).toBe(true);
  });

  it("compares arrays and nested objects structurally", () => {
    expect(deepEqual([1, [2, [3]]], [1, [2, [3]]])).toBe(true);
    expect(deepEqual([1, 2], [1, 3])).toBe(false);
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("compares dates by instant and rejects date-vs-object", () => {
    expect(deepEqual(new Date("2024-01-01"), new Date("2024-01-01"))).toBe(true);
    expect(deepEqual(new Date("2024-01-01"), new Date("2024-01-02"))).toBe(false);
    expect(deepEqual(new Date("2024-01-01"), {})).toBe(false);
  });
});

/* jsdom has no Worker → runFnTests uses the inline fallback (the same path the
   browser takes is the worker; both share the loop logic via the worker source). */
describe("runFnTests (inline fallback)", () => {
  it("calls a plain function with args and deep-compares the result", async () => {
    const results = await runFnTests(
      "function add(a, b) { return a + b; }",
      [{ args: [1, 2], expect: 3 }, { args: [10, 20], expect: 30 }],
      "add"
    );
    expect(results.every(r => r.pass)).toBe(true);
  });

  it("awaits async functions and rejects with a message on throw", async () => {
    const results = await runFnTests(
      "async function double(x) { return x * 2; }",
      [{ args: [4], expect: 8 }],
      "double"
    );
    expect(results[0].pass).toBe(true);
    const boom = await runFnTests(
      "function boom() { throw new Error('kaboom'); }",
      [{ args: [], expect: 1 }],
      "boom"
    );
    expect(boom[0].pass).toBe(false);
    expect(boom[0].error).toContain("kaboom");
  });

  it("hands the function to a drive harness when provided", async () => {
    const results = await runFnTests(
      "function once(fn) { let called = false; return (...a) => { if (called) return undefined; called = true; return fn(...a); }; }",
      [{
        label: "runs the inner fn once",
        args: [],
        drive: async (once) => {
          let n = 0;
          const f = (once as (fn: () => number) => () => number)(() => ++n);
          f(); f(); f();
          return n;
        },
        expect: 1
      }],
      "once"
    );
    expect(results[0].pass).toBe(true);
  });

  it("reports a missing function by name", async () => {
    const results = await runFnTests("const x = 1;", [{ args: [], expect: 1 }], "mystery");
    expect(results[0].pass).toBe(false);
    expect(results[0].error).toContain("mystery");
  });

  it("reports compile errors", async () => {
    const results = await runFnTests("function broken( {", [{ args: [], expect: 1 }], "broken");
    expect(results[0].pass).toBe(false);
    expect(results[0].error).toContain("Compile error");
  });

  it("deep-compares object results (deepClone style)", async () => {
    const results = await runFnTests(
      "function clone(v) { return JSON.parse(JSON.stringify(v)); }",
      [{ args: [{ a: [1, { b: 2 }] }], expect: { a: [1, { b: 2 }] } }],
      "clone"
    );
    expect(results[0].pass).toBe(true);
  });
});
