/* embed — server-side embeddings proxy so signed-in users WITHOUT their own
   API key can still turn a query into a vector for RAG retrieval, using the
   admin-configured shared provider (ai_provider_config key='embeddings', see
   _shared/embedProvider.ts). This is the query half of D2.

   Scope (D2): QUERIES ONLY. Any signed-in user may embed a small batch here;
   INDEXING stays admin/BYOK-only (indexing on the shared key is a real cost and
   abuse surface), so this endpoint caps batch size and total characters. It is
   deliberately NOT admin-gated — keyless retrieval is the whole point.

   Contract: on success returns { vectors:number[][], model, dim }. Any provider
   failure is a non-2xx with { error } — it NEVER returns a partial or empty
   vector, mirroring embedTexts()'s throw-on-failure invariant so a caller can't
   persist a corrupt embedding. */

import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { callerFrom } from "../_shared/auth.ts";
import { clientKey, makeLimiter } from "../_shared/ratelimit.ts";
import { serviceClient } from "../_shared/serviceClient.ts";
import { EMBED_DIM, embedTexts, resolveEmbedProvider } from "../_shared/embedProvider.ts";

/* D2 caps — query embedding, not bulk indexing. A query is a sentence or two;
   these bound shared-key cost/abuse without pinching legitimate retrieval. */
const MAX_INPUTS = 8;
const MAX_CHARS = 8000;

/* Module-scope so the fixed window survives across requests in one instance
   (best-effort; instances are ephemeral — see ratelimit.ts). */
const limiter = makeLimiter(60, 60_000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };

  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ error: "origin not allowed" }), { status: 403, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });
  }

  // Real JWT verification — any signed-in user (D2), not just admins.
  const caller = await callerFrom(req);
  if (!caller) {
    return new Response(JSON.stringify({ error: "Sign in to use embeddings." }), { status: 401, headers });
  }

  if (!limiter(clientKey(req, caller.uid))) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded — try again shortly." }), { status: 429, headers });
  }

  // Parse + validate input (string | string[]).
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const raw = (body as { input?: unknown }).input;
  const input: string[] = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];

  if (input.length === 0) {
    return new Response(JSON.stringify({ error: "input (string or string[]) is required" }), { status: 400, headers });
  }
  if (input.length > MAX_INPUTS) {
    return new Response(JSON.stringify({ error: `Too many inputs (max ${MAX_INPUTS}) — this endpoint embeds queries, not bulk indexing.` }), { status: 400, headers });
  }
  const totalChars = input.reduce((n, s) => n + s.length, 0);
  if (totalChars > MAX_CHARS || input.some((s) => s.trim().length === 0)) {
    return new Response(
      JSON.stringify({ error: totalChars > MAX_CHARS ? `Input too large (max ${MAX_CHARS} chars)` : "input entries must be non-empty" }),
      { status: 400, headers },
    );
  }

  // Resolve the shared embeddings provider (embeddings row → provider row → env).
  const sc = serviceClient();
  const provider = await resolveEmbedProvider(async (rowKey) => {
    const { data } = await sc.from("ai_provider_config").select("value").eq("key", rowKey).maybeSingle();
    return (data as { value?: unknown } | null)?.value ?? null;
  });
  if (!provider) {
    return new Response(
      JSON.stringify({ error: "Embeddings not configured — an admin must set the embeddings provider in Product Config." }),
      { status: 503, headers },
    );
  }

  try {
    const vectors = await embedTexts(provider, input);
    return new Response(JSON.stringify({ vectors, model: provider.model, dim: EMBED_DIM }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "Embeddings failed" }), { status: 502, headers });
  }
});
