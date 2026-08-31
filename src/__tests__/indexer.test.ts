/* Incremental re-indexing — unchanged chunks reuse embeddings, only changed
   content is embedded, identical documents short-circuit before touching the
   database. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareChunks, reindexDocument } from "../services/indexer";
import { embed } from "../services/embeddings";

vi.mock("../services/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/embeddings")>();
  return { ...actual, embed: vi.fn() };
});

const adminMocks = vi.hoisted(() => ({
  listPdfChunks: vi.fn(),
  deletePdfChunks: vi.fn(),
  insertPdfChunks: vi.fn(),
  setPdfChunkCount: vi.fn()
}));

vi.mock("../services/admin", () => ({
  listPdfChunks: adminMocks.listPdfChunks,
  deletePdfChunks: adminMocks.deletePdfChunks,
  insertPdfChunks: adminMocks.insertPdfChunks,
  setPdfChunkCount: adminMocks.setPdfChunkCount
}));

const fakeVec = (n: number): number[] => [n, 0.5, 0.25];

afterEach(() => {
  vi.mocked(embed).mockReset();
  for (const m of Object.values(adminMocks)) m.mockReset();
});

describe("reindexDocument", () => {
  it("short-circuits when nothing changed — no DB writes, no embeddings", async () => {
    const docText = "Closures capture lexical scope so functions remember variables after the outer call returns.";
    const oldRows = [{ chunkIndex: 0, content: docText, embedding: fakeVec(1) }];
    const r = await reindexDocument(7, docText, oldRows);
    expect(r).toEqual({ changed: 0, reused: 1, fresh: 0 });
    expect(embed).not.toHaveBeenCalled();
    expect(adminMocks.deletePdfChunks).not.toHaveBeenCalled();
    expect(adminMocks.insertPdfChunks).not.toHaveBeenCalled();
  });

  it("reuses untouched chunks and embeds only what changed", async () => {
    /* long text → multiple chunks; append a sentence so only the last chunk changes */
    const base = "Closures capture lexical scope so functions remember variables after the outer call returns. ";
    const full = base.repeat(30);
    const newChunks = prepareChunks(full);
    expect(newChunks.length).toBeGreaterThan(1);
    const oldRows = newChunks.map((c, i) => ({ chunkIndex: i, content: c.content, embedding: fakeVec(i + 1) }));
    vi.mocked(embed).mockResolvedValue([fakeVec(99)]);
    const edited = full + " A brand new closing sentence about microtasks and the event loop.";
    const r = await reindexDocument(7, edited, oldRows);
    expect(r.changed).toBeGreaterThan(0);
    expect(r.reused).toBeGreaterThan(0);
    expect(r.fresh).toBeGreaterThan(0);
    /* only the changed content hit the embedding API */
    expect(embed).toHaveBeenCalledTimes(1);
    expect((vi.mocked(embed).mock.calls[0][0] as string[]).length).toBe(r.fresh);
    /* the document's rows were replaced, reusing old vectors for unchanged chunks */
    expect(adminMocks.deletePdfChunks).toHaveBeenCalledWith(7);
    const editedChunks = prepareChunks(edited);
    const inserted = adminMocks.insertPdfChunks.mock.calls[0][0];
    expect(inserted).toHaveLength(editedChunks.length);
    const reusedInPlace = inserted.filter((row: { embedding: number[] }) =>
      row.embedding.length === 3 && row.embedding[0] !== 99
    );
    expect(reusedInPlace.length).toBe(r.reused);
    expect(adminMocks.setPdfChunkCount).toHaveBeenCalledWith(7, editedChunks.length);
  });

  it("embeds everything for a brand-new document (empty old rows)", async () => {
    const text = "one section about closures\n\ntwo sections about the event loop";
    const chunks = prepareChunks(text);
    vi.mocked(embed).mockResolvedValue(chunks.map((_, i) => fakeVec(i + 1)));
    const r = await reindexDocument(9, text, []);
    expect(r.fresh).toBe(chunks.length);
    expect(r.changed).toBe(chunks.length);
    expect(r.reused).toBe(0);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(adminMocks.deletePdfChunks).toHaveBeenCalledWith(9);
  });

  it("stamps the embedding provider + model so chunks survive the p_model filter", async () => {
    const text = "one section about closures\n\ntwo sections about the event loop";
    const chunks = prepareChunks(text);
    vi.mocked(embed).mockResolvedValue(chunks.map((_, i) => fakeVec(i + 1)));
    await reindexDocument(11, text, []);
    /* insertPdfChunks(rows, meta) — meta must carry a non-empty model, else these
       chunks get a NULL embedding_model and match_pdf_chunks' p_model filter hides them */
    const meta = adminMocks.insertPdfChunks.mock.calls[0][1];
    expect(meta).toBeTruthy();
    expect(typeof meta.model).toBe("string");
    expect(meta.model.length).toBeGreaterThan(0);
    expect("provider" in meta).toBe(true);
  });
});

describe("prepareChunks", () => {
  it("uses heading-aware chunking when structure exists, plain fallback otherwise", () => {
    const structured = prepareChunks("# Closures\n\nClosures capture scope.");
    expect(structured.some(c => c.content.includes("Closures capture"))).toBe(true);
    const plain = prepareChunks("Just sentences without any headings here. ".repeat(60));
    expect(plain.length).toBeGreaterThan(1);
  });
});
