/* One entry point avoids shell-specific environment syntax on Windows/CI.
   Only isolated build directories are ever cleared; dist/ is never a target. */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { dirname, resolve, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { assertIsolatedBuild, FIXTURE_ORIGIN } from "./virtual-tester-lib.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const command = process.argv[2] ?? "test";
const extra = process.argv.slice(3);
if (Number(process.versions.node.split(".")[0]) !== 22) {
  console.error(`Virtual tester requires Node 22 (current: ${process.versions.node}). Use the version in .nvmrc.`);
  process.exit(1);
}
const env = { ...process.env, PATH: dirname(process.execPath) + delimiter + process.env.PATH };
const run = (file, args, patch = {}) => {
  const result = spawnSync(process.execPath, [resolve(root, file), ...args], { cwd: root, env: { ...env, ...patch }, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

async function prepare() {
  for (const mode of ["fixture", "offline"]) {
    const outDir = `.virtual-tester/${mode}`;
    const url = mode === "fixture" ? FIXTURE_ORIGIN : "";
    const key = mode === "fixture" ? "sb_publishable_virtual_tester" : "";
    assertIsolatedBuild(mode, url, key, outDir);
    run("node_modules/vite/bin/vite.js", ["build", "--mode", "virtual-test", "--outDir", outDir, "--emptyOutDir"], {
      VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, VITE_APP_ENV: "production", VITE_FEATURE_FLAGS: ""
    });
    await writeFile(resolve(root, outDir, "virtual-build.json"), JSON.stringify({ mode, backend: url, builtAt: new Date().toISOString() }));
  }
}

if (["prepare", "test", "repeat", "ui"].includes(command)) await prepare();
await mkdir(resolve(root, "test-results"), { recursive: true });
if (command === "prepare") process.exit(0);
if (command === "check") {
  run("node_modules/typescript/bin/tsc", ["--noEmit", "-p", "tsconfig.e2e.json"]);
  run("scripts/virtual-tester-lib.test.mjs", []);
} else if (command === "report") {
  run("node_modules/@playwright/test/cli.js", ["show-report", "playwright-report", ...extra]);
} else if (command === "selftest") {
  const probeRunId = randomUUID();
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [resolve(root, "node_modules/@playwright/test/cli.js"), "test", "--project=desktop", "--workers=1"], {
    cwd: root, env: { ...env, VIRTUAL_TEST_MODE: "isolated", VIRTUAL_TEST_PROBE: "1", VIRTUAL_TEST_PROBE_ID: probeRunId, CI: "" }, stdio: "inherit"
  });
  if (result.error || result.signal || result.status !== 1) throw new Error("Failure probe did not complete with the expected test-failure exit code");
  const reportPath = resolve(root, `.virtual-tester/probe/${probeRunId}/test-results/results.json`);
  if ((await stat(reportPath)).mtimeMs < startedAt - 1000) throw new Error("Stale failure-probe evidence");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const results = [];
  const collect = suite => {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) results.push(...test.results);
    for (const child of suite.suites ?? []) collect(child);
  };
  collect(report);
  if (!results.some(r => r.status === "failed" && r.errors?.some(e => /Deliberate fault/.test(e.message ?? "")) &&
      r.attachments?.some(a => a.name === "screenshot" && a.path) && r.attachments?.some(a => a.name === "trace" && a.path))) {
    throw new Error("Probe failed for an unrelated reason or did not record screenshot/trace evidence");
  }
  console.log("PASS: manufactured broken bundle was rejected with screenshot and trace evidence");
} else if (["test", "browser", "repeat", "ui", "live"].includes(command)) {
  const args = ["test", ...extra];
  if (command === "repeat") args.push("--repeat-each=2");
  if (command === "ui") args.push("--ui");
  run("node_modules/@playwright/test/cli.js", args, { VIRTUAL_TEST_MODE: command === "live" ? "live" : "isolated" });
} else {
  console.error("Usage: node scripts/virtual-tester.mjs prepare|test|browser|repeat|ui|live|report|check|selftest [Playwright options]");
  process.exit(1);
}
