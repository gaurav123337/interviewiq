/* seed-rag — seeds the RAG knowledge base with the in-repo starter corpus
   (content/rag-seed/*.md, baked into corpus.generated.ts). Admin-only, server-side
   equivalent of `npm run seed:rag`: it embeds the whole corpus with the shared,
   server-configured embeddings provider and writes source='seed' pdf_documents +
   pdf_chunks, stamped with the provider host + model so match_pdf_chunks' p_model
   filter finds them. Mirrors content-index/index.ts.

   POST /seed-rag  (body ignored)
   -> { seeded, chunks, errors, errorDetails, model, provider }

   Embed-first, delete-second: the whole corpus is embedded in ONE batch BEFORE any
   delete, so a provider failure (misconfigured / no credits) leaves the existing seed
   intact — unlike the CLI, which deletes up front and can leave the KB half-seeded. */

import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/serviceClient.ts";
import { embedTexts, resolveEmbedProvider } from "../_shared/embedProvider.ts";
import { buildSeedDocs, estimateTokens, hostOf } from "../_shared/ragSeed.ts";
import { RAG_SEED_CORPUS } from "./corpus.generated.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (!isAllowedOrigin(req)) return new Response("Forbidden", { status: 403 });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });

  try {
    const admin = await requireAdmin(req);
    if (!admin) return json({ error: "Admin access required" }, 403);

    const client = serviceClient();
    if (!client) return json({ error: "Server configuration error" }, 500);

    // Resolve the embeddings provider ONCE (shared with functions/embed and
    // content-index) so seeded chunks land in the SAME vector space the keyless query
    // path filters on (match_pdf_chunks p_model = provider.model).
    const provider = await resolveEmbedProvider(async (rowKey) => {
      const { data } = await client.from("ai_provider_config").select("value").eq("key", rowKey).maybeSingle();
      return (data as { value?: unknown } | null)?.value ?? null;
    });
    if (!provider) {
      return json({
        error: "Embeddings not configured — set the embeddings provider in Secrets → Embeddings provider.",
      }, 503);
    }
    const providerHost = hostOf(provider.base);

    // Parse + chunk the baked corpus; keep only docs that produced at least one chunk.
    const docs = buildSeedDocs(RAG_SEED_CORPUS).filter((d) => d.chunks.length > 0);
    if (docs.length === 0) return json({ error: "Seed corpus is empty" }, 500);

    // ── Embed-first: one batch for the whole corpus BEFORE any DB write. embedTexts
    //    throws on any failure (HTTP error / count mismatch / non-1536-dim vector), so
    //    a misconfigured provider or empty balance aborts here with the live seed intact.
    const allChunks = docs.flatMap((d) => d.chunks);
    let vectors: number[][];
    try {
      vectors = await embedTexts(provider, allChunks);
    } catch (e) {
      return json({ error: (e as Error).message || "Embedding failed" }, 502);
    }

    // ── Swap: only now clear the old seed and re-insert. The destructive window is
    //    just this insert loop (sub-second), not the network embed call above.
    const { error: delError } = await client.from("pdf_documents").delete().eq("source", "seed");
    if (delError) return json({ error: `Failed clearing prior seed: ${delError.message}` }, 500);

    let seeded = 0;
    let chunks = 0;
    let cursor = 0;
    const errorDetails: { file: string; error: string }[] = [];

    for (const doc of docs) {
      const docVectors = vectors.slice(cursor, cursor + doc.chunks.length);
      cursor += doc.chunks.length;
      try {
        const { data: inserted, error: docError } = await client
          .from("pdf_documents")
          .insert({ title: doc.title, source: "seed", char_count: doc.body.length, chunk_count: 0 })
          .select("id")
          .single();
        if (docError) throw docError;
        const docId = (inserted as { id: number }).id;

        const { error: chunkError } = await client.from("pdf_chunks").insert(
          doc.chunks.map((content, i) => ({
            document_id: docId,
            chunk_index: i,
            content,
            token_count: estimateTokens(content),
            // Stringify so PostgREST hands pgvector its `[..]` text literal — a raw
            // array binds as a Postgres `{..}` and fails the vector cast.
            embedding: JSON.stringify(docVectors[i]),
            embedding_provider: providerHost,
            embedding_model: provider.model,
          })),
        );
        if (chunkError) throw chunkError;

        await client.from("pdf_documents").update({ chunk_count: doc.chunks.length }).eq("id", docId);
        seeded++;
        chunks += doc.chunks.length;
      } catch (e) {
        const message = (e as Error).message || String(e);
        console.error(`[seed-rag] failed to seed ${doc.file}:`, message);
        errorDetails.push({ file: doc.file, error: message });
      }
    }

    return json({
      seeded,
      chunks,
      errors: errorDetails.length,
      errorDetails,
      model: provider.model,
      provider: providerHost,
    });
  } catch (e) {
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});
