/* ContentProvider — implements IContentProvider using Supabase.

   Architecture:
   - Single source of truth for all module content needs
   - Reads from content_items table (normalized data in content_refined JSONB)
   - Falls back to raw content when normalization hasn't run yet
   - No module imports this directly — they use the factory function

   Storage layout in content_items:
   - content: raw scraped text
   - content_refined: JSONB with beginner/intermediate/advanced + keywords + code_sections + glossary
   - summary: clean text summary
   - field_id: domain/topic classification
   */

import { getSupabaseClient } from "../cloud";
import type {
  IContentProvider,
  ArticleContent,
  ArticleHit,
  ContentRequest,
  CoachContent,
  SystemDesignContent,
  RoadmapContent,
  InterviewContent,
  CodeSection,
  GlossaryEntry,
} from "./types";
// Note: CodeSection and GlossaryEntry are re-declared in types.ts for the
// content provider contract. The CMS types (Testimonial, Ad, etc.) remain
// in the same file but are separate concerns.

/* ── Raw DB Row Shape ────────────────────────────────────────────────── */

interface ContentItemRow {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  source_name: string;
  source_url: string;
  domain: string;
  field_id: string;
  content_refined: Record<string, unknown> | null;
  quality_score: number | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Extract a string from JSONB that might be wrapped in {"summary":"..."} */
function cleanJsonString(val: unknown): string {
  if (!val || typeof val !== "string") return "";
  const trimmed = val.trim();
  if (trimmed.startsWith("{") && trimmed.includes('"summary"')) {
    const match = trimmed.match(/"summary"\s*:\s*"([^"]+)"/);
    if (match) return match[1];
  }
  if (trimmed.startsWith("{") && trimmed.length < 1000) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj.summary === "string") return obj.summary;
      if (typeof obj === "object") return "";
    } catch { /* use as-is */ }
  }
  return trimmed;
}

/** Safely extract array from JSONB */
function extractArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  return [];
}

/** Safely extract code sections from JSONB */
function extractCodeSections(val: unknown): CodeSection[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      language: String(s.language || "text"),
      code: String(s.code || ""),
      description: String(s.description || ""),
    }))
    .filter((s) => s.code.length > 0);
}

/** Safely extract glossary from JSONB */
function extractGlossary(val: unknown): GlossaryEntry[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((g): g is Record<string, unknown> => typeof g === "object" && g !== null)
    .map((g) => ({
      term: String(g.term || ""),
      definition: String(g.definition || ""),
    }))
    .filter((g) => g.term.length > 0);
}

/** Build ArticleContent from a DB row */
function rowToArticle(row: ContentItemRow, level: "beginner" | "intermediate" | "advanced" = "intermediate"): ArticleContent {
  const refined = (row.content_refined ?? {}) as Record<string, unknown>;

  const difficultyContent =
    String(
      (refined as Record<string, unknown>)[level] ||
      (refined as Record<string, unknown>).beginner ||
      (refined as Record<string, unknown>).intermediate ||
      row.content || ""
    ).trim();

  const readTimes = {
    beginner: Number(refined.read_time_beginner) || 0,
    intermediate: Number(refined.read_time_intermediate) || 0,
    advanced: Number(refined.read_time_advanced) || 0,
  };

  return {
    id: row.id,
    title: row.title,
    summary: cleanJsonString(refined.summary_ai) || cleanJsonString(row.summary) || row.title,
    keywords: extractArray(refined.keywords),
    difficulty: level,
    content: difficultyContent,
    rawContent: row.content || "",
    codeSections: extractCodeSections(refined.code_sections),
    glossary: extractGlossary(refined.glossary),
    keyTakeaways: extractArray(refined.keyTakeaways),
    readTimeMinutes: readTimes[level] || Number(refined.estimatedReadMinutes) || Math.ceil(difficultyContent.length / 1500),
    sourceName: row.source_name || "",
    sourceUrl: row.source_url || "",
    fieldId: row.field_id || "",
  };
}

/* ── ContentProvider Implementation ──────────────────────────────────── */

class ContentProvider implements IContentProvider {
  /** Fetch approved content items with normalized data */
  private async fetchItems(fieldId?: string, limit = 50): Promise<ContentItemRow[]> {
    const client = await getSupabaseClient();
    if (!client) return [];

    let query = client
      .from("content_items")
      .select("id, title, content, summary, source_name, source_url, domain, field_id, content_refined, quality_score")
      .eq("status", "approved")
      .order("quality_score", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (fieldId) {
      query = query.eq("field_id", fieldId);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as ContentItemRow[];
  }

  /** Fetch a single content item */
  private async fetchItem(id: string): Promise<ContentItemRow | null> {
    const client = await getSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from("content_items")
      .select("id, title, content, summary, source_name, source_url, domain, field_id, content_refined, quality_score")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as ContentItemRow;
  }

  /* ── IContentProvider Implementation ──────────────────────────────── */

  async getArticle(id: string, level: "beginner" | "intermediate" | "advanced" = "intermediate"): Promise<ArticleContent | null> {
    const row = await this.fetchItem(id);
    if (!row) return null;
    return rowToArticle(row, level);
  }

  async searchArticles(request: ContentRequest): Promise<ArticleHit[]> {
    const items = await this.fetchItems(request.field, 100);

    const scored = items
      .map((row) => {
        const refined = (row.content_refined ?? {}) as Record<string, unknown>;
        const keywords = extractArray(refined.keywords);
        const summary = cleanJsonString(refined.summary_ai) || cleanJsonString(row.summary) || "";

        // Score: keyword overlap + title match + quality
        let score = 0;
        const queryLower = request.topic.toLowerCase();
        const titleLower = row.title.toLowerCase();
        const summaryLower = summary.toLowerCase();

        // Title match (strongest signal)
        if (titleLower.includes(queryLower)) score += 0.5;

        // Summary match
        if (summaryLower.includes(queryLower)) score += 0.2;

        // Keyword overlap
        const queryTokens = queryLower.split(/\s+/);
        const keywordHits = keywords.filter((k) =>
          queryTokens.some((t) => k.toLowerCase().includes(t))
        ).length;
        score += Math.min(keywordHits * 0.1, 0.3);

        // Quality bonus
        if (row.quality_score) score += (row.quality_score / 100) * 0.1;

        // Level match
        if (request.level && refined[request.level]) score += 0.1;

        return {
          articleId: row.id,
          title: row.title,
          snippet: summary.slice(0, 200) || row.content.slice(0, 200),
          score: Math.min(score, 1),
          keywords,
          difficulty: request.level || "intermediate",
        };
      })
      .filter((h) => h.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, request.limit || 10);

    return scored;
  }

  async getCoachContent(field: string, level?: string): Promise<CoachContent> {
    const items = await this.fetchItems(field, 5);
    const allKeywords = new Set<string>();
    const allGlossary: GlossaryEntry[] = [];
    const allTakeaways: string[] = [];
    const sources: { title: string; url: string }[] = [];
    const groundingChunks: string[] = [];

    for (const row of items) {
      const article = rowToArticle(row, (level as "beginner" | "intermediate" | "advanced") || "intermediate");

      // Extract keywords
      article.keywords.forEach((k) => allKeywords.add(k));

      // Extract glossary (deduplicated)
      for (const g of article.glossary) {
        if (!allGlossary.some((existing) => existing.term === g.term)) {
          allGlossary.push(g);
        }
      }

      // Extract takeaways (top 3 per article)
      allTakeaways.push(...article.keyTakeaways.slice(0, 3));

      // Source citations
      sources.push({ title: article.title, url: article.sourceUrl });

      // Grounding chunks: first 500 chars from raw content
      // (article.content is already at the requested difficulty level)
      if (article.content.length > 100) {
        groundingChunks.push(article.content.slice(0, 500));
      }
      if (article.rawContent.length > 100) {
        groundingChunks.push(article.rawContent.slice(0, 500));
      }
    }

    return {
      groundingChunks: groundingChunks.slice(0, 8),
      quickRef: allGlossary.slice(0, 15),
      takeaways: allTakeaways.slice(0, 10),
      sources,
    };
  }

  async getSystemDesignContent(topic: string): Promise<SystemDesignContent> {
    const items = await this.fetchItems(undefined, 20);
    const codeExamples: CodeSection[] = [];
    const allGlossary: GlossaryEntry[] = [];
    const caseStudies: { title: string; summary: string; url: string }[] = [];
    const patterns = new Set<string>();

    for (const row of items) {
      const article = rowToArticle(row);

      // Collect code examples (max 3 per article)
      codeExamples.push(...article.codeSections.slice(0, 3));

      // Collect glossary
      for (const g of article.glossary) {
        if (!allGlossary.some((existing) => existing.term === g.term)) {
          allGlossary.push(g);
        }
      }

      // Case studies: articles with relevant content
      const titleLower = article.title.toLowerCase();
      const topicLower = topic.toLowerCase();
      if (titleLower.includes(topicLower) || article.keywords.some((k) => k.toLowerCase().includes(topicLower))) {
        caseStudies.push({
          title: article.title,
          summary: article.summary.slice(0, 300),
          url: article.sourceUrl,
        });
      }

      // Extract architecture patterns from keywords
      for (const kw of article.keywords) {
        const lower = kw.toLowerCase();
        if (lower.includes("pattern") || lower.includes("architecture") || lower.includes("design")) {
          patterns.add(kw);
        }
      }
    }

    return {
      codeExamples: codeExamples.slice(0, 10),
      glossary: allGlossary.slice(0, 20),
      caseStudies: caseStudies.slice(0, 5),
      patterns: Array.from(patterns).slice(0, 10),
    };
  }

  async getRoadmapContent(field: string): Promise<RoadmapContent> {
    const items = await this.fetchItems(field, 20);
    const learningPath: RoadmapContent["learningPath"] = [];
    let totalReadTime = 0;
    const relatedTopics = new Set<string>();

    for (const row of items) {
      const article = rowToArticle(row);
      const refined = (row.content_refined ?? {}) as Record<string, unknown>;

      // Add to learning path for each available difficulty
      for (const level of ["beginner", "intermediate", "advanced"] as const) {
        if (refined[level] && String(refined[level]).length > 100) {
          const readTime = Number(refined[`read_time_${level}`]) || Math.ceil(String(refined[level]).length / 1500);
          learningPath.push({
            level,
            title: article.title,
            readTime,
            articleId: article.id,
          });
          totalReadTime += readTime;
        }
      }

      // Collect related topics from keywords
      article.keywords.forEach((k) => relatedTopics.add(k));
    }

    // Sort by difficulty progression
    const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
    learningPath.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

    return {
      learningPath: learningPath.slice(0, 15),
      totalReadTime,
      relatedTopics: Array.from(relatedTopics).slice(0, 20),
    };
  }

  async getInterviewContent(field: string, level?: string): Promise<InterviewContent> {
    const items = await this.fetchItems(field, 10);
    const questions: string[] = [];
    const keyConcepts = new Set<string>();
    const cheatSheet: string[] = [];
    const furtherReading: { title: string; url: string }[] = [];

    for (const row of items) {
      const article = rowToArticle(row, (level as "beginner" | "intermediate" | "advanced") || "intermediate");

      // Extract potential interview questions from takeaways
      for (const takeaway of article.keyTakeaways) {
        // Convert statements to questions
        if (takeaway.length > 20 && takeaway.length < 200) {
          const question = takeaway.endsWith(".")
            ? `Explain: ${takeaway.slice(0, -1)}`
            : `What is ${takeaway}?`;
          questions.push(question);
        }
      }

      // Key concepts from keywords + glossary
      article.keywords.forEach((k) => keyConcepts.add(k));
      article.glossary.forEach((g) => keyConcepts.add(g.term));

      // Cheat sheet: glossary definitions + key takeaways
      for (const g of article.glossary.slice(0, 3)) {
        cheatSheet.push(`${g.term}: ${g.definition}`);
      }
      cheatSheet.push(...article.keyTakeaways.slice(0, 2));

      // Further reading
      furtherReading.push({ title: article.title, url: article.sourceUrl });
    }

    return {
      questions: questions.slice(0, 10),
      keyConcepts: Array.from(keyConcepts).slice(0, 15),
      cheatSheet: cheatSheet.slice(0, 10),
      furtherReading: furtherReading.slice(0, 5),
    };
  }

  async getAllKeywords(): Promise<string[]> {
    const items = await this.fetchItems(undefined, 100);
    const keywords = new Set<string>();
    for (const row of items) {
      const refined = (row.content_refined ?? {}) as Record<string, unknown>;
      extractArray(refined.keywords).forEach((k) => keywords.add(k));
    }
    return Array.from(keywords).sort();
  }
}

/* ── Singleton Factory ───────────────────────────────────────────────── */

let _instance: IContentProvider | null = null;

/** Get the content provider instance (singleton). */
export function getContentProvider(): IContentProvider {
  if (!_instance) {
    _instance = new ContentProvider();
  }
  return _instance;
}

/** Reset the singleton (for testing or re-initialization). */
export function resetContentProvider(): void {
  _instance = null;
}
