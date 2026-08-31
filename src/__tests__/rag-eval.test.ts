/* Retrieval eval harness + grounding tests for the RAG pipeline.
   A golden set of query → expected-doc pairs asserts the hybrid re-ranker
   surfaces the right chunk even when distractors carry higher raw vector
   similarity — the regression guard for any future chunking/embedding change. */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CANDIDATE_POOL, GROUNDING_HARD_FLOOR, GROUNDING_MIN_SIM, effectiveCandidatePool,
  effectiveGroundingMinSim, effectiveHardFloor, expandQuery, gateStats, getRagDigestOpts, groundingPrompt,
  hybridScore, isGrounded, lexicalScore, lexicalSearch, ragTuningInfo, rerankHits, retrieveContext
} from "../services/rag";
import { setRemoteConfig } from "../services/remoteConfig";
import {
  bestTuningCell, evaluateRagDigest, ragHealthSummary, ragHistogram, simulateTuning, suggestHardFloor,
  type RagHealthRow, type RagWeeklyDigest
} from "../services/quality";
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
    const hits = rerankHits("caching", [
      { documentId: 1, content: "styling with flexbox and grid", similarity: GROUNDING_MIN_SIM - 0.1 },
      { documentId: 2, content: "versioned cache keys with ttl expiry", similarity: GROUNDING_MIN_SIM + 0.1 }
    ]);
    expect(hits.find(h => h.documentId === 1)?.grounded).toBe(false);
    expect(hits.find(h => h.documentId === 2)?.grounded).toBe(true);
  });

  it("concept gate: same-domain chunks aren't cited without shared concepts", () => {
    const hits = rerankHits("closures", [
      { documentId: 1, content: "marketing copy about the product brand identity", similarity: 0.8 },
      { documentId: 2, content: "a closure captures lexical scope so functions remember variables", similarity: 0.6 }
    ]);
    expect(hits.find(h => h.documentId === 1)?.grounded).toBe(false);
    expect(hits.find(h => h.documentId === 2)?.grounded).toBe(true);
  });

  it("very close matches are cited even without lexical overlap", () => {
    const hits = rerankHits("closures", [
      { documentId: 1, content: "unrelated but semantically near prose", similarity: GROUNDING_HARD_FLOOR + 0.01 }
    ]);
    expect(hits[0].grounded).toBe(true);
  });

  it("isGrounded is a pure function of similarity + lexical signal", () => {
    expect(isGrounded(0.5, 0)).toBe(false);
    expect(isGrounded(0.5, 0.1)).toBe(true);
    expect(isGrounded(GROUNDING_HARD_FLOOR, 0)).toBe(true);
    expect(isGrounded(GROUNDING_MIN_SIM - 0.05, 0.9)).toBe(false);
  });

  it("gateStats classifies candidates for the rejection analytics", () => {
    const q = expandQuery("closures");
    const s = gateStats([
      { documentId: 1, content: "a closure captures lexical scope", similarity: 0.6 },
      { documentId: 2, content: "marketing copy about the product brand", similarity: 0.8 },
      { documentId: 3, content: "totally unrelated prose", similarity: 0.3 }
    ], q);
    expect(s).toEqual({ groundedCount: 1, gateRejects: 1, belowMin: 1 });
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

const cloudRpc = vi.hoisted(() => vi.fn().mockImplementation((name: string) => {
  if (name === "search_pdf_chunks_lex") {
    return Promise.resolve({
      data: [
        { document_id: 1, content: "a closure captures lexical scope so functions remember variables", score: 2 },
        { document_id: 1, content: "promise then callbacks drain before the next timer", score: 1 }
      ],
      error: null
    });
  }
  return Promise.resolve({ data: null, error: null });
}));

vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  getSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ insert: async () => ({ error: { message: "not flushed in tests" } }) }),
    rpc: cloudRpc
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
  /* retrieveContext resolves the query vector via embedQuery; override it too
     (the real one would take the cloud-proxy branch here, since no key is set,
     and this mock provides no cloudFnHeaders). embedQuery returns a single
     number[], not embed()'s number[][]. */
  return {
    ...actual,
    embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
  };
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
    /* the concept gate's rejections are tracked for admin tuning */
    expect(ev!.meta.gateRejects).toBe(1); /* the 0.82-sim marketing distractor */
    expect(ev!.meta.belowMin).toBe(0);
    /* per-document attribution feeds the admin per-doc breakdown */
    const docs = ev!.meta.docs as { id: number; sim: number }[];
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every(d => typeof d.id === "number" && typeof d.sim === "number")).toBe(true);
  });

  it("records the field/level context and per-candidate lexical signal", async () => {
    await retrieveContext("how does the event loop handle promises", { field: "frontend", level: "senior" });
    const outbox = storageGet<{ kind: string; meta: Record<string, unknown> }[]>(STORAGE_KEYS.eventOutbox, []);
    const ev = outbox.find(e => e.kind === "rag_event");
    expect(ev).toBeDefined();
    /* the per-domain breakdown aggregates on these */
    expect(ev!.meta.field).toBe("frontend");
    expect(ev!.meta.level).toBe("senior");
    /* every candidate carries its lexical score so simulateTuning is exact */
    const cands = ev!.meta.cands as { s: number; st: number; lx: number }[];
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.every(c => typeof c.s === "number" && typeof c.lx === "number" && [0, 1, 2].includes(c.st))).toBe(true);
  });
});

describe("lexicalSearch (keyless offline-coach fallback)", () => {
  it("filters query terms, calls the RPC, and returns hits with doc attribution", async () => {
    const hits = await lexicalSearch("how do closures capture variables");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].content).toContain("closure");
    expect(cloudRpc).toHaveBeenCalledWith("search_pdf_chunks_lex", expect.objectContaining({ match_count: 4 }));
    const terms = cloudRpc.mock.calls[0][1].terms as string[];
    expect(terms).toContain("closure");
    expect(terms.length).toBeLessThanOrEqual(8);
    /* the keyless path still feeds per-document analytics */
    const outbox = storageGet<{ kind: string; meta: Record<string, unknown> }[]>(STORAGE_KEYS.eventOutbox, []);
    const ev = outbox.find(e => e.kind === "rag_event");
    expect(ev).toBeDefined();
    expect((ev!.meta.docs as { id: number }[]).every(d => d.id === 1)).toBe(true);
  });

  it("tags the keyless path with field/level context too", async () => {
    await lexicalSearch("how do closures capture variables", 4, { field: "backend", level: "junior" });
    const outbox = storageGet<{ kind: string; meta: Record<string, unknown> }[]>(STORAGE_KEYS.eventOutbox, []);
    const ev = outbox.find(e => e.kind === "rag_event");
    expect(ev).toBeDefined();
    expect(ev!.meta.field).toBe("backend");
    expect(ev!.meta.level).toBe("junior");
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
  it("buckets the log into similarity bands for the gate histogram", () => {
    const hist = ragHistogram(rows);
    expect(hist.length).toBe(5);
    /* 0.7 and 0.6 land in the 0.50–0.65 / 0.65–0.80 bands; 0 is empty-hit */
    const mid = hist.find(b => b.label === "0.65–0.80")!;
    expect(mid.total).toBe(1);
    expect(mid.grounded).toBe(1);
    expect(hist.find(b => b.label === "< 0.35")!.total).toBe(1);
    expect(hist.find(b => b.label === "≥ 0.80")!.total).toBe(0);
  });
  it("histogram respects the explorer cutoff and flags gated rows", () => {
    const gated = ragHistogram([
      { query: "x", hits: 3, topSim: 0.7, grounded: true, gateRejects: 2, at: "2026-08-01T00:00:00Z" }
    ], 0.65);
    const band = gated.find(b => b.label === "0.65–0.80")!;
    expect(band.grounded).toBe(1);
    expect(band.gated).toBe(1);
    const dropped = ragHistogram([
      { query: "y", hits: 2, topSim: 0.7, grounded: true, at: "2026-08-01T00:00:00Z" }
    ], 0.85);
    expect(dropped.find(b => b.label === "0.65–0.80")!.grounded).toBe(0);
  });
});

describe("remote-tunable grounding", () => {
  afterEach(() => {
    setRemoteConfig({ rag: undefined });
  });
  it("falls back to the baked-in threshold, pool and hard floor", () => {
    expect(effectiveGroundingMinSim()).toBe(GROUNDING_MIN_SIM);
    expect(effectiveCandidatePool()).toBe(CANDIDATE_POOL);
    expect(effectiveHardFloor()).toBe(GROUNDING_HARD_FLOOR);
  });
  it("honors admin-published values without a deploy", () => {
    setRemoteConfig({ rag: { minSim: 0.62, candidatePool: 12, hardFloor: 0.9 } });
    expect(effectiveGroundingMinSim()).toBe(0.62);
    expect(effectiveCandidatePool()).toBe(12);
    expect(effectiveHardFloor()).toBe(0.9);
    /* the user-facing tuning info reflects the same effective values */
    expect(ragTuningInfo()).toEqual({ minSim: 0.62, pool: 12, hardFloor: 0.9 });
    /* the configurable hard floor changes the concept-free citation escape hatch */
    expect(isGrounded(0.88, 0, 0.62, 0.9)).toBe(false);
    expect(isGrounded(0.88, 0, 0.62, 0.85)).toBe(true);
    /* rerankHits applies the cutoff passed in */
    const hits = rerankHits("caching", [
      { documentId: 1, content: "styling with flexbox grid", similarity: 0.55 },
      { documentId: 2, content: "versioned cache keys and ttl expiry solve invalidation", similarity: 0.7 }
    ], 4, 0.62);
    expect(hits.find(h => h.documentId === 1)?.grounded).toBe(false);
    expect(hits.find(h => h.documentId === 2)?.grounded).toBe(true);
  });
});

describe("weekly RAG digest alerts", () => {
  const digest: RagWeeklyDigest = {
    total: 20, grounded: 8, empty: 9, avgTopSim: 0.4, gateRejects: 12,
    prevTotal: 20, prevGrounded: 15, topQueries: [], topDocs: []
  };
  it("fires on grounded-rate breach with defaults", () => {
    const alerts = evaluateRagDigest(digest);
    expect(alerts.filter(a => a.fired).map(a => a.title)).toEqual(["Grounded rate dropped", "Empty-hit rate high", "Concept-gate rejects spiked"]);
  });
  it("reports healthy checks as non-firing", () => {
    const healthy: RagWeeklyDigest = { ...digest, total: 20, grounded: 18, empty: 2, gateRejects: 1 };
    const alerts = evaluateRagDigest(healthy);
    expect(alerts.every(a => !a.fired)).toBe(true);
    expect(alerts.map(a => a.title)).toEqual(["Grounded rate healthy"]);
  });
  it("honors custom thresholds", () => {
    const alerts = evaluateRagDigest({ ...digest, grounded: 19, empty: 1, gateRejects: 1 }, { minGroundedRate: 99, maxEmptyRate: 0, maxGateRejects: 0 });
    expect(alerts.filter(a => a.fired).length).toBe(3);
  });
  it("is empty-safe — no digest, no alerts", () => {
    expect(evaluateRagDigest(null)).toEqual([]);
    expect(evaluateRagDigest({ ...digest, total: 0 })).toEqual([]);
  });
});

describe("hard-floor suggestion", () => {
  const rows: RagHealthRow[] = [
    { query: "a", hits: 2, topSim: 0.7, grounded: true, gateRejects: 3, at: "2026-08-01T00:00:00Z" },
    { query: "b", hits: 1, topSim: 0.5, grounded: true, at: "2026-08-01T00:00:00Z" }
  ];
  it("lowers the floor to the highest gated top-hit when the gate drops candidates", () => {
    const sug = suggestHardFloor(rows, 0.9, 0.45);
    expect(sug.changed).toBe(true);
    expect(sug.value).toBe(0.7);
    expect(sug.reason).toContain("0.70");
  });
  it("clamps to the similarity cutoff and never raises the floor", () => {
    const sug = suggestHardFloor(rows, 0.5, 0.45);
    expect(sug.changed).toBe(false);
    expect(sug.value).toBe(0.5);
  });
  it("is a no-op when nothing was gate-rejected", () => {
    const sug = suggestHardFloor([rows[1]], 0.9, 0.45);
    expect(sug.changed).toBe(false);
    expect(sug.value).toBe(0.9);
    expect(sug.reason).toContain("No concept-gate rejections");
  });
  it("reads digest thresholds from remote config, defaults when unset", () => {
    expect(getRagDigestOpts()).toEqual({});
    setRemoteConfig({ rag: { digest: { minGroundedRate: 50, maxEmptyRate: 30, maxGateRejects: 5, webhook: "https://hooks.slack.com/x" } } });
    const opts = getRagDigestOpts();
    expect(opts.minGroundedRate).toBe(50);
    expect(opts.webhook).toBe("https://hooks.slack.com/x");
    setRemoteConfig({ rag: undefined });
    expect(getRagDigestOpts()).toEqual({});
  });
});

describe("tuning playground", () => {
  /* one concept-grounded candidate at 0.6 (lex 0.4) + one gate-rejected 0.8-sim distractor (lex 0) */
  const rows: RagHealthRow[] = [
    {
      query: "closures", hits: 1, topSim: 0.6, grounded: true, gateRejects: 1, belowMin: 0,
      cands: [
        { s: 0.6, st: 1, lx: 0.4 },
        { s: 0.8, st: 2, lx: 0 }
      ],
      at: "2026-08-01T00:00:00Z"
    },
    {
      query: "styling", hits: 0, topSim: 0.3, grounded: false, gateRejects: 0, belowMin: 1,
      cands: [{ s: 0.3, st: 0, lx: 0 }],
      at: "2026-08-01T00:00:00Z"
    }
  ];
  it("reclassifies the log at every candidate pair — grounded rate + gate rejects", () => {
    const cells = simulateTuning(rows, [0.45, 0.65], [0.85, 0.9]);
    /* at 0.45 the closures row grounds (0.6 ≥ 0.45, lex 0.4 > 0); the 0.8 distractor is gate-rejected */
    const at45 = cells.find(c => c.minSim === 0.45 && c.hardFloor === 0.85)!;
    expect(at45.grounded).toBe(1);
    expect(at45.groundedRate).toBe(50);
    expect(at45.gateRejects).toBe(1);
    /* at 0.65 the 0.6 candidate drops below the cutoff — nothing grounds */
    const at65 = cells.find(c => c.minSim === 0.65 && c.hardFloor === 0.85)!;
    expect(at65.grounded).toBe(0);
    expect(at65.groundedRate).toBe(0);
    /* the hard floor rescues the concept-free 0.8 distractor at 0.75 */
    const floor = simulateTuning([rows[0]], [0.45], [0.75]);
    expect(floor[0].grounded).toBe(1);
    expect(floor[0].gateRejects).toBe(0);
  });
  it("handles rows without per-candidate data via the recorded outcome", () => {
    const legacy: RagHealthRow[] = [{ query: "x", hits: 2, topSim: 0.6, grounded: true, at: "2026-08-01T00:00:00Z" }];
    const cells = simulateTuning(legacy, [0.45], [0.85]);
    expect(cells[0].grounded).toBe(1);
    expect(cells[0].groundedRate).toBe(100);
    const strict = simulateTuning(legacy, [0.7], [0.85]);
    expect(strict[0].grounded).toBe(0);
  });
  it("is empty-safe", () => {
    const cells = simulateTuning([], [0.45], [0.85]);
    expect(cells).toEqual([{ minSim: 0.45, hardFloor: 0.85, total: 0, grounded: 0, gateRejects: 0, groundedRate: 0 }]);
  });
  it("bestTuningCell prefers the highest grounded rate, fewest gate rejects, then proximity", () => {
    const cells = simulateTuning(rows, [0.45, 0.55], [0.85, 0.9]);
    const best = bestTuningCell(cells, 0.45, 0.85)!;
    /* at 0.55 both candidates drop below the cutoff → 0% beats nothing is impossible,
       so the best must be one of the 50% cells; 0.45/0.85 wins on proximity */
    expect(best.groundedRate).toBeGreaterThan(0);
    expect(best.minSim).toBe(0.45);
    expect(best.hardFloor).toBe(0.85);
    /* a strictly better cell wins over proximity */
    const better = cells.map(c => ({ ...c, groundedRate: c.minSim === 0.45 ? 100 : c.groundedRate }));
    const best2 = bestTuningCell(better, 0.45, 0.85)!;
    expect(best2.minSim).toBe(0.45);
    expect(best2.groundedRate).toBe(100);
  });
});

describe("user-facing knowledge-gap notification", () => {
  afterEach(() => storageRemove(STORAGE_KEYS.ragGapNotif));
  it("reports a gap once per day (rate-limited), then goes quiet", async () => {
    const { notifyKnowledgeGap } = await import("../services/rag");
    /* window is undefined in node — the notification itself no-ops, but the
       rate limit still gates the in-app note */
    expect(notifyKnowledgeGap("how do closures capture variables")).toBe(true);
    expect(notifyKnowledgeGap("how do closures capture variables")).toBe(false);
    expect(notifyKnowledgeGap("what is caching")).toBe(false);
  });
});

describe("suggest-a-topic", () => {
  it("queues a topic_suggestion event with the field/level context", async () => {
    const { suggestKbTopic } = await import("../services/rag");
    suggestKbTopic("how do closures capture variables", { field: "frontend", level: "senior" });
    const outbox = storageGet<{ kind: string; meta: Record<string, unknown> }[]>(STORAGE_KEYS.eventOutbox, []);
    const ev = outbox.find(e => e.kind === "topic_suggestion");
    expect(ev).toBeDefined();
    expect(ev!.meta.topic).toContain("closures");
    expect(ev!.meta.field).toBe("frontend");
    expect(ev!.meta.level).toBe("senior");
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
