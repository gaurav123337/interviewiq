import { assert, assertEquals, assertRejects } from "jsr:@std/assert";
import {
  DEFAULT_EMBED_MODEL,
  EMBED_DIM,
  embedTexts,
  parseProviderRow,
  pickProvider,
  resolveEmbedProvider,
  type EmbedProvider,
} from "./embedProvider.ts";

// ---- pickProvider: the D1 resolution ladder, exercised purely ----------------

Deno.test("pickProvider prefers the dedicated embeddings row", () => {
  const p = pickProvider(
    { key: "emb-key", base: "https://api.openai.com/v1", model: "text-embedding-3-large" },
    { key: "prov-key", base: "https://openrouter.ai/api/v1", model: "gpt-4o" },
    "env-key",
  );
  assertEquals(p, {
    base: "https://api.openai.com/v1",
    key: "emb-key",
    model: "text-embedding-3-large",
  });
});

Deno.test("pickProvider falls back to the provider row when no embeddings row", () => {
  const p = pickProvider(
    null,
    { key: "prov-key", base: "https://api.openai.com/v1/", model: "gpt-4o" },
    "env-key",
  );
  // provider row's chat model is ignored — embeddings default wins.
  assertEquals(p, {
    base: "https://api.openai.com/v1",
    key: "prov-key",
    model: DEFAULT_EMBED_MODEL,
  });
});

Deno.test("pickProvider falls back to the env OpenAI key last", () => {
  const p = pickProvider(null, null, "env-key");
  assertEquals(p, { base: "https://api.openai.com/v1", key: "env-key", model: DEFAULT_EMBED_MODEL });
});

Deno.test("pickProvider returns null when nothing is configured", () => {
  assertEquals(pickProvider(null, null, ""), null);
});

Deno.test("pickProvider ignores a row missing base or key", () => {
  // key without base -> not usable; falls through to env.
  assertEquals(pickProvider({ key: "k", base: "" }, null, "env-key"), {
    base: "https://api.openai.com/v1",
    key: "env-key",
    model: DEFAULT_EMBED_MODEL,
  });
  // base without key -> not usable; nothing else -> null.
  assertEquals(pickProvider({ key: "", base: "https://x/v1" }, null, ""), null);
});

Deno.test("pickProvider keeps the embeddings model even when falling back to the provider row's base", () => {
  const p = pickProvider(
    { model: "text-embedding-3-large" }, // model only, no usable base/key
    { key: "prov-key", base: "https://api.openai.com/v1", model: "gpt-4o" },
    "",
  );
  assertEquals(p?.model, "text-embedding-3-large");
  assertEquals(p?.key, "prov-key");
});

Deno.test("pickProvider strips trailing slashes from base", () => {
  const p = pickProvider({ key: "k", base: "https://api.openai.com/v1///" }, null, "");
  assertEquals(p?.base, "https://api.openai.com/v1");
});

// ---- parseProviderRow --------------------------------------------------------

Deno.test("parseProviderRow accepts an object", () => {
  assertEquals(parseProviderRow({ key: "k", base: "b", model: "m" }), { key: "k", base: "b", model: "m" });
});

Deno.test("parseProviderRow parses a JSON string", () => {
  assertEquals(parseProviderRow('{"key":"k","base":"b"}'), { key: "k", base: "b", model: undefined });
});

Deno.test("parseProviderRow rejects junk", () => {
  assertEquals(parseProviderRow(null), null);
  assertEquals(parseProviderRow("not json"), null);
  assertEquals(parseProviderRow(42), null);
  // non-string fields are dropped, not coerced
  assertEquals(parseProviderRow({ key: 5, base: true, model: "m" }), {
    key: undefined,
    base: undefined,
    model: "m",
  });
});

// ---- resolveEmbedProvider: wiring parse + ladder over a fake reader ----------

Deno.test("resolveEmbedProvider reads the embeddings row via the supplied reader", async () => {
  const rows: Record<string, unknown> = {
    embeddings: { key: "emb-key", base: "https://api.openai.com/v1", model: "text-embedding-3-small" },
    provider: { key: "prov-key", base: "https://openrouter.ai/api/v1", model: "gpt-4o" },
  };
  const p = await resolveEmbedProvider((k) => Promise.resolve(rows[k] ?? null));
  assertEquals(p?.key, "emb-key");
  assertEquals(p?.model, "text-embedding-3-small");
});

Deno.test("resolveEmbedProvider treats a throwing reader as an absent row", async () => {
  // embeddings read throws, provider read succeeds -> provider tier used.
  const p = await resolveEmbedProvider((k) => {
    if (k === "embeddings") return Promise.reject(new Error("boom"));
    return Promise.resolve({ key: "prov-key", base: "https://api.openai.com/v1", model: "gpt-4o" });
  });
  assertEquals(p?.key, "prov-key");
});

// ---- embedTexts: contract enforcement with a stubbed fetch -------------------

const PROVIDER: EmbedProvider = { base: "https://api.openai.com/v1", key: "k", model: "text-embedding-3-small" };
const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string, init?: RequestInit) => Response): void {
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init))) as typeof fetch;
}
function restoreFetch(): void {
  globalThis.fetch = realFetch;
}

function embeddingResponse(vectors: number[][]): Response {
  return new Response(JSON.stringify({ data: vectors.map((embedding) => ({ embedding })) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("embedTexts returns vectors on success", async () => {
  const vec = new Array(EMBED_DIM).fill(0.1);
  stubFetch((url, init) => {
    assert(url.endsWith("/embeddings"), `expected /embeddings, got ${url}`);
    const body = JSON.parse(String(init?.body));
    assertEquals(body.model, "text-embedding-3-small");
    assertEquals(body.input, ["hello"]);
    assertEquals((init?.headers as Record<string, string>)?.Authorization, "Bearer k");
    return embeddingResponse([vec]);
  });
  try {
    const out = await embedTexts(PROVIDER, ["hello"]);
    assertEquals(out.length, 1);
    assertEquals(out[0].length, EMBED_DIM);
  } finally {
    restoreFetch();
  }
});

Deno.test("embedTexts throws on a non-1536-dim vector", async () => {
  stubFetch(() => embeddingResponse([[1, 2, 3]]));
  try {
    await assertRejects(() => embedTexts(PROVIDER, ["hi"]), Error, `${EMBED_DIM}-dim`);
  } finally {
    restoreFetch();
  }
});

Deno.test("embedTexts throws on a count mismatch", async () => {
  const vec = new Array(EMBED_DIM).fill(0.1);
  stubFetch(() => embeddingResponse([vec])); // 1 returned for 2 requested
  try {
    await assertRejects(() => embedTexts(PROVIDER, ["a", "b"]), Error, "count mismatch");
  } finally {
    restoreFetch();
  }
});

Deno.test("embedTexts surfaces the upstream error message on HTTP error", async () => {
  stubFetch(() =>
    new Response(JSON.stringify({ error: { message: "invalid api key" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  );
  try {
    await assertRejects(() => embedTexts(PROVIDER, ["hi"]), Error, "invalid api key");
  } finally {
    restoreFetch();
  }
});

Deno.test("embedTexts falls back to a status message when the error body is unparseable", async () => {
  stubFetch(() => new Response("gateway boom", { status: 502 }));
  try {
    await assertRejects(() => embedTexts(PROVIDER, ["hi"]), Error, "HTTP 502");
  } finally {
    restoreFetch();
  }
});
