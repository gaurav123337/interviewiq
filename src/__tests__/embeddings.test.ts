import { afterEach, describe, expect, it, vi } from "vitest";
import { chunkText, DEFAULT_EMBED_MODEL, embed, embedModel, estimateTokens } from "../services/embeddings";
import { STORAGE_KEYS, storageSet } from "../services/storage";

afterEach(() => {
  vi.restoreAllMocks();
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
