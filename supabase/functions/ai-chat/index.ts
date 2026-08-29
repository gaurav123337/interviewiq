/* ai-chat — Cloud proxy for AI requests. Uses the admin-configured provider
   (from ai_provider_config table) so users don't need their own API key.
   Requires authentication — the user's JWT proves they're signed in. */

import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";

const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

    // Resolve model (may have been overridden above)
    const finalModel = resolvedModel || model;

    // Call the AI provider
    const apiBase = baseUrl.replace(/\/+$/, "");
    // For thinking models (Qwen3, DeepSeek, etc.), disable thinking mode
    // so the model produces actual content instead of consuming all tokens on reasoning
    const isThinkingModel = finalModel.toLowerCase().includes("qwen3") || finalModel.toLowerCase().includes("deepseek-r1");
    const requestBody: Record<string, unknown> = {
      model: finalModel,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    if (isThinkingModel) {
      // OpenRouter: disable thinking to get actual content output
      requestBody.reasoning = { effort: "none" };
    }
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
    // Primary: check content field. Fallback: check reasoning_content (thinking models)
    const choiceMsg = aiBody.choices?.[0]?.message ?? {};
    const text = choiceMsg.content || choiceMsg.reasoning_content || "";
    const usage = aiBody.usage ?? {};

    // If the AI returned an error in the body (non-HTTP error), forward it
    if (!text && aiBody.error) {
      const errMsg = typeof aiBody.error === "string" ? aiBody.error : aiBody.error.message ?? JSON.stringify(aiBody.error);
      return new Response(JSON.stringify({
        error: `AI provider error: ${errMsg}`,
      }), { status: 502, headers });
    }

    // If text is empty, return the full body for debugging
    if (!text) {
      console.error("[ai-chat] Empty text from AI provider. Model:", finalModel, "Response:", JSON.stringify(aiBody).slice(0, 500));
      return new Response(JSON.stringify({
        error: `AI provider returned empty response (model: ${finalModel}). Check the API key and provider configuration.`,
      }), { status: 502, headers });
    }

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
