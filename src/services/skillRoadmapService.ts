/* skillRoadmapService — API layer for the Skill Roadmap Explorer.
   Offline-first: reads from Supabase → localStorage cache → fallback defaults.
   Admin-managed content with quality scoring and Pro/Free tier gating. */

import { getSupabaseClient } from "./cloud";
import { storageGet, storageSet, STORAGE_KEYS } from "./storage";
import { fieldById } from "../data";
import type { CareerGoal, LevelId } from "../types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SkillRoadmapResource {
  title: string;
  url: string;
  kind: "docs" | "course" | "video" | "book" | "interactive" | "article";
  free: boolean;
  publishedYear: number;
  qualityScore: number;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface SkillRoadmap {
  id: string;
  skillId: string;
  name: string;
  icon: string;
  band: "junior" | "mid" | "senior" | "staff" | "principal" | "cto";
  difficulty: 1 | 2 | 3;
  description: string;
  why: string;
  slug: string;
  tags: string[];
  aliases: string[];
  prerequisites: string[];
  learningPath: string[];
  resources: SkillRoadmapResource[];
  estimatedHours: number;
  qualityStatus: "draft" | "reviewed" | "published" | "archived";
  tier: "free" | "pro";
  published: boolean;
  sortOrder: number;
  views: number;
  starts: number;
  completions: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  roadmap: SkillRoadmap;
  matchScore: number;
  matchType: "exact" | "name" | "alias" | "tag" | "description";
}

export interface ResolvedPath {
  roadmap: SkillRoadmap;
  prerequisitesResolved: { skillId: string; known: boolean }[];
  totalHours: number;
  weeksEstimate: number;
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  data: SkillRoadmap[];
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/* Default data (fallback when Supabase is unreachable)                */
/* ------------------------------------------------------------------ */

const DEFAULT_ROADMAPS: SkillRoadmap[] = [
  {
    id: "java", skillId: "java", name: "Java", icon: "☕", band: "mid", difficulty: 2,
    description: "The language of enterprise, Android, and high-performance backend systems.",
    why: "Java powers millions of enterprise systems, Android apps, and high-performance backend services. Its strong typing, JVM ecosystem, and mature tooling make it a top choice for large-scale applications.",
    slug: "java", tags: ["backend", "enterprise", "android"], aliases: ["jdk", "jvm"],
    prerequisites: ["data-structures", "sql"], learningPath: ["java-basics", "collections", "concurrency", "spring-boot", "testing"],
    resources: [
      { title: "Oracle Java Tutorial", url: "https://docs.oracle.com/javase/tutorial/", kind: "docs", free: true, publishedYear: 2024, qualityScore: 95 },
      { title: "Baeldung Spring Guide", url: "https://www.baeldung.com/spring-boot", kind: "article", free: true, publishedYear: 2025, qualityScore: 88 },
      { title: "Java Concurrency in Practice", url: "https://jcip.net/", kind: "book", free: false, publishedYear: 2014, qualityScore: 92 },
    ],
    estimatedHours: 40, qualityStatus: "published", tier: "free", published: true, sortOrder: 0,
    views: 0, starts: 0, completions: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "react", skillId: "react", name: "React", icon: "⚛️", band: "mid", difficulty: 2,
    description: "The most popular UI library for building component-based interfaces.",
    why: "React's component model, hooks, and virtual DOM have become the standard for modern frontend development. Used by millions of developers and thousands of companies worldwide.",
    slug: "react", tags: ["frontend", "ui", "components"], aliases: ["reactjs", "react.js"],
    prerequisites: ["javascript", "html", "css"], learningPath: ["components", "hooks", "state", "performance", "testing"],
    resources: [
      { title: "React docs", url: "https://react.dev/learn", kind: "docs", free: true, publishedYear: 2025, qualityScore: 98 },
      { title: "React for Beginners", url: "https://www.youtube.com/watch?v=Ke90Tje7VS0", kind: "video", free: true, publishedYear: 2024, qualityScore: 85 },
    ],
    estimatedHours: 30, qualityStatus: "published", tier: "free", published: true, sortOrder: 1,
    views: 0, starts: 0, completions: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "system-design", skillId: "system-design", name: "System Design", icon: "🏗️", band: "senior", difficulty: 3,
    description: "Trade-offs at scale — load, data, consistency, and cost.",
    why: "System design interviews are the gateway to senior+ roles. Understanding distributed systems, caching, and architecture decisions separates senior engineers from the rest.",
    slug: "system-design", tags: ["architecture", "distributed", "scale"], aliases: ["sysdesign"],
    prerequisites: ["data-structures", "sql", "networking"], learningPath: ["foundations", "caching", "load-balancing", "databases", "case-studies"],
    resources: [
      { title: "System Design Interview (Alex Xu)", url: "https://www.amazon.com/dp/1736049127", kind: "book", free: false, publishedYear: 2024, qualityScore: 96 },
      { title: "Designing Data-Intensive Applications", url: "https://www.amazon.com/dp/1449373321", kind: "book", free: false, publishedYear: 2017, qualityScore: 98 },
    ],
    estimatedHours: 60, qualityStatus: "published", tier: "pro", published: true, sortOrder: 2,
    views: 0, starts: 0, completions: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "python", skillId: "python", name: "Python", icon: "🐍", band: "junior", difficulty: 1,
    description: "The language of data science, automation, and rapid prototyping.",
    why: "Python's simplicity and extensive libraries make it perfect for beginners. Used in data science, web development, automation, and machine learning.",
    slug: "python", tags: ["backend", "data-science", "automation"], aliases: ["python3", "py"],
    prerequisites: [], learningPath: ["basics", "data-types", "functions", "libraries", "projects"],
    resources: [
      { title: "Python docs", url: "https://docs.python.org/3/tutorial/", kind: "docs", free: true, publishedYear: 2025, qualityScore: 97 },
      { title: "Automate the Boring Stuff", url: "https://automatetheboringstuff.com/", kind: "book", free: true, publishedYear: 2024, qualityScore: 92 },
    ],
    estimatedHours: 25, qualityStatus: "published", tier: "free", published: true, sortOrder: 3,
    views: 0, starts: 0, completions: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "kubernetes", skillId: "kubernetes", name: "Kubernetes", icon: "🐳", band: "senior", difficulty: 3,
    description: "Container orchestration for modern infrastructure.",
    why: "Kubernetes has become the standard for deploying and managing containerized applications. Essential for DevOps and cloud-native development.",
    slug: "kubernetes", tags: ["devops", "infrastructure", "containers"], aliases: ["k8s", "kube"],
    prerequisites: ["docker", "networking"], learningPath: ["foundations", "pods", "services", "deployments", "production"],
    resources: [
      { title: "Kubernetes docs", url: "https://kubernetes.io/docs/", kind: "docs", free: true, publishedYear: 2025, qualityScore: 96 },
      { title: "Kubernetes in Action", url: "https://www.manning.com/books/kubernetes-in-action", kind: "book", free: false, publishedYear: 2024, qualityScore: 94 },
    ],
    estimatedHours: 50, qualityStatus: "published", tier: "pro", published: true, sortOrder: 4,
    views: 0, starts: 0, completions: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/* Fetch from Supabase                                                 */
/* ------------------------------------------------------------------ */

async function fetchFromSupabase(): Promise<SkillRoadmap[]> {
  const client = await getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from("skill_roadmaps")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch skill roadmaps:", error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    skillId: row.skill_id as string,
    name: row.name as string,
    icon: row.icon as string,
    band: row.band as SkillRoadmap["band"],
    difficulty: row.difficulty as SkillRoadmap["difficulty"],
    description: row.description as string,
    why: row.why as string,
    slug: row.slug as string,
    tags: (row.tags as string[]) ?? [],
    aliases: (row.aliases as string[]) ?? [],
    prerequisites: (row.prerequisites as string[]) ?? [],
    learningPath: (row.learning_path as string[]) ?? [],
    resources: (row.resources as SkillRoadmapResource[]) ?? [],
    estimatedHours: row.estimated_hours as number,
    qualityStatus: (row.quality_status as SkillRoadmap["qualityStatus"]) ?? "published",
    tier: (row.tier as SkillRoadmap["tier"]) ?? "free",
    published: row.published as boolean,
    sortOrder: (row.sort_order as number) ?? 0,
    views: (row.views as number) ?? 0,
    starts: (row.starts as number) ?? 0,
    completions: (row.completions as number) ?? 0,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  }));
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getAllRoadmaps(): Promise<SkillRoadmap[]> {
  const supabaseData = await fetchFromSupabase();
  if (supabaseData.length > 0) {
    storageSet(STORAGE_KEYS.skillRoadmaps, { data: supabaseData, timestamp: Date.now() });
    return supabaseData;
  }

  const cached = storageGet<CacheEntry | null>(STORAGE_KEYS.skillRoadmaps, null);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  return DEFAULT_ROADMAPS;
}

export async function getRoadmapBySlug(slug: string): Promise<SkillRoadmap | null> {
  const all = await getAllRoadmaps();
  return all.find(r => r.slug === slug) ?? null;
}

export async function searchRoadmaps(query: string): Promise<SearchResult[]> {
  const all = await getAllRoadmaps();
  const q = query.toLowerCase().trim();
  if (!q) return all.map(roadmap => ({ roadmap, matchScore: 50, matchType: "name" as const }));

  return all
    .map(roadmap => {
      let matchScore = 0;
      let matchType: SearchResult["matchType"] = "name";

      if (roadmap.slug === q) {
        matchScore = 100; matchType = "exact";
      } else if (roadmap.name.toLowerCase() === q) {
        matchScore = 95; matchType = "name";
      } else if (roadmap.name.toLowerCase().includes(q)) {
        matchScore = 80; matchType = "name";
      } else if (roadmap.aliases.some(a => a.toLowerCase() === q || a.toLowerCase().includes(q))) {
        matchScore = 60; matchType = "alias";
      } else if (roadmap.tags.some(t => t.toLowerCase().includes(q))) {
        matchScore = 40; matchType = "tag";
      } else if (roadmap.description.toLowerCase().includes(q)) {
        matchScore = 20; matchType = "description";
      }

      return { roadmap, matchScore, matchType };
    })
    .filter(r => r.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function resolvePath(roadmap: SkillRoadmap, knownSkills: string[]): ResolvedPath {
  const knownSet = new Set(knownSkills.map(s => s.toLowerCase()));
  return {
    roadmap,
    prerequisitesResolved: roadmap.prerequisites.map(skillId => ({
      skillId,
      known: knownSet.has(skillId.toLowerCase()),
    })),
    totalHours: roadmap.estimatedHours,
    weeksEstimate: Math.ceil(roadmap.estimatedHours / 10),
  };
}

export function isAvailable(roadmap: SkillRoadmap, userTier: "free" | "pro"): boolean {
  return roadmap.tier === "free" || userTier === "pro";
}

/* ------------------------------------------------------------------ */
/* Prep-loop adapters (Item 14 — wire SkillDetail actions)             */
/* ------------------------------------------------------------------ */

export interface RoadmapPrepSel {
  fieldId: string;
  levelId: LevelId;
  keywords: string[];
}

/** Turn an admin-authored skill roadmap into a selection for the shared prep
    loop (`startWeakSession` → `composeRelevantSession`). A roadmap has no
    interview field of its own, so we take the first `tag` that names a real
    field (`fieldById`), else the user's goal/onboarding field, else "frontend".
    Level prefers the user's own target (their prep context) over the skill's
    band. Keywords ALWAYS lead with `roadmap.name` — a real, tokenizable word —
    so `composeRelevantSession` never reaches `pickRelevant`'s empty-keyword
    random fallback; an optional `step` adds its slug as a secondary signal so a
    per-step "Start →" biases toward that step while staying anchored on the
    skill. Pure. */
export function roadmapPrepSel(
  roadmap: SkillRoadmap,
  goal: CareerGoal | null,
  ob: { field: string | null; level: LevelId | null },
  step?: string,
): RoadmapPrepSel {
  const fieldId = roadmap.tags.find(t => fieldById(t)) ?? goal?.fieldId ?? ob.field ?? "frontend";
  const levelId = goal?.targetLevel ?? ob.level ?? roadmap.band ?? "mid";
  const keywords = step ? [roadmap.name, step] : [roadmap.name];
  return { fieldId, levelId, keywords };
}

/** Deterministic plain-text summary of a roadmap for the Share action (there is
    no per-skill route to link to, so we share text, mirroring the career
    roadmap's markdown export). Pure. */
export function skillRoadmapShareText(roadmap: SkillRoadmap): string {
  const path = roadmap.learningPath.length
    ? "\n\nLearning path:\n" + roadmap.learningPath.map((s, i) => `${i + 1}. ${s}`).join("\n")
    : "";
  const n = roadmap.resources.length;
  return `${roadmap.icon} ${roadmap.name} — learning roadmap\n\n${roadmap.why}\n\n~${roadmap.estimatedHours}h · ${n} curated resource${n === 1 ? "" : "s"}${path}\n\nvia InterviewIQ`;
}
