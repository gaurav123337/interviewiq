/* Catalog metadata corpus (docs/skill-counselor.md §4.1, §5.1) — freshness,
   manifest diff and quality scoring. Pure, offline. */

import { describe, it, expect } from "vitest";
import {
  applyManifestDiff,
  markManifestSeen,
  resourceFreshness,
  resourceQuality,
  qualityBand
} from "../services/catalogMeta";
import { CATALOG_MANIFEST, SKILLS } from "../data/skillCatalog";

const res = (publishedYear: number, free = true) => ({
  title: "t", url: "https://x.dev", kind: "docs" as const, free, publishedYear
});

describe("resourceFreshness", () => {
  const now = new Date("2026-08-15");
  it("flags old resources", () => {
    expect(resourceFreshness(res(2018), now).status).toBe("verify");
    expect(resourceFreshness(res(2023), now).status).toBe("stale");
    expect(resourceFreshness(res(2025), now).status).toBe("current");
  });
});

describe("applyManifestDiff", () => {
  it("first run is new (no stored version)", () => {
    const d = applyManifestDiff({ version: "" });
    expect(d.isNew).toBe(true);
    expect(d.version).toBe(CATALOG_MANIFEST.version);
    expect(d.changes.length).toBeGreaterThan(0);
  });

  it("same version → not new", () => {
    expect(applyManifestDiff({ version: CATALOG_MANIFEST.version }).isNew).toBe(false);
  });

  it("markManifestSeen persists the current version", () => {
    markManifestSeen();
    expect(applyManifestDiff().isNew).toBe(false);
  });

  it("counts the bundled catalog", () => {
    const d = applyManifestDiff({ version: "" });
    expect(d.skillCount).toBe(Object.keys(SKILLS).length);
    expect(d.resourceCount).toBeGreaterThan(d.skillCount);
  });
});

describe("resourceQuality", () => {
  const now = new Date("2026-08-15");
  it("fresh free resources score highest", () => {
    const q = resourceQuality(res(2026, true), { now });
    expect(q).toBeGreaterThanOrEqual(85);
    expect(qualityBand(q)).toBe("Top");
  });

  it("old paid resources score lowest", () => {
    const q = resourceQuality(res(2015, false), { now });
    expect(q).toBeLessThanOrEqual(60);
  });

  it("community votes add up to +10", () => {
    const base = resourceQuality(res(2024, true), { now });
    const voted = resourceQuality(res(2024, true), { now, communityVotes: 25 });
    expect(voted).toBe(base + 10);
  });

  it("never exceeds 100", () => {
    expect(resourceQuality(res(2026, true), { now, communityVotes: 99 })).toBe(100);
  });
});
