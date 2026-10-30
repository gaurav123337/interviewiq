import type { View } from "../types";

/**
 * Site Config Service
 * 
 * Manages configurable site elements (header, footer, menus, logo, texts)
 * backed by Supabase. Falls back to defaults when Supabase is unavailable.
 */

export interface SiteConfig {
  // Branding
  logo: {
    icon: string;        // emoji or image URL
    favicon: string;
    text: string;        // "InterviewIQ"
    tagline: string;     // "AI Interview Coach"
  };
  
  // Header navigation
  header: {
    primaryTabs: { id: string; label: string; icon: string }[];
    showThemeToggle: boolean;
    showFeedbackButton: boolean;
    showInstallButton: boolean;
  };
  
  // Footer
  footer: {
    brand: string;
    links: { label: string; href: string; hash?: string }[];
    copyright: string;
  };
  
  // Menus
  menus: {
    moreMenu: { id: string; label: string; icon: string }[];
    mobileTabs: { id: string; label: string; icon: string }[];
  };
  
  // Hero section
  hero: {
    badge: string;
    title: string;
    description: string;
    ctaText: string;
    ctaLink: string;
  };
  
  // Meta
  meta: {
    title: string;
    description: string;
    ogImage: string;
    canonical: string;
    twitterHandle: string;
  };
}

export const SITE_CONFIG_ROUTES = [
  { id: "onboard", label: "Practice", icon: "🎯" },
  { id: "planner", label: "Planner", icon: "🗓️" },
  { id: "roadmap", label: "Roadmap", icon: "🧭" },
  { id: "systemDesign", label: "System Design", icon: "🏗️" },
  { id: "playground", label: "Code", icon: "💻" },
  { id: "drill", label: "Drill", icon: "🎴" },
  { id: "bank", label: "Bank", icon: "📚" },
  { id: "jobs", label: "Jobs", icon: "💼" },
  { id: "learn", label: "Learn a Skill", icon: "🔍" },
  { id: "counselor", label: "Skill Counselor", icon: "🧑‍🏫" },
  { id: "articles", label: "Articles", icon: "📰" },
  { id: "resources", label: "Resources", icon: "🔗" },
  { id: "progress", label: "Progress", icon: "📈" },
  { id: "history", label: "History", icon: "🗂️" },
  { id: "settings", label: "Settings", icon: "⚙️" },
  { id: "account", label: "Account", icon: "👤" },
] as const;

const CONFIG_ROUTES = new Map<string, (typeof SITE_CONFIG_ROUTES)[number]>(SITE_CONFIG_ROUTES.map(route => [route.id, route]));

export const SITE_CONFIG_LINK_ROUTES: Record<string, View> = {
  practice: "onboard", onboard: "onboard", landing: "landing", planner: "planner",
  roadmap: "roadmap", systemDesign: "systemDesign", "system-design": "systemDesign",
  playground: "playground", code: "playground", drill: "drill", bank: "bank", jobs: "jobs",
  learn: "learn", counselor: "counselor", articles: "articles", resources: "resources",
  progress: "progress", history: "history", settings: "settings", account: "account",
  legal: "legal", terms: "legal", privacy: "legal", refunds: "legal", shipping: "legal", sources: "sources",
};

const DEFAULT_CONFIG: SiteConfig = {
  logo: {
    icon: "🎙️",
    favicon: "icons/favicon.svg",
    text: "InterviewIQ",
    tagline: "AI Interview Coach",
  },
  header: {
    primaryTabs: [
      { id: "onboard", label: "Practice", icon: "🎯" },
      { id: "planner", label: "Planner", icon: "🗓️" },
      { id: "roadmap", label: "Roadmap", icon: "🧭" },
      { id: "systemDesign", label: "System Design", icon: "🏗️" },
      { id: "playground", label: "Code", icon: "💻" },
    ],
    showThemeToggle: true,
    showFeedbackButton: true,
    showInstallButton: true,
  },
  footer: {
    brand: "InterviewIQ — AI Interview Coach",
    links: [
      { label: "Terms", hash: "terms", href: "#/legal" },
      { label: "Privacy", hash: "privacy", href: "#/legal" },
      { label: "Refunds", hash: "refunds", href: "#/legal" },
      { label: "Shipping", hash: "shipping", href: "#/legal" },
    ],
    copyright: `© ${new Date().getFullYear()} InterviewIQ. All rights reserved.`,
  },
  menus: {
    moreMenu: [
      { id: "drill", label: "Drill", icon: "🎴" },
      { id: "bank", label: "Bank", icon: "📚" },
      { id: "jobs", label: "Jobs", icon: "💼" },
      { id: "learn", label: "Learn a Skill", icon: "🔍" },
      { id: "counselor", label: "Skill Counselor", icon: "🧑‍🏫" },
      { id: "articles", label: "Articles", icon: "📰" },
      { id: "resources", label: "Resources", icon: "🔗" },
      { id: "progress", label: "Progress", icon: "📈" },
      { id: "history", label: "History", icon: "🗂️" },
      { id: "settings", label: "Settings", icon: "⚙️" },
      { id: "account", label: "Account", icon: "👤" },
    ],
    mobileTabs: [
      { id: "onboard", label: "Practice", icon: "🎯" },
      { id: "jobs", label: "Jobs", icon: "💼" },
      { id: "counselor", label: "Counselor", icon: "🧑‍🏫" },
      { id: "systemDesign", label: "Sys Design", icon: "🏗️" },
    ],
  },
  hero: {
    badge: "⚡ Free · Offline-first · No account needed",
    title: "From junior developer to CTO & CEO — interview prep that knows your target.",
    description: "InterviewIQ is the AI interviewer that tailors every question to your field, level and target company.",
    ctaText: "Start practicing free →",
    ctaLink: "#/practice",
  },
  meta: {
    title: "InterviewIQ — AI Interview Coach: Junior to CTO & CEO | Free, Offline, Tailored to Company",
    description: "AI-powered interview prep. Pick a level, field and company. Get tailored questions, model answers, scoring and a career roadmap. Free, offline-first PWA.",
    ogImage: "icons/icon-512.png",
    canonical: "https://gaurav123337.github.io/interviewiq/",
    twitterHandle: "",
  },
};

let cachedConfig: SiteConfig | null = null;
let configPromise: Promise<SiteConfig> | null = null;
const listeners = new Set<(config: SiteConfig) => void>();

export function subscribeSiteConfig(listener: (config: SiteConfig) => void): () => void {
  listeners.add(listener);
  /* Hand over the current snapshot immediately. Lazy route chunks (Landing,
     Legal) mount after the initial load resolved, so waiting for the next
     publish would leave them on defaults — the header would follow the saved
     config while every later-mounted section stayed unbranded. */
  try { listener(cachedConfig ?? DEFAULT_CONFIG); } catch { /* One bad subscriber must not block the others. */ }
  return () => listeners.delete(listener);
}

function publishSiteConfig(config: SiteConfig): void {
  cachedConfig = config;
  for (const listener of listeners) {
    try { listener(config); } catch { /* One UI subscriber must not block the others. */ }
  }
}

/**
 * Load site config from Supabase (app_config table, key = 'site_config')
 * Falls back to defaults if Supabase is unavailable
 */
export async function loadSiteConfig(): Promise<SiteConfig> {
  if (cachedConfig) return cachedConfig;
  
  if (!configPromise) {
    configPromise = (async () => {
  try {
    const { getSupabaseClient } = await import("./cloud");
    const client = await getSupabaseClient();
    if (!client) {
      publishSiteConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    
    const { data } = await client
      .from("app_config")
      .select("value")
      .eq("key", "site_config")
      .single();
    
    if (data?.value) {
      const remote = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const config = mergeSiteConfig(remote);
      publishSiteConfig(config);
      return config;
    }
  } catch {
    // Supabase not configured or table doesn't exist
  }
  publishSiteConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
})();
  }
  
  return configPromise;
}

/**
 * Save site config to Supabase (upsert)
 */
function mergeSiteConfig(value: unknown, previous: SiteConfig = DEFAULT_CONFIG): SiteConfig {
  const remote = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const logo = remote.logo && typeof remote.logo === "object" ? remote.logo as Record<string, unknown> : {};
  const header = remote.header && typeof remote.header === "object" ? remote.header as Record<string, unknown> : {};
  const footer = remote.footer && typeof remote.footer === "object" ? remote.footer as Record<string, unknown> : {};
  const menus = remote.menus && typeof remote.menus === "object" ? remote.menus as Record<string, unknown> : {};
  const hero = remote.hero && typeof remote.hero === "object" ? remote.hero as Record<string, unknown> : {};
  const meta = remote.meta && typeof remote.meta === "object" ? remote.meta as Record<string, unknown> : {};
  const stringValue = (source: Record<string, unknown>, key: string, fallback: string) =>
    typeof source[key] === "string" ? source[key] as string : fallback;
  const policyHash = (hash: string): string => {
    const normalized = hash.replace(/^#\/?/, "").split(/[/?#]/)[0];
    return ["terms", "privacy", "refunds", "shipping"].includes(normalized) ? normalized : "terms";
  };
  const safeLink = (href: string, hash?: string): string => {
    if (hash && href.startsWith("#/legal")) return `#/legal/${policyHash(hash)}`;
    try {
      const url = new URL(href, "https://site-config.invalid/");
      if (["https:", "http:", "mailto:", "tel:"].includes(url.protocol)) return href;
      if (href.startsWith("#")) {
        const [route, ...parts] = url.hash.replace(/^#\/?/, "").split(/[/?#]/);
        if (["terms", "privacy", "refunds", "shipping"].includes(route)) return `#/legal/${policyHash(route)}`;
        if (SITE_CONFIG_LINK_ROUTES[route]) {
          return route === "legal" ? `#/legal/${policyHash(parts[0] ?? "terms")}` : `#/${route}`;
        }
      }
    } catch { /* Return a safe internal route for malformed values. */ }
    return "#/practice";
  };
  const logoConfig = {
    icon: stringValue(logo, "icon", DEFAULT_CONFIG.logo.icon),
    favicon: stringValue(logo, "favicon", DEFAULT_CONFIG.logo.favicon),
    text: stringValue(logo, "text", DEFAULT_CONFIG.logo.text),
    tagline: stringValue(logo, "tagline", DEFAULT_CONFIG.logo.tagline),
  };
  const normalizeNavigation = (items: unknown, fallback: SiteConfig["header"]["primaryTabs"]) => {
    if (!Array.isArray(items)) return fallback;
    if (items.length > 0 && items.every(item => !item || typeof item !== "object" || typeof (item as Record<string, unknown>).id !== "string" || !CONFIG_ROUTES.has((item as Record<string, unknown>).id as string))) return fallback;
    const seen = new Set<string>();
    const normalized = items.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const entry = item as Record<string, unknown>;
      if (typeof entry.id !== "string" || !CONFIG_ROUTES.has(entry.id) || seen.has(entry.id)) return [];
      seen.add(entry.id);
      const route = CONFIG_ROUTES.get(entry.id)!;
      return [{
        id: entry.id,
        label: stringValue(entry, "label", route.label),
        icon: stringValue(entry, "icon", route.icon),
      }];
    });
    return normalized.length || items.length === 0 ? normalized : fallback;
  };
  const defaultDerived = (current: unknown, defaultText: string, previousText: string, wasDefault: boolean, replacement: string) =>
    typeof current !== "string" || current === defaultText || (wasDefault && current === previousText) ? replacement : current;
  const previousFooterBrandDefault = previous.footer.brand === `${previous.logo.text} — ${previous.logo.tagline}`;
  const footerBrand = defaultDerived(footer.brand, DEFAULT_CONFIG.footer.brand,
    previous.footer.brand, previousFooterBrandDefault, `${logoConfig.text} — ${logoConfig.tagline}`);
  const previousCopyrightDefault = previous.footer.copyright.startsWith("© ") &&
    previous.footer.copyright.endsWith(" All rights reserved.") && previous.footer.copyright.includes(previous.logo.text);
  const copyright = defaultDerived(footer.copyright, DEFAULT_CONFIG.footer.copyright,
    previous.footer.copyright, previousCopyrightDefault,
    `© ${new Date().getFullYear()} ${logoConfig.text}. All rights reserved.`);
  const previousHeroDescriptionDefault = previous.hero.description ===
    DEFAULT_CONFIG.hero.description.replace("InterviewIQ", previous.logo.text);
  const heroDescription = defaultDerived(hero.description, DEFAULT_CONFIG.hero.description,
    previous.hero.description, previousHeroDescriptionDefault,
    DEFAULT_CONFIG.hero.description.replace("InterviewIQ", logoConfig.text));
  const previousMetaTitleDefault = previous.meta.title ===
    DEFAULT_CONFIG.meta.title.replace("InterviewIQ", previous.logo.text);
  const metaTitle = defaultDerived(meta.title, DEFAULT_CONFIG.meta.title,
    previous.meta.title, previousMetaTitleDefault,
    DEFAULT_CONFIG.meta.title.replace("InterviewIQ", logoConfig.text));
  const normalizeLinks = (links: unknown): SiteConfig["footer"]["links"] => {
    if (!Array.isArray(links)) return DEFAULT_CONFIG.footer.links;
    return links.flatMap(link => {
      if (!link || typeof link !== "object") return [];
      const entry = link as Record<string, unknown>;
      if (typeof entry.label !== "string" || typeof entry.href !== "string") return [];
      const hash = typeof entry.hash === "string" && entry.hash ? policyHash(entry.hash) : undefined;
      return [{
        label: entry.label,
        href: safeLink(entry.href, hash),
        ...(hash ? { hash } : {}),
      }];
    });
  };
  const booleanValue = (source: Record<string, unknown>, key: string, fallback: boolean) =>
    typeof source[key] === "boolean" ? source[key] as boolean : fallback;

  return {
    logo: logoConfig,
    header: {
      primaryTabs: normalizeNavigation(header.primaryTabs, DEFAULT_CONFIG.header.primaryTabs),
      showThemeToggle: booleanValue(header, "showThemeToggle", DEFAULT_CONFIG.header.showThemeToggle),
      showFeedbackButton: booleanValue(header, "showFeedbackButton", DEFAULT_CONFIG.header.showFeedbackButton),
      showInstallButton: booleanValue(header, "showInstallButton", DEFAULT_CONFIG.header.showInstallButton),
    },
    footer: {
      brand: footerBrand,
      links: normalizeLinks(footer.links),
      copyright,
    },
    menus: {
      moreMenu: normalizeNavigation(menus.moreMenu, DEFAULT_CONFIG.menus.moreMenu),
      mobileTabs: normalizeNavigation(menus.mobileTabs, DEFAULT_CONFIG.menus.mobileTabs),
    },
    hero: {
      badge: stringValue(hero, "badge", DEFAULT_CONFIG.hero.badge),
      title: stringValue(hero, "title", DEFAULT_CONFIG.hero.title),
      description: heroDescription,
      ctaText: stringValue(hero, "ctaText", DEFAULT_CONFIG.hero.ctaText),
      ctaLink: stringValue(hero, "ctaLink", DEFAULT_CONFIG.hero.ctaLink),
    },
    meta: {
      title: metaTitle,
      description: stringValue(meta, "description", DEFAULT_CONFIG.meta.description),
      ogImage: stringValue(meta, "ogImage", DEFAULT_CONFIG.meta.ogImage),
      canonical: stringValue(meta, "canonical", DEFAULT_CONFIG.meta.canonical),
      twitterHandle: stringValue(meta, "twitterHandle", DEFAULT_CONFIG.meta.twitterHandle),
    },
  };
}

export function publishRemoteSiteConfig(value: unknown): void {
  let remote = value;
  if (typeof value === "string") {
    try { remote = JSON.parse(value) as unknown; }
    catch { remote = null; /* Invalid remote JSON falls back to safe defaults. */ }
  }
  const config = mergeSiteConfig(remote, cachedConfig ?? DEFAULT_CONFIG);
  publishSiteConfig(config);
  configPromise = Promise.resolve(config);
}

export async function saveSiteConfig(config: SiteConfig): Promise<boolean> {
  try {
    const { getSupabaseClient } = await import("./cloud");
    const client = await getSupabaseClient();
    if (!client) return false;
    
    const savedConfig = mergeSiteConfig(config, cachedConfig ?? DEFAULT_CONFIG);
    const { error } = await client
      .from("app_config")
      .upsert({ key: "site_config", value: JSON.stringify(savedConfig), updated_at: Date.now() }, { onConflict: "key" });
    
    if (error) throw error;
    publishSiteConfig(savedConfig);
    configPromise = Promise.resolve(savedConfig);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the cached config (synchronous, returns defaults if not loaded yet)
 */
export function getSiteConfig(): SiteConfig {
  return cachedConfig ?? DEFAULT_CONFIG;
}

/**
 * Reset cache (for admin edits)
 */
export function resetSiteConfigCache(): void {
  cachedConfig = null;
  configPromise = null;
}

export { DEFAULT_CONFIG };
