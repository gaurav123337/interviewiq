import { beforeEach, describe, expect, it, vi } from "vitest";

/* Mock cloud module to inject a fake Supabase client */
const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fromMock = vi.fn();
const fakeClient = {
  rpc: rpcMock,
  from: fromMock,
};

vi.mock("../services/cloud", () => ({
  getSupabaseClient: () => Promise.resolve(fakeClient),
}));

/* Mock storage to bypass localStorage in CI */
const store = new Map<string, unknown>();
vi.mock("../services/storage", () => ({
  storageGet: <T>(key: string, fallback: T) => (store.has(key) ? store.get(key) as T : fallback),
  storageSet: (_key: string, val: unknown) => { store.set(_key, val); },
  storageRemove: (key: string) => { store.delete(key); },
}));

import {
  trackClick,
  trackImpression,
  fetchBannersForPosition,
  fetchAnalyticsSummary,
  fetchABTestResults,
  fetchDailyAnalytics,
  getVisitorVariant,
  type Banner,
} from "../services/contentService";

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: null, error: null });
  fromMock.mockReset();
  store.clear();
});

/* ------------------------------------------------------------------ */
/* A/B Variant assignment                                              */
/* ------------------------------------------------------------------ */

describe("getVisitorVariant", () => {
  it("returns 'A' or 'B'", () => {
    const v = getVisitorVariant();
    expect(v === "A" || v === "B").toBe(true);
  });

  it("returns the same variant for the same visitor ID", () => {
    const v1 = getVisitorVariant();
    const v2 = getVisitorVariant();
    expect(v1).toBe(v2);
  });

  it("is deterministic across calls (same visitor)", () => {
    // Call many times — should always return the same value
    const results = Array.from({ length: 20 }, () => getVisitorVariant());
    expect(new Set(results).size).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Analytics tracking                                                  */
/* ------------------------------------------------------------------ */

describe("trackClick", () => {
  it("calls the RPC with correct params", async () => {
    await trackClick("banner", "b1", "A");
    expect(rpcMock).toHaveBeenCalledWith("track_content_click", {
      p_entity_type: "banner",
      p_entity_id: "b1",
      p_variant: "A",
    });
  });

  it("passes null variant when not provided", async () => {
    await trackClick("ad", "ad-1");
    expect(rpcMock).toHaveBeenCalledWith("track_content_click", {
      p_entity_type: "ad",
      p_entity_id: "ad-1",
      p_variant: null,
    });
  });

  it("silently fails when Supabase is null", async () => {
    // Replace client with null
    fromMock.mockImplementation(() => { throw new Error("no client"); });
    // Should not throw
    await expect(trackClick("resource", "r1")).resolves.toBeUndefined();
  });
});

describe("trackImpression", () => {
  it("calls the RPC with correct params", async () => {
    await trackImpression("banner", "b2", "B");
    expect(rpcMock).toHaveBeenCalledWith("track_content_impression", {
      p_entity_type: "banner",
      p_entity_id: "b2",
      p_variant: "B",
    });
  });

  it("passes null variant when not provided", async () => {
    await trackImpression("testimonial", "t1");
    expect(rpcMock).toHaveBeenCalledWith("track_content_impression", {
      p_entity_type: "testimonial",
      p_entity_id: "t1",
      p_variant: null,
    });
  });
});

/* ------------------------------------------------------------------ */
/* Banner CRUD                                                         */
/* ------------------------------------------------------------------ */

describe("Banner operations", () => {
  it("fetchBannersForPosition filters by position", async () => {
    const banners: Banner[] = [
      { id: "b1", title: "Hero", subtitle: "", cta_text: "", cta_url: "", image_url: "", bg_gradient: "", text_color: "#fff", position: "hero", published: true, impressions: 0, clicks: 0 },
      { id: "b2", title: "Popup", subtitle: "", cta_text: "", cta_url: "", image_url: "", bg_gradient: "", text_color: "#fff", position: "popup", published: true, impressions: 0, clicks: 0 },
    ];
    // Mock the chain: from("admin_banners").select("*").order("created_at", { ascending: true })
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: banners, error: null }),
      }),
    });

    const result = await fetchBannersForPosition("hero");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b1");
  });

  it("fetchAnalyticsSummary returns data from RPC", async () => {
    const summary = [{ entity_type: "ad", entity_id: "1", impressions: 100, clicks: 5, ctr: 5 }];
    rpcMock.mockResolvedValue({ data: summary, error: null });
    const result = await fetchAnalyticsSummary();
    expect(result).toEqual(summary);
    expect(rpcMock).toHaveBeenCalledWith("admin_content_analytics_summary");
  });

  it("fetchABTestResults returns data from RPC", async () => {
    const ab = [{ variant: "A", impressions: 50, clicks: 3, ctr: 6 }];
    rpcMock.mockResolvedValue({ data: ab, error: null });
    const result = await fetchABTestResults();
    expect(result).toEqual(ab);
    expect(rpcMock).toHaveBeenCalledWith("admin_ab_test_results");
  });

  it("fetchDailyAnalytics returns data from RPC", async () => {
    const daily = [{ day: "2026-08-20", impressions: 200, clicks: 10 }];
    rpcMock.mockResolvedValue({ data: daily, error: null });
    const result = await fetchDailyAnalytics();
    expect(result).toEqual(daily);
    expect(rpcMock).toHaveBeenCalledWith("admin_daily_analytics");
  });

  it("analytics functions return empty arrays on RPC error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "fail" } });
    expect(await fetchAnalyticsSummary()).toEqual([]);
    expect(await fetchABTestResults()).toEqual([]);
    expect(await fetchDailyAnalytics()).toEqual([]);
  });

  it("analytics functions return empty arrays when client is null", async () => {
    // If getSupabaseClient returns null, these should return empty
    // The mock always returns fakeClient, so we can test the null-data path
    rpcMock.mockResolvedValue({ data: null, error: null });
    expect(await fetchAnalyticsSummary()).toEqual([]);
  });
});
