/* Article Normalizer — transforms any article (any format, any source) into a
   structured, multi-level format with keywords, code sections, and summary.

   Uses the project's existing multi-provider AI infrastructure:
   - BYOK (user's own API key) → direct call with fallback chain
   - Cloud proxy (ai-chat edge function) → admin-configured provider

   Flow:
   1. Admin article → normalize → store in content_items (shared, RAG-ready)
   2. User custom article → normalize → store in user_article_notes (private)

   Once normalized, subsequent reads cost ZERO AI tokens (cached in DB). */

import { chat, type ChatMessage } from "../ai";
import { getSupabaseClient } from "./cloud";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface CodeSection {
  language: string;
  code: string;
  description: string;
}

export interface NormalizedArticle {
  summary: string;
  keywords: string[];
  codeSections: CodeSection[];
  beginner: string;
  intermediate: string;
  advanced: string;
  glossary: { term: string; definition: string }[];
  keyTakeaways: string[];
  estimatedReadMinutes: number;
  readTimeBeginner: number;
  readTimeIntermediate: number;
  readTimeAdvanced: number;
}

export interface NormalizeResult {
  success: boolean;
  normalized?: NormalizedArticle;
  error?: string;
  tokensUsed?: number;
}

/* ── Prompt Building ───────────────────────────────────────────────────── */

function buildNormalizationMessages(
  title: string,
  content: string,
  sourceName: string,
  isUserArticle: boolean,
): ChatMessage[] {
  // Truncate very long articles to stay within token limits
  // ~4 chars per token, need room for the structured output too
  const maxContent = isUserArticle ? 10000 : 6000;
  const truncated = content.slice(0, maxContent);

  const systemLines = [
    "You are a senior technical educator normalizing an article for an interview preparation platform.",
    "Your job is to analyze ANY article (blog post, documentation, tutorial, news, etc.) and produce a structured, multi-level learning resource.",
    "",
    "RULES:",
    "1. Extract the KEY INFORMATION regardless of the original format.",
    "2. Rewrite into 3 progressive difficulty levels (beginner → intermediate → advanced).",
    "3. Extract ALL code examples and preserve them exactly (don't modify code logic).",
    "4. Extract keywords that someone would search for to find this article.",
    "5. Write a concise 2-3 sentence summary.",
    "6. Identify technical terms for the glossary.",
    "7. List key takeaways as actionable points.",
    "",
    "CODE EXTRACTION RULES:",
    "- Preserve code EXACTLY as written (don't change variable names, logic, etc.)",
    "- If code is in the article text (not in ``` fences), extract it and wrap it properly",
    "- Include inline code snippets (single lines) AND full code blocks",
    "- Tag each code section with its programming language",
    "- Add a brief description of what the code does",
    "",
    "DIFFICULTY LEVEL RULES:",
    "- BEGINNER: 'What is it?' — simple analogy, why it matters, core concept",
    "- INTERMEDIATE: 'How does it work?' — implementation details, patterns, code examples",
    "- ADVANCED: 'Deep dive + interview angles' — internals, edge cases, performance, common interview questions",
    "",
    "RESPOND IN EXACTLY THIS JSON FORMAT (no text outside the JSON):",
    "{",
    '  "summary": "2-3 sentence summary of the article",',
    '  "keywords": ["keyword1", "keyword2", "..."],',
    '  "codeSections": [',
    '    { "language": "typescript", "code": "actual code here", "description": "What this code does" }',
    '  ],',
    '  "beginner": "## Simplified explanation\\n\\n[content]",',
    '  "intermediate": "## How it works\\n\\n[content with code examples]",',
    '  "advanced": "## Deep dive\\n\\n[content with interview angles]",',
    '  "glossary": [{ "term": "Term", "definition": "Clear definition" }],',
    '  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],',
    '  "estimatedReadMinutes": 5,',
    '  "readTimeBeginner": 2,',
    '  "readTimeIntermediate": 4,',
    '  "readTimeAdvanced": 6',
    "}",
    "",
    "IMPORTANT:",
    "- Use Markdown formatting with ## and ### headings in difficulty levels",
    "- Keep each difficulty level to 200-500 words",
    "- The beginner level should be understandable by someone with 6 months of coding experience",
    "- The intermediate level assumes 1-2 years of experience",
    "- The advanced level is for senior developers and system design interviews",
    "- Include at least 5 keywords",
    "- Include at least 3 key takeaways",
    "- Include at least 2 glossary terms",
    "- Extract ALL code sections (don't skip any code in the article)",
  ];

  const userLines = [
    isUserArticle ? "SOURCE: User-provided article" : "SOURCE: " + sourceName,
    "TITLE: " + title,
    "",
    "ARTICLE CONTENT:",
    truncated,
    "",
    "Analyze and normalize this article into a structured learning resource.",
  ];

  return [
    { role: "system", content: systemLines.join("\n") },
    { role: "user", content: userLines.join("\n") },
  ];
}

/* ── Parse LLM Response ────────────────────────────────────────────────── */

function parseNormalized(raw: string): NormalizedArticle | null {
  if (!raw || raw.trim().length < 50) return null;

  let parsed: Record<string, unknown> | null = null;

  // Strategy 1: Extract from ```json code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { parsed = JSON.parse(codeBlockMatch[1].trim()); } catch { /* try next */ }
  }

  // Strategy 2: Find the outermost { ... } block using string-aware parser
  // (handles braces inside quoted strings like code examples)
  if (!parsed) {
    const start = raw.indexOf("{");
    if (start >= 0) {
      let depth = 0;
      let inString = false;
      let escape = false;
      let end = -1;
      for (let i = start; i < raw.length; i++) {
        const ch = raw[i];
        if (escape) { escape = false; continue; }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end > start) {
        try {
          parsed = JSON.parse(raw.slice(start, end + 1));
        } catch {
          // Strategy 3: Fix common JSON issues
          let fixed = raw.slice(start, end + 1)
            .replace(/'/g, '"')
            .replace(/,\s*([}\]])/g, "$1");
          try { parsed = JSON.parse(fixed); } catch { /* try next */ }
        }
      }
    }
  }

  // Strategy 4: Try to find JSON by looking for "beginner" key
  if (!parsed) {
    const beginnerIdx = raw.indexOf('"beginner"');
    if (beginnerIdx >= 0) {
      // Walk backward to find the opening {
      let start = beginnerIdx;
      while (start > 0 && raw[start] !== "{") start--;
      if (start >= 0) {
        try {
          parsed = JSON.parse(raw.slice(start));
        } catch { /* ignore */ }
      }
    }
  }

  if (!parsed) {
    // Debug: log the raw response for troubleshooting
    console.error("[articleNormalizer] Failed to parse AI response. Raw length:", raw.length);
    console.error("[articleNormalizer] First 500 chars:", raw.slice(0, 500));
    console.error("[articleNormalizer] Last 500 chars:", raw.slice(-500));
    
    // Fallback: Create basic normalized article from the raw text
    // Split content into rough thirds for the difficulty levels
    const words = raw.replace(/[#*`[\]()]/g, "").split(/\s+/).filter(Boolean);
    const third = Math.ceil(words.length / 3);
    const beginner = words.slice(0, third).join(" ");
    const intermediate = words.slice(third, third * 2).join(" ");
    const advanced = words.slice(third * 2).join(" ");
    
    if (words.length > 20) {
      parsed = {
        summary: words.slice(0, 30).join(" ") + "...",
        keywords: [],
        codeSections: [],
        beginner: beginner || raw,
        intermediate: intermediate || raw,
        advanced: advanced || raw,
        glossary: [],
        keyTakeaways: ["Read the original article for full details"],
        estimatedReadMinutes: Math.ceil(words.length / 250),
        readTimeBeginner: Math.ceil(third / 250),
        readTimeIntermediate: Math.ceil(third / 250),
        readTimeAdvanced: Math.ceil(third / 250),
      };
    } else {
      return null;
    }
  }

  const clamp = (v: unknown, fallback: number) => {
    const n = Number(v);
    return isNaN(n) ? fallback : Math.max(0, n);
  };

  const beginner = String(parsed.beginner || "");
  const intermediate = String(parsed.intermediate || "");
  const advanced = String(parsed.advanced || "");

  if (!beginner && !intermediate && !advanced) return null;

  // Parse code sections
  const rawCodeSections = Array.isArray(parsed.codeSections) ? parsed.codeSections : [];
  const codeSections: CodeSection[] = rawCodeSections
    .filter((s: Record<string, unknown>) => s && typeof s.code === "string" && s.code.trim())
    .map((s: Record<string, unknown>) => ({
      language: String(s.language || "text"),
      code: String(s.code || ""),
      description: String(s.description || ""),
    }));

  // Parse keywords
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.map(String).filter(k => k.trim())
    : [];

  // Parse glossary
  const glossary = Array.isArray(parsed.glossary)
    ? parsed.glossary
        .filter((g: Record<string, unknown>) => g && typeof g.term === "string" && g.term.trim())
        .map((g: Record<string, unknown>) => ({
          term: String(g.term || ""),
          definition: String(g.definition || ""),
        }))
    : [];

  // Parse key takeaways
  const keyTakeaways = Array.isArray(parsed.keyTakeaways)
    ? parsed.keyTakeaways.map(String).filter(t => t.trim())
    : [];

  // Calculate read times (250 words per minute)
  const wordCount = (text: string) => text.replace(/[#*`[\](){}]/g, "").split(/\s+/).length;
  const readTime = (text: string) => Math.max(1, Math.ceil(wordCount(text) / 250));

  return {
    summary: String(parsed.summary || "").slice(0, 500),
    keywords: keywords.slice(0, 20),
    codeSections,
    beginner: beginner || intermediate || advanced,
    intermediate: intermediate || beginner,
    advanced: advanced || intermediate || beginner,
    glossary,
    keyTakeaways: keyTakeaways.slice(0, 10),
    estimatedReadMinutes: clamp(parsed.estimatedReadMinutes, readTime(intermediate || beginner)),
    readTimeBeginner: clamp(parsed.readTimeBeginner, readTime(beginner || intermediate)),
    readTimeIntermediate: clamp(parsed.readTimeIntermediate, readTime(intermediate)),
    readTimeAdvanced: clamp(parsed.readTimeAdvanced, readTime(advanced || intermediate)),
  };
}

/* ── Main Normalization Function ───────────────────────────────────────── */

/**
 * Normalize any article into a structured, multi-level format.
 * Uses the project's multi-provider chat (BYOK or cloud proxy).
 */
export async function normalizeArticle(params: {
  title: string;
  content: string;
  sourceName: string;
  isUserArticle?: boolean;
}): Promise<NormalizeResult> {
  const { title, content, sourceName, isUserArticle = false } = params;

  try {
    const messages = buildNormalizationMessages(title, content, sourceName, isUserArticle);

    const rawText = await chat(messages, {
      maxTokens: 8000,
      temperature: 0.2,
      module: "articleNormalize",
    });

    // Clean up the response — strip preamble, markdown wrappers, etc.
    let cleaned = rawText.trim();
    // Remove ```json ... ``` wrappers
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    // If there's text before the first {, strip it (AI sometimes adds "Here's the JSON:")
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 0 && firstBrace < 200) {
      cleaned = cleaned.slice(firstBrace);
    }

    const normalized = parseNormalized(cleaned);
    if (!normalized) {
      return { success: false, error: "Failed to parse AI response — the article may be too short or the AI response was malformed" };
    }

    return { success: true, normalized };
  } catch (e) {
    const msg = (e as Error).message || "Normalization failed";
    if (msg.includes("No API key") || msg.includes("Sign in")) {
      return {
        success: false,
        error: "AI not configured — add an API key in Settings → AI, or sign in to use the cloud proxy",
      };
    }
    return { success: false, error: msg };
  }
}

/* ── Database Operations (Admin Articles) ──────────────────────────────── */

/**
 * Normalize a content item and store the result in content_items table.
 * Subsequent reads cost zero AI tokens.
 */
export async function normalizeAndUpdateContent(contentId: string): Promise<NormalizeResult> {
  const client = await getSupabaseClient();
  if (!client) return { success: false, error: "Cloud not configured" };

  const { data: item, error: fetchError } = await client
    .from("content_items")
    .select("id, title, content, source_name, content_refined")
    .eq("id", contentId)
    .single();

  if (fetchError || !item) return { success: false, error: "Content item not found" };

  // Idempotent: skip if already normalized (has beginner content)
  const existing = (item.content_refined ?? {}) as Record<string, unknown>;
  if (existing.beginner && String(existing.beginner).length > 50) {
    return { success: true, normalized: existing as unknown as import("./articleNormalizer").NormalizedArticle };
  }

  const result = await normalizeArticle({
    title: item.title,
    content: item.content,
    sourceName: item.source_name,
  });

  if (!result.success || !result.normalized) return result;

  const n = result.normalized;
  const { error: updateError } = await client
    .from("content_items")
    .update({
      content_refined: {
        beginner: n.beginner,
        intermediate: n.intermediate,
        advanced: n.advanced,
        tableOfContents: n.keyTakeaways.slice(0, 6),
        keyTakeaways: n.keyTakeaways,
        glossary: n.glossary,
        estimatedReadMinutes: n.estimatedReadMinutes,
        // Extended fields (stored in content_refined JSONB)
        summary_ai: (() => {
          const raw = n.summary || '';
          // Clean JSON-wrapped summaries at storage time
          if (raw.startsWith("{") && raw.includes('"summary"')) {
            const match = raw.match(/"summary"\s*:\s*"([^"]+)"/);
            if (match) return match[1];
          }
          if (raw.startsWith("{") && raw.length < 1000) {
            try {
              const obj = JSON.parse(raw);
              if (obj && typeof obj.summary === "string") return obj.summary;
              if (typeof obj === "object") return '';
            } catch { /* use as-is */ }
          }
          return raw;
        })(),
        keywords: n.keywords,
        code_sections: n.codeSections,
        read_time_beginner: n.readTimeBeginner,
        read_time_intermediate: n.readTimeIntermediate,
        read_time_advanced: n.readTimeAdvanced,
      },
      summary: (() => {
        const raw = n.summary || item.title;
        // Clean JSON-wrapped summaries at storage time
        if (raw.startsWith("{") && raw.includes('"summary"')) {
          const match = raw.match(/"summary"\s*:\s*"([^"]+)"/);
          if (match) return match[1];
        }
        if (raw.startsWith("{") && raw.length < 1000) {
          try {
            const obj = JSON.parse(raw);
            if (obj && typeof obj.summary === "string") return obj.summary;
            return item.title;
          } catch { /* use as-is */ }
        }
        return raw;
      })(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", contentId);

  if (updateError) {
    return { success: false, error: `Database update failed: ${updateError.message}` };
  }

  return result;
}

/**
 * Batch normalize all approved content items that haven't been normalized yet.
 * Processes 1 at a time with rate limiting.
 */
export async function batchNormalizeContent(): Promise<{
  normalized: number;
  errors: number;
  total: number;
  firstError?: string;
}> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");

  // Find articles that need normalization (approved but no refined content)
  const { data: items, error: fetchError, count } = await client
    .from("content_items")
    .select("id", { count: "exact" })
    .eq("status", "approved")
    .is("content_refined->>beginner", null)
    .limit(20);

  if (fetchError) throw fetchError;
  if (!items?.length) return { normalized: 0, errors: 0, total: 0 };

  const total = count ?? items.length;
  let normalized = 0;
  let errors = 0;
  let firstError: string | undefined;

  for (const item of items) {
    try {
      const result = await normalizeAndUpdateContent(item.id);
      if (result.success) normalized++;
      else {
        errors++;
        if (!firstError && result.error) firstError = result.error;
      }
    } catch {
      errors++;
    }
    // Rate limit between AI calls
    await new Promise(r => setTimeout(r, 2000));
  }

  return { normalized, errors, total, firstError };
}

/* ── User Article Normalization (Private) ──────────────────────────────── */

/**
 * Normalize a user-provided article (URL or text) and store in user_article_notes.
 * This is PRIVATE to the user — never added to shared content_items.
 */
export async function normalizeUserArticle(params: {
  url?: string;
  text: string;
  title?: string;
}): Promise<NormalizeResult & { noteId?: string }> {
  const client = await getSupabaseClient();
  if (!client) return { success: false, error: "Cloud not configured" };

  const { data: { user } } = await client.auth.getUser();
  if (!user) return { success: false, error: "Sign in to use this feature" };

  const title = params.title || params.url || "User Article";
  const content = params.text;

  const result = await normalizeArticle({
    title,
    content,
    sourceName: params.url || "User-provided",
    isUserArticle: true,
  });

  if (!result.success || !result.normalized) return result;

  // Store in user_article_notes (private, RLS-scoped to user)
  const { data, error: insertError } = await client
    .from("user_article_notes")
    .insert({
      user_id: user.id,
      original_url: params.url || null,
      original_text: content.slice(0, 5000), // Store first 5K chars for reference
      title,
      normalized: {
        summary: result.normalized.summary,
        keywords: result.normalized.keywords,
        codeSections: result.normalized.codeSections,
        beginner: result.normalized.beginner,
        intermediate: result.normalized.intermediate,
        advanced: result.normalized.advanced,
        glossary: result.normalized.glossary,
        keyTakeaways: result.normalized.keyTakeaways,
        estimatedReadMinutes: result.normalized.estimatedReadMinutes,
        readTimeBeginner: result.normalized.readTimeBeginner,
        readTimeIntermediate: result.normalized.readTimeIntermediate,
        readTimeAdvanced: result.normalized.readTimeAdvanced,
      },
    })
    .select("id")
    .single();

  if (insertError) {
    return { success: false, error: `Failed to save: ${insertError.message}` };
  }

  return { ...result, noteId: data?.id };
}

/**
 * List all user-normalized articles for the current user.
 */
export async function listUserArticles(): Promise<{
  id: string;
  title: string;
  url: string | null;
  normalized: NormalizedArticle;
  createdAt: string;
}[]> {
  const client = await getSupabaseClient();
  if (!client) return [];

  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];

  const { data, error } = await client
    .from("user_article_notes")
    .select("id, title, original_url, normalized, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.map(r => ({
    id: String(r.id),
    title: String(r.title || "Untitled"),
    url: r.original_url ?? null,
    normalized: r.normalized as unknown as NormalizedArticle,
    createdAt: String(r.created_at),
  }));
}

/**
 * Delete a user-normalized article.
 */
export async function deleteUserArticle(noteId: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;
  await client.from("user_article_notes").delete().eq("id", noteId);
}

/* ── Token Cost Estimation ─────────────────────────────────────────────── */

/**
 * Rough estimate of AI tokens needed for normalization.
 * Based on: input (article + prompt) + output (structured response).
 */
export function estimateTokenCost(contentLength: number): {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: string;
} {
  const inputTokens = Math.ceil(contentLength / 4) + 500; // content + system prompt
  const outputTokens = 2000; // structured JSON response
  // Rough cost at $0.002 per 1K input tokens, $0.006 per 1K output tokens (GPT-4o-mini)
  const cost = (inputTokens / 1000) * 0.002 + (outputTokens / 1000) * 0.006;
  return {
    inputTokens,
    outputTokens,
    estimatedCost: cost < 0.01 ? "< $0.01" : `~$${cost.toFixed(3)}`,
  };
}
