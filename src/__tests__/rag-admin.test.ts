import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestClient } from "../services/cloud";
import {
  adminMissCandidates, batchDeleteQuestions, batchSetQuestionsPublished, createPdfDocument,
  deletePdfDocument, insertPdfChunks, listPdfDocuments, listQuestionAudit, searchPdfChunks,
  setPdfChunkCount, updateQuestion
} from "../services/admin";

/** Minimal chainable+thenable fake Supabase client recording every call. */
function makeClient() {
  const calls: string[] = [];
  const rows: Record<string, unknown[]> = {
    pdf_documents: [{ id: 7, title: "Algorithms.pdf", source: "pdf-import", char_count: 9000, chunk_count: 4, created_at: "2026-08-01T00:00:00Z" }],
    question_audit: [{
      id: 1, question_id: 5, action: "update", field_id: "backend", level: "mid",
      question: "Design a queue", actor: "a@b.c",
      diff: { before: { question: "Old question" }, after: { question: "New question" } },
      created_at: "2026-08-02T00:00:00Z"
    }]
  };
  const chain = (table: string) => {
    const c = {
      select: (cols: string) => { calls.push(`select:${cols}`); return c; },
      order: (col: string) => { calls.push(`order:${col}`); return c; },
      limit: (n: number) => { calls.push(`limit:${n}`); return c; },
      eq: (k: string, v: unknown) => { calls.push(`eq:${k}=${String(v)}`); return c; },
      in: (k: string, v: unknown[]) => { calls.push(`in:${k}=${v.join(",")}`); return c; },
      single: async () => ({ data: { id: 42 }, error: null }),
      insert: (r: unknown) => { calls.push(`insert:${JSON.stringify(r).slice(0, 400)}`); return c; },
      update: (r: unknown) => { calls.push(`update:${JSON.stringify(r)}`); return c; },
      delete: () => { calls.push("delete"); return c; },
      /* thenable: awaiting the terminal link resolves the table's rows */
      then: (resolve: (v: unknown) => void) => { resolve({ data: rows[table] ?? [], error: null }); },
      catch: () => c
    };
    return c;
  };
  const client = {
    from: (t: string) => { calls.push(`from:${t}`); return chain(t); },
    rpc: (name: string, args?: unknown) => {
      calls.push(`rpc:${name}:${JSON.stringify(args ?? {})}`);
      if (name === "is_admin") return Promise.resolve({ data: true, error: null });
      if (name === "match_pdf_chunks") return Promise.resolve({
        data: [{ document_id: 1, content: "relevant chunk", similarity: 0.9 }], error: null
      });
      if (name === "admin_miss_candidates") return Promise.resolve({
        data: [{ question: "Design a rate limiter", field_id: "backend", level: "mid", attempts: 3, misses: 3, miss_rate: 100, avg_score: 1.3 }],
        error: null
      });
      return Promise.resolve({ data: [], error: null });
    },
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) }
  };
  return { client, calls, rows };
}

let fake: ReturnType<typeof makeClient> | null = null;

beforeEach(() => {
  fake = makeClient();
  setTestClient(fake.client as never);
});

afterEach(() => {
  setTestClient(null);
});

describe("review inbox admin ops", () => {
  it("maps a question edit to snake_case columns", async () => {
    await updateQuestion(5, { question: "Fixed question?", answer: "Better answer", keyPoints: ["k1"], fieldId: "backend", level: "senior" });
    const u = fake!.calls.find(c => c.startsWith("update:"));
    expect(u).toContain('"field_id":"backend"');
    expect(u).toContain('"key_points":["k1"]');
    expect(fake!.calls.some(c => c.startsWith("eq:id=5"))).toBe(true);
  });

  it("batch-publishes and batch-deletes by ids", async () => {
    await batchSetQuestionsPublished([1, 2, 3], true);
    expect(fake!.calls.some(c => c.startsWith("update:") && c.includes('"published":true'))).toBe(true);
    expect(fake!.calls.some(c => c.startsWith("in:id=1,2,3"))).toBe(true);

    fake = makeClient();
    setTestClient(fake.client as never);
    await batchDeleteQuestions([4, 5]);
    expect(fake!.calls.some(c => c === "delete")).toBe(true);
    expect(fake!.calls.some(c => c.startsWith("in:id=4,5"))).toBe(true);
  });
});

describe("RAG knowledge base ops", () => {
  it("creates a document and returns its id", async () => {
    const id = await createPdfDocument({ title: "SysDesign.pdf", source: "pdf-import", charCount: 5000 });
    expect(id).toBe(42);
    expect(fake!.calls.some(c => c.startsWith("from:pdf_documents"))).toBe(true);
    expect(fake!.calls.some(c => c.includes('"char_count":5000'))).toBe(true);
  });

  it("inserts chunks with embedding vectors", async () => {
    await insertPdfChunks([{ documentId: 42, index: 0, content: "chunk one", tokens: 8, embedding: [0.1, 0.2] }]);
    const ins = fake!.calls.find(c => c.startsWith("insert:"));
    expect(ins).toContain('"document_id":42');
    expect(ins).toContain('"embedding":[0.1,0.2]');
  });

  it("lists documents and maps chunk counts", async () => {
    const docs = await listPdfDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].chunk_count).toBe(4);
  });

  it("updates the chunk count after indexing", async () => {
    await setPdfChunkCount(42, 9);
    const u = fake!.calls.find(c => c.startsWith("update:"));
    expect(u).toContain('"chunk_count":9');
  });

  it("deletes a document (cascade)", async () => {
    await deletePdfDocument(42);
    expect(fake!.calls.some(c => c.startsWith("eq:id=42"))).toBe(true);
  });

  it("searches chunks via the vector RPC and maps rows", async () => {
    const hits = await searchPdfChunks([0.1, 0.2, 0.3], 4);
    expect(fake!.calls.some(c => c.startsWith("rpc:match_pdf_chunks"))).toBe(true);
    expect(hits).toEqual([{ documentId: 1, content: "relevant chunk", similarity: 0.9 }]);
    /* no model → no p_model arg (back-compatible with the 2-arg RPC) */
    const call = fake!.calls.find(c => c.startsWith("rpc:match_pdf_chunks"))!;
    expect(call).not.toContain("p_model");
  });

  it("scopes the search to an embedding model when one is given", async () => {
    await searchPdfChunks([0.1, 0.2, 0.3], 4, "text-embedding-3-small");
    const call = fake!.calls.find(c => c.startsWith("rpc:match_pdf_chunks"))!;
    expect(call).toContain('"p_model":"text-embedding-3-small"');
    expect(call).toContain('"match_count":4');
  });
});

describe("harvesting + audit ops", () => {
  it("aggregates miss candidates via the admin RPC", async () => {
    const cands = await adminMissCandidates();
    expect(fake!.calls.some(c => c.startsWith("rpc:admin_miss_candidates"))).toBe(true);
    expect(cands).toEqual([{
      question: "Design a rate limiter", field_id: "backend", level: "mid",
      attempts: 3, misses: 3, miss_rate: 100, avg_score: 1.3
    }]);
  });

  it("reads the question-bank audit log newest-first", async () => {
    const audit = await listQuestionAudit(50);
    expect(fake!.calls.some(c => c.startsWith("limit:50"))).toBe(true);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("update");
    expect(audit[0].question).toBe("Design a queue");
    expect(audit[0].actor).toBe("a@b.c");
  });
});
