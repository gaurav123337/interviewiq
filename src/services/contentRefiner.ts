/* Content Refiner — Transforms raw scraped content into well-structured,
   progressive-difficulty articles for InterviewIQ users.

   Pipeline: Raw content -> LLM refinement -> 3 difficulty levels -> store.
   Each level builds on the previous:
     - Beginner:  What is it? Why does it matter? Simple analogies.
     - Intermediate: How does it work? Code examples, common patterns.
     - Advanced: Edge cases, deep internals, architecture decisions.

   Also extracts: table of contents, key takeaways, glossary terms. */

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

/* ── AI Settings Resolution ────────────────────────────────────────────── */

function getAiSettings(): { key: string; base: string } | null {
  try {
    const stored = localStorage.getItem("ai_settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.key) return { key: parsed.key, base: parsed.base || "https://api.openai.com/v1" };
    }
  } catch { /* ignore */ }
  return null;
}

/* ── Refinement Prompt ─────────────────────────────────────────────────── */

function buildRefinementPrompt(title: string, content: string, sourceName: string): { system: string; user: string } {
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
    "RESPOND IN EXACTLY THIS JSON FORMAT (the content strings should use \\n for newlines):",
    '{',
    '  "beginner": "## What is [Topic]?\\n\\n[Simple explanation with analogy]\\n\\n### Why does it matter?\\n\\n[Relevance]\\n\\n### Key concepts\\n\\n[Core ideas]",',
    '  "intermediate": "## How it works\\n\\n[Technical explanation]\\n\\n### Code example\\n\\n[Runnable code]\\n\\n### Common patterns\\n\\n[Best practices]",',
    '  "advanced": "## Deep dive\\n\\n[Advanced internals]\\n\\n### Performance\\n\\n[Optimization]\\n\\n### Interview angles\\n\\n[Common questions]",',
    '  "tableOfContents": ["Section 1", "Section 2"],',
    '  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],',
    '  "glossary": [{"term": "Term", "definition": "Definition"}],',
    '  "estimatedReadMinutes": 5',
    '}',
    "",
    "IMPORTANT:",
    "- Use Markdown formatting with ## and ### headings",
    "- Code examples should use triple backticks with language tags",
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

  return { system: systemLines.join("\n"), user: userLines.join("\n") };
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
      if (jsonMatch) jsonMatch[0];
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
        ? parsed.glossary.map((g: any) => ({ term: String(g.term || ""), definition: String(g.definition || "") }))
        : [],
      estimatedReadMinutes: Number(parsed.estimatedReadMinutes) || 5,
    };
  } catch {
    return null;
  }
}

/* ── Main Refinement Function ──────────────────────────────────────────── */

/** Refine raw content into progressive-difficulty article using AI */
export async function refineContent(params: {
  title: string;
  content: string;
  sourceName: string;
  model?: string;
}): Promise<ContentRefinementResult> {
  const { title, content, sourceName, model = "gpt-4o-mini" } = params;

  const settings = getAiSettings();
  if (!settings) {
    return { success: false, error: "No AI key configured -- add one in Settings > AI" };
  }

  try {
    const { system, user } = buildRefinementPrompt(title, content, sourceName);

    const res = await fetch(`${settings.base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!res.ok) {
      return { success: false, error: `AI API error (${res.status})` };
    }

    const body = await res.json();
    const rawText = (body.choices?.[0]?.message?.content ?? "").trim();

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
    await new Promise(r => setTimeout(r, 2000));
  }

  return { refined, errors };
}
