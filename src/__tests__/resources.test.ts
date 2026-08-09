import { describe, expect, it } from "vitest";
import { COMPANIES, FIELDS, LEVELS } from "../data";
import { getTopicInfo, hasSpecificInfo } from "../data/resources";

describe("resources integrity", () => {
  it("every field skill resolves to a specific entry", () => {
    for (const f of FIELDS) {
      for (const s of f.skills) {
        expect(hasSpecificInfo(s), `field ${f.id} skill "${s}"`).toBe(true);
      }
    }
  });

  it("every level focus term resolves to a specific entry", () => {
    for (const l of LEVELS) {
      for (const f of l.focus.split(",")) {
        expect(hasSpecificInfo(f.trim()), `level ${l.id} focus "${f}"`).toBe(true);
      }
    }
  });

  it("every company stack term resolves to a specific entry", () => {
    for (const c of COMPANIES) {
      for (const s of c.stack) {
        expect(hasSpecificInfo(s), `company ${c.id} stack "${s}"`).toBe(true);
      }
    }
  });

  it("pool topics fall back to their pool's info", () => {
    expect(getTopicInfo("Design a URL shortener.", "sysdesign").primer).toContain("requirements");
    expect(getTopicInfo("Tell me about a time you failed.", "behavioral").primer).toContain("STAR");
    expect(getTopicInfo("How do you manage the engineering budget?", "cto").links.length).toBeGreaterThan(0);
    expect(getTopicInfo("How do you evaluate a new market opportunity?", "ceo").links.length).toBeGreaterThan(0);
  });

  it("unknown topics still get a generic entry", () => {
    const info = getTopicInfo("Quantum teleportation of beets");
    expect(info.primer.length).toBeGreaterThan(10);
    expect(info.links.length).toBeGreaterThan(0);
  });
});
