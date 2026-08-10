import { beforeEach, describe, expect, it } from "vitest";
import { CODING_PROBLEMS, RUNNER_LANGS, codingProblemById, type CliProblem, type FnProblem } from "../data/coding";
import { buildProgram, matchesExpected, runLocalJavaScript, runTests, normalizeOutput } from "../services/runner";

beforeEach(() => {
  localStorage.clear();
});

describe("coding catalog", () => {
  it("every problem has tests and a sensible shape for its kind", () => {
    const cli = CODING_PROBLEMS.filter((p): p is CliProblem => p.kind === "cli");
    const fn = CODING_PROBLEMS.filter((p): p is FnProblem => p.kind === "fn");
    expect(cli.length).toBeGreaterThanOrEqual(6);
    expect(fn.length).toBeGreaterThanOrEqual(15);
    for (const p of cli) {
      expect(Object.keys(p.starters).sort()).toEqual(RUNNER_LANGS.map(l => l.id).sort());
      expect(p.tests.length).toBeGreaterThanOrEqual(2);
      for (const t of p.tests) expect(t.expect.trim().length).toBeGreaterThan(0);
    }
    for (const p of fn) {
      expect(p.starter.trim().length).toBeGreaterThan(0);
      expect(p.fn.name.trim().length).toBeGreaterThan(0);
      expect(p.tests.length).toBeGreaterThanOrEqual(2);
      expect(p.reference.trim().length).toBeGreaterThan(0);
      for (const t of p.tests) expect(Array.isArray(t.args)).toBe(true);
    }
  });
});

describe("output comparison", () => {
  it("normalizes trailing whitespace and empty lines", () => {
    expect(normalizeOutput("42\n\n")).toBe("42");
    expect(normalizeOutput("a\nb  \n")).toBe("a\nb");
    expect(matchesExpected("6\n", "6")).toBe(true);
    expect(matchesExpected("6", "7")).toBe(false);
    expect(matchesExpected("1\n2\nFizz", "1\n2\nFizz\n")).toBe(true);
  });
});

describe("local JavaScript engine (offline)", () => {
  it("runs a solve-based program with injected stdin", () => {
    const code = `function solve(lines) {
  const out = [];
  for (let i = 1; i <= Number(lines[0]); i++) {
    out.push(i % 15 === 0 ? "FizzBuzz" : i % 3 === 0 ? "Fizz" : i % 5 === 0 ? "Buzz" : String(i));
  }
  return out;
}
// --- runner ---
function __run() {
  const input = typeof __INPUT__ !== "undefined" ? __INPUT__ : "";
  const lines = input.split("\\n");
  for (const out of solve(lines)) console.log(out);
}
__run();`;
    const r = runLocalJavaScript(code, "5\n");
    expect(r.ok).toBe(true);
    expect(normalizeOutput(r.stdout)).toBe("1\n2\nFizz\n4\nBuzz");
  });

  it("surfaces runtime errors without throwing", () => {
    const r = runLocalJavaScript("function solve(lines) { throw new Error('boom'); }\nsolve([]);", "x");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("boom");
  });

  it("passes the real problem tests for two-sum in JS", async () => {
    const p = codingProblemById("two-sum")!;
    if (p.kind !== "cli") throw new Error("two-sum must stay a cli problem");
    const starter = p.starters.javascript.replace("// your code here — push each output line onto out", `const seen = new Map();
for (let i = 0; i < lines.length; i++) { /* parse */ }
const n = Number(lines[0]);
const arr = lines[1].split(" ").map(Number);
const target = Number(lines[2]);
const idx = new Map();
for (let i = 0; i < n; i++) {
  const need = target - arr[i];
  if (idx.has(need)) { out.push(idx.get(need) + " " + i); return out; }
  idx.set(arr[i], i);
}
return out;`);
    const lang = RUNNER_LANGS.find(l => l.id === "javascript")!;
    const results = await runTests(lang, buildProgram(lang, starter), p.tests);
    expect(results.every(r => r.pass)).toBe(true);
  });
});

describe("program assembly", () => {
  it("appends a stdin wrapper for python/js/ts but not for self-contained languages", () => {
    const js = RUNNER_LANGS.find(l => l.id === "javascript")!;
    const cpp = RUNNER_LANGS.find(l => l.id === "cpp")!;
    expect(buildProgram(js, "function solve(lines){return []}")).toContain("__run");
    expect(buildProgram(cpp, "int main(){}")).not.toContain("__run");
  });

  it("prepends ambient declarations for typescript", () => {
    const ts = RUNNER_LANGS.find(l => l.id === "typescript")!;
    expect(buildProgram(ts, "function solve(lines: string[]): string[] { return []; }")).toContain("declare const require");
  });
});
