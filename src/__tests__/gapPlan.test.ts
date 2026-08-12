/* Gap plan (Apply Kit Phase 2) — effort bands, weekly schedule sizing, persistence. */

import { afterEach, describe, expect, it } from "vitest";
import type { JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import { buildGapPlan, getGapPlan, saveGapPlan } from "../services/gapPlan";

const JOB: JobPosting = {
  id: "greenhouse:1",
  source: "greenhouse",
  externalId: "1",
  title: "Senior Backend Engineer",
  company: "Lyft",
  location: "Toronto",
  remote: true,
  description: "",
  url: "https://x/1",
  skills: [],
  level: "senior",
  postedAt: null
};

afterEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

describe("buildGapPlan", () => {
  it("orders missing skills and estimates effort by band", () => {
    const plan = buildGapPlan(JOB, ["kubernetes", "typescript", "css"], 4);
    expect(plan.items.map(i => i.skill)).toEqual(["kubernetes", "typescript", "css"]);
    expect(plan.items[0].estHours).toBe(8); /* infra band */
    expect(plan.items[1].estHours).toBe(6); /* language band */
    expect(plan.items[2].estHours).toBe(4); /* UI band */
    expect(plan.items.map(i => i.priority)).toEqual([1, 2, 3]);
  });

  it("sizes the weekly schedule from available hours", () => {
    const plan = buildGapPlan(JOB, ["kubernetes", "typescript", "css", "docker", "python"], 4);
    expect(plan.totalHours).toBe(8 + 6 + 4 + 8 + 6); /* 32 */
    expect(plan.perWeekHours).toBe(4);
    expect(plan.weeks).toBe(8);
  });

  it("every item gets a primer and links from the topic library", () => {
    const plan = buildGapPlan(JOB, ["react"], 4);
    expect(plan.items[0].primer.length).toBeGreaterThan(10);
    expect(plan.items[0].links.length).toBeGreaterThan(0);
  });

  it("defaults to 4h/week when the goal is unset and never divides by zero", () => {
    const plan = buildGapPlan(JOB, ["react"], 0);
    expect(plan.perWeekHours).toBe(4);
    expect(plan.weeks).toBeGreaterThanOrEqual(1);
  });
});

describe("gap plan persistence", () => {
  it("save then get round-trips per job", () => {
    const plan = buildGapPlan(JOB, ["react"], 4);
    saveGapPlan(plan);
    const got = getGapPlan(JOB.id);
    expect(got?.jobTitle).toBe("Senior Backend Engineer");
    expect(got?.items[0].skill).toBe("react");
    expect(getGapPlan("greenhouse:other")).toBeNull();
  });
});
