/* Content Management System — Supabase-backed CRUD with localStorage cache.
   
   All reads: Supabase → cache in localStorage → fallback to defaults.
   All writes: Supabase → update localStorage cache.
   
   This ensures content persists across devices and browsers, while still
   working offline (reads from localStorage cache). */

import { getSupabaseClient } from "./cloud";
import { storageGet, storageSet } from "./storage";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  rating: number;
  text: string;
  highlight?: string;
  variant: "all" | "A" | "B";
  published: boolean;
  sort_order: number;
}

export interface Ad {
  id: string;
  title: string;
  description: string;
  sponsor: string;
  image_url: string;
  link_url: string;
  bg_color: string;
  text_color: string;
  position: "landing-hero" | "landing-pricing" | "landing-footer" | "sidebar" | "interstitial" | "banner";
  start_date: string | null;
  end_date: string | null;
  published: boolean;
  auto_rotate: boolean;
  rotate_interval: number;
  impressions: number;
  clicks: number;
}

export interface Resource {
  id: string;
  title: string;
  author: string;
  type: "book" | "course" | "tool";
  description: string;
  affiliate_url: string;
  icon: string;
  price: string;
  badge?: string;
  published: boolean;
  sort_order: number;
  clicks: number;
}

export interface TipConfig {
  id: string;
  amounts: number[];
  labels: string[];
  descriptions: string[];
  stripe_link: string;
  buymeacoffee_link: string;
  enabled: boolean;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_url: string;
  image_url: string;
  bg_gradient: string;
  text_color: string;
  position: "hero" | "midpage" | "footer" | "popup";
  published: boolean;
  impressions: number;
  clicks: number;
}

export interface AnalyticsSummary {
  entity_type: string;
  entity_id: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface ABTestResult {
  variant: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface DailyAnalytics {
  day: string;
  impressions: number;
  clicks: number;
}

/* ------------------------------------------------------------------ */
/* A/B Test variant assignment (deterministic by visitor ID)           */
/* ------------------------------------------------------------------ */

export function getVisitorVariant(): "A" | "B" {
  let visitorId = storageGet<string>("iq.visitor_id", "");
  if (!visitorId) {
    visitorId = Math.random().toString(36).slice(2, 10);
    storageSet("iq.visitor_id", visitorId);
  }
  // Simple hash: if sum of char codes is even → A, else → B
  const sum = Array.from(visitorId).reduce((s, c) => s + c.charCodeAt(0), 0);
  return sum % 2 === 0 ? "A" : "B";
}

/* ------------------------------------------------------------------ */
/* LocalStorage cache keys                                             */
/* ------------------------------------------------------------------ */

const CACHE = {
  testimonials: "iq.cms.testimonials",
  ads: "iq.cms.ads",
  resources: "iq.cms.resources",
  tips: "iq.cms.tips",
  banners: "iq.cms.banners",
} as const;

/* ------------------------------------------------------------------ */
/* Default data (fallback when Supabase is unreachable)                */
/* ------------------------------------------------------------------ */

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { id: "t1", name: "Priya M.", role: "Frontend Engineer", company: "Google", avatar: "👩‍💻", rating: 5, text: "InterviewIQ was my daily practice tool for 3 months. The system design flashcards helped me nail the architecture round. Got my dream offer!", highlight: "Landed Google L4", variant: "all" as const, published: true, sort_order: 0 },
  { id: "t2", name: "James K.", role: "Senior Backend Dev", company: "Amazon", avatar: "👨‍💼", rating: 5, text: "The AI coach explained distributed systems better than any course I've taken. The offline mode meant I could practice on my commute.", highlight: "Amazon SDE2 offer", variant: "all" as const, published: true, sort_order: 1 },
  { id: "t3", name: "Ananya R.", role: "Full Stack Developer", company: "Microsoft", avatar: "👩‍🔬", rating: 5, text: "What sets this apart is the career roadmap. It identified my weak spots and built a plan. My interviewer even commented on how well-prepared I was.", highlight: "Microsoft L62", variant: "all" as const, published: true, sort_order: 2 },
  { id: "t4", name: "Marcus L.", role: "ML Engineer", company: "Meta", avatar: "🧑‍💻", rating: 4, text: "The system design hub with 15 case studies is gold. I used it daily for a month. The spaced repetition flashcards made numbers stick.", highlight: "Meta E5 offer", variant: "all" as const, published: true, sort_order: 3 },
  { id: "t5", name: "Sarah T.", role: "DevOps Engineer", company: "Netflix", avatar: "👩‍🏫", rating: 5, text: "I was skeptical about AI interview prep, but the grounded citations won me over. Every answer has a source. No hallucinated nonsense.", highlight: "Netflix Senior", variant: "all" as const, published: true, sort_order: 4 },
  { id: "t6", name: "Rohit P.", role: "Backend Developer", company: "Stripe", avatar: "🧑‍🎓", rating: 5, text: "The mock interview mode with timed questions was a game-changer. I practiced 50+ sessions. The analytics showed exactly where I improved.", highlight: "Stripe L3 → L4", variant: "all" as const, published: true, sort_order: 5 },
];

const DEFAULT_ADS: Ad[] = [];

const DEFAULT_RESOURCES: Resource[] = [
  { id: "r1", title: "System Design Interview", author: "Alex Xu", type: "book", description: "The go-to book for system design prep. Clear diagrams, real-world examples, and step-by-step walkthroughs.", affiliate_url: "https://www.amazon.com/dp/1736049127", icon: "📖", price: "$25", badge: "Best Seller", published: true, sort_order: 0, clicks: 0 },
  { id: "r2", title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", type: "book", description: "Deep dive into distributed systems, databases, and streaming. Essential for senior+ roles.", affiliate_url: "https://www.amazon.com/dp/1449373321", icon: "📖", price: "$40", badge: "Must Read", published: true, sort_order: 1, clicks: 0 },
  { id: "r3", title: "Grokking the System Design Interview", author: "Educative", type: "course", description: "Interactive course with 40+ system design problems and solutions.", affiliate_url: "https://www.educative.io/courses/grokking-the-system-design-interview", icon: "🎓", price: "$79", published: true, sort_order: 2, clicks: 0 },
  { id: "r4", title: "LeetCode Premium", author: "LeetCode", type: "tool", description: "Premium coding practice with company-tagged questions and hints.", affiliate_url: "https://leetcode.com/subscription/", icon: "💻", price: "$35/mo", badge: "Popular", published: true, sort_order: 3, clicks: 0 },
  { id: "r5", title: "ByteByteGo Newsletter", author: "Alex Xu", type: "course", description: "Weekly system design concepts with visual explanations. Free and paid tiers.", affiliate_url: "https://blog.bytebytego.com/", icon: "📧", price: "Free", badge: "Free", published: true, sort_order: 4, clicks: 0 },
  { id: "r6", title: "Roadmap.sh", author: "Community", type: "tool", description: "Free learning roadmaps for every tech role. Great for career planning.", affiliate_url: "https://roadmap.sh/", icon: "🗺️", price: "Free", badge: "Free", published: true, sort_order: 5, clicks: 0 },
];

const DEFAULT_TIPS: TipConfig = {
  id: "default",
  amounts: [5, 15, 30],
  labels: ["☕ Coffee", "🍕 Lunch", "🎉 Celebration"],
  descriptions: ["Buy me a coffee", "Buy me lunch", "Celebrating a new offer?"],
  stripe_link: "",
  buymeacoffee_link: "",
  enabled: true,
};

/* ------------------------------------------------------------------ */
/* Generic Supabase fetch with localStorage fallback                   */
/* ------------------------------------------------------------------ */

async function fetchFromDB<T>(
  table: string,
  cacheKey: string,
  defaults: T[],
  orderCol?: string
): Promise<T[]> {
  const client = await getSupabaseClient();
  
  if (client) {
    try {
      let query = client.from(table).select("*");
      if (orderCol) query = query.order(orderCol, { ascending: true });
      const { data, error } = await query;
      if (!error && data) {
        const items = data as T[];
        // Cache in localStorage for offline use
        storageSet(cacheKey, items);
        return items;
      }
    } catch {
      // Fall through to cache
    }
  }

  // Fallback to localStorage cache
  const cached = storageGet<T[]>(cacheKey, []);
  if (cached.length > 0) return cached;

  // Final fallback to defaults
  storageSet(cacheKey, defaults);
  return defaults;
}

async function fetchSingleton<T>(
  table: string,
  cacheKey: string,
  defaults: T
): Promise<T> {
  const client = await getSupabaseClient();
  
  if (client) {
    try {
      const { data, error } = await client.from(table).select("*").limit(1).single();
      if (!error && data) {
        storageSet(cacheKey, data);
        return data as T;
      }
    } catch {
      // Fall through to cache
    }
  }

  return storageGet<T>(cacheKey, defaults);
}

/* ------------------------------------------------------------------ */
/* CRUD operations — all go through Supabase                           */
/* ------------------------------------------------------------------ */

// ---- Testimonials ----

export async function fetchTestimonials(): Promise<Testimonial[]> {
  return fetchFromDB<Testimonial>("admin_testimonials", CACHE.testimonials, DEFAULT_TESTIMONIALS, "sort_order");
}

export async function saveTestimonial(t: Testimonial): Promise<Testimonial> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");

  const row = {
    name: t.name,
    role: t.role,
    company: t.company,
    avatar: t.avatar,
    rating: t.rating,
    text: t.text,
    highlight: t.highlight || null,
    variant: t.variant || "all",
    published: t.published,
    sort_order: t.sort_order,
  };

  if (t.id && !t.id.startsWith("t")) {
    // Existing — update
    const { data, error } = await client.from("admin_testimonials").update({ ...row, updated_at: new Date().toISOString() }).eq("id", t.id).select().single();
    if (error) throw new Error(error.message);
    await refreshTestimonialCache();
    return data as Testimonial;
  } else {
    // New — insert
    const { data, error } = await client.from("admin_testimonials").insert(row).select().single();
    if (error) throw new Error(error.message);
    await refreshTestimonialCache();
    return data as Testimonial;
  }
}

export async function deleteTestimonial(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");
  const { error } = await client.from("admin_testimonials").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshTestimonialCache();
}

async function refreshTestimonialCache(): Promise<void> {
  const items = await fetchFromDB<Testimonial>("admin_testimonials", CACHE.testimonials, DEFAULT_TESTIMONIALS, "sort_order");
  storageSet(CACHE.testimonials, items);
}

// ---- Ads ----

export async function fetchAds(): Promise<Ad[]> {
  return fetchFromDB<Ad>("admin_ads", CACHE.ads, DEFAULT_ADS, "created_at");
}

export async function saveAd(a: Ad): Promise<Ad> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");

  const row = {
    title: a.title,
    description: a.description,
    sponsor: a.sponsor,
    image_url: a.image_url,
    link_url: a.link_url,
    bg_color: a.bg_color || "",
    text_color: a.text_color || "",
    position: a.position,
    start_date: a.start_date || null,
    end_date: a.end_date || null,
    published: a.published,
    auto_rotate: a.auto_rotate || false,
    rotate_interval: a.rotate_interval || 5,
  };

  if (a.id && !a.id.startsWith("ad")) {
    const { data, error } = await client.from("admin_ads").update({ ...row, updated_at: new Date().toISOString() }).eq("id", a.id).select().single();
    if (error) throw new Error(error.message);
    await refreshAdCache();
    return data as Ad;
  } else {
    const { data, error } = await client.from("admin_ads").insert(row).select().single();
    if (error) throw new Error(error.message);
    await refreshAdCache();
    return data as Ad;
  }
}

export async function deleteAd(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");
  const { error } = await client.from("admin_ads").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdCache();
}

async function refreshAdCache(): Promise<void> {
  const items = await fetchFromDB<Ad>("admin_ads", CACHE.ads, DEFAULT_ADS, "created_at");
  storageSet(CACHE.ads, items);
}

// ---- Resources ----

export async function fetchResources(): Promise<Resource[]> {
  return fetchFromDB<Resource>("admin_resources", CACHE.resources, DEFAULT_RESOURCES, "sort_order");
}

export async function saveResource(r: Resource): Promise<Resource> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");

  const row = {
    title: r.title,
    author: r.author,
    type: r.type,
    description: r.description,
    affiliate_url: r.affiliate_url,
    icon: r.icon,
    price: r.price,
    badge: r.badge || null,
    published: r.published,
    sort_order: r.sort_order,
  };

  if (r.id && !r.id.startsWith("r")) {
    const { data, error } = await client.from("admin_resources").update({ ...row, updated_at: new Date().toISOString() }).eq("id", r.id).select().single();
    if (error) throw new Error(error.message);
    await refreshResourceCache();
    return data as Resource;
  } else {
    const { data, error } = await client.from("admin_resources").insert(row).select().single();
    if (error) throw new Error(error.message);
    await refreshResourceCache();
    return data as Resource;
  }
}

export async function deleteResource(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");
  const { error } = await client.from("admin_resources").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshResourceCache();
}

async function refreshResourceCache(): Promise<void> {
  const items = await fetchFromDB<Resource>("admin_resources", CACHE.resources, DEFAULT_RESOURCES, "sort_order");
  storageSet(CACHE.resources, items);
}

// ---- Tips ----

export async function fetchTips(): Promise<TipConfig> {
  return fetchSingleton<TipConfig>("admin_tips", CACHE.tips, DEFAULT_TIPS);
}

export async function saveTips(t: TipConfig): Promise<TipConfig> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");

  const row = {
    amounts: t.amounts,
    labels: t.labels,
    descriptions: t.descriptions,
    stripe_link: t.stripe_link,
    buymeacoffee_link: t.buymeacoffee_link,
    enabled: t.enabled,
  };

  if (t.id && t.id !== "default") {
    const { data, error } = await client.from("admin_tips").update({ ...row, updated_at: new Date().toISOString() }).eq("id", t.id).select().single();
    if (error) throw new Error(error.message);
    storageSet(CACHE.tips, data);
    return data as TipConfig;
  } else {
    const { data, error } = await client.from("admin_tips").insert(row).select().single();
    if (error) throw new Error(error.message);
    storageSet(CACHE.tips, data);
    return data as TipConfig;
  }
}

/* ------------------------------------------------------------------ */
/* Analytics — track clicks and impressions                            */
/* ------------------------------------------------------------------ */

export async function trackClick(entityType: "ad" | "resource" | "testimonial" | "banner", entityId: string, variant?: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return; // silently fail if offline

  try {
    await client.rpc("track_content_click", {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_variant: variant || null,
    });
  } catch {
    // Silent fail — analytics shouldn't block UX
  }
}

export async function trackImpression(entityType: "ad" | "resource" | "testimonial" | "banner", entityId: string, variant?: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;

  try {
    await client.rpc("track_content_impression", {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_variant: variant || null,
    });
  } catch {
    // Silent fail
  }
}

/** Fetch active ads for a specific position (for the landing page). */
export async function fetchAdsForPosition(position: Ad["position"]): Promise<Ad[]> {
  const allAds = await fetchAds();
  const now = new Date().toISOString().slice(0, 10);
  return allAds.filter(a => {
    if (a.position !== position) return false;
    if (a.start_date && a.start_date > now) return false;
    if (a.end_date && a.end_date < now) return false;
    return true;
  });
}

// ---- Banners ----

export async function fetchBanners(): Promise<Banner[]> {
  return fetchFromDB<Banner>("admin_banners", CACHE.banners, [], "created_at");
}

export async function saveBanner(b: Banner): Promise<Banner> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");

  const row = {
    title: b.title,
    subtitle: b.subtitle,
    cta_text: b.cta_text,
    cta_url: b.cta_url,
    image_url: b.image_url,
    bg_gradient: b.bg_gradient,
    text_color: b.text_color,
    position: b.position,
    published: b.published,
  };

  if (b.id && !b.id.startsWith("bn")) {
    const { data, error } = await client.from("admin_banners").update({ ...row, updated_at: new Date().toISOString() }).eq("id", b.id).select().single();
    if (error) throw new Error(error.message);
    await refreshBannerCache();
    return data as Banner;
  } else {
    const { data, error } = await client.from("admin_banners").insert(row).select().single();
    if (error) throw new Error(error.message);
    await refreshBannerCache();
    return data as Banner;
  }
}

export async function deleteBanner(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");
  const { error } = await client.from("admin_banners").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshBannerCache();
}

async function refreshBannerCache(): Promise<void> {
  const items = await fetchFromDB<Banner>("admin_banners", CACHE.banners, [], "created_at");
  storageSet(CACHE.banners, items);
}

/** Fetch active banners for a specific position. */
export async function fetchBannersForPosition(position: Banner["position"]): Promise<Banner[]> {
  const allBanners = await fetchBanners();
  return allBanners.filter(b => b.position === position);
}

// ---- Analytics Dashboard ----

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("admin_content_analytics_summary");
  if (error || !data) return [];
  return data as AnalyticsSummary[];
}

export async function fetchABTestResults(): Promise<ABTestResult[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("admin_ab_test_results");
  if (error || !data) return [];
  return data as ABTestResult[];
}

export async function fetchDailyAnalytics(): Promise<DailyAnalytics[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("admin_daily_analytics");
  if (error || !data) return [];
  return data as DailyAnalytics[];
}
