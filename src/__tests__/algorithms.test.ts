// @vitest-environment jsdom
/* Bank self-test — every CLI problem's JS reference must pass its own visible
   + hidden cases through the real local engine. A broken problem, bad test, or
   drifting reference fails here. */

import { describe, expect, it } from "vitest";
import { CODING_PROBLEMS, RUNNER_LANGS, type CliProblem } from "../data/coding";
import { AI_GENERATED_PROBLEMS, AI_CLI_TOPICS, AI_PROBLEM_COMPANIES } from "../data/codingBank/aiGenerated";
import { CLI_TOPICS, PROBLEM_COMPANIES } from "../data/codingCompanies";
import { PATTERN_LABELS } from "../data/patterns";
import { buildProgram, runTests } from "../services/runner";

const cli = CODING_PROBLEMS.filter((p): p is CliProblem => p.kind === "cli" && !!p.reference);
const lang = RUNNER_LANGS.find(l => l.id === "javascript")!;

describe("CLI algorithm bank self-test", () => {
  it("every problem with a reference passes its own full suite in JS", async () => {
    expect(cli.length).toBeGreaterThanOrEqual(18);
    const failures: string[] = [];
    for (const p of cli) {
      const results = await runTests(lang, buildProgram(lang, p.reference!), [...p.tests, ...(p.hidden ?? [])]);
      const bad = results.filter(r => !r.pass);
      if (bad.length > 0) {
        failures.push(`${p.id}: ${bad.map(b => `stdin=${JSON.stringify(b.stdin)} expected=${JSON.stringify(b.expect)} got=${JSON.stringify(b.got)}`).join("; ")}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every problem has a hint", () => {
    for (const p of CODING_PROBLEMS.filter(x => x.kind === "cli")) {
      expect(p.hint?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("P4 AI-generated bank wiring", () => {
  it("every AI problem is fully wired: pattern, topic, company tags, all 6 starters", () => {
    for (const p of AI_GENERATED_PROBLEMS) {
      expect(PATTERN_LABELS[p.pattern ?? ""], `${p.id}: unknown pattern ${p.pattern}`).toBeDefined();
      expect(CLI_TOPICS[p.id], `${p.id}: missing CLI topic`).toBeDefined();
      expect(CLI_TOPICS[p.id]).toBe(AI_CLI_TOPICS[p.id]);
      expect((PROBLEM_COMPANIES[p.id] ?? []).length, `${p.id}: untagged`).toBeGreaterThan(0);
      expect(Object.keys(p.starters).sort()).toEqual(RUNNER_LANGS.map(l => l.id).sort());
    }
  });

  it("AI_PROBLEM_COMPANIES and AI_CLI_TOPICS only reference real problems", () => {
    const ids = new Set(AI_GENERATED_PROBLEMS.map(p => p.id));
    for (const id of Object.keys(AI_PROBLEM_COMPANIES)) expect(ids.has(id), `unknown id ${id}`).toBe(true);
    for (const id of Object.keys(AI_CLI_TOPICS)) expect(ids.has(id), `unknown id ${id}`).toBe(true);
  });
});
