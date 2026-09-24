import { readFileSync, writeFileSync } from "node:fs";
import { deriveSkills } from "./draft-quality-lib.js";

const rows = JSON.parse(readFileSync("backfill-rows.json", "utf8")).filter(r => r.id !== 121); /* "refactoring benefits" — CSS came only from "styling" in the answer; no real CSS content */

const out = [];
const tagCounts = new Map();
let changed = 0;
for (const r of rows) {
  const skills = deriveSkills(`${r.question}\n${r.answer}`);
  if (!skills.length) continue;
  changed++;
  for (const t of skills) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  /* JSON array with double quotes inside a single-quoted SQL literal — jsonb parses it directly */
  out.push(`update published_questions set skills = '${JSON.stringify(skills)}'::jsonb where id = ${Number(r.id)};`);
}

console.log(`rows scanned: ${rows.length}`);
console.log(`rows that would gain tags: ${changed}`);
console.log(`rows left untagged (no confident tag): ${rows.length - changed}`);
console.log("per-tag counts BEFORE applying:");
for (const [t, c] of [...tagCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${c}`);

writeFileSync("backfill-updates.sql", out.join("\n") + "\n", "utf8");
console.log(`wrote ${out.length} UPDATE statements to backfill-updates.sql`);
