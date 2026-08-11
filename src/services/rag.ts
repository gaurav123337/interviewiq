/* RAG retrieval core — hybrid search + grounding discipline.
   Shared by the roadmap tutor (tutor.ts) and the AI-coach API mode
   (CoachChat.tsx) so both surfaces retrieve from the same knowledge base.

   Hybrid retrieval: the pgvector RPC returns the top-N vector candidates;
   we re-rank them client-side with a lexical component (concept families +
   significant-token overlap, with query expansion from family synonyms) so a
   chunk that uses different words for the same concept still surfaces.

   Grounding discipline: a chunk only counts as grounded above a similarity
   threshold; below it the caller tells the model the knowledge base had no
   strong match and to answer from general knowledge — no pretending — and the
   UI shows which state the answer came from (📚 grounded vs 🧠 general).

   Every retrieval attempt queues a rag_event so the admin Quality center can
   see which queries the knowledge base actually answers and how often it
   comes up empty. */

import { conceptOverlap, conceptSet, familyVocabulary, sigTokens } from "../coach/concepts";
import { getCloudState, getSupabaseClient } from "./cloud";
import { embed } from "./embeddings";
import { listPdfDocuments, searchPdfChunks, type PdfHit } from "./admin";
import { queueEvent } from "./events";
import { getRagDefaults } from "./remoteConfig";

export interface RagHit {
  documentId: number;
  content: string;
  /** Raw vector similarity (pgvector cosine). */
  similarity: number;
  /** Fused rank score (vector + lexical). */
  hybrid: number;
  /** True when the vector similarity clears the grounding threshold. */
  grounded: boolean;
}

/** Below this raw vector similarity a chunk is NOT cited as grounding — the
    answer comes from general knowledge and says so. */
export const GROUNDING_MIN_SIM = 0.45;
/** How many vector candidates to fetch before the client-side re-rank. */
export const CANDIDATE_POOL = 24;
/** Final number of citations handed to the model / UI. */
export const RANK_TOP_N = 4;
export const DEFAULT_TITLE = "Knowledge base";

/** Effective grounding threshold — admin-published remote value or baked-in. */
export function effectiveGroundingMinSim(): number {
  return getRagDefaults().minSim ?? GROUNDING_MIN_SIM;
}

/** Effective candidate pool — admin-published remote value or baked-in. */
export function effectiveCandidatePool(): number {
  return getRagDefaults().candidatePool ?? CANDIDATE_POOL;
}

/* ------------------------------------------------------------------ */
/* Pure scoring (unit-tested by the retrieval eval harness)            */
/* ------------------------------------------------------------------ */

/** Query expansion — append concept-family synonyms so the lexical scorer
    matches chunks that use different words for the same idea
    ("closures" also searches "lexical scope", "hoisting"). */
export function expandQuery(query: string): string {
  const base = String(query || "");
  const parts = [base];
  const seen = new Set<string>();
  let budget = 0;
  for (const fam of conceptSet(base)) {
    for (const w of familyVocabulary(fam)) {
      const low = w.toLowerCase();
      if (!seen.has(low) && !base.toLowerCase().includes(low)) {
        seen.add(low);
        parts.push(w);
        if (++budget >= 10) return parts.join(" ");
      }
    }
  }
  return parts.join(" ");
}

/** Lexical overlap between the expanded query and a chunk: significant-token
    hits + concept-family hits, normalized to ~[0,1]. */
export function lexicalScore(query: string, content: string): number {
  const qt = sigTokens(query);
  const ct = sigTokens(content);
  let tokens = 0;
  for (const t of qt) if (ct.has(t)) tokens++;
  const fams = conceptOverlap(query, content);
  return Math.min(1, (tokens + 2 * fams) / 6);
}

/** Fused score — vector similarity is the anchor, lexical overlap breaks ties. */
export function hybridScore(query: string, content: string, similarity: number): number {
  return 0.6 * similarity + 0.4 * lexicalScore(query, content);
}

/** Re-ranks the raw vector candidates by the hybrid score, keeping the top N.
    `minSim` is the grounding cutoff (defaults to the baked-in threshold). */
export function rerankHits(query: string, hits: PdfHit[], topN = RANK_TOP_N, minSim = GROUNDING_MIN_SIM): RagHit[] {
  const expanded = expandQuery(query);
  return hits
    .map(h => ({ ...h, hybrid: hybridScore(expanded, h.content, h.similarity) }))
    .sort((a, b) => b.hybrid - a.hybrid)
    .slice(0, topN)
    .map(h => ({
      documentId: h.documentId,
      content: h.content,
      similarity: h.similarity,
      hybrid: h.hybrid,
      grounded: h.similarity >= minSim
    }));
}

/* ------------------------------------------------------------------ */
/* Prompt building (strict when grounded, honest when not)             */
/* ------------------------------------------------------------------ */

/** Appends the grounding instructions to a system prompt.
    grounded → answer ONLY from the reference material; otherwise → answer
    from general knowledge and say so, never pretending the KB covers it. */
export function groundingPrompt(sys: string, grounded: boolean, context: string): string {
  if (grounded) {
    return (
      sys +
      "\n\nYou have reference material from the product knowledge base below. Answer ONLY from this " +
      "reference material when it covers the question — quote or paraphrase it accurately. If the material " +
      "doesn't cover the question, say so plainly and give your best general answer. Never invent a detail " +
      "and attribute it to the knowledge base; never claim the reference says what it doesn't.\n\n" +
      context
    );
  }
  return (
    sys +
    "\n\nRetrieval found no strong match in the product knowledge base for this question. " +
    "Answer from your general knowledge and say so plainly — do not pretend the knowledge base covers it."
  );
}

/* ------------------------------------------------------------------ */
/* Retrieval + health analytics                                        */
/* ------------------------------------------------------------------ */

export interface RetrievalResult {
  hits: RagHit[];
  /** True when retrieval was actually attempted (signed in + key). */
  checked: boolean;
}

/** Retrieves and re-ranks the top knowledge-base chunks for a query.
    Best-effort: any failure returns empty hits (grounding never breaks a chat). */
export async function retrieveContext(query: string): Promise<RetrievalResult> {
  try {
    const client = await getSupabaseClient();
    if (!client || !getCloudState().user) return { hits: [], checked: false };
    const qv = await embed([query]);
    if (!qv[0]?.length) return { hits: [], checked: true };
    const raw = await searchPdfChunks(qv[0], effectiveCandidatePool());
    const hits = rerankHits(query, raw, RANK_TOP_N, effectiveGroundingMinSim());
    queueEvent("rag_event", {
      q: String(query).slice(0, 200),
      hits: hits.length,
      topSim: hits.length ? Math.round(hits[0].similarity * 100) / 100 : 0,
      grounded: hits.some(h => h.grounded),
      checked: true
    });
    return { hits, checked: true };
  } catch {
    return { hits: [], checked: true }; /* grounding must never break the tutor */
  }
}

/** Fetches document titles for citation chips (one round-trip per reply). */
export async function documentTitles(): Promise<Map<number, string>> {
  const docs = await listPdfDocuments().catch(() => []);
  return new Map(docs.map(d => [d.id, d.title]));
}
