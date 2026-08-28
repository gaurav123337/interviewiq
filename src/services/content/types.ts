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

/* ── Content Provider Types (Article Normalization) ──────────────────── */

/** A normalized article with all enrichment data */
export interface ArticleContent {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  content: string;
  rawContent: string;
  codeSections: CodeSection[];
  glossary: GlossaryEntry[];
  keyTakeaways: string[];
  readTimeMinutes: number;
  sourceName: string;
  sourceUrl: string;
  fieldId: string;
}

export interface CodeSection {
  language: string;
  code: string;
  description: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface ArticleHit {
  articleId: string;
  title: string;
  snippet: string;
  score: number;
  keywords: string[];
  difficulty: string;
}

export interface ContentRequest {
  topic: string;
  field?: string;
  level?: "beginner" | "intermediate" | "advanced";
  limit?: number;
  filters?: Record<string, unknown>;
}

export interface CoachContent {
  groundingChunks: string[];
  quickRef: GlossaryEntry[];
  takeaways: string[];
  sources: { title: string; url: string }[];
}

export interface SystemDesignContent {
  codeExamples: CodeSection[];
  glossary: GlossaryEntry[];
  caseStudies: { title: string; summary: string; url: string }[];
  patterns: string[];
}

export interface RoadmapContent {
  learningPath: {
    level: "beginner" | "intermediate" | "advanced";
    title: string;
    readTime: number;
    articleId: string;
  }[];
  totalReadTime: number;
  relatedTopics: string[];
}

export interface InterviewContent {
  questions: string[];
  keyConcepts: string[];
  cheatSheet: string[];
  furtherReading: { title: string; url: string }[];
}

export interface IContentProvider {
  getArticle(id: string, level?: "beginner" | "intermediate" | "advanced"): Promise<ArticleContent | null>;
  searchArticles(request: ContentRequest): Promise<ArticleHit[]>;
  getCoachContent(field: string, level?: string): Promise<CoachContent>;
  getSystemDesignContent(topic: string): Promise<SystemDesignContent>;
  getRoadmapContent(field: string): Promise<RoadmapContent>;
  getInterviewContent(field: string, level?: string): Promise<InterviewContent>;
  getAllKeywords(): Promise<string[]>;
}

