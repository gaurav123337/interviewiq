// @vitest-environment jsdom
/* Bank self-test — every CLI problem's JS reference must pass its own visible
   + hidden cases through the real local engine. A broken problem, bad test, or
   drifting reference fails here. */

import { describe, expect, it } from "vitest";
import { CODING_PROBLEMS, RUNNER_LANGS, type CliProblem } from "../data/coding";
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
