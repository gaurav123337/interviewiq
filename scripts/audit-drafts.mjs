/* One-off audit of all drafts: runs the repo's own draft-quality-lib classifiers
   (the same ones the scraper/cron and the ReviewInbox triage worker use) over the
   live draft pile and buckets them — hard noise (deletable), truncated (review-first),
   and salvageable (needs-work/ready). Writes drafts-audit-result.json for the sweep. */
import { readFileSync, writeFileSync } from "node:fs";
import { noiseReason, looksTruncated } from "./draft-quality-lib.js";

const drafts = JSON.parse(readFileSync("drafts-audit.json", "utf8"));

const buckets = { noise: [], truncated: [], salvageable: [] };
const noiseReasons = new Map();
const fieldCounts = new Map();

for (const d of drafts) {
  const nr = noiseReason(d.question);
  if (nr) {
    buckets.noise.push({ id: d.id, reason: nr });
    noiseReasons.set(nr, (noiseReasons.get(nr) ?? 0) + 1);
    continue;
  }
  if (looksTruncated(d.question)) {
    buckets.truncated.push({ id: d.id });
    continue;
  }
  buckets.salvageable.push({ id: d.id, hasAnswer: d.answer.length > 0, field: d.field_id });
  fieldCounts.set(d.field_id, (fieldCounts.get(d.field_id) ?? 0) + 1);
}

console.log(`total drafts: ${drafts.length}`);
console.log(`hard noise (deletable): ${buckets.noise.length}`);
for (const [r, c] of [...noiseReasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${r}: ${c}`);
console.log(`truncated (review-first): ${buckets.truncated.length}`);
console.log(`salvageable: ${buckets.salvageable.length}`);
const withAnswer = buckets.salvageable.filter(s => s.hasAnswer).length;
console.log(`  salvageable with answers: ${withAnswer}, without: ${buckets.salvageable.length - withAnswer}`);
console.log("salvageable by field:");
for (const [f, c] of [...fieldCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${f}: ${c}`);

writeFileSync("drafts-audit-result.json", JSON.stringify(buckets, null, 2), "utf8");
console.log("wrote drafts-audit-result.json");
