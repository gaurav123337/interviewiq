/* RAG knowledge-base seeding — triggers the server-side seed-rag edge function,
   which embeds the in-repo starter corpus with the shared, server-configured
   embeddings provider and writes source='seed' pdf_documents + pdf_chunks.

   Admin-only (the function enforces requireAdmin server-side). No service-role key
   and no embeddings key ever reach the client bundle — that is the whole reason this
   runs as an edge function instead of a browser-side bulk embed. */

import { CONFIG } from "../../config";
import { cloudFnHeaders } from "../cloud";

export interface SeedResult {
  /** Number of seed documents written. */
  seeded: number;
  /** Total chunks embedded and inserted across those documents. */
  chunks: number;
  /** Documents that failed to write (embedding already succeeded for all). */
  errors: number;
  errorDetails: { file: string; error: string }[];
  /** Embedding model stamped on the chunks (must match retrieval's p_model). */
  model: string;
  /** Embedding provider host stamped on the chunks. */
  provider: string;
}

/** Seeds (or re-seeds) the RAG starter corpus via the seed-rag edge function.
    Throws with the function's error message on any non-2xx — notably a 503 when the
    embeddings provider isn't configured — so the caller can surface it to the admin. */
export async function seedKnowledgeBase(): Promise<SeedResult> {
  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/seed-rag`, {
    method: "POST",
    headers: await cloudFnHeaders(),
    body: "{}",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `Seed failed (${res.status})`);
  }
  return body as SeedResult;
}
