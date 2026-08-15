/* Deno parity tests for the shared trend engine — the same math runs in the
   client (vitest) and in trends-refresh. Runs in CI via
   `deno test supabase/functions/_shared/` without network. */

import { assertEquals, assert } from "jsr:@std/assert";

import {
  classifyStage,
  computeTrendScore,
  mentionsIn,
  proposalsFromSignals,
  SKILL_KEYWORDS,
  clamp
} from "./trends.ts";

Deno.test("trends clamp bounds values", () => {
  assertEquals(clamp(5, 0, 10), 5);
  assertEquals(clamp(-3, 0, 10), 0);
  assertEquals(clamp(99, 0, 10), 10);
});

Deno.test("trends mentionsIn counts rows by keyword", () => {
  const rows = [
    { description: "React developer", skills: [] },
    { description: "backend", skills: ["node"] },
    { description: "other" }
  ];
  assertEquals(mentionsIn(rows, SKILL_KEYWORDS.react), 1);
  assertEquals(mentionsIn(rows, SKILL_KEYWORDS.node), 1);
});

Deno.test("trends score rises with demand, falls with decline", () => {
  const up = computeTrendScore({ skillId: "x", job30: 90, job90: 10 });
  const down = computeTrendScore({ skillId: "x", job30: 5, job90: 50 });
  assert(up > 60);
  assert(down < 35);
});

Deno.test("trends stage classification is stable", () => {
  assertEquals(classifyStage(25), "declining");
  assertEquals(classifyStage(45), "nascent");
  assertEquals(classifyStage(55), "emerging");
  assertEquals(classifyStage(70), "growing");
  assertEquals(classifyStage(90), "mainstream");
});

Deno.test("trends proposals only fire on stage crossings", () => {
  const p = proposalsFromSignals([{ skillId: "css", job30: 2, job90: 40 }], { css: "growing" });
  assertEquals(p.length, 1);
  assertEquals(p[0].kind, "demote");
  const none = proposalsFromSignals([{ skillId: "react", job30: 50, job90: 40 }], { react: "growing" });
  assertEquals(none.length, 0);
});
