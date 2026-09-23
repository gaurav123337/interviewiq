#!/usr/bin/env node
/* Takedown CLI (Phase 4 Item D3) — operational side of the takedown engine.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<ref> node scripts/takedown.js list
 *   ... node scripts/takedown.js regenerate-coding-bank [--apply]
 *
 * - list: open takedowns + suppression count (what is currently blocked)
 * - regenerate-coding-bank: rewrites src/data/codingBank/aiGenerated.ts with
 *   taken-down attributed problems EXCLUDED — the problem object, its
 *   AI_PROBLEM_COMPANIES entry and its AI_CLI_TOPICS entry are all removed by
 *   textual block-splice (no TS execution needed). Dry-run by default;
 *   --apply writes the file. The takedowns table remains the audit trail.
 *
 * Question-side soft-delete/purge/restore live in the admin UI
 * (services/admin/questions.ts takeDownQuestion / restoreQuestion / purgeQuestion).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { excludeProblems, problemEntry, takedownNote } from "./takedown-lib.js";

const API = "https://api.supabase.com/v1";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function runSql(sql) {
  const res = await fetch(`${API}/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SQL ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

/** Removes top-level object literals from a `const X = [ ... ];` / `= { ... };`
    block by brace/bracket balancing — textual, no TS execution. */
function spliceBlocks(source, constName, matchId) {
  const declStart = source.indexOf(`export const ${constName}`);
  if (declStart < 0) return source;
  const open = source.indexOf(constName.includes("PROBLEMS") ? "[" : "{", declStart);
  if (open < 0) return source;
  const openCh = source[open];
  const closeCh = openCh === "[" ? "]" : "}";

  let i = open;
  let depth = 0;
  let blockStart = -1;
  let removed = 0;
  let out = source;

  while (i < out.length) {
    const ch = out[i];
    if (ch === openCh || ch === "{") {
      if (depth === 0 && ch === openCh) { i++; depth++; continue; }
      if (depth === 1 && blockStart < 0) blockStart = i;
      depth++;
    } else if (ch === closeCh || ch === "}") {
      depth--;
      if (depth === 1 && blockStart >= 0) {
        const block = out.slice(blockStart, i + 1);
        if (block.includes(matchId)) {
          out = out.slice(0, blockStart) + out.slice(i + 1);
          removed++;
          /* swallow a trailing comma right after the removed block */
          if (out[i] === ",") out = out.slice(0, i) + out.slice(i + 1);
          i = blockStart;
          blockStart = -1;
          continue;
        }
        blockStart = -1;
      }
      if (depth === 0) break;
    }
    i++;
  }
  return out.replace(/,\s*,/g, ",");
}

async function main() {
  const cmd = process.argv[2] ?? "list";
  const apply = process.argv.includes("--apply");
  if (!token || !projectRef) {
    console.error(red("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF."));
    process.exit(1);
  }

  if (cmd === "list") {
    const rows = await runSql(
      `select target_kind, target_id, reason, actor, restored_at, created_at
       from public.takedowns order by created_at desc limit 50`
    );
    if (!rows.length) { console.log(green("No takedowns recorded.")); return; }
    console.log(`Last ${rows.length} takedown(s):`);
    for (const r of rows) {
      const state = r.restored_at ? dim("restored") : yellow("OPEN");
      console.log(`  ${state} [${r.target_kind}] ${r.target_id} — ${r.reason} (by ${r.actor || "unknown"}, ${r.created_at})`);
    }
    return;
  }

  if (cmd === "regenerate-coding-bank") {
    /* open (non-restored) problem takedowns drive the exclusion */
    let takenDown;
    try {
      takenDown = await runSql(
        `select distinct target_id from public.takedowns
         where target_kind = 'problem' and restored_at is null`
      );
    } catch (e) {
      console.warn(yellow(`  (takedowns table missing — nothing to exclude: ${e.message})`));
      takenDown = [];
    }
    const ids = (takenDown ?? []).map((r) => String(r.target_id));
    if (!ids.length) {
      console.log(green("No open problem takedowns — aiGenerated.ts needs no changes."));
      return;
    }

    const bankPath = fileURLToPath(new URL("../src/data/codingBank/aiGenerated.ts", import.meta.url));
    let src = readFileSync(bankPath, "utf8");
    for (const id of ids) {
      src = spliceBlocks(src, "AI_GENERATED_PROBLEMS", `"${id}"`);
      src = spliceBlocks(src, "AI_PROBLEM_COMPANIES", `"${id}"`);
      src = spliceBlocks(src, "AI_CLI_TOPICS", `"${id}"`);
    }

    if (apply) {
      writeFileSync(bankPath, src);
      console.log(green(`\nRegenerated aiGenerated.ts — excluded: ${ids.join(", ")}`));
      console.log(dim("  → commit the regenerated file; the takedowns table is the audit trail."));
    } else {
      console.log(dim("(dry run — re-run with --apply to write the file)"));
      for (const id of ids) {
        console.log(`  ${red("−")} ${id}`);
      }
      console.log(`  would splice out ${ids.length * 3} block(s) (problem + companies + topics).`);
    }
    return;
  }

  console.error(red(`Unknown command: ${cmd} (use list | regenerate-coding-bank)`));
  process.exit(1);
}

main().catch((e) => {
  console.error(red(e.message));
  process.exit(1);
});
