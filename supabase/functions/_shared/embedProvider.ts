/* embedProvider — the single server-side source of truth for WHICH provider
   turns text into embeddings, shared by the query proxy (functions/embed) and
   the content indexer (functions/content-index) so the two never drift into
   different vector spaces. Before this, content-index hardcoded api.openai.com
   and its own key/model while the client used the configured provider — the
   exact divergence D1 exists to remove.

   Resolution ladder (D1):
     1. the dedicated ai_provider_config key='embeddings' row (base + key), OR
     2. key='provider' (the chat provider) — only usable when it ALSO speaks
        /embeddings, which OpenRouter (the documented default) does NOT, hence
        the dedicated row, OR
     3. the legacy OPENAI_API_KEY / SUPABASE_SECRET_KEYS env — the backstop
        content-index used before this module, so converging it never regresses
        below the key it had.
   The model is ALWAYS an embeddings model: a provider row's `model` is a CHAT
   model, so it is never used for embeddings — the embeddings row's own model
   wins, else the 1536-dim default.

   embedTexts() ALWAYS throws on failure and enforces the vector(1536) contract:
   a mis-configured model can't silently store a wrong-dimension (or empty)
   vector into pdf_chunks. Callers turn a throw into an honest empty result
   (retrieveContext -> checked:false); they never persist a partial vector. */

/** pdf_chunks.embedding is vector(1536) and match_pdf_chunks compares in
    1536-space — a non-1536 model must be rejected, never stored. */
export const EMBED_DIM = 1536;
export const DEFAULT_EMBED_MODEL = "text-embedding-3-small";

export interface EmbedProvider {
  base: string;
  key: string;
  model: string;
}

/** The stored ai_provider_config value shape (see aiProvider.ts's
    saveAiProviderConfig / saveEmbeddingsProviderConfig). */
export interface ProviderRow {
  key?: string;
  base?: string;
  model?: string;
}

/** Reads one ai_provider_config row's raw `value` by key (or null). Supplied by
    the caller so this module stays decoupled from the supabase-js version. */
export type RowValueReader = (rowKey: string) => Promise<unknown>;

const stripBase = (b: string): string => b.trim().replace(/\/+$/, "");

/** Normalizes a stored `value` (jsonb object, or a JSON string) into a
    ProviderRow. Anything unusable -> null. Pure. */
export function parseProviderRow(value: unknown): ProviderRow | null {
  let v = value;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return null; }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    key: typeof o.key === "string" ? o.key : undefined,
    base: typeof o.base === "string" ? o.base : undefined,
    model: typeof o.model === "string" ? o.model : undefined,
  };
}

/** The env backstop content-index used before D1 — OPENAI_API_KEY, or the
    "openai" entry inside a SUPABASE_SECRET_KEYS JSON blob. Guarded so a
    permissionless `deno test` (no --allow-env) yields "" rather than throwing. */
export function envEmbedKey(): string {
  try {
    return (
      Deno.env.get("OPENAI_API_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEYS")?.match(/"openai":\s*"([^"]+)"/)?.[1] ||
      ""
    );
  } catch {
    return "";
  }
}

/** Pure ladder: embeddings row -> provider row -> env OpenAI key -> null. Pure
    (no IO) so the Deno gate can exercise every tier without env/network perms.
    The model is always an embeddings model (never the provider row's chat
    model): the embeddings row's own model if set, else the 1536-dim default. */
export function pickProvider(
  emb: ProviderRow | null,
  prov: ProviderRow | null,
  envKey: string,
): EmbedProvider | null {
  const model = (emb?.model || "").trim() || DEFAULT_EMBED_MODEL;

  const embKey = (emb?.key || "").trim();
  const embBase = stripBase(emb?.base || "");
  if (embKey && embBase) return { base: embBase, key: embKey, model };

  const provKey = (prov?.key || "").trim();
  const provBase = stripBase(prov?.base || "");
  if (provKey && provBase) return { base: provBase, key: provKey, model };

  const env = (envKey || "").trim();
  if (env) return { base: "https://api.openai.com/v1", key: env, model };

  return null;
}

/** Resolves the embeddings provider from ai_provider_config (+ env backstop).
    Returns null when nothing is configured — callers should 503 / skip, NEVER
    fall back to a hardcoded endpoint. A row read that throws is treated as
    absent (fail toward the next tier, not the whole request). */
export async function resolveEmbedProvider(read: RowValueReader): Promise<EmbedProvider | null> {
  const [embVal, provVal] = await Promise.all([
    read("embeddings").catch(() => null),
    read("provider").catch(() => null),
  ]);
  return pickProvider(parseProviderRow(embVal), parseProviderRow(provVal), envEmbedKey());
}

/** Embeds a batch via the resolved provider's OpenAI-compatible /embeddings
    endpoint. ALWAYS throws on any failure (HTTP error, count mismatch, or a
    non-1536 vector) — it NEVER returns [] or a wrong-dimension vector, so the
    knowledge base can't be silently corrupted. */
export async function embedTexts(provider: EmbedProvider, input: string[]): Promise<number[][]> {
  const res = await fetch(`${provider.base}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
    body: JSON.stringify({ model: provider.model, input }),
  });
  if (!res.ok) {
    let msg = `Embeddings request failed (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j?.error?.message) msg = j.error.message;
    } catch { /* keep the status message */ }
    throw new Error(msg);
  }
  const j = await res.json();
  const out: number[][] = ((j?.data ?? []) as { embedding?: number[] }[]).map((d) => d.embedding ?? []);
  if (out.length !== input.length) {
    throw new Error(`Embeddings count mismatch: got ${out.length}, expected ${input.length}`);
  }
  for (const v of out) {
    if (v.length !== EMBED_DIM) {
      throw new Error(
        `Embeddings must be ${EMBED_DIM}-dim (got ${v.length}) — configure a ${EMBED_DIM}-dim model such as text-embedding-3-small.`,
      );
    }
  }
  return out;
}
