/* Content Refiner — Transforms raw scraped content into well-structured,
   progressive-difficulty articles for InterviewIQ users.

   Uses the project's existing multi-provider AI infrastructure:
   - BYOK (user's own API key) → direct call with fallback chain
   - Cloud proxy (ai-chat edge function) → admin-configured provider
   - Supports any OpenAI-compatible endpoint (OpenAI, Anthropic, Gemini, etc.)

   Pipeline: Raw content → LLM refinement → 3 difficulty levels → store. */

import { chat, type ChatMessage } from "../ai";
import { getSupabaseClient } from "./cloud";
import { normalizeAiOutput } from "./aiOutputNormalizer";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface RefinedContent {
  beginner: string;
  intermediate: string;
  advanced: string;
  tableOfContents: string[];
  keyTakeaways: string[];
  glossary: { term: string; definition: string }[];
  estimatedReadMinutes: number;
}

export interface ContentRefinementResult {
  success: boolean;
  refined?: RefinedContent;
  error?: string;
  qualityScore?: number;
}

/* ── Prompt Building ───────────────────────────────────────────────────── */

function buildRefinementMessages(title: string, content: string, sourceName: string): ChatMessage[] {
  const truncated = content.slice(0, 8000);

  const systemLines = [
    "You are a senior technical educator creating learning content for an interview preparation platform.",
    "Your job is to transform raw scraped content into a well-structured, progressive-difficulty article.",
    "",
    "RULES:",
    "1. Write CLEAR, CONCISE, and PRACTICAL content aimed at developers preparing for interviews.",
    "2. Start simple (beginner), build to intermediate, then advanced -- like a teacher would.",
    "3. Use short paragraphs, bullet points, code examples, and analogies.",
    "4. Remove marketing fluff, navigation text, ads, cookie notices, and sidebar content.",
    "5. Keep code examples focused and runnable.",
    "6. Each section should have a clear heading.",
    "7. End key takeaways as a numbered list.",
    "8. The glossary should define any technical terms a junior developer might not know.",
    "",
    "RESPOND IN EXACTLY THIS JSON FORMAT:",
    "{",
    '  "beginner": "## What is [Topic]?\\n\\n[Simple explanation]\\n\\n### Why does it matter?\\n\\n[Relevance]\\n\\n### Key concepts\\n\\n[Core ideas]",',
    '  "intermediate": "## How it works\\n\\n[Technical explanation]\\n\\n### Code example\\n\\n[Runnable code]\\n\\n### Common patterns\\n\\n[Best practices]",',
    '  "advanced": "## Deep dive\\n\\n[Advanced internals]\\n\\n### Performance\\n\\n[Optimization]\\n\\n### Interview angles\\n\\n[Common questions]",',
    '  "tableOfContents": ["Section 1", "Section 2"],',
    '  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],',
    '  "glossary": [{"term": "Term", "definition": "Definition"}],',
    '  "estimatedReadMinutes": 5',
    "}",
    "",
    "IMPORTANT:",
    "- Use Markdown formatting with ## and ### headings",
    "- Keep each difficulty level to 300-600 words",
    "- The beginner level should be understandable by someone with 6 months of coding experience",
    "- The intermediate level assumes 1-2 years of experience",
    "- The advanced level is for senior developers and system design interviews",
  ];

  const userLines = [
    "SOURCE: " + sourceName,
    "TITLE: " + title,
    "",
    "RAW SCRAPED CONTENT:",
    truncated,
    "",
    "Transform this into a progressive-difficulty interview prep article.",
  ];

  return [
    { role: "system", content: systemLines.join("\n") },
    { role: "user", content: userLines.join("\n") },
  ];
}/* ── Parse LLM Response ────────────────────────────────────────────────── */

/** Parsed result with quality metadata — returned instead of using global state */
export interface ParsedRefinement {
  refined: RefinedContent | null;
  qualityScore: number;
}

/** Parse raw AI response into structured content + quality score */
function parseRefinedContent(raw: string): ParsedRefinement {
  if (!raw || raw.trim().length < 50) {
    return { refined: null, qualityScore: 0 };
  }

  // Use the universal AI output normalizer
  const result = normalizeAiOutput(raw, ['beginner', 'intermediate', 'advanced']);
  const qualityScore = result.quality.score;
  console.log(`[contentRefiner] Strategy: ${result.strategy} | Quality: ${result.quality.score}/100 | Passed: ${result.quality.passed}`);
  if (result.quality.issues.length > 0) {
    console.warn('[contentRefiner] Quality issues:', result.quality.issues);
  }
  if (result.quality.suggestions.length > 0) {
    console.log('[contentRefiner] Suggestions:', result.quality.suggestions);
  }

  if (!result.parsed) {
    console.error('[contentRefiner] All normalization strategies failed. Raw length:', raw.length);
    console.error('[contentRefiner] First 500 chars:', raw.slice(0, 500));
    return { refined: null, qualityScore };
  }

  // Warn if quality is low but still return the content
  if (qualityScore < 50) {
    console.warn(`[contentRefiner] Low quality output (${qualityScore}/100) — content may need manual review`);
  }

  const parsed = result.parsed;
  const beginner = String(parsed.beginner || "");
  const intermediate = String(parsed.intermediate || "");
  const advanced = String(parsed.advanced || "");

  if (!beginner && !intermediate && !advanced) {
    return { refined: null, qualityScore };
  }

  return {
    refined: {
      beginner: beginner || intermediate || advanced,
      intermediate: intermediate || beginner,
      advanced: advanced || intermediate || beginner,
      tableOfContents: Array.isArray(parsed.tableOfContents) ? parsed.tableOfContents.map(String) : [],
      keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways.map(String) : [],
      glossary: Array.isArray(parsed.glossary)
        ? parsed.glossary.map((g: Record<string, unknown>) => ({
              term: String(g.term || ""),
              definition: String(g.definition || ""),
            }))
        : [],
      estimatedReadMinutes: Number(parsed.estimatedReadMinutes) || Math.ceil(raw.length / 1500),
    },
    qualityScore,
  };
}

/* ── Main Refinement Function ──────────────────────────────────────────── */

/**
 * Refine raw content into progressive-difficulty article using AI.
 *
 * Uses the project's existing multi-provider infrastructure:
 * - If user has BYOK key → uses it with fallback chain
 * - If user is signed in → routes through ai-chat proxy (admin-configured provider)
 * - Supports OpenAI, Anthropic, Gemini, or any OpenAI-compatible endpoint
 * - Falls back to cheaper models on 429/5xx errors
 */
export async function refineContent(params: {
  title: string;
  content: string;
  sourceName: string;
}): Promise<ContentRefinementResult> {
  const { title, content, sourceName } = params;

  try {
    const messages = buildRefinementMessages(title, content, sourceName);

    // Use the project's multi-provider chat function
    // This handles: BYOK fallback, cloud proxy, model fallback chain, caching
    console.log(`[contentRefiner] Calling AI for "${title}" (${content.length} chars input)`);
    const rawText = await chat(messages, {
      maxTokens: 4000,
      temperature: 0.3,
      module: "contentRefine",
    });
    console.log(`[contentRefiner] AI response length: ${rawText.length} chars`);
    console.log(`[contentRefiner] First 300 chars: ${rawText.slice(0, 300)}`);
    console.log(`[contentRefiner] Last 200 chars: ${rawText.slice(-200)}`);

    const { refined, qualityScore } = parseRefinedContent(rawText);
    if (!refined) {
      console.error(`[contentRefiner] PARSE FAILED for "${title}". Raw: ${rawText.length} chars.`);
      return { success: false, error: `Failed to parse AI response (${rawText.length} chars returned). Check console for details.`, qualityScore };
    }

    return { success: true, refined, qualityScore };
  } catch (e) {
    const msg = (e as Error).message || "Refinement failed";
    // Provide helpful guidance for common AI configuration errors
    if (msg.includes("No API key") || msg.includes("Sign in")) {
      return {
        success: false,
        error: "AI not configured — add an API key in Settings → AI, or sign in to use the cloud proxy",
      };
    }
    return { success: false, error: msg };
  }
}

/* ── Database Operations ───────────────────────────────────────────────── */

/** Refine a content item and store the result */
export async function refineAndUpdateContent(contentId: string): Promise<ContentRefinementResult> {
  const client = await getSupabaseClient();
  if (!client) return { success: false, error: "Cloud not configured" };

  const { data: item, error: fetchError } = await client
    .from("content_items")
    .select("id, title, content, source_name, domain")
    .eq("id", contentId)
    .single();

  if (fetchError || !item) return { success: false, error: "Content item not found" };

  const result = await refineContent({
    title: item.title,
    content: item.content,
    sourceName: item.source_name,
  });

  if (!result.success || !result.refined) return result;

  const { error: updateError } = await client
    .from("content_items")
    .update({
      content_refined: result.refined,
      quality_score: result.qualityScore ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contentId);

  if (updateError) {
    return { success: false, error: `Database update failed: ${updateError.message}` };
  }

  return result;
}

/** Batch refine all approved content items that haven't been refined yet */
export async function batchRefineContent(): Promise<{ refined: number; errors: number; firstError?: string }> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");

  const { data: items, error: fetchError } = await client
    .from("content_items")
    .select("id, title, content, source_name, domain")
    .eq("status", "approved")
    .is("content_refined->>beginner", null)
    .limit(10);

  if (fetchError) throw fetchError;
  if (!items?.length) return { refined: 0, errors: 0 };

  let refined = 0;
  let errors = 0;
  let firstError: string | undefined;

  for (const item of items) {
    try {
      const result = await refineAndUpdateContent(item.id);
      if (result.success) refined++;
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

  return { refined, errors, firstError };
}

/* ── Retroactive Quality Scoring ──────────────────────────────────────── */

/** Calculate quality score from existing refined content (no AI call needed) */
function calculateQualityFromRefined(refined: Record<string, unknown>): number {
  let score = 0;

  // Check required keys
  const beginner = String(refined.beginner || '');
  const intermediate = String(refined.intermediate || '');
  const advanced = String(refined.advanced || '');

  if (beginner.length > 0) score += 20;
  if (intermediate.length > 0) score += 20;
  if (advanced.length > 0) score += 20;

  // Check content length (good content should have substance)
  const minWords = 20;
  const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
  if (wordCount(beginner) >= minWords) score += 10;
  if (wordCount(intermediate) >= minWords) score += 10;
  if (wordCount(advanced) >= minWords) score += 10;

  // Check for differentiation (levels should not be identical)
  const unique = new Set([beginner.slice(0, 200), intermediate.slice(0, 200), advanced.slice(0, 200)]);
  if (unique.size === 3) score += 10;
  else if (unique.size === 2) score += 5;

  return Math.min(100, score);
}

/** Batch calculate quality scores for all refined articles */
export async function batchCalculateQualityScores(): Promise<{ updated: number; errors: number }> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");

  const { data: items, error: fetchError } = await client
    .from("content_items")
    .select("id, content_refined")
    .eq("status", "approved")
    .not("content_refined->>beginner", "is", null)
    .limit(200);

  if (fetchError) throw fetchError;
  if (!items?.length) return { updated: 0, errors: 0 };

  let updated = 0;
  let errors = 0;

  for (const item of items) {
    try {
      const refined = (item.content_refined ?? {}) as Record<string, unknown>;
      const score = calculateQualityFromRefined(refined);

      const { error: updateError } = await client
        .from("content_items")
        .update({ quality_score: score })
        .eq("id", item.id);

      if (updateError) errors++;
      else updated++;
    } catch {
      errors++;
    }
  }

  return { updated, errors };
}
