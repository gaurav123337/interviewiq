import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerGoal } from "../types";

/* Item 20 (Phase 3) — load-bearing path: a REAL RAG round-trip.
   index → embed → store → query → retrieve → re-rank → ground.

   Existing RAG tests each mock ONE seam: withGrounding.test mocks retrieveContext;
   tutor-grounding.test hands searchPdfChunks a canned hit; rag-eval drives the pure
   scorers over a fixture. NONE proves the chunks a document is indexed with are the
   same vectors retrieval later ranks. This suite closes that gap with a genuine
   chain: reindexDocument runs the REAL chunker + contentHash diff, a deterministic
   bag-of-words embedder turns text→vector, an in-memory Supabase fake stores the
   rows, and its match_pdf_chunks RPC computes REAL cosine over those stored vectors.
   So a query about React ranks the React doc #1 and grounds; an off-vocabulary query
   retrieves the same rows but clears no threshold and honestly does NOT ground.

   Determinism (no clock/network): the embedder is a fixed 12-word vocabulary count
   vector; cosine is computed in-test. The frozen model literal "text-embedding-3-small"
   is reused verbatim (never mutated — that invariant lives in rag-eval/embeddings).
   Only embed()/embedQuery()/embedModel()/embedProviderHost() are swapped; chunkText,
   sectionChunkText, contentHash and changedChunkIndices stay REAL via importActual. */

const H = vi.hoisted(() => {
  // A tiny fixed vocabulary; each text embeds to per-word occurrence counts.
  const VOCAB = [
    "react", "hooks", "state", "component",
    "kubernetes", "pod", "cluster", "container",
    "garbage", "collector", "memory", "heap",
  ];
  const vec = (text: string): number[] => {
    const t = String(text).toLowerCase();
    return VOCAB.map(w => (t.match(new RegExp(`\\b${w}\\b`, "g")) || []).length);
  };
  const cosine = (a: number[], b: number[]): number => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  };
  return { VOCAB, vec, cosine };
});

const MODEL = "text-embedding-3-small";

vi.mock("../services/embeddings", async (orig) => {
  const actual = await orig<typeof import("../services/embeddings")>();
  return {
    ...actual, // real chunkText / sectionChunkText / contentHash / changedChunkIndices
    embed: vi.fn(async (texts: string[]) => texts.map(H.vec)),
    embedQuery: vi.fn(async (text: string) => ({ vector: H.vec(text), model: MODEL })),
    embedModel: () => MODEL,
    embedProviderHost: () => "test-host",
  };
});

vi.mock("../ai", () => ({
  chat: vi.fn(async () => "MODEL_REPLY"),
  getSettings: () => ({ base: "https://api.openai.com/v1", key: "test-key" }),
}));

// tutorChat's daily-quota guard — keep it open and side-effect-free.
vi.mock("../services/entitlements", () => ({
  isPaywallEnabled: () => false,
  aiCallsLeft: () => 999,
  recordAiCall: vi.fn(),
}));

// In-memory Supabase fake: stores pdf_chunks/pdf_documents rows and computes REAL
// cosine in match_pdf_chunks. getCloudState reports a signed-in user so
// retrieveContext actually attempts retrieval.
const kb = vi.hoisted(() => ({ current: null as ReturnType<typeof makeKb> | null }));

vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn(async () => kb.current),
  getCloudState: () => ({ user: { id: "u1" }, configured: true, syncing: false, error: null, oauth: [] }),
  cloudFnHeaders: async () => ({}),
}));

import { chat } from "../ai";
import { embedQuery } from "../services/embeddings";
import { reindexDocument } from "../services/indexer";
import { retrieveContext } from "../services/rag";
import { withGrounding, tutorChat } from "../services/tutor";

const chatMock = vi.mocked(chat);
const embedQueryMock = vi.mocked(embedQuery);

interface ChunkRow {
  document_id: number;
  chunk_index: number;
  content: string;
  token_count: number;
  embedding: number[];
  embedding_provider?: string;
  embedding_model?: string;
}

/** A minimal stateful Supabase double covering exactly the calls pdfDocs.ts makes:
    from("pdf_chunks").select().eq().order() / .insert() / .delete().eq();
    from("pdf_documents").select().order() / .update().eq();
    rpc("match_pdf_chunks", { query_embedding, match_count, p_model? }). */
function makeKb() {
  const chunks: ChunkRow[] = [];
  const documents = [
    { id: 1, title: "React Guide", source: "test", char_count: 0, chunk_count: 0, created_at: "2026-01-01T00:00:00Z" },
    { id: 2, title: "Kubernetes Guide", source: "test", char_count: 0, chunk_count: 0, created_at: "2026-01-02T00:00:00Z" },
  ];

  const from = (table: string) => {
    let op: "select" | "insert" | "update" | "delete" | null = null;
    let payload: unknown = null;
    const filters: Record<string, unknown> = {};
    const b: Record<string, unknown> = {
      select() { op = op ?? "select"; return b; },
      insert(rows: unknown) { op = "insert"; payload = rows; return b; },
      update(row: unknown) { op = "update"; payload = row; return b; },
      delete() { op = "delete"; return b; },
      eq(col: string, val: unknown) { filters[col] = val; return b; },
      order() { return b; },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve().then(run).then(resolve, reject);
      },
    };
    function run() {
      if (table === "pdf_chunks") {
        if (op === "select") {
          const rows = chunks
            .filter(c => c.document_id === filters.document_id)
            .sort((a, b) => a.chunk_index - b.chunk_index)
            .map(c => ({ chunk_index: c.chunk_index, content: c.content, embedding: c.embedding }));
          return { data: rows, error: null };
        }
        if (op === "insert") { (payload as ChunkRow[]).forEach(r => chunks.push(r)); return { error: null }; }
        if (op === "delete") {
          for (let i = chunks.length - 1; i >= 0; i--) {
            if (chunks[i].document_id === filters.document_id) chunks.splice(i, 1);
          }
          return { error: null };
        }
      }
      if (table === "pdf_documents") {
        if (op === "select") return { data: documents, error: null };
        if (op === "update") {
          const d = documents.find(x => x.id === filters.id);
          if (d) Object.assign(d, payload);
          return { error: null };
        }
      }
      return { data: null, error: null };
    }
    return b;
  };

  const rpc = async (name: string, args: Record<string, unknown>) => {
    if (name !== "match_pdf_chunks") return { data: [], error: null };
    const qv = args.query_embedding as number[];
    const model = args.p_model as string | undefined;
    const k = (args.match_count as number) ?? 4;
    const data = chunks
      .filter(c => !model || c.embedding_model === model)
      .map(c => ({ document_id: c.document_id, content: c.content, similarity: H.cosine(qv, c.embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
    return { data, error: null };
  };

  return { chunks, documents, from, rpc } as unknown as {
    chunks: ChunkRow[]; documents: typeof documents;
    from: typeof from; rpc: typeof rpc;
  };
}

const REACT_DOC =
  "React hooks manage component state. The useState primitive stores state inside a " +
  "function component, and React re-renders that component whenever its state changes.";
const K8S_DOC =
  "Kubernetes schedules a pod onto a node in the cluster. Each pod runs at least one " +
  "container, and the cluster continuously reconciles container placement across nodes.";

const goal: CareerGoal = {
  currentLevel: "mid", targetLevel: "senior", fieldId: "frontend", companyId: "general",
  targetDate: "2099-01-01", hoursPerWeek: 5, createdAt: 1,
};

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  chatMock.mockResolvedValue("MODEL_REPLY");
  embedQueryMock.mockImplementation(async (text: string) => ({ vector: H.vec(text), model: MODEL }));
  kb.current = makeKb();
  // Index both documents through the REAL chunker + embed pipeline.
  await reindexDocument(1, REACT_DOC);
  await reindexDocument(2, K8S_DOC);
});

describe("reindexDocument — incremental indexing", () => {
  it("embeds and stores fresh chunks on first index, and stamps the model", () => {
    // beforeEach already indexed both docs.
    expect(kb.current!.chunks.length).toBeGreaterThanOrEqual(2);
    expect(kb.current!.chunks.every(c => c.embedding_model === MODEL)).toBe(true);
    expect(kb.current!.chunks.every(c => c.embedding.length === H.VOCAB.length)).toBe(true);
  });

  it("is a no-op when the text is unchanged (contentHash diff → 0 changed)", async () => {
    const res = await reindexDocument(1, REACT_DOC);
    expect(res.changed).toBe(0);
    expect(res.fresh).toBe(0);
  });

  it("re-embeds only when the text actually changes", async () => {
    const res = await reindexDocument(1, REACT_DOC + " Effects run after render via useEffect.");
    expect(res.changed).toBeGreaterThan(0);
    expect(res.fresh).toBeGreaterThan(0);
  });
});

describe("retrieveContext — real cosine over stored vectors", () => {
  it("ranks the topically-matching document #1 first and grounds it", async () => {
    const { hits, checked } = await retrieveContext("react hooks and component state");
    expect(checked).toBe(true);
    expect(hits[0].documentId).toBe(1);
    expect(hits[0].similarity).toBeGreaterThan(0.45);
    expect(hits[0].grounded).toBe(true);
  });

  it("ranks the other document first for a disjoint-vocabulary query", async () => {
    const { hits } = await retrieveContext("kubernetes pod and cluster container scheduling");
    expect(hits[0].documentId).toBe(2);
    expect(hits[0].grounded).toBe(true);
  });

  it("retrieves but does NOT ground an off-vocabulary query (honest miss)", async () => {
    const { hits, checked } = await retrieveContext("quarterly budget planning spreadsheet");
    expect(checked).toBe(true); // we DID look…
    expect(hits.every(h => !h.grounded)).toBe(true); // …and honestly found no strong match
  });

  it("finds nothing when the query vector's model doesn't match the indexed space", async () => {
    // Model-scoping invariant: a query embedded by a different model must not be
    // ranked against chunks from another embedding space.
    embedQueryMock.mockResolvedValueOnce({ vector: H.vec("react hooks state"), model: "other-embed-model" });
    const { hits } = await retrieveContext("react hooks state");
    expect(hits).toEqual([]);
  });
});

describe("withGrounding — end-to-end grounding decision", () => {
  it("injects the retrieved chunk into the system prompt and cites its source", async () => {
    const r = await withGrounding("SYS", "how do react hooks track component state");
    expect(r.grounded).toBe(true);
    expect(r.citations.map(c => c.documentId)).toContain(1);
    expect(r.citations[0].title).toBe("React Guide");
    expect(r.sys).toContain("React hooks manage component state");
    expect(r.sys.toLowerCase()).toContain("knowledge base");
  });

  it("cites nothing and stays honest when no chunk clears the threshold", async () => {
    const r = await withGrounding("SYS", "quarterly budget planning spreadsheet");
    expect(r.grounded).toBe(false);
    expect(r.citations).toEqual([]);
  });
});

describe("tutorChat — grounded context reaches the model", () => {
  it("passes the retrieved chunk to chat and returns the citation", async () => {
    const reply = await tutorChat("how do react hooks track component state", goal, [
      { role: "user", content: "how do react hooks track component state" },
    ]);
    expect(reply.text).toBe("MODEL_REPLY");
    expect(reply.grounded).toBe(true);
    expect(reply.citations.map(c => c.documentId)).toContain(1);
    // The system prompt handed to the model carries the grounded excerpt.
    const msgs = chatMock.mock.calls[0][0] as { role: string; content: string }[];
    expect(msgs[0].content).toContain("React hooks manage component state");
  });
});
