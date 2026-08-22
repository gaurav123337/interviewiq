/* Runner core — build programs, run remotely or locally, execute test cases */

import type { LangId, RunnerLang } from "../../data/coding";

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
