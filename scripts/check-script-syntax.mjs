/* Build gate: every file under scripts/ must PARSE before it ships.
   tsconfig.build.json excludes tests AND scripts/, vitest never imports the
   Playwright drivers, and nothing ran `node --check` over scripts/ — so four
   NUL-byte placeholder markers (\0CHALLENGE_DETECT\0) reached main and the
   apply driver died at load with "Invalid or unexpected token" while every CI
   gate stayed green. NUL bytes get their own message because node --check
   reports them as a bare syntax error with no hint that a placeholder leaked
   into the file. Run: node scripts/check-script-syntax.mjs */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = join(import.meta.dirname, "..");
const SCRIPTS = join(ROOT, "scripts");
const SKIP_DIRS = new Set(["node_modules"]);

function scriptFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...scriptFiles(abs));
    else if (name.endsWith(".js") || name.endsWith(".mjs")) out.push(abs);
  }
  return out;
}

const files = scriptFiles(SCRIPTS);
const problems = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  const buf = readFileSync(file);
  const nul = buf.indexOf(0);
  if (nul >= 0) {
    const line = buf.subarray(0, nul).toString("utf8").split("\n").length;
    problems.push(`${rel}:${line} — NUL byte (a placeholder marker was committed; delete the line)`);
    continue; // node --check stops at the first invalid token; the NUL is the cause
  }
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (err) {
    const detail = String(err.stderr ?? err.message).trim().split("\n").slice(0, 4).join("\n");
    problems.push(`${rel}\n${detail}`);
  }
}

if (problems.length) {
  console.error(`❌ script-syntax: ${problems.length} of ${files.length} script(s) do not parse\n`);
  for (const p of problems) console.error(`${p}\n`);
  process.exit(1);
}
console.log(`✅ script-syntax: ${files.length} scripts parse clean`);
