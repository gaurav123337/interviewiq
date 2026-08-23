/* content-refine — Server-side content refinement edge function.
   Transforms raw scraped content into 3 progressive difficulty levels
   (Beginner → Intermediate → Advanced) using the existing ai-chat proxy.

   POST /content-refine
   Body: { contentId: string }  — specific content item to refine
          OR {} to refine all approved un-refined items

   Returns: { refined: number, errors: number } */

import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/serviceClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (!isAllowedOrigin(req)) return new Response("Forbidden", { status: 403 });

  try {
    const admin = await requireAdmin(req);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const client = serviceClient();
    if (!client) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const contentId: string | undefined = body.contentId;

    // Fetch approved content items that haven't been refined
    let query = client
      .from("content_items")
      .select("id, title, content, source_name, domain")
      .eq("status", "approved");

    if (contentId) {
      query = query.eq("id", contentId);
    } else {
      query = query.is("content_refined->>beginner", null);
    }

    const { data: items, error: fetchError } = await query.limit(5);
    if (fetchError) throw fetchError;
    if (!items?.length) {
      return new Response(JSON.stringify({ refined: 0, errors: 0, message: "No items to refine" }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get a service-level JWT to call ai-chat
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEYS") || "";

    let refined = 0;
    let errors = 0;

    for (const item of items) {
      try {
        const systemPrompt = buildSystemPrompt();
        const userPrompt = buildUserPrompt(item.title, item.content, item.source_name);

        // Call ai-chat proxy for the refinement
        const aiResult = await callAiChat(supabaseUrl, serviceKey, [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ]);

        if (!aiResult) {
          errors++;
          continue;
        }

        // Parse the response
        const refinedContent = parseRefinedContent(aiResult);
        if (!refinedContent) {
          errors++;
          continue;
        }

        // Store refined content
        const { error: updateError } = await client
          .from("content_items")
          .update({
            content_refined: refinedContent,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (updateError) throw updateError;
        refined++;
      } catch (e) {
        console.error("Refine error:", (e as Error).message);
        errors++;
      }

      // Rate limit between AI calls
      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(JSON.stringify({ refined, errors }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

/* ── AI Chat Proxy Call ────────────────────────────────────────────────── */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callAiChat(supabaseUrl: string, serviceKey: string, messages: ChatMessage[]): Promise<string | null> {
  try {
    // Use service role key to call ai-chat (bypasses user auth requirement)
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages,
        temperature: 0.3,
        maxTokens: 3000,
      }),
    });

    if (!res.ok) {
      console.error("ai-chat error:", res.status);
      return null;
    }

    const body = await res.json();
    return body.text || null;
  } catch (e) {
    console.error("ai-chat call failed:", (e as Error).message);
    return null;
  }
}

/* ── Prompt Building ───────────────────────────────────────────────────── */

function buildSystemPrompt(): string {
  return [
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
  ].join("\n");
}

function buildUserPrompt(title: string, content: string, sourceName: string): string {
  const truncated = content.slice(0, 8000);
  return [
    "SOURCE: " + sourceName,
    "TITLE: " + title,
    "",
    "RAW SCRAPED CONTENT:",
    truncated,
    "",
    "Transform this into a progressive-difficulty interview prep article.",
  ].join("\n");
}

/* ── Parse LLM Response ────────────────────────────────────────────────── */

function parseRefinedContent(raw: string): Record<string, unknown> | null {
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
    if (parsed.beginner && parsed.intermediate && parsed.advanced) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
