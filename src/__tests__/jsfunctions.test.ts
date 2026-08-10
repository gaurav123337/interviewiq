// @vitest-environment jsdom
/* Bank self-test — the quality gate that keeps the function bank honest:
   each problem's `reference` implementation must pass its own visible + hidden
   tests through the real judge. A broken problem, bad test, or drifting
   reference fails here, so the bank can never silently ship a liar. */

import { describe, expect, it } from "vitest";
import { JS_FUNCTION_PROBLEMS } from "../data/codingBank/jsFunctions";
import { runFnTests } from "../services/runner";
import type { FnTest } from "../data/coding";

/* The production worker rehydrates drive functions from their stringified form
   ((0, eval) of toString()). Round-tripping here catches drives that secretly
   close over module scope — which would throw in the worker but pass inline. */
const roundTripped = (suite: FnTest[]): FnTest[] =>
  suite.map(t => t.drive
    ? { ...t, drive: (0, eval)(`(${t.drive.toString()})`) as FnTest["drive"] }
    : t);

describe("JS function bank self-test", () => {
  it("every reference solution passes its own full suite", async () => {
    expect(JS_FUNCTION_PROBLEMS.length).toBeGreaterThanOrEqual(20);
    const failures: string[] = [];
    for (const p of JS_FUNCTION_PROBLEMS) {
      const suite = [...p.tests, ...(p.hidden ?? [])];
      const results = await runFnTests(p.reference, suite, p.fn.name);
      const bad = results.filter(r => !r.pass);
      if (bad.length > 0) {
        failures.push(`${p.id}: ${bad.map(b => `${b.label || "case"}${b.error ? ` (${b.error})` : ""}`).join("; ")}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every reference passes with worker-style stringified drives", async () => {
    const failures: string[] = [];
    for (const p of JS_FUNCTION_PROBLEMS) {
      const suite = roundTripped([...p.tests, ...(p.hidden ?? [])]);
      const results = await runFnTests(p.reference, suite, p.fn.name);
      const bad = results.filter(r => !r.pass);
      if (bad.length > 0) {
        failures.push(`${p.id}: ${bad.map(b => `${b.label || "case"}${b.error ? ` (${b.error})` : ""}`).join("; ")}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("exposes a reference for every problem (no undefined skeletons)", () => {
    for (const p of JS_FUNCTION_PROBLEMS) {
      expect(p.reference.trim().length).toBeGreaterThan(10);
      expect(p.tests.length).toBeGreaterThanOrEqual(2);
      expect(p.hidden?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
  });
});
