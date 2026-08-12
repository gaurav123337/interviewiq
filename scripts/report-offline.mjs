/* Offline-shell check reporter — runs the offline-readiness suite
   (src/__tests__/offline.test.tsx) with the JSON reporter, then writes a
   compact markdown summary to:
     1. $GITHUB_STEP_SUMMARY (GitHub Actions run summary) when set, and
     2. ./offline-summary.md (consumed by the PR-comment workflow).
   Exits non-zero when any offline test fails, so it doubles as a gate.

   Usage: node scripts/report-offline.mjs */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(tmpdir(), `offline-results-${process.pid}.json`);
const SUMMARY_FILE = join(ROOT, "offline-summary.md");

/* run the suite via the vitest CLI with the current Node binary — avoids
   npx shim issues on Windows. The exit code is inspected below via the
   parsed JSON; a failed/missing run is treated as a hard failure, never a
   silent pass. */
const VITEST_BIN = join(ROOT, "node_modules", "vitest", "vitest.mjs");
try {
  execFileSync(process.execPath, [VITEST_BIN, "run", "src/__tests__/offline.test.tsx", "--reporter=json", `--outputFile=${OUT}`], {
    cwd: ROOT,
    stdio: "inherit"
  });
} catch {
  /* parsed below */
}

let data = {};
if (existsSync(OUT)) {
  try { data = JSON.parse(readFileSync(OUT, "utf8")); } catch { /* fall through */ }
}

const tests = (data.testResults ?? []).flatMap(r => r.assertionResults ?? []);
const failed = tests.filter(t => t.status !== "passed");
const total = data.numTotalTests ?? tests.length;
const passed = total - failed.length;

const shortTitle = (t) => t.replace(/^(service-worker offline shell|legal views render offline \(fetch fails\)) > /, "");

/* zero parsed tests means the run itself failed — never report a green gate */
if (total === 0) {
  const msg = "Offline-shell check could not run — vitest produced no results (see logs).\n";
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg);
  writeFileSync(SUMMARY_FILE, msg);
  console.error(msg);
  process.exit(1);
}

const lines = [
  `## 🛡️ Offline-shell check — ${failed.length ? "❌ FAILED" : "✅ PASSED"}`,
  "",
  `**${passed}/${total} tests passed** · ${process.env.GITHUB_RUN_ID ? `[run #${process.env.GITHUB_RUN_ID}](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})` : "local run"}`,
  "",
  ...tests.map(t => `- ${t.status === "passed" ? "✅" : "❌"} ${shortTitle(t.title)}`),
  ...(failed.length
    ? ["", "**Failing:**", ...failed.map(t => `- ${t.title}`), "", "Fix these before merging — the offline shell or legal views are broken."]
    : ["", "The service worker precaches the built JS/CSS bundle and the legal pages render with zero network."])
];
const md = lines.join("\n") + "\n";

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
writeFileSync(SUMMARY_FILE, md);
console.log(md);

process.exit(failed.length ? 1 : 0);
