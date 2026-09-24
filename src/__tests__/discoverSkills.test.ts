import { describe, expect, it } from "vitest";

import {
  budgetCap, dedupeProposals, findSkillGaps, parseCatalogSkillNames,
  proposeSkillSeeds, sourceKey, skillNames, GAP_MIN
} from "../../scripts/discover-skills-lib.js";

/* TS annotations on the .js-import lambdas (repo pattern — the .d.ts sibling
   covers the module's own exports; inline literals here need explicit types). */
const CATALOG: Record<string, { name: string }> = {
  html: { name: "HTML" },
  css: { name: "CSS" },
  js: { name: "JavaScript" }
};

describe("parseCatalogSkillNames (TS source → names, zero eval)", () => {
  it("extracts name literals in first-appearance order and dedupes", () => {
    const src = `
      export const SKILLS: Record<string, CatalogSkill> = {
        "html": { id: "html", name: "HTML", band: "junior", difficulty: 1, why: "the skeleton" },
        "js":   { id: "js", name: "JavaScript", band: "junior", why: "the language" },
        "js2":  { id: "js2", name: "JavaScript", band: "mid", why: "dup name — kept once" },
        "sys":  { id: "sys", name: "System design", band: "staff", why: "architecture" }
      };
    `;
    expect(parseCatalogSkillNames(src)).toEqual(["HTML", "JavaScript", "System design"]);
  });

  it("ignores non-name string literals and tolerates garbage input", () => {
    expect(parseCatalogSkillNames('const why = "not a name"; name: "Real Skill"')).toEqual(["Real Skill"]);
    expect(parseCatalogSkillNames("")).toEqual([]);
    expect(parseCatalogSkillNames(null)).toEqual([]);
  });
});

describe("skill names + source keys", () => {
  it("maps the catalog record to trimmed, non-empty names", () => {
    expect(skillNames(CATALOG)).toEqual(["HTML", "CSS", "JavaScript"]);
    expect(skillNames({ broken: { name: "  " } })).toEqual([]);
    expect(skillNames(null)).toEqual([]);
  });

  it("normalizes source keys (trim + lowercase)", () => {
    expect(sourceKey("  React ")).toBe("react");
    expect(sourceKey(null)).toBe("");
  });
});

describe("findSkillGaps — fewer than GAP_MIN approved resources", () => {
  it("flags skills under the threshold and spares those at/above it", () => {
    const counts = { html: 2, css: 1 }; // GAP_MIN = 2
    expect(findSkillGaps(CATALOG, counts)).toEqual(["CSS", "JavaScript"]);
    expect(GAP_MIN).toBe(2);
  });

  it("accepts a name array or a catalog record (same result)", () => {
    const counts = { javascript: 5 };
    expect(findSkillGaps(["HTML", "JavaScript"], counts)).toEqual(["HTML"]);
    expect(findSkillGaps(CATALOG, counts)).toEqual(["HTML", "CSS"]);
  });

  it("with no approved resources everything is a gap; null inputs degrade to []", () => {
    expect(findSkillGaps(CATALOG, {})).toEqual(["HTML", "CSS", "JavaScript"]);
    expect(findSkillGaps(null, null)).toEqual([]);
  });
});

describe("proposeSkillSeeds — deterministic keyless proposals", () => {
  it("proposes github repo-search + hn algolia per skill, slugged, skill-tagged", () => {
    const out = proposeSkillSeeds(["State management"]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      kind: "html",
      origin: "skill-auto",
      origin_detail: "skill-auto: State management (github repo-search)",
      skill: "State management"
    });
    expect(out[0].url).toContain("state-management%20interview-questions");
    expect(out[1]).toMatchObject({ kind: "json", origin: "skill-auto", skill: "State management" });
    expect(out[1].url).toContain("hn.algolia.com");
    expect(out[1].url).toContain("state-management%20interview");
  });

  it("is deterministic and honors maxPerSkill", () => {
    const a = proposeSkillSeeds(["React", "CSS"]);
    const b = proposeSkillSeeds(["React", "CSS"]);
    expect(a).toEqual(b);
    expect(proposeSkillSeeds(["React"], { maxPerSkill: 1 })).toHaveLength(1);
    expect(proposeSkillSeeds([])).toEqual([]);
    expect(proposeSkillSeeds(null)).toEqual([]);
  });
});

describe("dedupe + budget", () => {
  const props = proposeSkillSeeds(["React", "CSS"]);

  it("drops proposals whose URL is already known (any status) case-insensitively", () => {
    const known = [props[0].url.toUpperCase(), "https://unrelated.dev/page"];
    const out = dedupeProposals(props, known);
    expect(out.some(p => p.url === props[0].url)).toBe(false);
    expect(out.some(p => p.url === props[1].url)).toBe(true);
  });

  it("tolerates null/undefined on both sides", () => {
    expect(dedupeProposals(null, null)).toEqual([]);
    expect(dedupeProposals(props, null)).toEqual(props);
  });

  it("budgetCap caps the queue (small enough to actually review)", () => {
    expect(budgetCap(props, 3)).toHaveLength(3);
    expect(budgetCap(props, 99)).toHaveLength(4);
    expect(budgetCap(null)).toEqual([]);
  });
});

describe("discover-skills.js orchestrator", () => {
  it("imports without side effects (is-main guard)", async () => {
    const mod = await import("../../scripts/discover-skills.js");
    expect(typeof mod.main).toBe("function");
  });
});
