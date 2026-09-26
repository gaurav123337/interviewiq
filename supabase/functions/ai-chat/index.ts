/* ai-chat — Cloud proxy for AI requests. Uses the admin-configured provider
   (from ai_provider_config table) so users don't need their own API key.
   Requires authentication — the user's JWT proves they're signed in.

   Smart model handling:
   - Detects thinking models (Qwen3, DeepSeek-R1, o1, o3)
   - For JSON-output modules: disables thinking to prevent token waste
   - For conversational modules: keeps thinking enabled for better reasoning
   - Falls back gracefully with informative errors
*/

import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/* ── Dynamic Model Intelligence ──────────────────────────────────────────── */

/** Detect model capabilities from name patterns — works for ANY model */
function classifyModel(modelName: string): {
  isThinking: boolean;
  tags: string[];
} {
  const lower = modelName.toLowerCase();
  const tags: string[] = [];
  let isThinking = false;

  // Thinking/reasoning models — detect by naming patterns
  if (lower.includes("qwen3") || lower.includes("qwq")) { isThinking = true; tags.push("thinking"); }
  if (lower.includes("deepseek-r1") || lower.includes("deepseek-reasoner")) { isThinking = true; tags.push("reasoning"); }
  if (lower.match(/\bo[13]\b/) || lower.includes("-o1") || lower.includes("-o3")) { isThinking = true; tags.push("reasoning"); }
  if (lower.includes("thinking")) { isThinking = true; tags.push("thinking"); }
  if (lower.includes("chain-of-thought") || lower.includes("cot")) { isThinking = true; tags.push("reasoning"); }
  if (lower.includes("hy3") || lower.includes("-reason") || lower.includes("-think")) { isThinking = true; tags.push("thinking"); }

  // Code-specialized models
  if (lower.includes("coder") || lower.includes("code") || lower.includes("codestral")) { tags.push("code"); }

  // Embedding models
  if (lower.includes("embed") || lower.includes("embedding")) { tags.push("embeddings"); }

  // Vision models
  if (lower.includes("vision") || lower.includes("-vl") || lower.includes("multimodal")) { tags.push("vision"); }

  // Creative models
  if (lower.includes("creative") || lower.includes("story")) { tags.push("creative"); }

  // Fast/cheap models (by name heuristic)
  if (lower.includes("mini") || lower.includes("flash") || lower.includes("lite") || lower.includes("nano") || lower.includes("tiny")) { tags.push("fast"); }

  return { isThinking, tags };
}

/** Determine if thinking should be disabled for this module */
function shouldDisableThinking(modelName: string, moduleId: string): boolean {
  const { isThinking } = classifyModel(modelName);
  // JSON-output modules should never use thinking models
  const JSON_MODULES = new Set(["contentRefine", "articleNormalize", "contentIndex", "contentQuality", "ats"]);
  return isThinking && JSON_MODULES.has(moduleId);
}

/* ── POST action: probe models with 1-token live calls ─────────────────── */

/** Deterministic suffix so probing never hits the provider's prompt cache —
    an accidental cache-hit response would look like a healthy model while
    proving nothing about live generation. */
const probeNonce = () => `#p${Date.now().toString(36)}`;
/** Cap on models probed per request — keeps a 200-model gateway from
    turning one scan into a minute-long, quota-burning marathon. */
const MAX_PROBES = 60;

interface ProbeVerdict {
  model: string;
  status: "ok" | "failed";
  httpStatus: number;
  latencyMs: number;
  sample: string;
  /** Server-decoded quota wall, e.g. "needs 200.1 credits, 174.06 available". */
  quota?: string;
}

/** Probes one model with a 1-token chat call. Cheap (1 output token) and
    decisive: listed-but-dead upstream models 524, priced-out models 403. */
async function probeModel(apiKey: string, apiBase: string, model: string): Promise<ProbeVerdict> {
  const t0 = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);
    const res = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      signal: ac.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: `Reply with the single word OK. ${probeNonce()}` }],
        max_tokens: 1,
        temperature: 0,
      }),
    });
    clearTimeout(timer);
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    const errMsg = String((body as { error?: { message?: string } }).error?.message ?? "");
    let quota: string | undefined;
    const need = errMsg.match(/需要预扣费额度[:：]?\s*Credits?([\d.]+)/);
    const have = errMsg.match(/剩余额度[:：]?\s*Credits?([\d.]+)/);
    if (need && have) quota = `needs ~${need[1]} credits/call, ${have[1]} available`;
    if (res.ok) {
      const msg = (body as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
      return { model, status: "ok", httpStatus: res.status, latencyMs: Date.now() - t0, sample: msg.slice(0, 20), quota };
    }
    return { model, status: "failed", httpStatus: res.status, latencyMs: Date.now() - t0, sample: errMsg.slice(0, 120), quota };
    } catch (e) {
    return { model, status: "failed", httpStatus: 0, latencyMs: Date.now() - t0, sample: (e as Error).name === "AbortError" ? "timeout after 30s" : (e as Error).message.slice(0, 120) };
  }
}

/** POST { action: "probe-models", models?: string[] } — admin-only. Probes the
    requested models (default: every chat model from GET /models, capped) with
    1-token calls and returns live verdicts + quota intel. Every Response below
    MUST carry the prepared CORS headers: CORS is enforced by the BROWSER, so a
    bare Response (Content-Type only) is a 200 the browser throws away — the
    scan then failed as "Couldn't list models" while curl worked fine. */
async function handleProbeModels(providerConfig: Record<string, string>, body: Record<string, unknown>, cors: Record<string, string>): Promise<Response> {
  const apiKey = providerConfig.key ?? providerConfig.apiKey ?? "";
  const apiBase = (providerConfig.base ?? providerConfig.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!apiKey || !apiBase) {
    return new Response(JSON.stringify({ error: "Provider not configured" }), { status: 503, headers: cors });
  }
  try {
    const listRes = await fetch(`${apiBase}/models`, { headers: { "Authorization": `Bearer ${apiKey}` } });
    if (!listRes.ok) {
      return new Response(JSON.stringify({ error: `Provider /models returned HTTP ${listRes.status}` }), { status: 502, headers: cors });
    }
    const data = await listRes.json().catch(() => ({}));
    const listed: { id: string }[] = data.data ?? [];
    const wanted = (body?.models as string[] | undefined)?.filter(m => typeof m === "string");
    /* exclude image/video/audio/embedding model families — they can't serve
       chat completions and would burn quota on a guaranteed 4xx */
    const chatOnly = listed
      .map(m => m.id)
      .filter(id => id && !/(image|seedance|kling|hailuo|imagine|tts|whisper|embed|bge-)/i.test(id))
      .slice(0, MAX_PROBES);
    const targets = wanted && wanted.length ? wanted : chatOnly;
    if (!targets.length) return new Response(JSON.stringify({ error: "no probeable models" }), { status: 400, headers: cors });
    /* modest parallelism — fast enough to finish before gateway idle timeouts,
       gentle enough not to trip per-key burst limits */
    const verdicts = (await Promise.all(targets.map(m => probeModel(apiKey, apiBase, m))));
    return new Response(JSON.stringify({ verdicts, probed: verdicts.length }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "probe failed" }), { status: 500, headers: cors });
  }
}

/** POST { action: "set-provider-model", model } — admin-only. Updates the
    active model on the saved provider row WITHOUT needing the key again.
    Lets the auto-apply / model picker switch models in one click. */
async function handleSetProviderModel(model: string, projectUrl: string, cors: Record<string, string>): Promise<Response> {
  const m = String(model || "").trim();
  if (!m || m.length > 200) return new Response(JSON.stringify({ error: "model required" }), { status: 400, headers: cors });
  try {
    /* read-modify-write the value blob so the key/base are never clobbered */
    const cur = await fetch(`${projectUrl}/rest/v1/ai_provider_config?key=eq.provider&select=value`, {
      headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY },
    });
    const rows = await cur.json().catch(() => [] as Record<string, unknown>[]);
    const value = { ...((rows[0]?.value as Record<string, unknown>) ?? {}), model: m };
    const res = await fetch(`${projectUrl}/rest/v1/ai_provider_config?key=eq.provider`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Prefer": "return=minimal" },
      body: JSON.stringify({ value, updated_at: Date.now() }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return new Response(JSON.stringify({ error: `update failed HTTP ${res.status}: ${t.slice(0, 120)}` }), { status: 502, headers: cors });
    }
    return new Response(JSON.stringify({ ok: true, model: m }), { status: 200, headers: cors });
    } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "update failed" }), { status: 500, headers: cors });
  }
}

/* ── GET /models — list available models from provider ──────────────────── */

async function handleListModels(providerConfig: Record<string, string>, projectUrl: string, cors: Record<string, string>): Promise<Response> {
  const apiKey = providerConfig.key ?? providerConfig.apiKey ?? "";
  const baseUrl = (providerConfig.base ?? providerConfig.baseUrl ?? "").replace(/\/+$/, "");
  if (!apiKey || !baseUrl) {
  	return new Response(JSON.stringify({ error: "Provider not configured" }), { status: 503, headers: cors });
  }

  try {
  	const res = await fetch(`${baseUrl}/models`, {
  	  headers: { "Authorization": `Bearer ${apiKey}` },
  	});
  	if (!res.ok) {
  	  return new Response(JSON.stringify({ error: `Provider returned HTTP ${res.status}` }), { status: 502, headers: cors });
  	}
  	const data = await res.json().catch(() => ({}));
  	const models: { id: string; name?: string; owned_by?: string }[] = data.data ?? [];

  	// Read module overrides to show which model each module uses
  	const modRes = await fetch(`${projectUrl}/rest/v1/ai_provider_config?key=like.module:*&select=key,value`, {
  	  headers: { "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`, "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" },
  	});
  	const modRows = await modRes.json().catch(() => []);
  	const moduleDefaults: Record<string, string> = {};
  	for (const r of modRows) {
  	  const id = (r.key ?? "").replace(/^module:/, "");
  	  const v = typeof r.value === "string" ? JSON.parse(r.value) : (r.value ?? {});
  	  if (v.model) moduleDefaults[id] = v.model;
  	}

  	// Enrich each model with capability tags
  	const enriched = models
  	  .filter(m => m.id && !m.id.includes("embedding") && !m.id.includes("tts") && !m.id.includes("whisper"))
  	  .map(m => {
  	    const { isThinking, tags } = classifyModel(m.id);
  	    return { id: m.id, name: m.name ?? m.id, owner: m.owned_by ?? "", isThinking, tags };
  	  })
  	  .sort((a, b) => a.id.localeCompare(b.id));

  	return new Response(JSON.stringify({ models: enriched, moduleDefaults }), { status: 200, headers: cors });
  } catch (e) {
  	return new Response(JSON.stringify({ error: (e as Error).message ?? "Failed to list models" }), { status: 500, headers: cors });
  }
}

/* ── Main Handler ───────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ error: "origin not allowed" }), { status: 403, headers });
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === ANON_KEY) {
      return new Response(JSON.stringify({ error: "Sign in to use AI." }), { status: 401, headers });
    }

    // Get the admin-configured AI provider from the database
    const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const providerRes = await fetch(`${projectUrl}/rest/v1/ai_provider_config?key=eq.provider&select=value`, {
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
    });
    const providerRows = await providerRes.json().catch(() => []);
    if (!providerRows.length || !providerRows[0].value) {
      return new Response(JSON.stringify({ error: "AI not configured — admin needs to set up the provider in Product Config." }), { status: 503, headers });
    }

    const config = typeof providerRows[0].value === "string"
      ? JSON.parse(providerRows[0].value)
      : providerRows[0].value;

    const apiKey = config.key ?? config.apiKey ?? "";
    const baseUrl = config.base ?? config.baseUrl ?? "";
    const model = config.model ?? "gpt-4o-mini";
    if (!apiKey || !baseUrl) {
      return new Response(JSON.stringify({ error: "AI provider not fully configured — missing API key or base URL." }), { status: 503, headers });
    }

    // GET /models — list available models from provider
    if (req.method === "GET") {
      return await handleListModels(config, projectUrl, headers);
    }

    // Parse the request body
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST or GET only" }), { status: 405, headers });
    }
    const body = await req.json().catch(() => ({}));

    /* Admin actions for the model picker / auto-apply — checked before the
       messages validation because these POSTs carry no messages array. They
       read/modify the saved provider config, so they are admin-gated. */
    if (body?.action === "probe-models" || body?.action === "set-provider-model") {
      const admin = await requireAdmin(req);
      if (!admin) {
        return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers });
      }
      if (body.action === "probe-models") return await handleProbeModels(config, body, headers);
      return await handleSetProviderModel(String(body?.model ?? ""), projectUrl, headers);
    }

    const { messages, temperature = 0.6, maxTokens = 700, module: moduleId } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }), { status: 400, headers });
    }

    // Get per-module model override if set
    let resolvedModel = model;
    if (moduleId) {
      const modRes = await fetch(`${projectUrl}/rest/v1/ai_provider_config?key=eq.module:${moduleId}&select=value`, {
        headers: {
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "apikey": SERVICE_ROLE_KEY,
        },
      });
      const modRows = await modRes.json().catch(() => []);
      if (modRows.length && modRows[0].value) {
        const modConfig = typeof modRows[0].value === "string" ? JSON.parse(modRows[0].value) : modRows[0].value;
        if (modConfig.model) resolvedModel = modConfig.model;
      }
    }

    const finalModel = resolvedModel || model;

    /* ── Smart Model Handling ─────────────────────────────────────────── */
    const thinkingDisabled = shouldDisableThinking(finalModel, moduleId);

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: finalModel,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    // Disable thinking for JSON-output modules using thinking models
    if (thinkingDisabled) {
      requestBody.reasoning = false;
    }

    /* ── Call AI Provider ─────────────────────────────────────────────── */
    const apiBase = baseUrl.replace(/\/+$/, "");
    const aiRes = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      return new Response(JSON.stringify({
        error: `AI provider returned HTTP ${aiRes.status}: ${errText.slice(0, 200)}`
      }), { status: 502, headers });
    }

    const aiBody = await aiRes.json().catch(() => ({}));

    /* ── Extract Response (multiple field formats) ────────────────────── */
    const choiceMsg = aiBody.choices?.[0]?.message ?? {};
    // Priority: content > reasoning_content > reasoning (format varies by provider)
    let text = choiceMsg.content || choiceMsg.reasoning_content || choiceMsg.reasoning || "";
    const usage = aiBody.usage ?? {};

    /* ── Strip thinking preamble ─────────────────────────────────────── */
    // Qwen3 thinking models sometimes put reasoning INTO the content field
    // instead of leaving it empty. Strip everything before the first '{'
    // when the preamble looks like thinking output.
    if (text && thinkingDisabled && text.indexOf('{') > 20) {
      const beforeBrace = text.slice(0, text.indexOf('{'));
      // Thinking preamble typically starts with 'We need', 'Let me', 'First', etc.
      if (/^(we|let|first|need|must|should|to |for |this )/i.test(beforeBrace.trim())) {
        console.log(`[ai-chat] Stripping ${beforeBrace.length} char thinking preamble from content`);
        text = text.slice(text.indexOf('{'));
      }
    }

    /* ── Handle Errors ────────────────────────────────────────────────── */
    if (!text && aiBody.error) {
      const errMsg = typeof aiBody.error === "string" ? aiBody.error : aiBody.error.message ?? JSON.stringify(aiBody.error);
      return new Response(JSON.stringify({ error: `AI provider error: ${errMsg}` }), { status: 502, headers });
    }

    /* ── Thinking Model Fallback ──────────────────────────────────────── */
    // If content is empty but reasoning exists, the thinking model consumed
    // all tokens on reasoning without producing output.
    if (!text && choiceMsg.reasoning) {
      // Try again with thinking disabled (only if we didn't already disable it)
      if (!thinkingDisabled) {
        const retryBody = { ...requestBody, reasoning: false };
        const retryRes = await fetch(`${apiBase}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(retryBody),
        });

        if (retryRes.ok) {
          const retryBody2 = await retryRes.json().catch(() => ({}));
          const retryMsg = retryBody2.choices?.[0]?.message ?? {};
          const retryText = retryMsg.content || retryMsg.reasoning_content || "";
          const retryUsage = retryBody2.usage ?? {};

          if (retryText) {
            console.log(`[ai-chat] Fallback succeeded: thinking disabled for module "${moduleId}" on model "${finalModel}"`);
            return new Response(JSON.stringify({
              text: retryText,
              model: finalModel,
              usage: {
                prompt_tokens: retryUsage.prompt_tokens ?? 0,
                completion_tokens: retryUsage.completion_tokens ?? 0,
              },
              _fallback: true, // Signal that fallback was used
            }), { status: 200, headers });
          }
        }
      }

      // All attempts failed — provide actionable error
      return new Response(JSON.stringify({
        error: `Model "${finalModel}" returned only thinking/reasoning output with no content for module "${moduleId}". ` +
          `This model is a thinking model that wastes tokens on internal reasoning. ` +
          `Recommendation: Configure a non-thinking model (gpt-4o-mini, gemini-2.5-flash) for JSON-output modules in Product Config.`,
      }), { status: 502, headers });
    }

    /* ── Empty Response ───────────────────────────────────────────────── */
    if (!text) {
      return new Response(JSON.stringify({
        error: `AI returned empty response (model: ${finalModel}). Check API key and provider configuration.`,
      }), { status: 502, headers });
    }

    /* ── Success ──────────────────────────────────────────────────────── */
    return new Response(JSON.stringify({
      text,
      model: finalModel,
      usage: {
        prompt_tokens: usage.prompt_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? 0,
      },
    }), { status: 200, headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "ai-chat failed" }), { status: 500, headers });
  }
});
