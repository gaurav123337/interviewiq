// @vitest-environment jsdom
/* Bank self-test — every UI problem's reference implementation must pass its
   own visible + hidden assertions through the judge core. This guarantees the
   assertions are actually solvable and the problems ship verified. */

import { describe, expect, it } from "vitest";
import { UI_COMPONENT_PROBLEMS } from "../data/codingBank/uiComponents";
import { runUiInDoc } from "../services/runner";

describe("UI component bank self-test", () => {
  it("every reference passes its own full assertion suite", async () => {
    expect(UI_COMPONENT_PROBLEMS.length).toBeGreaterThanOrEqual(10);
    const failures: string[] = [];
    for (const p of UI_COMPONENT_PROBLEMS) {
      const suite = [...p.assertions, ...(p.hiddenAssertions ?? [])];
      const results = await runUiInDoc(document, p.reference.html, p.reference.css, p.reference.js, suite);
      const bad = results.filter(r => !r.pass);
      if (bad.length > 0) {
        failures.push(`${p.id}: ${bad.map(b => `${b.label}${b.error ? ` (${b.error})` : ""}`).join("; ")}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("exposes a hint and reference for every problem", () => {
    for (const p of UI_COMPONENT_PROBLEMS) {
      expect(p.hint?.trim().length ?? 0).toBeGreaterThan(0);
      expect(p.reference.js.trim().length).toBeGreaterThan(10);
      expect(p.assertions.length).toBeGreaterThanOrEqual(2);
      expect((p.hiddenAssertions?.length ?? 0)).toBeGreaterThanOrEqual(1);
    }
  });
});
