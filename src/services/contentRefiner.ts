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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract a JSON object from text by brace-counting from a known key */
function extractJsonByKey(text: string, key: string): Record<string, unknown> | null {
  const searchKey = `"${key}"`;
  const keyIdx = text.indexOf(searchKey);
  if (keyIdx < 0) return null;

  // Walk backward to find opening {
  let start = keyIdx;
  while (start > 0 && text[start] !== '{') start--;
  if (text[start] !== '{') return null;

  // Brace-count forward to find matching }
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end <= start) return null;

  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    // Try fixing common issues
    const fixed = slice.replace(/'/g, '"').replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(fixed); } catch { return null; }
  }
}

/** Extract content between markdown headers (no regex needed) */
function extractByHeaders(text: string, headerNames: string[]): string {
  const lines = text.split('\n');
  let capturing = false;
  let headerPattern = '';
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Check if this is a header matching any of our target names
    const isHeader = trimmed.match(/^#{1,3}\s+(.+)/i);
    if (isHeader) {
      const title = isHeader[1].toLowerCase();
      if (headerNames.some(h => title.includes(h.toLowerCase()))) {
        capturing = true;
        headerPattern = trimmed;
        continue;
      } else if (capturing) {
        // Hit a different header — stop capturing
        break;
      }
    }
    if (capturing && trimmed) {
      result.push(line);
    }
  }

  return result.join('\n').trim();
}

/** Split text into three roughly equal parts */
function splitIntoThree(text: string): { first: string; second: string; third: string } {
  const cleaned = text.replace(/^[\s\S]*?(?=\n#{1,3}\s|We need|Let me|The |Based on)/i, '').trim() || text;
  const words = cleaned.split(/\s+/).filter(Boolean);
  const third = Math.ceil(words.length / 3);
  return {
    first: words.slice(0, third).join(' '),
    second: words.slice(third, third * 2).join(' '),
    third: words.slice(third * 2).join(' '),
  };
}

function parseRefinedContent(raw: string): RefinedContent | null {
  if (!raw || raw.trim().length < 50) return null;

  let parsed: Record<string, unknown> | null = null;

  // ═══ STRATEGY 1: Direct JSON parse ═══
  // Handle ```json...``` blocks
  if (!parsed && raw.includes('```json')) {
    const m = raw.match(/```json\s*([\s\S]*?)```/);
    if (m) try { parsed = JSON.parse(m[1].trim()); } catch { /* next */ }
  }

  // Handle JSON with thinking prefix — find by key
  if (!parsed) {
    parsed = extractJsonByKey(raw, 'beginner');
    if (parsed) console.log('[contentRefiner] Extracted JSON by key from', raw.length, 'chars');
  }

  // Handle plain JSON (no prefix)
  if (!parsed) {
    parsed = extractJsonByKey(raw, 'beginner');
  }

  // ═══ STRATEGY 2: Markdown-structured content ═══
  // Model outputted markdown headers instead of JSON
  if (!parsed) {
    const beginner = extractByHeaders(raw, ['beginner', 'what is', 'introduction', 'intro', 'overview', 'simplified']);
    const intermediate = extractByHeaders(raw, ['intermediate', 'how it works', 'implementation', 'details', 'patterns']);
    const advanced = extractByHeaders(raw, ['advanced', 'deep dive', 'internals', 'interview', 'performance']);
    if (beginner && intermediate && advanced) {
      parsed = { beginner, intermediate, advanced };
      console.log('[contentRefiner] Extracted content from markdown headers');
    }
  }

  // ═══ STRATEGY 3: Split by content markers ═══
  // Model outputted plain text with sections
  if (!parsed && raw.length > 200) {
    const split = splitIntoThree(raw);
    if (split.first.length > 50 && split.second.length > 50) {
      parsed = { beginner: split.first, intermediate: split.second, advanced: split.third };
      console.log('[contentRefiner] Split content into three levels');
    }
  }

  // ═══ STRATEGY 4: Last resort — use everything as intermediate ═══
  if (!parsed && raw.length > 100) {
    parsed = {
      beginner: raw.slice(0, Math.ceil(raw.length / 3)).trim(),
      intermediate: raw.slice(Math.ceil(raw.length / 3), Math.ceil(raw.length * 2 / 3)).trim(),
      advanced: raw.slice(Math.ceil(raw.length * 2 / 3)).trim(),
    };
    console.log('[contentRefiner] Last resort: split into thirds');
  }

  if (!parsed) {
    console.error('[contentRefiner] All strategies failed. Raw length:', raw.length);
    return null;
  }

  const beginner = String(parsed.beginner || "");
  const intermediate = String(parsed.intermediate || "");
  const advanced = String(parsed.advanced || "");

  // Need at least some content
  if (!beginner && !intermediate && !advanced) return null;

  return {
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

    const refined = parseRefinedContent(rawText);
    if (!refined) {
      console.error(`[contentRefiner] PARSE FAILED for "${title}". Raw: ${rawText.length} chars.`);
      return { success: false, error: `Failed to parse AI response (${rawText.length} chars returned). Check console for details.` };
    }

    return { success: true, refined };
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
