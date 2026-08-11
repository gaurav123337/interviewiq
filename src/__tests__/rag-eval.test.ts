/* Retrieval eval harness + grounding tests for the RAG pipeline.
   A golden set of query → expected-doc pairs asserts the hybrid re-ranker
   surfaces the right chunk even when distractors carry higher raw vector
   similarity — the regression guard for any future chunking/embedding change. */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CANDIDATE_POOL, GROUNDING_MIN_SIM, effectiveCandidatePool, effectiveGroundingMinSim,
  expandQuery, groundingPrompt, hybridScore, lexicalScore, ragTuningInfo,
  rerankHits, retrieveContext
} from "../services/rag";
import { setRemoteConfig } from "../services/remoteConfig";
import { ragHealthSummary, type RagHealthRow } from "../services/quality";
import { contentHash, sectionChunkText } from "../services/embeddings";
import { STORAGE_KEYS, storageGet, storageRemove } from "../services/storage";
import type { PdfHit } from "../services/admin";

/* ---------------- golden set: query → the chunk that should surface ---------------- */

const GOLDEN: { q: string; expected: string; distractors: { content: string; sim: number }[] }[] = [
  {
    q: "why do we memoize expensive functions",
    expected: "memoization caches the result of a pure function keyed by its arguments",
    distractors: [
      { content: "The profiler shows a flame graph of render time across components.", sim: 0.71 },
      { content: "Hoisting moves declarations to the top of their scope at parse time.", sim: 0.68 }
    ]
  },
  {
    q: "how does the event loop handle promises and timers",
    expected: "microtasks drain before the next macrotask; promise then callbacks run before setTimeout",
    distractors: [
      { content: "Call stacks in debuggers show the frames of the current function invocation.", sim: 0.69 },
      { content: "CSS animations run on the compositor thread.", sim: 0.55 }
    ]
  },
  {
    q: "what is the difference between REST and GraphQL",
    expected: "REST wins on caching and long-lived public APIs; GraphQL reduces over-fetching",
    distractors: [
      { content: "HTTP status codes communicate the result of a request.", sim: 0.66 },
      { content: "Websockets give bidirectional realtime streams.", sim: 0.6 }
    ]
  },
  {
    q: "how do closures capture variables",
    expected: "a closure captures the lexical scope so the function remembers variables after the outer call returns",
    distractors: [
      { content: "Hoisting moves declarations to the top of their scope at parse time.", sim: 0.68 },
      { content: "Promises chain asynchronous operations with then and catch.", sim: 0.57 }
    ]
  }
];

function candidatesFor(g: (typeof GOLDEN)[number]): PdfHit[] {
  return [
    { documentId: 1, content: g.expected, similarity: 0.6 },
    ...g.distractors.map((d, i) => ({ documentId: 100 + i, content: d.content, similarity: d.sim }))
  ];
}

describe("hybrid retrieval — golden set (retrieval@1)", () => {
  it.each(GOLDEN)("surfaces the right chunk for “$q” despite higher-sim distractors", (g) => {
    const hits = rerankHits(g.q, candidatesFor(g));
    expect(hits[0].content).toBe(g.expected);
  });

  it("ranks a lexical match above a raw-similarity-only distractor", () => {
    const q = "explain caching and cache invalidation";
    const relevant = { documentId: 1, content: "versioned cache keys and TTL expiry solve cache invalidation", similarity: 0.55 };
    const shiny = { documentId: 2, content: "recursive binary tree traversal in linear time", similarity: 0.78 };
    const [top] = rerankHits(q, [relevant, shiny]);
    expect(top.documentId).toBe(1);
  });
});

describe("grounding discipline", () => {
  it("flags hits below the similarity threshold as NOT grounded", () => {
    const hits = rerankHits("anything", [
      { documentId: 1, content: "weak overlap chunk", similarity: GROUNDING_MIN_SIM - 0.1 },
      { documentId: 2, content: "strong overlap chunk", similarity: GROUNDING_MIN_SIM + 0.1 }
    ]);
    expect(hits.find(h => h.documentId === 1)?.grounded).toBe(false);
    expect(hits.find(h => h.documentId === 2)?.grounded).toBe(true);
  });

  it("orders the strict prompt when grounded, the honest prompt when not", () => {
    const strict = groundingPrompt("sys", true, "REFERENCE HERE");
    expect(strict).toContain("Answer ONLY from this reference material");
    expect(strict).toContain("REFERENCE HERE");
    const honest = groundingPrompt("sys", false, "");
    expect(honest).toContain("no strong match");
    expect(honest).toContain("general knowledge");
    expect(honest).not.toContain("REFERENCE HERE");
  });

  it("query expansion adds concept-family synonyms", () => {
    const ex = expandQuery("how do closures work");
    expect(ex.toLowerCase()).toContain("lexical");
    const ex2 = expandQuery("caching strategy");
    expect(ex2.toLowerCase()).toContain("memoiz");
  });

  it("lexical scoring rewards concept families and shared stems", () => {
    expect(lexicalScore("closures and lexical scope", "a closure captures the lexical scope")).toBeGreaterThan(0);
    expect(lexicalScore("closures and lexical scope", "styling with flexbox grid")).toBe(0);
    expect(hybridScore("closures", "a closure captures scope", 0.5)).toBeGreaterThan(hybridScore("closures", "styling with flexbox grid", 0.6));
  });
});

/* ---------------- retrieveContext end-to-end (mocked cloud/KB) ---------------- */

vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  getSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ insert: async () => ({ error: { message: "not flushed in tests" } }) })
  })
}));

vi.mock("../services/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/admin")>();
  return {
    ...actual,
    searchPdfChunks: vi.fn().mockResolvedValue([
      { documentId: 1, content: "microtasks drain before the next macrotask in the event loop", similarity: 0.71 },
      { documentId: 1, content: "unrelated marketing copy about the product brand", similarity: 0.82 }
    ]),
    listPdfDocuments: vi.fn().mockResolvedValue([{ id: 1, title: "Event Loop Guide.pdf", source: "pdf-import", char_count: 10, chunk_count: 2, created_at: "2026-08-01T00:00:00Z" }])
  };
});

vi.mock("../services/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/embeddings")>();
  return { ...actual, embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]) };
});

afterEach(() => {
  vi.unstubAllGlobals();
  storageRemove(STORAGE_KEYS.eventOutbox);
});

describe("retrieveContext", () => {
  it("fetches a candidate pool, re-ranks hybrid, and queues a rag_event", async () => {
    const { searchPdfChunks } = await import("../services/admin");
    const result = await retrieveContext("how does the event loop handle promises");
    expect(result.checked).toBe(true);
    /* hybrid re-rank promotes the relevant chunk over the higher-sim distractor */
    expect(result.hits[0].content).toContain("microtasks");
    expect(result.hits[0].grounded).toBe(true);
    expect(searchPdfChunks).toHaveBeenCalledWith([0.1, 0.2, 0.3], CANDIDATE_POOL);
    /* health analytics queued offline-first */
    const outbox = storageGet<{ kind: string; meta: Record<string, unknown> }[]>(STORAGE_KEYS.eventOutbox, []);
    const ev = outbox.find(e => e.kind === "rag_event");
    expect(ev).toBeDefined();
    expect(ev!.meta.q).toContain("event loop");
    expect(ev!.meta.grounded).toBe(true);
    /* per-document attribution feeds the admin per-doc breakdown */
    const docs = ev!.meta.docs as { id: number; sim: number }[];
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every(d => typeof d.id === "number" && typeof d.sim === "number")).toBe(true);
  });
});

describe("RAG health summary", () => {
  const rows: RagHealthRow[] = [
    { query: "a", hits: 2, topSim: 0.7, grounded: true, at: "2026-08-01T00:00:00Z" },
    { query: "b", hits: 3, topSim: 0.6, grounded: true, at: "2026-08-01T00:00:00Z" },
    { query: "c", hits: 0, topSim: 0, grounded: false, at: "2026-08-01T00:00:00Z" }
  ];
  it("aggregates grounded rate, empty rate and avg top similarity", () => {
    const s = ragHealthSummary(rows);
    expect(s.total).toBe(3);
    expect(s.groundedRate).toBe(67);
    expect(s.emptyRate).toBe(33);
    expect(s.avgTopSim).toBeCloseTo(0.43, 1);
  });
  it("reclassifies the log against an explorer cutoff", () => {
    /* at 0.65 only the 0.7 query stays grounded */
    expect(ragHealthSummary(rows, 0.65).groundedRate).toBe(33);
    /* at 0.5 both non-empty queries ground */
    expect(ragHealthSummary(rows, 0.5).groundedRate).toBe(67);
  });
  it("is empty-safe", () => {
    expect(ragHealthSummary([])).toEqual({ total: 0, groundedRate: 0, emptyRate: 0, avgTopSim: 0 });
  });
});

describe("remote-tunable grounding", () => {
  afterEach(() => {
    setRemoteConfig({ rag: undefined });
  });
  it("falls back to the baked-in threshold and pool", () => {
    expect(effectiveGroundingMinSim()).toBe(GROUNDING_MIN_SIM);
    expect(effectiveCandidatePool()).toBe(CANDIDATE_POOL);
  });
  it("honors admin-published values without a deploy", () => {
    setRemoteConfig({ rag: { minSim: 0.62, candidatePool: 12 } });
    expect(effectiveGroundingMinSim()).toBe(0.62);
    expect(effectiveCandidatePool()).toBe(12);
    /* the user-facing tuning info reflects the same effective values */
    expect(ragTuningInfo()).toEqual({ minSim: 0.62, pool: 12 });
    /* rerankHits applies the cutoff passed in */
    const hits = rerankHits("anything", [
      { documentId: 1, content: "moderate match chunk", similarity: 0.55 },
      { documentId: 2, content: "strong match chunk", similarity: 0.7 }
    ], 4, 0.62);
    expect(hits.find(h => h.documentId === 1)?.grounded).toBe(false);
    expect(hits.find(h => h.documentId === 2)?.grounded).toBe(true);
  });
});

describe("section-aware chunking", () => {
  it("keeps markdown headings attached to their section and searchable", () => {
    const text = [
      "# Closures",
      "Closures capture lexical scope so functions remember variables.",
      "",
      "## Hoisting",
      "Hoisting moves declarations to the top of the scope."
    ].join("\n");
    const chunks = sectionChunkText(text, 2000, 100);
    expect(chunks.length).toBe(2);
    const closures = chunks.find(c => c.content.includes("Closures capture"))!;
    expect(closures.content).toContain("# Closures");
    expect(chunks.find(c => c.content.includes("Hoisting moves"))!.content).toContain("## Hoisting");
  });

  it("falls back gracefully on unstructured text", () => {
    const chunks = sectionChunkText("Just a plain run of sentences without any headings at all. " .repeat(20), 400, 60);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("contentHash is stable and distinct", () => {
    expect(contentHash("same text")).toBe(contentHash("same text"));
    expect(contentHash("same text")).not.toBe(contentHash("different text"));
    expect(contentHash("")).toBe(contentHash(""));
  });
});
