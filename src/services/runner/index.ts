/* Runner service — barrel re-export (zero import changes for consumers) */

export type { RunResult, CaseResult } from "./core";
export { buildProgram, normalizeOutput, matchesExpected, runRemote, runLocalJavaScript, runCase, runTests } from "./core";

export type { FnCaseResult } from "./fnJudge";
export { deepEqual, runFnTests } from "./fnJudge";

export type { UiAssertionLike, UiCaseResult } from "./uiJudge";
export { ensureUiLib, runUiInDoc, runUiTests } from "./uiJudge";
