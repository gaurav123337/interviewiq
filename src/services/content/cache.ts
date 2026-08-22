/* LocalStorage cache keys + generic Supabase fetch with localStorage fallback */

import { getSupabaseClient } from "../cloud";
import { storageGet, storageSet } from "../storage";

import { Ad, Banner, Resource, Testimonial, TipConfig } from "./types";

/* ------------------------------------------------------------------ */
/* LocalStorage cache keys                                             */
/* ------------------------------------------------------------------ */

export const CACHE = {
  testimonials: "iq.cms.testimonials",
  ads: "iq.cms.ads",
  resources: "iq.cms.resources",
  tips: "iq.cms.tips",
  banners: "iq.cms.banners",
} as const;

/* ------------------------------------------------------------------ */
/* Default data (fallback when Supabase is unreachable)                */
/* ------------------------------------------------------------------ */

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { id: "t1", name: "Priya M.", role: "Frontend Engineer", company: "Google", avatar: "👩‍💻", rating: 5, text: "InterviewIQ was my daily practice tool for 3 months. The system design flashcards helped me nail the architecture round. Got my dream offer!", highlight: "Landed Google L4", variant: "all" as const, published: true, sort_order: 0 },
  { id: "t2", name: "James K.", role: "Senior Backend Dev", company: "Amazon", avatar: "👨‍💼", rating: 5, text: "The AI coach explained distributed systems better than any course I've taken. The offline mode meant I could practice on my commute.", highlight: "Amazon SDE2 offer", variant: "all" as const, published: true, sort_order: 1 },
  { id: "t3", name: "Ananya R.", role: "Full Stack Developer", company: "Microsoft", avatar: "👩‍🔬", rating: 5, text: "What sets this apart is the career roadmap. It identified my weak spots and built a plan. My interviewer even commented on how well-prepared I was.", highlight: "Microsoft L62", variant: "all" as const, published: true, sort_order: 2 },
  { id: "t4", name: "Marcus L.", role: "ML Engineer", company: "Meta", avatar: "🧑‍💻", rating: 4, text: "The system design hub with 15 case studies is gold. I used it daily for a month. The spaced repetition flashcards made numbers stick.", highlight: "Meta E5 offer", variant: "all" as const, published: true, sort_order: 3 },
  { id: "t5", name: "Sarah T.", role: "DevOps Engineer", company: "Netflix", avatar: "👩‍🏫", rating: 5, text: "I was skeptical about AI interview prep, but the grounded citations won me over. Every answer has a source. No hallucinated nonsense.", highlight: "Netflix Senior", variant: "all" as const, published: true, sort_order: 4 },
  { id: "t6", name: "Rohit P.", role: "Backend Developer", company: "Stripe", avatar: "🧑‍🎓", rating: 5, text: "The mock interview mode with timed questions was a game-changer. I practiced 50+ sessions. The analytics showed exactly where I improved.", highlight: "Stripe L3 → L4", variant: "all" as const, published: true, sort_order: 5 },
];

export const DEFAULT_ADS: Ad[] = [];

export const DEFAULT_RESOURCES: Resource[] = [
  { id: "r1", title: "System Design Interview", author: "Alex Xu", type: "book", description: "The go-to book for system design prep.", affiliate_url: "https://www.amazon.com/dp/1736049127", icon: "📖", price: "$25", badge: "Best Seller", published: true, sort_order: 0, clicks: 0 },
  { id: "r2", title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", type: "book", description: "Deep dive into distributed systems.", affiliate_url: "https://www.amazon.com/dp/1449373321", icon: "📖", price: "$40", badge: "Must Read", published: true, sort_order: 1, clicks: 0 },
  { id: "r3", title: "Grokking the System Design Interview", author: "Educative", type: "course", description: "Interactive course with 40+ problems.", affiliate_url: "https://www.educative.io/courses/grokking-the-system-design-interview", icon: "🎓", price: "$79", published: true, sort_order: 2, clicks: 0 },
  { id: "r4", title: "LeetCode Premium", author: "LeetCode", type: "tool", description: "Premium coding practice with company-tagged questions.", affiliate_url: "https://leetcode.com/subscription/", icon: "💻", price: "$35/mo", badge: "Popular", published: true, sort_order: 3, clicks: 0 },
  { id: "r5", title: "ByteByteGo Newsletter", author: "Alex Xu", type: "course", description: "Weekly system design concepts.", affiliate_url: "https://blog.bytebytego.com/", icon: "📧", price: "Free", badge: "Free", published: true, sort_order: 4, clicks: 0 },
  { id: "r6", title: "Roadmap.sh", author: "Community", type: "tool", description: "Free learning roadmaps for every tech role.", affiliate_url: "https://roadmap.sh/", icon: "🗺️", price: "Free", badge: "Free", published: true, sort_order: 5, clicks: 0 },
];

export const DEFAULT_TIPS: TipConfig = {
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

export async function fetchFromDB<T>(
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
        storageSet(cacheKey, items);
        return items;
      }
    } catch {
      // Fall through to cache
    }
  }

  const cached = storageGet<T[]>(cacheKey, []);
  if (cached.length > 0) return cached;

  storageSet(cacheKey, defaults);
  return defaults;
}

export async function fetchSingleton<T>(
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
