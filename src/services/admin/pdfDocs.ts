/* RAG knowledge base — indexed PDF documents + vector search. */

import { getSupabaseClient } from "../cloud";

export interface PdfDocumentRow {
  id: number;
  title: string;
  source: string;
  char_count: number;
  chunk_count: number;
  created_at: string;
}

/** Indexed knowledge-base documents (public read — they feed every user's tutor). */
export async function listPdfDocuments(): Promise<PdfDocumentRow[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("pdf_documents")
    .select("id, title, source, char_count, chunk_count, created_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as PdfDocumentRow[];
}

/** Registers a document and returns its id. */
export async function createPdfDocument(input: { title: string; source?: string; charCount: number }): Promise<number> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.from("pdf_documents")
    .insert({ title: input.title, source: input.source ?? "", char_count: input.charCount, chunk_count: 0 })
    .select("id").single();
  if (error) throw new Error(error.message);
  return (data as { id: number }).id;
}

/** Stores embedded chunks for a document. `meta` stamps the embedding provider
    host + model onto each chunk so match_pdf_chunks' p_model filter can scope
    retrieval to this vector space — without it these chunks get a NULL model and
    are invisible to model-scoped queries. Omitted (legacy callers) → unstamped. */
export async function insertPdfChunks(rows: {
  documentId: number; index: number; content: string; tokens: number; embedding: number[];
}[], meta?: { provider?: string; model?: string }): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("pdf_chunks").insert(
    rows.map(r => ({
      document_id: r.documentId,
      chunk_index: r.index,
      content: r.content,
      token_count: r.tokens,
      embedding: r.embedding,
      ...(meta?.provider ? { embedding_provider: meta.provider } : {}),
      ...(meta?.model ? { embedding_model: meta.model } : {}),
    }))
  );
  if (error) throw new Error(error.message);
}

/** Updates a document's chunk count after indexing. */
export async function setPdfChunkCount(id: number, count: number): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;
  await client.from("pdf_documents").update({ chunk_count: count }).eq("id", id);
}

/** Removes a document and its chunks (cascade). */
export async function deletePdfDocument(id: number): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("pdf_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface PdfChunkRow {
  chunkIndex: number;
  content: string;
  embedding: number[];
}

/** The indexed chunks of one document. */
export async function listPdfChunks(documentId: number): Promise<PdfChunkRow[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("pdf_chunks")
    .select("chunk_index, content, embedding")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });
  if (error) return [];
  return ((data ?? []) as { chunk_index: number; content: string; embedding: number[] }[])
    .map(d => ({ chunkIndex: d.chunk_index, content: d.content, embedding: d.embedding }));
}

/** Removes a document's chunks without removing the document. */
export async function deletePdfChunks(documentId: number): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;
  await client.from("pdf_chunks").delete().eq("document_id", documentId);
}

/** Updates document metadata. */
export async function updatePdfDocument(id: number, patch: { charCount?: number }): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;
  const row: Record<string, unknown> = {};
  if (patch.charCount !== undefined) row.char_count = patch.charCount;
  await client.from("pdf_documents").update(row).eq("id", id);
}

export interface PdfHit {
  documentId: number;
  content: string;
  similarity: number;
}

/** Vector search over the knowledge base — the RAG retrieval step. When `model`
    is given it scopes results to chunks embedded by that model (match_pdf_chunks'
    p_model filter), so a query vector is never compared against chunks from a
    different embedding space. Omitted → no filter (back-compatible with the 2-arg
    RPC on installs that predate the model column). */
export async function searchPdfChunks(embedding: number[], matchCount = 4, model?: string): Promise<PdfHit[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const args: Record<string, unknown> = { query_embedding: embedding, match_count: matchCount };
  if (model) args.p_model = model;
  const { data, error } = await client.rpc("match_pdf_chunks", args);
  if (error || !data) return [];
  return (data as { document_id: number; content: string; similarity: number }[])
    .map(d => ({ documentId: d.document_id, content: d.content, similarity: d.similarity }));
}
