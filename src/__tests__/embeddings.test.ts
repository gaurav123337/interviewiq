import { afterEach, describe, expect, it, vi } from "vitest";

/* embedQuery's keyless path calls into ../services/cloud; mock it (mirrors
   aiChat.test.ts). A hoisted holder avoids TDZ since embeddings.ts is imported
   statically below and the factory reads .user/.cloudFnHeaders lazily. */
const cloud = vi.hoisted(() => ({
  user: null as { id: string } | null,
  cloudFnHeaders: vi.fn()
}));
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: cloud.user, configured: true, syncing: false, error: null, oauth: [] }),
  isCloudConfigured: () => true,
  getSupabaseClient: vi.fn().mockResolvedValue(null),
  cloudFnHeaders: cloud.cloudFnHeaders
}));

import { changedChunkIndices, chunkText, DEFAULT_EMBED_MODEL, embed, embedModel, embedQuery, estimateTokens } from "../services/embeddings";
import { STORAGE_KEYS, storageRemove, storageSet } from "../services/storage";

afterEach(() => {
  vi.restoreAllMocks();
  cloud.user = null;
  storageRemove(STORAGE_KEYS.apiKey);
  storageRemove(STORAGE_KEYS.apiBase);
  try { localStorage.clear(); } catch { /* jsdom */ }
});

describe("chunkText", () => {
  it("returns one chunk for short text", () => {
    const chunks = chunkText("What is the capital of France?");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("capital of France");
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].tokens).toBeGreaterThan(0);
  });

  it("splits long text and prefers sentence boundaries", () => {
    const text = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} has enough words to look realistic and ends here.`).join(" ");
    const chunks = chunkText(text, 400, 60);
    expect(chunks.length).toBeGreaterThan(1);
    /* chunks should not cut a sentence mid-word where a boundary was available */
    for (const c of chunks) {
      if (c.content.length === 400) {
        expect(c.content.trim().endsWith(".")).toBe(true);
      }
    }
    /* overlap: consecutive chunks share tail content (trim + boundary-tolerant) */
    if (chunks.length > 1) {
      const a = chunks[0].content;
      const b = chunks[1].content;
      expect(a.includes(b.slice(0, 25).trim())).toBe(true);
    }
  });

  it("returns an empty list for empty input", () => {
    expect(chunkText("   ")).toHaveLength(0);
  });
});

describe("changedChunkIndices", () => {
  const oldChunks = ["chunk one unchanged", "chunk two unchanged", "chunk three old version"];
  it("returns [] when nothing changed", () => {
    expect(changedChunkIndices(oldChunks, oldChunks)).toEqual([]);
  });
  it("flags only the changed chunk when a small edit is made", () => {
    const next = ["chunk one unchanged", "chunk two unchanged", "chunk three NEW version"];
    expect(changedChunkIndices(oldChunks, next)).toEqual([2]);
  });
  it("flags every index when the document is new or fully replaced", () => {
    expect(changedChunkIndices([], ["a", "b"])).toEqual([0, 1]);
    expect(changedChunkIndices(["x"], ["y", "z"])).toEqual([0, 1]);
  });
  it("treats identical content at a shifted position as unchanged", () => {
    /* chunk inserted at the front — the other two keep their vectors */
    const next = ["chunk zero new", ...oldChunks];
    expect(changedChunkIndices(oldChunks, next)).toEqual([0]);
  });
});

describe("embed", () => {
  it("throws without a configured key", async () => {
    await expect(embed(["hello"])).rejects.toThrow("No API key");
  });

  it("posts to the configured base and returns the embeddings", async () => {
    storageSet(STORAGE_KEYS.apiKey, "sk-test");
    storageSet(STORAGE_KEYS.apiBase, "https://example.com/v1");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }] })
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await embed(["a", "b"]);
    expect(out).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/v1/embeddings");
    const body = JSON.parse(init.body);
    expect(body.model).toBe(DEFAULT_EMBED_MODEL);
    expect(body.input).toEqual(["a", "b"]);
    expect(init.headers.Authorization).toBe("Bearer sk-test");
  });

  it("surfaces API errors", async () => {
    storageSet(STORAGE_KEYS.apiKey, "sk-test");
    storageSet(STORAGE_KEYS.apiBase, "https://example.com/v1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "bad key" } })
    }));
    await expect(embed(["x"])).rejects.toThrow("bad key");
  });
});

describe("embedQuery", () => {
  it("throws when there is neither a key nor a signed-in user", async () => {
    cloud.user = null;
    await expect(embedQuery("what is a b-tree")).rejects.toThrow("No API key");
  });

  it("embeds with the user's own key (BYOK) via the provider, not the proxy", async () => {
    storageSet(STORAGE_KEYS.apiKey, "sk-user");
    storageSet(STORAGE_KEYS.apiBase, "https://example.com/v1");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] })
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await embedQuery("what is a b-tree");
    expect(out.vector).toEqual([0.1, 0.2, 0.3]);
    expect(out.model).toBe(DEFAULT_EMBED_MODEL);
    /* BYOK talks to the provider's /embeddings directly — never the edge proxy */
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://example.com/v1/embeddings");
  });

  it("routes keyless signed-in users through the embed proxy and returns vectors[0]", async () => {
    cloud.user = { id: "u1" };
    cloud.cloudFnHeaders.mockResolvedValue({
      "Content-Type": "application/json",
      apikey: "anon",
      Authorization: "Bearer tok-1"
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vectors: [[0.4, 0.5, 0.6]], model: "text-embedding-3-small", dim: 1536 })
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await embedQuery("what is a b-tree");
    expect(out.vector).toEqual([0.4, 0.5, 0.6]);
    expect(out.model).toBe("text-embedding-3-small");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/functions/v1/embed");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ input: ["what is a b-tree"] });
    /* the caller's JWT (from cloudFnHeaders) is forwarded so the function can verify it */
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok-1" });
  });

  it("rejects when the proxy returns an error status", async () => {
    cloud.user = { id: "u1" };
    cloud.cloudFnHeaders.mockResolvedValue({ "Content-Type": "application/json" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "Embeddings not configured" })
    }));
    await expect(embedQuery("q")).rejects.toThrow("Embeddings not configured");
  });

  it("rejects when the proxy returns no vector", async () => {
    cloud.user = { id: "u1" };
    cloud.cloudFnHeaders.mockResolvedValue({ "Content-Type": "application/json" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vectors: [] })
    }));
    await expect(embedQuery("q")).rejects.toThrow("no vector");
  });
});

describe("embedModel", () => {
  it("defaults to text-embedding-3-small", () => {
    expect(embedModel()).toBe("text-embedding-3-small");
  });
});

describe("estimateTokens", () => {
  it("approximates tokens from characters", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a b c d")).toBe(2);
  });
});
