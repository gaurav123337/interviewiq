/* Function-mode judge — implement a named function, call it with typed
   args (or a drive harness), deep-compare the result (async-aware). */

import type { FnTest } from "../../data/coding";

export interface FnCaseResult {
  pass: boolean;
  label: string;
  args: unknown[];
  expect: unknown;
  got: unknown;
  error?: string;
  /** Wall time for the case (ms) — visible for timer-based problems. */
  ms: number;
}

/** Structural equality: primitives, NaN, Date, arrays, plain objects. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every(k =>
      Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
    );
  }
  return false;
}

/* Wire format for worker postMessage: functions and Dates aren't directly
   cloneable as-is, so they travel as markers and are rehydrated in the worker. */
type Wire = { __fn?: string; __date?: number };

function wireify(v: unknown): unknown {
  if (typeof v === "function") return { __fn: v.toString() } as Wire;
  if (v instanceof Date) return { __date: v.getTime() } as Wire;
  if (Array.isArray(v)) return v.map(wireify);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object)) o[k] = wireify((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
}

function unwire(v: unknown): unknown {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.__fn === "string") return (0, eval)(`(${o.__fn})`) as unknown;
    if (typeof o.__date === "number") return new Date(o.__date);
    if (Array.isArray(v)) return v.map(unwire);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) out[k] = unwire(o[k]);
    return out;
  }
  return v;
}

/** Safety valve so a hung user solution can't freeze the tab forever. */
const FN_TIMEOUT_MS = 8000;

/* Worker isolates user code (including infinite loops) from the UI thread.
   Kept as an array of strings so no nested-template escaping is needed. */
const FN_WORKER_SOURCE = [
  "function deepEqual(a, b) {",
  "  if (a === b) return true;",
  "  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;",
  "  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();",
  "  if (a instanceof Date || b instanceof Date) return false;",
  "  if (Array.isArray(a) && Array.isArray(b)) {",
  "    if (a.length !== b.length) return false;",
  "    return a.every(function (v, i) { return deepEqual(v, b[i]); });",
  "  }",
  "  if (a && b && typeof a === 'object' && typeof b === 'object') {",
  "    var ka = Object.keys(a), kb = Object.keys(b);",
  "    if (ka.length !== kb.length) return false;",
  "    return ka.every(function (k) { return Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]); });",
  "  }",
  "  return false;",
  "}",
  "function unwire(v) {",
  "  if (v && typeof v === 'object') {",
  "    if (typeof v.__fn === 'string') return (0, eval)('(' + v.__fn + ')');",
  "    if (typeof v.__date === 'number') return new Date(v.__date);",
  "    if (Array.isArray(v)) return v.map(unwire);",
  "    var out = {};",
  "    Object.keys(v).forEach(function (k) { out[k] = unwire(v[k]); });",
  "    return out;",
  "  }",
  "  return v;",
  "}",
  "self.onmessage = async function (e) {",
  "  var data = e.data || {};",
  "  var code = data.code || '', tests = data.tests || [], fnName = data.fnName || '';",
  "  var fail = function (msg) {",
  "    return tests.map(function (t) { return { pass: false, label: t.label || '', args: t.args, expect: t.expect, error: msg, ms: 0 }; });",
  "  };",
  "  var fn;",
  "  try {",
  "    (0, eval)(code);",
  "    fn = (0, eval)('typeof ' + fnName + ' !== \\\"undefined\\\" ? ' + fnName + ' : undefined');",
  "  } catch (err) {",
  "    self.postMessage({ results: fail('Compile error: ' + (err && err.message ? err.message : String(err))) });",
  "    return;",
  "  }",
  "  if (typeof fn !== 'function') {",
  "    self.postMessage({ results: fail('Define a function named ' + fnName + '(...)') });",
  "    return;",
  "  }",
  "  var results = [];",
  "  for (var i = 0; i < tests.length; i++) {",
  "    var t = tests[i];",
  "    var start = Date.now();",
  "    try {",
  "      var expected = unwire(t.expect);",
  "      var actual = t.drive ? await unwire(t.drive)(fn) : await fn.apply(null, t.args.map(unwire));",
  "      var got = (typeof actual === 'function') ? ('[Function ' + (actual.name || 'anonymous') + ']') : actual;",
  "      results.push({ pass: deepEqual(actual, expected), label: t.label || '', args: t.args, expect: t.expect, got: got, ms: Date.now() - start });",
  "    } catch (err) {",
  "      results.push({ pass: false, label: t.label || '', args: t.args, expect: t.expect, error: err && err.message ? err.message : String(err), ms: Date.now() - start });",
  "    }",
  "  }",
  "  self.postMessage({ results: results });",
  "};"
].join("\n");

function runFnTestsWorker(code: string, tests: FnTest[], fnName: string): Promise<FnCaseResult[]> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(new Blob([FN_WORKER_SOURCE], { type: "application/javascript" }));
    let worker: Worker;
    try {
      worker = new Worker(url);
    } catch {
      resolve(runFnTestsInline(code, tests, fnName));
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(tests.map(t => ({
        pass: false, label: t.label ?? "", args: t.args, expect: t.expect, got: undefined,
        error: "Timed out — possible infinite loop or a promise that never settles.", ms: FN_TIMEOUT_MS
      })));
    }, FN_TIMEOUT_MS);
    worker.onmessage = (e: MessageEvent) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      const raw = (e.data?.results as FnCaseResult[] | undefined) ?? [];
      resolve(raw.map(r => ({ ...r, args: unwire(r.args) as unknown[], expect: unwire(r.expect) })));
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(tests.map(t => ({
        pass: false, label: t.label ?? "", args: t.args, expect: t.expect, got: undefined,
        error: e.message || "Worker error", ms: 0
      })));
    };
    worker.postMessage({ code, tests: wireify(tests), fnName });
  });
}

/* Same-thread fallback (used when Workers are unavailable, e.g. jsdom tests).
   Mirrors the existing CLI local engine's constraints. */
async function runFnTestsInline(code: string, tests: FnTest[], fnName: string): Promise<FnCaseResult[]> {
  const compileFail = (msg: string): FnCaseResult[] => tests.map(t => ({
    pass: false, label: t.label ?? "", args: t.args, expect: t.expect, got: undefined, error: msg, ms: 0
  }));
  let fn: unknown;
  try {
    fn = new Function(`${code}\n;return typeof ${fnName} === "function" ? ${fnName} : undefined;`)();
  } catch (e) {
    return compileFail(`Compile error: ${(e as Error)?.message ?? String(e)}`);
  }
  if (typeof fn !== "function") return compileFail(`Define a function named ${fnName}(...)`);
  const results: FnCaseResult[] = [];
  for (const t of tests) {
    const start = Date.now();
    try {
      const actual = t.drive
        ? await t.drive(fn)
        : await (fn as (...a: unknown[]) => unknown)(...t.args);
      results.push({ pass: deepEqual(actual, t.expect), label: t.label ?? "", args: t.args, expect: t.expect, got: actual, ms: Date.now() - start });
    } catch (e) {
      results.push({ pass: false, label: t.label ?? "", args: t.args, expect: t.expect, got: undefined, error: (e as Error)?.message ?? String(e), ms: Date.now() - start });
    }
  }
  return results;
}

/** Judges function-mode problems. Production runs in a Web Worker (isolates
    infinite loops + provides a timeout); tests fall back to inline eval. */
export async function runFnTests(code: string, tests: FnTest[], fnName: string): Promise<FnCaseResult[]> {
  if (typeof Worker !== "undefined") return runFnTestsWorker(code, tests, fnName);
  return runFnTestsInline(code, tests, fnName);
}
