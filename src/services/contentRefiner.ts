/* Content Refiner — Transforms raw scraped content into well-structured,
   progressive-difficulty articles for InterviewIQ users.

   Uses the project's existing multi-provider AI infrastructure:
   - BYOK (user's own API key) → direct call with fallback chain
   - Cloud proxy (ai-chat edge function) → admin-configured provider
   - Supports any OpenAI-compatible endpoint (OpenAI, Anthropic, Gemini, etc.)

   Pipeline: Raw content → LLM refinement → 3 difficulty levels → store. */

import { chat, type ChatMessage } from "../ai";
import { getSupabaseClient } from "./cloud";

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
}

/* ── Parse LLM Response ────────────────────────────────────────────────── */

function parseRefinedContent(raw: string): RefinedContent | null {
  try {
    let jsonStr = raw;
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    } else {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    if (!parsed.beginner || !parsed.intermediate || !parsed.advanced) return null;

    return {
      beginner: String(parsed.beginner || ""),
      intermediate: String(parsed.intermediate || ""),
      advanced: String(parsed.advanced || ""),
      tableOfContents: Array.isArray(parsed.tableOfContents) ? parsed.tableOfContents.map(String) : [],
      keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways.map(String) : [],
      glossary: Array.isArray(parsed.glossary)
        ? parsed.glossary.map((g: Record<string, unknown>) => ({
            term: String(g.term || ""),
            definition: String(g.definition || ""),
          }))
        : [],
      estimatedReadMinutes: Number(parsed.estimatedReadMinutes) || 5,
    };
  } catch {
    return null;
  }
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
    const rawText = await chat(messages, {
      maxTokens: 3000,
      temperature: 0.3,
      module: "contentRefine",
    });

    const refined = parseRefinedContent(rawText);
    if (!refined) {
      return { success: false, error: "Failed to parse AI response" };
    }

    return { success: true, refined };
  } catch (e) {
    return { success: false, error: (e as Error).message || "Refinement failed" };
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", contentId);

  if (updateError) {
    return { success: false, error: `Database update failed: ${updateError.message}` };
  }

  return result;
}

/** Batch refine all approved content items that haven't been refined yet */
export async function batchRefineContent(): Promise<{ refined: number; errors: number }> {
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

  for (const item of items) {
    try {
      const result = await refineAndUpdateContent(item.id);
      if (result.success) refined++;
      else errors++;
    } catch {
      errors++;
    }
    // Rate limit between AI calls
    await new Promise(r => setTimeout(r, 2000));
  }

  return { refined, errors };
}
