/**
 * Site Config Service
 * 
 * Manages configurable site elements (header, footer, menus, logo, texts)
 * backed by Supabase. Falls back to defaults when Supabase is unavailable.
 */

export interface SiteConfig {
  // Branding
  logo: {
    icon: string;        // emoji or URL
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
  };
}

const DEFAULT_CONFIG: SiteConfig = {
  logo: {
    icon: "🎙️",
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
  },
};

let cachedConfig: SiteConfig | null = null;
let configPromise: Promise<SiteConfig> | null = null;

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
    if (!client) return DEFAULT_CONFIG;
    
    const { data } = await client
      .from("app_config")
      .select("value")
      .eq("key", "site_config")
      .single();
    
    if (data?.value) {
      const remote = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      cachedConfig = { ...DEFAULT_CONFIG, ...remote };
      return cachedConfig!;
    }
  } catch {
    // Supabase not configured or table doesn't exist
  }
  return DEFAULT_CONFIG;
})();
  }
  
  return configPromise;
}

/**
 * Save site config to Supabase (upsert)
 */
export async function saveSiteConfig(config: SiteConfig): Promise<boolean> {
  try {
    const { getSupabaseClient } = await import("./cloud");
    const client = await getSupabaseClient();
    if (!client) return false;
    
    const { error } = await client
      .from("app_config")
      .upsert({ key: "site_config", value: JSON.stringify(config) }, { onConflict: "key" });
    
    if (error) throw error;
    
    cachedConfig = config;
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
