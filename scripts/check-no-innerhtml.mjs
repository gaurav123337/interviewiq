/* Build gate (docs/app-security.md §6): fail on raw-HTML sinks in app code.
   React text nodes escape by default; innerHTML / document.write are the
   classic XSS sinks, so they're banned from UI code. The allowlist is
   deliberate and small:
   - src/services/runner.ts          — the offline code-playground sandbox; it
                                       executes user code by design (new Function,
                                       innerHTML into a throwaway host element).
   - src/services/resumeHtml.ts      — writes fully-escaped markup into a fresh
                                       about:blank print window (no user HTML),
                                       then the OPENER calls print() (no inline
                                       script, so strict CSP applies).
   - src/data/codingBank/            — sample source code strings used as
                                       educational question content, never executed.
   Anything else must use React text nodes. Run: node scripts/check-no-innerhtml.mjs */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const ALLOW_FILES = new Set([
  "src/services/runner/uiJudge.ts", /* extracted from runner.ts — the offline code-playground sandbox */
  "src/services/resumeHtml.ts",
  /* skillsReport.ts writes a self-contained print document to a brand-new
     noopener popup (never the app DOM). Every dynamic value is escaped by
     buildSkillsReportHtml before it reaches the template (unit-tested), and
     the popup is used only for the browser's print → Save as PDF flow. */
  "src/services/skillsReport.ts"
]);
const ALLOW_DIRS = ["src/data/codingBank"];

const SINKS = [
  /dangerouslySetInnerHTML/,
  /\.innerHTML\s*=/,
  /\.outerHTML\s*=/,
  /insertAdjacentHTML\s*\(/,
  /document\.write\s*\(/,
  /document\.open\s*\(/
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

let failed = false;
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (ALLOW_FILES.has(rel)) continue;
  if (ALLOW_DIRS.some(d => rel.startsWith(d + "/"))) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (SINKS.some(re => re.test(line))) {
      failed = true;
      console.error(`❌ ${rel}:${i + 1} — raw-HTML sink: ${line.trim().slice(0, 120)}`);
    }
  });
}

if (failed) {
  console.error("\nRaw-HTML sinks are banned (docs/app-security.md §6). Use React text nodes / escaped output. To allow a file, add it to ALLOW_FILES with a comment explaining why.");
  process.exit(1);
}
console.log(`✅ no-innerhtml: ${walk(SRC).length} source files clean (${ALLOW_FILES.size} allowlisted)`);
