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

const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/* ── Model Intelligence ─────────────────────────────────────────────────── */

function isThinkingModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return lower.includes("qwen3") || lower.includes("deepseek-r1") ||
    lower.includes("/o1") || lower.includes("/o3") || lower.includes("thinking");
}

/** Modules that need structured JSON output — thinking should be disabled for these */
const JSON_OUTPUT_MODULES = new Set([
  "contentRefine", "articleNormalize", "contentIndex",
]);

/** Modules that benefit from reasoning — thinking should stay ON */
const REASONING_MODULES = new Set([
  "coach", "hint", "feedback", "deepdive", "rag",
]);

function shouldDisableThinking(modelName: string, moduleId: string): boolean {
  // Only disable for thinking models + JSON-output modules
  return isThinkingModel(modelName) && JSON_OUTPUT_MODULES.has(moduleId);
}

/* ── Main Handler ───────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ error: "origin not allowed" }), { status: 403, headers });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });
    }

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

    // Parse the request body
    const body = await req.json().catch(() => ({}));
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
