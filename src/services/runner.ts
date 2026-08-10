/* Code playground runner. Executes user code against the free Wandbox API
   (compiles + runs 40+ languages server-side) with a built-in JavaScript
   engine fallback so the playground still works fully offline.

   Contract: every starter defines `solve(lines)` where `lines` is the stdin
   split by newline; it returns the output lines. The per-language wrapper
   below turns real stdin (or the injected __INPUT__ global for the local
   engine) into that call. */

import type { FnTest, LangId, RunnerLang } from "../data/coding";

const WANDBOX_URL = "https://wandbox.org/api/compile.json";

/* stdin wrappers appended to the starter for languages whose template has no
   main() (python/js/ts). cpp/java/go starters already embed their own main. */
const APPEND_WRAPPER: Partial<Record<LangId, string>> = {
  python: `
# --- runner: stdin → solve(lines) → stdout ---
def __run():
    import sys
    lines = sys.stdin.read().splitlines()
    for out in solve(lines):
        print(out)

__run()
`,
  javascript: `
// --- runner: stdin (or __INPUT__) → solve(lines) → stdout ---
function __run() {
  const input = typeof __INPUT__ !== "undefined" ? __INPUT__ : require("fs").readFileSync(0, "utf8");
  const lines = input.split("\\n");
  for (const out of solve(lines)) console.log(out);
}
__run();
`,
  typescript: `
// --- runner: stdin → solve(lines) → stdout ---
function __run(): void {
  const rl = require("readline").createInterface({ input: process.stdin });
  const lines: string[] = [];
  rl.on("line", (l: string) => lines.push(l));
  rl.on("close", () => { for (const out of solve(lines)) console.log(out); });
}
__run();
`
};

/** Full program sent to the remote compiler (prelude + starter + wrapper). */
export function buildProgram(lang: RunnerLang, starter: string): string {
  const prelude = lang.prelude ?? "";
  const wrapper = APPEND_WRAPPER[lang.id] ?? "";
  return prelude + starter + wrapper;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  /** Remote exit code (0 = success); absent for the local engine. */
  exitCode?: number;
  /** Human explanation when the run failed before/at compile. */
  error?: string;
}

/** Normalizes stdout for comparison: trim each line, drop trailing empties. */
export function normalizeOutput(s: string): string {
  return s.split("\n").map(l => l.trimEnd()).join("\n").replace(/\n+$/, "").trim();
}

export function matchesExpected(got: string, expect: string): boolean {
  return normalizeOutput(got) === normalizeOutput(expect);
}

/* ------------------------------------------------------------------ */
/* Remote execution (Wandbox)                                          */
/* ------------------------------------------------------------------ */

export async function runRemote(lang: RunnerLang, code: string, stdin: string): Promise<RunResult> {
  let res: Response;
  try {
    res = await fetch(WANDBOX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compiler: lang.compiler, code, stdin })
    });
  } catch {
    return { ok: false, stdout: "", stderr: "", error: "Network unavailable — JavaScript runs offline, other languages need a connection." };
  }
  if (!res.ok) {
    return { ok: false, stdout: "", stderr: "", error: `Runner responded HTTP ${res.status} — try again in a moment.` };
  }
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!j) return { ok: false, stdout: "", stderr: "", error: "Runner returned an unreadable response." };
  const exitCode = Number(j.status ?? 0);
  const stdout = String(j.program_output ?? "");
  const stderr = String(j.compiler_error ?? j.program_error ?? "").trim();
  const ok = exitCode === 0 && !stderr;
  return { ok, stdout, stderr, exitCode, error: ok ? undefined : stderr || `Exit code ${exitCode}` };
}

/* ------------------------------------------------------------------ */
/* Local JavaScript engine (offline)                                   */
/* ------------------------------------------------------------------ */

export function runLocalJavaScript(code: string, stdin: string): RunResult {
  const out: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a: unknown[]) => out.push(a.map(v => (typeof v === "string" ? v : JSON.stringify(v))).join(" "));
  console.error = (...a: unknown[]) => out.push(a.map(v => (typeof v === "string" ? v : JSON.stringify(v))).join(" "));
  try {
    /* __INPUT__ is a function parameter → user code reads it instead of stdin */
    new Function("__INPUT__", code)(stdin);
    return { ok: true, stdout: out.join("\n"), stderr: "" };
  } catch (e) {
    return { ok: false, stdout: out.join("\n"), stderr: "", error: (e as Error).message ?? String(e) };
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

/** Runs one stdin/stdout case. JS executes locally (works offline); everything
    else goes to Wandbox. */
export async function runCase(lang: RunnerLang, code: string, stdin: string): Promise<RunResult> {
  if (lang.offline) return runLocalJavaScript(code, stdin);
  return runRemote(lang, code, stdin);
}

export interface CaseResult {
  pass: boolean;
  stdin: string;
  expect: string;
  got: string;
  error?: string;
}

/** Runs every test case for the problem, one at a time. */
export async function runTests(lang: RunnerLang, code: string, tests: { stdin: string; expect: string }[]): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const t of tests) {
    const r = await runCase(lang, code, t.stdin);
    results.push({
      pass: r.ok && matchesExpected(r.stdout, t.expect),
      stdin: t.stdin,
      expect: t.expect,
      got: r.ok ? r.stdout : r.error ?? r.stderr,
      error: r.error
    });
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Function-mode judge — implement a named function, call it with typed  */
/* args (or a drive harness), deep-compare the result (async-aware).     */
/* ------------------------------------------------------------------ */

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
  "    fn = (0, eval)('typeof ' + fnName + ' !== \"undefined\" ? ' + fnName + ' : undefined');",
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

/* ------------------------------------------------------------------ */
/* UI-mode judge — render HTML/CSS/JS in a sandboxed same-origin iframe  */
/* and run DOM assertions (clicks, typing, computed styles) inside it.   */
/* The iframe IS the sandbox: user code can never touch the app.         */
/* ------------------------------------------------------------------ */

export interface UiAssertionLike {
  label: string;
  /** JS body evaluated inside the iframe; may await; returns truthy to pass. */
  check: string;
}

export interface UiCaseResult {
  pass: boolean;
  label: string;
  error?: string;
  ms: number;
}

const UI_LOAD_TIMEOUT_MS = 5000;
const UI_CHECK_TIMEOUT_MS = 3000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("Timed out (possible infinite loop in your code)")), ms);
    p.then(v => { clearTimeout(to); resolve(v); }, e => { clearTimeout(to); reject(e); });
  });
}

/** Loads a framework library (React/Vue UMD from a CDN) into a document. When a
    script with the matching data-lib marker already exists (tests pre-inject
    fetched libs), it is skipped. Returns false if loading failed/timed out. */
export async function ensureUiLib(host: Document, lib: { url: string; global: string }): Promise<boolean> {
  if (host.querySelector(`script[data-lib="${lib.global}"]`)) return true;
  return new Promise(resolve => {
    const s = host.createElement("script");
    s.dataset.lib = lib.global;
    s.src = lib.url;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    host.head.appendChild(s);
    setTimeout(() => resolve(false), 20_000);
  });
}

/** Core UI judging against a given Document (a sandboxed iframe's document in
    production, the test document in unit tests). Injects the user's HTML/CSS/JS,
    runs each assertion, and cleans up. Returns per-assertion results. */
export async function runUiInDoc(
  host: Document,
  html: string,
  css: string,
  js: string,
  assertions: UiAssertionLike[],
  libs?: { url: string; global: string }[]
): Promise<UiCaseResult[]> {
  const root = host.createElement("div");
  root.id = "__ui-judge-root";
  root.innerHTML = html;
  const style = host.createElement("style");
  style.textContent = css;
  const script = host.createElement("script");
  /* IIFE-scoped so consecutive problems in the same window (tests) never
     collide on top-level const/let; production uses a fresh iframe anyway */
  script.textContent = `(function(){${js}
})();`;
  host.body.appendChild(root);
  host.head.appendChild(style);
  for (const lib of libs ?? []) {
    /* loads from CDN in the browser; skips when a test pre-injected the lib */
    await ensureUiLib(host, lib);
  }
  host.body.appendChild(script);
  const win = host.defaultView;
  try {
    /* let dynamically-inserted scripts run before asserting */
    await new Promise(r => setTimeout(r, 30));
    const results: UiCaseResult[] = [];
    for (const a of assertions) {
      const start = Date.now();
      try {
        if (!win) throw new Error("Window unavailable");
        /* the wrapper injects the sleep helper so checks can await real timers */
        const pass = await withTimeout(
          Promise.resolve(win.eval(`(async () => { const sleep = (ms) => new Promise(r => setTimeout(r, ms)); ${a.check} })()`)),
          UI_CHECK_TIMEOUT_MS
        );
        results.push({ pass: !!pass, label: a.label, ms: Date.now() - start });
      } catch (e) {
        results.push({ pass: false, label: a.label, error: (e as Error)?.message ?? String(e), ms: Date.now() - start });
      }
    }
    return results;
  } finally {
    root.remove();
    style.remove();
    script.remove();
  }
}

/** Judges a UI component problem. The iframe IS the sandbox: user code runs in
    a blank same-origin iframe detached from the page, so it can never touch the
    app, and sync loops only freeze the disposable iframe thread. */
export async function runUiTests(
  html: string,
  css: string,
  js: string,
  assertions: UiAssertionLike[],
  libs?: { url: string; global: string }[]
): Promise<UiCaseResult[]> {
  /* Opaque-origin sandbox: `allow-scripts` WITHOUT `allow-same-origin` so user
     code can never reach the host app (that combination is effectively no
     sandbox in Chrome). localStorage is unavailable inside — problems that
     mention persistence guard for it. */
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:absolute;left:-99999px;top:0;width:600px;height:400px;border:0;";
  iframe.srcdoc = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>";
  document.body.appendChild(iframe);
  try {
    const deadline = Date.now() + UI_LOAD_TIMEOUT_MS;
    for (;;) {
      if (iframe.contentDocument?.readyState === "complete") break;
      if (Date.now() > deadline) throw new Error("Preview failed to load");
      await new Promise(r => setTimeout(r, 10));
    }
    if (!iframe.contentDocument) throw new Error("Sandbox unavailable");
    return runUiInDoc(iframe.contentDocument, html, css, js, assertions, libs);
  } finally {
    iframe.remove();
  }
}
