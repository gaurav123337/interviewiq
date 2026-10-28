import { beforeEach, describe, expect, it, vi } from "vitest";

const cloud = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));
vi.mock("../services/cloud", () => cloud);

import {
  DEFAULT_CONFIG,
  getSiteConfig,
  loadSiteConfig,
  resetSiteConfigCache,
  saveSiteConfig,
  subscribeSiteConfig,
} from "../services/siteConfig";

function makeClient(value: unknown, saveError: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: value == null ? null : { value }, error: null });
  const upsert = vi.fn().mockResolvedValue({ error: saveError });
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })),
      upsert,
    })),
  };
  return { client, single, upsert };
}

beforeEach(() => {
  resetSiteConfigCache();
  cloud.getSupabaseClient.mockReset();
});

describe("site config branding", () => {
  it("loads remote branding while retaining defaults for omitted nested fields", async () => {
    const { client } = makeClient({ logo: { text: "JobAssist" } });
    cloud.getSupabaseClient.mockResolvedValue(client);

    const config = await loadSiteConfig();

    expect(config.logo.text).toBe("JobAssist");
    expect(config.logo.icon).toBe(DEFAULT_CONFIG.logo.icon);
    expect(config.header).toEqual(DEFAULT_CONFIG.header);
    expect(getSiteConfig()).toBe(config);
  });

  it("publishes a successful save to current subscribers and subsequent loads", async () => {
    const { client, upsert } = makeClient(null);
    cloud.getSupabaseClient.mockResolvedValue(client);
    const received: string[] = [];
    const unsubscribe = subscribeSiteConfig(config => received.push(config.logo.text));
    const config = { ...DEFAULT_CONFIG, logo: { ...DEFAULT_CONFIG.logo, text: "JobAssist" } };

    try {
      expect(await saveSiteConfig(config)).toBe(true);
      expect(received).toEqual(["JobAssist"]);
      expect(getSiteConfig().logo.text).toBe("JobAssist");
      expect((await loadSiteConfig()).logo.text).toBe("JobAssist");
      expect(upsert).toHaveBeenCalledOnce();
    } finally {
      unsubscribe();
    }
  });

  it("keeps the current branding when persistence fails", async () => {
    const { client } = makeClient(null, new Error("write rejected"));
    cloud.getSupabaseClient.mockResolvedValue(client);
    const received: string[] = [];
    const unsubscribe = subscribeSiteConfig(config => received.push(config.logo.text));
    const config = { ...DEFAULT_CONFIG, logo: { ...DEFAULT_CONFIG.logo, text: "JobAssist" } };

    try {
      expect(await saveSiteConfig(config)).toBe(false);
      expect(received).toEqual([]);
      expect(getSiteConfig()).toBe(DEFAULT_CONFIG);
    } finally {
      unsubscribe();
    }
  });
});
