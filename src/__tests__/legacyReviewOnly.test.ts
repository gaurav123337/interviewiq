/// <reference types="node" />
/* The legacy Playwright driver remains local-only. These regressions execute its
   guarded native Node exports with synthetic traps; no browser is launched.
   Removing/moving the review-only boundary must fail on the first page access,
   even when auto-submit, healed controls and tailoring approval are supplied. */
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const driverUrl = pathToFileURL(path.join(repoRoot, "scripts", "auto-apply-jobs.js")).href;

function runNative(selection: "cli" | "env") {
  const env = { ...process.env };
  // Do not inherit a real binding, credentials, loader or live browser endpoint.
  for (const key of Object.keys(env)) {
    if (/^(INTERVIEWIQ_|FREEBUFF_|SUPA|SERVICE_ROLE_KEY$|NODE_OPTIONS$|NODE_PATH$)/.test(key)) delete env[key];
  }
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", `
    import assert from "node:assert/strict";
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";

    const accesses = [];
    function forbidden(operation) {
      accesses.push(operation);
      throw new Error("Legacy driver attempted side effect: " + operation);
    }
    for (const method of ["mkdirSync", "writeFileSync", "appendFileSync", "createWriteStream", "unlinkSync", "renameSync"]) {
      fs[method] = () => forbidden("fs." + method);
    }
    const openSync = fs.openSync;
    fs.openSync = (file, flags, ...rest) => {
      // Native module loading needs read-only opens; application locks do not.
      if (flags === "r") return openSync(file, flags, ...rest);
      return forbidden("fs.openSync (write)");
    };
    syncBuiltinESMExports();
    globalThis.fetch = () => forbidden("fetch");
    process.exit = () => forbidden("process.exit");
    process.argv = [process.execPath, "legacy-containment-test-not-an-entrypoint",
      ${selection === "cli" ? '"--legacy-owner",' : ""} "--yes", "--unattended", "--url", "https://www.instahyre.com/candidate/opportunities/"];
    ${selection === "env" ? 'process.env.INTERVIEWIQ_LEGACY_OWNER = "1";' : ""}

    // A native import exercises the existing main-entrypoint guard, not Vite's
    // transformed import. Importing must not start a run or create artifacts.
    const driver = await import(${JSON.stringify(driverUrl)});
    assert.equal(typeof driver.trySubmit, "function");
    assert.deepEqual(accesses, []);

    const page = new Proxy({}, {
      get(_target, property) { return forbidden("page." + String(property)); }
    });
    const opaque = new Proxy({}, {
      get(_target, property) { return forbidden("input." + String(property)); }
    });
    const results = [];
    for (const site of ["instahyre", "naukri", "linkedin", "generic", "unknown"]) {
      // No command/env opt-in, healed label, earned trust or AI consent can
      // turn this legacy driver back into an application executor.
      process.argv.push("--auto-submit", "--confirm", "--apply");
      process.env.APPLY_HEAL = "on";
      process.env.INTERVIEWIQ_LEGACY_AUTO_SUBMIT = "1";
      process.env.INTERVIEWIQ_LEGACY_OWNER = "0";
      const suppliedRules = {
        autoSubmit: true, applyButtonText: /apply now/i, submitButtonText: /submit/i,
        healedApplyText: "Apply now", healedSubmitText: "Submit application",
        healConfidence: 1, trustNote: "earned auto-submit trust"
      };
      for (const rules of [undefined, suppliedRules, opaque]) {
        const result = await driver.trySubmit(page, site, rules, {
          dryRun: false, autoSubmit: true, legacyReviewOnly: false, verified: true,
          profile: { autoTailor: true, resumeApproved: true },
          job: { __variantApproved: true }, ai: { key: "synthetic-not-a-credential" }
        });
        assert.equal(result.auto, false);
        assert.match(result.note, /legacy-review-only/);
        assert.deepEqual(accesses, []);
        results.push(result);
      }
    }
    // Reject before even reading caller context, including dry-run/tailor flags.
    const result = await driver.trySubmit(page, "instahyre", opaque, opaque);
    assert.equal(result.auto, false);
    assert.match(result.note, /legacy-review-only/);
    assert.deepEqual(accesses, []);
    process.stdout.write(JSON.stringify({ accesses, results, opaqueResult: result }));
  `], { cwd: repoRoot, env, encoding: "utf8", timeout: 15_000 }));
}

describe("legacy discovery/review-only containment", () => {
  it.each(["cli", "env"] as const)("blocks native trySubmit before any page access with %s runtime selection", selection => {
    const execution = runNative(selection);
    expect(execution.accesses).toEqual([]);
    expect(execution.results).toHaveLength(15);
    for (const result of [...execution.results, execution.opaqueResult]) {
      expect(result).toMatchObject({ auto: false, note: expect.stringContaining("legacy-review-only") });
    }
  });
});
