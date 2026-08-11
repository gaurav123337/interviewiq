/* Embeddings for the RAG pipeline — turns uploaded documents into searchable
   vectors (stored in pdf_chunks) and queries into retrieval vectors.
   Reuses the same OpenAI-compatible key/base as chat, with a separate model
   (the admin can push a suggested one remotely via app_config → ai). */

import { getSettings } from "../ai";
import { getAiDefaults } from "./remoteConfig";

export const DEFAULT_EMBED_MODEL = "text-embedding-3-small";

/** Embeddings model (remote override → local default). Must match the
    vector(1536) column, so prefer 1536-dim models (e.g. text-embedding-3-small). */
export function embedModel(): string {
  return getAiDefaults().embeddingsModel || DEFAULT_EMBED_MODEL;
}

/** Rough token estimate (chars / 4) for chunk sizing and display. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.replace(/\s+/g, " ").length / 4);
}

export interface TextChunk {
  index: number;
  content: string;
  tokens: number;
}

/** Splits long text into overlapping chunks, preferring sentence boundaries. */
export function chunkText(text: string, chunkChars = 2400, overlap = 240): TextChunk[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const chunks: TextChunk[] = [];
  let start = 0;
  let i = 0;
  while (start < normalized.length) {
    let end = Math.min(start + chunkChars, normalized.length);
    /* back off to a sentence boundary when the chunk ends mid-sentence */
    if (end < normalized.length) {
      const window = normalized.slice(Math.max(0, end - 160), end);
      const lastBreak = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("\n"));
      if (lastBreak > 80) end = end - 160 + lastBreak + 1;
    }
    const content = normalized.slice(start, end).trim();
    if (content) chunks.push({ index: i++, content, tokens: estimateTokens(content) });
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

/** Section-aware chunking for structured documents. Splits the text at
    heading lines (markdown `## Title` or numbered titles like `3.2 Caching`),
    keeps the heading attached to its section body, then runs the regular
    sentence-boundary chunker per section — so a question and its answer under
    one heading stay in the same chunk, and the heading text is searchable.
    Unstructured text degrades gracefully to plain chunkText. */
export function sectionChunkText(text: string, chunkChars = 2400, overlap = 240): TextChunk[] {
  const raw = String(text || "");
  if (!raw.trim()) return [];
  /* split before lines that look like headings (markdown or numbered titles) */
  const parts = raw.split(/(?=^\s*(?:#{1,6}\s+[^\n]{2,90}|\d{1,2}(?:\.\d{1,2}){0,2}[.)]?\s+[A-Z][A-Za-z0-9 &/()'-]{3,60})\s*$)/m);
  const chunks: TextChunk[] = [];
  let idx = 0;
  for (const part of parts) {
    if (!part.trim()) continue;
    for (const c of chunkText(part, chunkChars, overlap)) {
      chunks.push({ index: idx++, content: c.content, tokens: c.tokens });
    }
  }
  return chunks;
}

/** Cheap stable hash for re-upload dedupe (identical docs skip re-indexing). */
export function contentHash(text: string): string {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Which NEW chunks changed vs the document's old chunks (by content hash).
    Returns indices of new chunks that need a fresh embedding — unchanged
    chunks can reuse their existing vectors, so a small edit to a big PDF
    re-embeds only the affected parts. */
export function changedChunkIndices(oldContents: string[], newContents: string[]): number[] {
  const oldHashes = new Set(oldContents.map(contentHash));
  const out: number[] = [];
  for (let i = 0; i < newContents.length; i++) {
    if (!oldHashes.has(contentHash(newContents[i]))) out.push(i);
  }
  return out;
}

/** Generates embeddings for a batch of texts via the OpenAI-compatible /embeddings endpoint. */
export async function embed(texts: string[]): Promise<number[][]> {
  const s = getSettings();
  if (!s.key) throw new Error("No API key configured");
  const res = await fetch(s.base + "/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.key },
    body: JSON.stringify({ model: embedModel(), input: texts })
  });
  if (!res.ok) {
    let msg = "Embeddings request failed (" + res.status + ")";
    try { const j = await res.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const j = await res.json();
  const out: number[][] = ((j.data ?? []) as { embedding?: number[] }[]).map(d => d.embedding ?? []);
  if (out.length !== texts.length) throw new Error("Embeddings response count mismatch");
  return out;
}
