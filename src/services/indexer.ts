/* Incremental document re-indexing — shared by the Auto-fill upload flow and
   the admin bulk re-index action so both stay in sync.

   The core bet: unchanged chunks keep their embeddings. Given the old chunk
   rows of a document and the freshly chunked text, we diff by content hash,
   embed only the new/changed chunks, and replace the document's rows in one
   round-trip pair. Identical content short-circuits before touching the DB. */

import { changedChunkIndices, chunkText, contentHash, embed, sectionChunkText, type TextChunk } from "./embeddings";
import {
  deletePdfChunks, insertPdfChunks, listPdfChunks, setPdfChunkCount, type PdfChunkRow
} from "./admin";

/** Heading-aware chunking with a plain-text fallback — the single chunker
    entry point for everything that indexes documents. */
export function prepareChunks(text: string): TextChunk[] {
  const sectioned = sectionChunkText(text);
  return sectioned.length ? sectioned : chunkText(text);
}

export interface ReindexResult {
  /** New/changed chunk count (0 = document is identical — nothing was done). */
  changed: number;
  /** Chunks whose existing embeddings were reused. */
  reused: number;
  /** Chunks that needed a fresh embedding call. */
  fresh: number;
}

/** Diffs the document's existing chunks against the fresh text and replaces
    only what changed. `oldRows` may be preloaded to avoid a second read. */
export async function reindexDocument(
  docId: number,
  text: string,
  oldRows?: PdfChunkRow[]
): Promise<ReindexResult> {
  const chunks = prepareChunks(text);
  const rows = oldRows ?? await listPdfChunks(docId);
  const changedIdx = changedChunkIndices(rows.map(c => c.content), chunks.map(c => c.content));
  if (changedIdx.length === 0) {
    return { changed: 0, reused: chunks.length, fresh: 0 };
  }
  const vectors: number[][] = new Array(chunks.length);
  const oldByHash = new Map(rows.map(c => [contentHash(c.content), c.embedding]));
  const toEmbedIdx: number[] = [];
  chunks.forEach((c, i) => {
    const old = oldByHash.get(contentHash(c.content));
    if (old) vectors[i] = old;
    else toEmbedIdx.push(i);
  });
  let fresh = 0;
  if (toEmbedIdx.length) {
    const freshVectors = await embed(toEmbedIdx.map(i => chunks[i].content));
    toEmbedIdx.forEach((idx, k) => { vectors[idx] = freshVectors[k]; });
    fresh = toEmbedIdx.length;
  }
  await deletePdfChunks(docId);
  await insertPdfChunks(chunks.map((c, i) => ({
    documentId: docId, index: c.index, content: c.content, tokens: c.tokens, embedding: vectors[i]
  })));
  await setPdfChunkCount(docId, chunks.length);
  return { changed: changedIdx.length, reused: chunks.length - fresh, fresh };
}
