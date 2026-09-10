import { beforeEach, describe, expect, it, vi } from "vitest";

/* Item 20 (Phase 3) — load-bearing path: skill-roadmap service API.
   Item 14 covered the prep-loop adapters (roadmapPrepSel/skillRoadmapShareText);
   the search ladder, resolvePath, tier gating and the offline cache cascade were
   untested. We force offline by mocking getSupabaseClient → null, so fetchFromSupabase
   returns [] and the service falls through to its localStorage cache / DEFAULT_ROADMAPS.
   Storage cache uses the real in-memory shim from setup.ts. */

vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn(async () => null),
}));

import {
  getAllRoadmaps,
  getRoadmapBySlug,
  searchRoadmaps,
  resolvePath,
  isAvailable,
} from "../services/skillRoadmapService";
import { storageSet, STORAGE_KEYS } from "../services/storage";

const DEFAULT_SLUGS = ["java", "react", "system-design", "python", "kubernetes"];

beforeEach(() => localStorage.clear());

describe("getAllRoadmaps — offline cache cascade", () => {
  it("returns the bundled defaults when there is no client and no cache", async () => {
    const all = await getAllRoadmaps();
    expect(all.map(r => r.slug)).toEqual(DEFAULT_SLUGS);
  });

  it("returns a fresh cache in preference to the defaults", async () => {
    const defaults = await getAllRoadmaps();
    const custom = [{ ...defaults[0], id: "cached-one", slug: "cached-one", name: "Cached" }];
    storageSet(STORAGE_KEYS.skillRoadmaps, { data: custom, timestamp: Date.now() });

    const fresh = await getAllRoadmaps();
    expect(fresh).toEqual(custom);
  });

  it("ignores a stale cache (older than the TTL) and uses the defaults", async () => {
    const defaults = await getAllRoadmaps();
    const custom = [{ ...defaults[0], id: "cached-one", slug: "cached-one" }];
    // TTL is 5 min; 6 min ago is stale.
    storageSet(STORAGE_KEYS.skillRoadmaps, { data: custom, timestamp: Date.now() - 6 * 60 * 1000 });

    const stale = await getAllRoadmaps();
    expect(stale.map(r => r.slug)).toEqual(DEFAULT_SLUGS);
  });
});

describe("getRoadmapBySlug", () => {
  it("finds a roadmap by slug", async () => {
    expect((await getRoadmapBySlug("react"))?.name).toBe("React");
  });

  it("returns null for an unknown slug", async () => {
    expect(await getRoadmapBySlug("does-not-exist")).toBeNull();
  });
});

describe("searchRoadmaps — scoring ladder", () => {
  it("scores an exact slug match at 100", async () => {
    const results = await searchRoadmaps("java");
    expect(results[0].roadmap.slug).toBe("java");
    expect(results[0].matchScore).toBe(100);
    expect(results[0].matchType).toBe("exact");
  });

  it("scores an alias match at 60", async () => {
    const results = await searchRoadmaps("k8s");
    expect(results).toHaveLength(1);
    expect(results[0].roadmap.slug).toBe("kubernetes");
    expect(results[0].matchScore).toBe(60);
    expect(results[0].matchType).toBe("alias");
  });

  it("scores a tag match at 40 across every roadmap carrying the tag", async () => {
    const results = await searchRoadmaps("backend");
    expect(results.map(r => r.roadmap.slug).sort()).toEqual(["java", "python"]);
    expect(results.every(r => r.matchScore === 40 && r.matchType === "tag")).toBe(true);
  });

  it("returns all roadmaps at score 50 for an empty query", async () => {
    const results = await searchRoadmaps("");
    expect(results).toHaveLength(DEFAULT_SLUGS.length);
    expect(results.every(r => r.matchScore === 50 && r.matchType === "name")).toBe(true);
  });

  it("returns nothing for a non-matching query", async () => {
    expect(await searchRoadmaps("zzql9xq")).toEqual([]);
  });

  it("sorts results by descending score (name-include beats description)", async () => {
    // "system": system-design name-includes it (80); java description mentions
    // "backend systems" (20). Two distinct scores → proves the sort.
    const results = await searchRoadmaps("system");
    expect(results[0].roadmap.slug).toBe("system-design");
    expect(results[0].matchScore).toBe(80);
    const java = results.find(r => r.roadmap.slug === "java");
    expect(java?.matchScore).toBe(20);
    expect(java?.matchType).toBe("description");
    const scores = results.map(r => r.matchScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe("resolvePath", () => {
  it("resolves prerequisites case-insensitively and computes weeks from hours", async () => {
    const java = (await getRoadmapBySlug("java"))!;
    const resolved = resolvePath(java, ["SQL"]);
    expect(resolved.prerequisitesResolved).toEqual([
      { skillId: "data-structures", known: false },
      { skillId: "sql", known: true },
    ]);
    expect(resolved.totalHours).toBe(java.estimatedHours);
    expect(resolved.weeksEstimate).toBe(Math.ceil(java.estimatedHours / 10));
  });
});

describe("isAvailable — tier gating", () => {
  it("a free roadmap is available on both tiers", async () => {
    const java = (await getRoadmapBySlug("java"))!; // tier: free
    expect(isAvailable(java, "free")).toBe(true);
    expect(isAvailable(java, "pro")).toBe(true);
  });

  it("a pro roadmap is gated behind the pro tier", async () => {
    const sysDesign = (await getRoadmapBySlug("system-design"))!; // tier: pro
    expect(isAvailable(sysDesign, "free")).toBe(false);
    expect(isAvailable(sysDesign, "pro")).toBe(true);
  });
});
