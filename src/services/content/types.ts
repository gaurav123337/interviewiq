/* Content types — testimonials, ads, resources, tips, banners, analytics */

/* Content Management System — Supabase-backed CRUD with localStorage cache.
   
   All reads: Supabase → cache in localStorage → fallback to defaults.
   All writes: Supabase → update localStorage cache.
   
   This ensures content persists across devices and browsers, while still
   working offline (reads from localStorage cache). */


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
  razorpay_key_id: string;
  razorpay_name: string;
  currency: string;
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

