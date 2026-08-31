/* content-index — Indexes approved content items into the RAG knowledge base.
   Uses NORMALIZED content when available (keywords, difficulty levels, code sections)
   for richer, more relevant RAG results.

   POST /content-index
   Body: { contentId: string }  — specific content item to index
          OR {} to index all un-indexed approved items

   Returns: { indexed: number, errors: number } */

import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/serviceClient.ts";
import { embedTexts, resolveEmbedProvider } from "../_shared/embedProvider.ts";

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

    /* Resolve the embeddings provider ONCE (shared with functions/embed): the
       dedicated ai_provider_config key='embeddings' row → the chat provider →
       env OPENAI_API_KEY. Converges this indexer off its old hardcoded
       api.openai.com path so it can never drift into a different vector space
       than the query side. */
    const provider = await resolveEmbedProvider(async (rowKey) => {
      const { data } = await client.from("ai_provider_config").select("value").eq("key", rowKey).maybeSingle();
      return (data as { value?: unknown } | null)?.value ?? null;
    });
    if (!provider) {
      return new Response(JSON.stringify({ error: "Embeddings not configured — set the embeddings provider in Product Config." }), {
        status: 503,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const contentId: string | undefined = body.contentId;

    // Fetch approved content items
    // For specific contentId: always fetch (for re-indexing)
    // For bulk: only un-indexed items
    let query = client
      .from("content_items")
      .select("id, title, content, summary, source_name, source_url, domain, field_id, content_refined, rag_document_id")
      .eq("status", "approved");

    if (contentId) {
      query = query.eq("id", contentId);
    } else {
      // Only un-indexed items (skip already indexed)
      query = query.is("rag_document_id", null);
    }

    const { data: items, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!items?.length) {
      return new Response(JSON.stringify({ indexed: 0, errors: 0, message: "No items to index" }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let indexed = 0;
    let errors = 0;

    for (const item of items) {
      try {
        const title = String(item.title);
        const rawContent = String(item.content);
        const sourceName = String(item.source_name);
        const sourceUrl = String(item.source_url);
        const fieldId = String(item.field_id);

        // Parse normalized content (content_refined JSONB)
        const refined = (typeof item.content_refined === "object" && item.content_refined !== null)
          ? item.content_refined as Record<string, unknown>
          : {};

        // Build enriched content for indexing:
        // Combine all difficulty levels + keywords + glossary + takeaways
        const enrichedParts: string[] = [];

        // 1. Title + summary (always available)
        enrichedParts.push(`Title: ${title}`);
        const summary = cleanJsonString(item.summary) || cleanJsonString(refined.summary_ai) || "";
        if (summary) enrichedParts.push(`Summary: ${summary}`);

        // 2. Keywords (for lexical search matching)
        const keywords = extractArray(refined.keywords);
        if (keywords.length > 0) {
          enrichedParts.push(`Keywords: ${keywords.join(", ")}`);
        }

        // 3. Difficulty-level content (the meat of the article)
        for (const level of ["beginner", "intermediate", "advanced"] as const) {
          const levelContent = String(refined[level] || "").trim();
          if (levelContent.length > 50) {
            enrichedParts.push(`[${level.toUpperCase()}]\n${levelContent}`);
          }
        }

        // 4. Code examples (valuable for coding questions)
        const codeSections = extractCodeSections(refined.code_sections);
        for (const section of codeSections.slice(0, 5)) {
          enrichedParts.push(`[CODE: ${section.language}] ${section.description}\n${section.code}`);
        }

        // 5. Glossary (valuable for interview hints)
        const glossary = extractGlossary(refined.glossary);
        if (glossary.length > 0) {
          const glossaryText = glossary.map((g) => `${g.term}: ${g.definition}`).join("\n");
          enrichedParts.push(`[GLOSSARY]\n${glossaryText}`);
        }

        // 6. Key takeaways (valuable for quick reference)
        const takeaways = extractArray(refined.keyTakeaways);
        if (takeaways.length > 0) {
          enrichedParts.push(`[KEY TAKEAWAYS]\n${takeaways.join("\n")}`);
        }

        // Fall back to raw content if no normalized data
        if (enrichedParts.length <= 2) {
          enrichedParts.push(rawContent);
        }

        // Join all parts with clear separators for better chunking
        const fullContent = enrichedParts.join("\n\n---\n\n").slice(0, 50000);

        // ── Idempotent: delete old document + chunks if re-indexing ──
        const existingDocId = (item as Record<string, unknown>).rag_document_id;
        if (existingDocId) {
          // Delete old chunks first (foreign key dependency)
          await client.from("pdf_chunks").delete().eq("document_id", existingDocId);
          // Delete old document
          await client.from("pdf_documents").delete().eq("id", existingDocId);
        }

        // Create new pdf_documents entry
        const { data: doc, error: docError } = await client
          .from("pdf_documents")
          .insert({
            title: `[Article] ${title}`,
            content: fullContent,
            chunk_count: 0,
            indexed: false,
          })
          .select("id")
          .single();

        if (docError) throw docError;
        const docId = doc.id;

        // Chunk the enriched content (~800 chars per chunk with 200 char overlap)
        // Smaller chunks = more precise RAG retrieval
        const chunks = chunkText(fullContent, 800, 200);

        // Embed all chunks in ONE batch via the shared provider. embedTexts
        // throws on any failure (incl. a non-1536 vector), so a document is
        // either fully indexed or counted as an error — never half-embedded
        // with silently-dropped chunks (which would leave gaps in the KB).
        let chunkCount = 0;
        if (chunks.length) {
          const vectors = await embedTexts(provider, chunks);
          for (let i = 0; i < chunks.length; i++) {
            const { error: chunkError } = await client.from("pdf_chunks").insert({
              document_id: docId,
              content: chunks[i],
              embedding: JSON.stringify(vectors[i]),
              chunk_index: i,
            });
            if (chunkError) throw chunkError;
            chunkCount++;
          }
        }

        // Update document with chunk count
        await client
          .from("pdf_documents")
          .update({ chunk_count: chunkCount, indexed: true })
          .eq("id", docId);

        // Link back to content_item
        await client
          .from("content_items")
          .update({ rag_document_id: docId })
          .eq("id", item.id);

        indexed++;
      } catch (e) {
        console.error(`[content-index] failed to index item ${item.id}:`, (e as Error).message);
        errors++;
      }
    }

    return new Response(JSON.stringify({ indexed, errors }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

/* ── Helpers ──────────────────────────────────────────────────────────── */

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start + overlap >= text.length) break;
  }
  return chunks.filter(c => c.trim().length > 50);
}

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
    } catch { /* use as-is */ }
  }
  return trimmed;
}

function extractArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  return [];
}

function extractCodeSections(val: unknown): { language: string; code: string; description: string }[] {
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

function extractGlossary(val: unknown): { term: string; definition: string }[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((g): g is Record<string, unknown> => typeof g === "object" && g !== null)
    .map((g) => ({
      term: String(g.term || ""),
      definition: String(g.definition || ""),
    }))
    .filter((g) => g.term.length > 0);
}
