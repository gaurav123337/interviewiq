import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cloud = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));
vi.mock("../services/cloud", () => cloud);

import {
  DEFAULT_CONFIG,
  getSiteConfig,
  loadSiteConfig,
  resetSiteConfigCache,
  saveSiteConfig,
  subscribeSiteConfig,
  SITE_CONFIG_ROUTES,
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

afterEach(() => {
  resetSiteConfigCache();
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
    /* the subscription replays the current snapshot first; track publishes after it */
    expect(received).toEqual([DEFAULT_CONFIG.logo.text]);
    received.length = 0;
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

  it("refreshes default branding and linked copy when saving the complete config", async () => {
    const { client, upsert } = makeClient(null);
    cloud.getSupabaseClient.mockResolvedValue(client);
    const config = {
      ...DEFAULT_CONFIG,
      logo: { ...DEFAULT_CONFIG.logo, text: "JobAssist", tagline: "AI Job Helper" },
    };

    expect(await saveSiteConfig(config)).toBe(true);
    const saved = getSiteConfig();
    expect(saved.footer.brand).toBe("JobAssist — AI Job Helper");
    expect(saved.footer.copyright).toContain("JobAssist");
    expect(saved.hero.description).toContain("JobAssist");
    expect(saved.meta.title).toContain("JobAssist");
    expect(JSON.parse(upsert.mock.calls[0][0].value)).toEqual(saved);
  });

  it("retains custom footer branding when the logo changes", async () => {
    const { client } = makeClient({
      ...DEFAULT_CONFIG,
      footer: { ...DEFAULT_CONFIG.footer, brand: "A manually branded footer" },
    });
    cloud.getSupabaseClient.mockResolvedValue(client);
    const loaded = await loadSiteConfig();

    expect(await saveSiteConfig({
      ...loaded,
      logo: { ...loaded.logo, text: "JobAssist" },
    })).toBe(true);
    expect(getSiteConfig().footer.brand).toBe("A manually branded footer");
  });

  it("falls back to navigation defaults only when every configured destination is invalid", async () => {
    const { client } = makeClient({
      header: { ...DEFAULT_CONFIG.header, primaryTabs: [{ id: "invalid", label: "Bad", icon: "?" }] },
      menus: { ...DEFAULT_CONFIG.menus, moreMenu: [], mobileTabs: [] },
    });
    cloud.getSupabaseClient.mockResolvedValue(client);

    const config = await loadSiteConfig();
    expect(config.header.primaryTabs).toEqual(DEFAULT_CONFIG.header.primaryTabs);
    expect(config.menus.moreMenu).toEqual([]);
    expect(config.menus.mobileTabs).toEqual([]);
  });

  it("maps each configurable navigation id to a real app route", () => {
    const appRoutes = new Set([
      "onboard", "planner", "roadmap", "systemDesign", "playground", "drill", "bank",
      "jobs", "learn", "counselor", "articles", "resources", "progress", "history",
      "settings", "account",
    ]);
    expect(SITE_CONFIG_ROUTES.every(route => appRoutes.has(route.id))).toBe(true);
    expect(new Set(SITE_CONFIG_ROUTES.map(route => route.id)).size).toBe(SITE_CONFIG_ROUTES.length);
  });

  it("replays the loaded config to components that subscribe after it resolved", async () => {
    /* Landing/Legal are lazy chunks: they mount once loadSiteConfig() has
       already resolved, so a subscribe that only waits for the next publish
       would leave them on default hero/footer text. */
    const { client } = makeClient({ logo: { text: "JobAssist" }, hero: { title: "Prep that knows your target" } });
    cloud.getSupabaseClient.mockResolvedValue(client);
    await loadSiteConfig();

    const received: { text: string; title: string }[] = [];
    const unsubscribe = subscribeSiteConfig(c => received.push({ text: c.logo.text, title: c.hero.title }));
    unsubscribe();

    expect(received).toEqual([{ text: "JobAssist", title: "Prep that knows your target" }]);
  });

  it("keeps the current branding when persistence fails", async () => {
    const { client } = makeClient(null, new Error("write rejected"));
    cloud.getSupabaseClient.mockResolvedValue(client);
    const received: string[] = [];
    const unsubscribe = subscribeSiteConfig(config => received.push(config.logo.text));
    const config = { ...DEFAULT_CONFIG, logo: { ...DEFAULT_CONFIG.logo, text: "JobAssist" } };

    try {
      expect(await saveSiteConfig(config)).toBe(false);
      expect(received).toEqual([DEFAULT_CONFIG.logo.text]);
      expect(getSiteConfig()).toBe(DEFAULT_CONFIG);
    } finally {
      unsubscribe();
    }
  });
});
