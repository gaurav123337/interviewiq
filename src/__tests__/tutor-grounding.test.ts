import { afterEach, describe, expect, it, vi } from "vitest";
import type { CareerGoal } from "../types";
import { tutorChat } from "../services/tutor";
import { STORAGE_KEYS, storageRemove, storageSet } from "../services/storage";

/* Signed-in user → the tutor attempts RAG retrieval before answering. */
vi.mock("../services/cloud", () => {
  const cloudClient = {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (t: string) => ({
      select: () => ({
        order: async () => ({
          data: t === "pdf_documents"
            ? [{ id: 1, title: "Prototypes Guide.pdf", source: "pdf-import", char_count: 100, chunk_count: 2, created_at: "2026-08-01T00:00:00Z" }]
            : [],
          error: null
        })
      })
    })
  };
  return {
    getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
    getSupabaseClient: vi.fn().mockResolvedValue(cloudClient)
  };
});

/* Knowledge base has one relevant chunk for the query. */
vi.mock("../services/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/admin")>();
  return {
    ...actual,
    searchPdfChunks: vi.fn().mockResolvedValue([
      { documentId: 1, content: "The prototype chain links every object to a parent object.", similarity: 0.92 }
    ])
  };
});

vi.mock("../services/embeddings", () => ({
  embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  chunkText: () => [],
  estimateTokens: () => 0,
  embedModel: () => "text-embedding-3-small",
  DEFAULT_EMBED_MODEL: "text-embedding-3-small"
}));

const goal: CareerGoal = {
  currentLevel: "mid", targetLevel: "senior", fieldId: "backend", companyId: "general",
  targetDate: "2099-01-01", hoursPerWeek: 5, createdAt: 1
};

afterEach(() => {
  vi.unstubAllGlobals();
  storageRemove(STORAGE_KEYS.apiKey);
});

describe("grounded tutor (RAG)", () => {
  it("injects retrieved knowledge-base chunks into the system prompt", async () => {
    storageSet(STORAGE_KEYS.apiKey, "test-key");
    const fn = vi.fn(async (_url: unknown, _init?: { body?: string }) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "grounded reply" } }] })
    }));
    vi.stubGlobal("fetch", fn);

    const reply = await tutorChat("how does prototype chaining work?", goal, []);
    expect(reply.text).toBe("grounded reply");

    const body = JSON.parse(String(fn.mock.calls[0][1]?.body ?? "")) as { messages: { role: string; content: string }[] };
    expect(body.messages[0].content).toContain("prototype chain links every object");
    expect(body.messages[0].content).toContain("knowledge base");

    /* citations surface back to the UI with the source title */
    expect(reply.citations).toHaveLength(1);
    expect(reply.citations[0].title).toBe("Prototypes Guide.pdf");
    expect(reply.citations[0].content).toContain("prototype chain");
  });
});
