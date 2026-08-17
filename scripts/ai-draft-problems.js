#!/usr/bin/env node
/* P4 — AI problem-drafting pipeline (docs/question-bank-expansion.md §4).
   Reads problem TITLES + companies + difficulty from a public mirror (facts —
   zero-restriction raw.githubusercontent.com), asks an OpenAI-compatible model
   to write ORIGINAL prompts/test-cases/references, gates every problem through
   the local judge (reference must pass its own visible + hidden cases), and
   writes the survivors to src/data/codingBank/aiGenerated.ts.

   The review gate is the owner: the workflow (.github/workflows/ai-problems.yml)
   runs this, commits the gated file to a branch and opens a PR.

   Usage:
     node scripts/ai-draft-problems.js [--dry-run|--list-candidates|--pr-body] [--count N] [--write] [--source URL]

   Env:
     AI_CLEAN_KEY   — OpenAI-compatible key (required to actually generate)
     AI_CLEAN_BASE  — base URL, default https://api.openai.com/v1
     AI_CLEAN_MODEL — model, default gpt-4o-mini
     AI_DRAFT_MAX   — max model calls per run (cost cap), default 30
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractCompanyList } from "./scrape-lib.js";
import {
  CURATED_TITLES, PATTERN_TOPIC, buildCandidates, buildDraftPrompt, emitProblemsFile,
  existingAiIds, gateProblem, normalizeProblem, parseDraftJson, patternFromTitle,
  slugify, validateProblem
} from "./ai-draft-lib.js";

/* one corrective retry when the model returns unparsable text */
const RETRY_HINT = "That reply was not valid JSON. Return ONLY the strict JSON object described above — no markdown fences, no commentary, no extra text.";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AI_GENERATED_PATH = join(__dirname, "..", "src", "data", "codingBank", "aiGenerated.ts");
const DEFAULT_SOURCE = "https://raw.githubusercontent.com/hxu296/leetcode-company-wise-problems-2022/main/README.md";

const API = "https://api.supabase.com/v1";
const aiKey = process.env.AI_CLEAN_KEY;
const aiBase = (process.env.AI_CLEAN_BASE || "https://api.openai.com/v1").replace(/\/+$/, "");
const aiModel = process.env.AI_CLEAN_MODEL || "gpt-4o-mini";
const maxCalls = Number(process.env.AI_DRAFT_MAX ?? 30) || 30;

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const listCandidates = args.includes("--list-candidates");
const prBody = args.includes("--pr-body");
const write = args.includes("--write");
const force = args.includes("--force");
const count = Number(args[args.indexOf("--count") + 1] ?? process.env.AI_DRAFT_COUNT ?? 12) || 12;
const sourceIdx = args.indexOf("--source");
const sourceUrl = (sourceIdx !== -1 ? args[sourceIdx + 1] : null) || DEFAULT_SOURCE;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One chat completion → parsed strict JSON (or null). With `retry`, appends a
    corrective hint when the first reply was unparsable. */
async function draftOne(candidate, retry = false) {
  const messages = [{ role: "user", content: buildDraftPrompt(candidate) }];
  if (retry) messages.push({ role: "user", content: RETRY_HINT });
  const res = await fetch(`${aiBase}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: aiModel,
      temperature: 0.3,
      max_tokens: 900,
      messages
    })
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const body = await res.json();
  return parseDraftJson(body?.choices?.[0]?.message?.content);
}

async function fetchMirror() {
  const res = await fetch(sourceUrl, { headers: { "User-Agent": "interviewiq-content-pipeline" } });
  if (!res.ok) throw new Error(`mirror fetch HTTP ${res.status} (${sourceUrl})`);
  return res.text();
}

function readGenerated() {
  try {
    return readFileSync(AI_GENERATED_PATH, "utf8");
  } catch {
    return "";
  }
}

/** PR body markdown from the emitted file (regex — machine-generated shape). */
function prBodyMarkdown(src) {
  const blocks = src.split(/\n(?={|"kind")/);
  const ids = [...src.matchAll(/"id":\s*"([^"]+)"/g)].map((m) => m[1]);
  const titles = [...src.matchAll(/"title":\s*"([^"]+)"/g)].map((m) => m[1]);
  const diffs = [...src.matchAll(/"difficulty":\s*(\d)/g)].map((m) => Number(m[1]));
  const pats = [...src.matchAll(/"pattern":\s*"([^"]+)"/g)].map((m) => m[1]);
  const n = Math.min(ids.length, titles.length, diffs.length, pats.length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(`| ${titles[i]} | ${["Easy", "Medium", "Hard"][diffs[i] - 1] ?? diffs[i]} | ${pats[i]} |`);
  }
  return [
    `## 🤖 AI-drafted coding problems (self-tested)`,
    ``,
    `This PR adds **${n}** algorithm problems to the coding bank. Every one passed the **self-test gate**: its AI-written reference solution was run through the local judge against its own visible + hidden cases before it was written to \`aiGenerated.ts\` (the bank self-test in CI re-runs the same gate).`,
    ``,
    `| Problem | Difficulty | Pattern |`,
    `|---|---|---|`,
    ...rows,
    ``,
    `Titles/difficulty/companies come from public mirror metadata (facts); prompts, test cases and references are AI-original — no verbatim third-party statements.`
  ].join("\n");
}

async function main() {
  /* --- pr-body mode: no network, just summarize the emitted file --- */
  if (prBody) {
    const src = readGenerated();
    if (!src) { console.log("No aiGenerated.ts found."); process.exit(0); }
    console.log(prBodyMarkdown(src));
    process.exit(0);
  }

  /* --- candidate discovery (facts from the mirror, keyless) --- */
  const md = await fetchMirror();
  const items = extractCompanyList(md, { id: "company-wise-metadata", url: sourceUrl, type: "company-list", groupAs: "company", fieldId: "backend", level: "senior" });
  /* curated human-bank titles are never regenerated; --force also re-drafts the AI bank */
  const existing = new Set(CURATED_TITLES.map(slugify));
  if (!force) for (const id of existingAiIds(readGenerated())) existing.add(id);
  const candidates = buildCandidates(items, existing);

  if (!candidates.length) {
    console.log(yellow("No new candidates — every mirror title is already in the bank (or unmatched to a company)."));
    process.exit(0);
  }

  if (listCandidates) {
    console.log(`${candidates.length} candidate title(s) — top ${Math.min(40, candidates.length)}:\n`);
    for (const c of candidates.slice(0, 40)) {
      const diff = c.difficulties.size ? [...c.difficulties].sort().join("/") : "?";
      console.log(`  ${c.slug.padEnd(42)} ${patternFromTitle(c.title).padEnd(20)} diff=${diff} companies=${c.companies.size}`);
    }
    process.exit(0);
  }

  const plan = Math.min(count, candidates.length);
  if (dryRun) {
    console.log(green(`DRY RUN — would draft up to ${plan} problem(s) from ${candidates.length} candidates (model ${aiModel}, max ${maxCalls} calls). No API calls, no writes.`));
    for (const c of candidates.slice(0, Math.min(plan, 15))) {
      console.log(`  · ${c.title} (${patternFromTitle(c.title)}) — ${[...c.companies].join(", ")}`);
    }
    console.log(yellow(`Cost estimate: ~${plan} model calls (${plan} × ~900 tokens out).`));
    process.exit(0);
  }
  if (!aiKey) {
    console.log("No AI_CLEAN_KEY — skipping AI problem drafting (optional step). Pass --list-candidates to see the candidate pool.");
    process.exit(0);
  }

  console.log(green(`Drafting up to ${plan} problem(s) from ${candidates.length} candidates (model ${aiModel}, max ${maxCalls} calls).`));

  const passed = [];
  const failed = [];
  let calls = 0;
  let httpErrors = 0;
  for (const c of candidates) {
    if (passed.length >= plan) break;
    if (calls >= maxCalls) { console.log(yellow("Cost cap reached — stopping early.")); break; }
    calls++;
    try {
      let parsed = await draftOne(c);
      httpErrors = 0;
      if (!parsed) parsed = await draftOne(c, true); /* one corrective retry */
      const v = validateProblem(c, parsed);
      if (!v.ok) { failed.push({ title: c.title, why: `invalid: ${v.errors.join("; ")}` }); console.warn(yellow(`  ✗ ${c.title} — ${v.errors.join("; ")}`)); continue; }
      const problem = normalizeProblem(c, parsed);
      const gate = gateProblem(problem);
      if (!gate.pass) {
        const first = gate.results.find((r) => !r.pass);
        failed.push({ title: c.title, why: `gate: stdin=${JSON.stringify(first?.stdin)} expect=${JSON.stringify(first?.expect)} got=${JSON.stringify(first?.got)}` });
        console.warn(yellow(`  ✗ ${c.title} — gate: expect=${JSON.stringify(first?.expect)} got=${JSON.stringify(first?.got)}`));
        continue;
      }
      passed.push(problem);
      console.log(green(`  ✓ ${c.title} (${problem.pattern}, ${["Easy", "Medium", "Hard"][problem.difficulty - 1]}) — ${problem.tests.length + problem.hidden.length} cases green`));
    } catch (e) {
      const msg = e && e.message ? String(e.message) : String(e);
      const isHttp = /^AI HTTP \d{3}/.test(msg);
      httpErrors = isHttp ? httpErrors + 1 : 0;
      failed.push({ title: c.title, why: msg });
      console.warn(yellow(`  ✗ ${c.title} — ${msg}${msg === "AI HTTP 401" ? " (check AI_CLEAN_KEY — or AI_CLEAN_BASE/AI_CLEAN_MODEL for a non-OpenAI provider)" : ""}`));
      if (httpErrors >= 3) {
        console.error(red(`\n${httpErrors} consecutive API HTTP errors — aborting. Verify AI_CLEAN_KEY (and AI_CLEAN_BASE / AI_CLEAN_MODEL if the key is not an OpenAI key), then re-run.`));
        break;
      }
    }
    await sleep(250); /* polite rate limit */
  }

  console.log(`\n${green(`${passed.length} passed the gate`)}${failed.length ? yellow(`, ${failed.length} rejected`) : ""}.`);
  if (!passed.length) {
    console.log(yellow("Nothing to write — no problem passed. Raise AI_DRAFT_MAX / try a different model, or accept the current bank."));
    process.exit(0);
  }

  if (!write) {
    console.log(`DRY: would write ${passed.length} problem(s) to src/data/codingBank/aiGenerated.ts. Pass --write to apply.`);
    for (const p of passed) console.log(`  · ${p.id}`);
    process.exit(0);
  }

  /* rebuild the companies + topics side-tables from the surviving problems */
  const companies = {};
  const topics = {};
  for (const c of candidates) {
    const kept = passed.find((p) => p.id === c.slug);
    if (!kept) continue;
    companies[c.slug] = [...c.companies].sort();
    topics[c.slug] = PATTERN_TOPIC[kept.pattern] ?? "Algorithms";
  }
  const src = emitProblemsFile({ problems: passed, companies, topics, generatedAt: new Date().toISOString() });
  writeFileSync(AI_GENERATED_PATH, src);
  console.log(green(`\n✓ Wrote ${passed.length} problem(s) to src/data/codingBank/aiGenerated.ts (${companies ? Object.keys(companies).length : 0} company-tagged, ${topics ? Object.keys(topics).length : 0} topic-mapped).`));
  process.exit(0);
}

main().catch((e) => {
  console.error(red(e.message));
  process.exit(1);
});
