/* ai-chat — server-side AI proxy for the app (docs/deep-dive-system-design-plan.md §2.3).
   App modules (coach, deep-dive explainer, RAG tutor, feedback, hints) call THIS
   function instead of the provider directly, so:
     - the admin-configured provider key (ai_provider_config key='provider') never
       touches the client;
     - each module resolves its own model (key='module:<id>') with the provider row
       as the default;
     - any signed-in user can use it (the owner bills the provider); rate-limited
       per user.

   Body: { module?, messages, temperature?, maxTokens? }
   Auth: signed-in user JWT (requireUser). Guests keep the offline engine. */

import { requireUser } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { makeLimiter } from "../_shared/ratelimit.ts";
import { isModuleId, moduleModel, type AiModuleId } from "../_shared/module-model.ts";
import { serviceClient } from "../_shared/serviceClient.ts";

/* 30 calls / minute / user — best-effort per instance (docs/app-security.md G5). */
const limitUser = makeLimiter(30, 60_000);
const PROVIDER_TIMEOUT_MS = 90_000;

interface ChatBody {
  module?: string;
  messages?: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ error: "origin not allowed" }), { status: 403, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });
  }
  const user = await requireUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Sign in to use cloud AI — or add your own API key in Settings" }), { status: 401, headers });
  }
  if (!limitUser(user.caller.uid)) {
    return new Response(JSON.stringify({ error: "Too many AI calls — slow down for a minute" }), { status: 429, headers });
  }

  const body = (await req.json().catch(() => ({}))) as ChatBody;
  if (!Array.isArray(body.messages) || !body.messages.length) {
    return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers });
  }
  const moduleId: AiModuleId = body.module && isModuleId(body.module) ? body.module : "coach";

  const resolved = await moduleModel(serviceClient(), moduleId);
  if (!resolved.key || !resolved.base) {
    return new Response(
      JSON.stringify({ error: "No AI provider configured — set one in Admin → Secrets → AI pipeline" }),
      { status: 400, headers }
    );
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(`${resolved.base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolved.key}` },
      body: JSON.stringify({
        model: resolved.model,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.6,
        max_tokens: typeof body.maxTokens === "number" ? body.maxTokens : 700,
        messages: body.messages
      }),
      signal: ac.signal
    });
    if (!res.ok) {
      let msg = `provider HTTP ${res.status}`;
      try {
        const j = await res.json();
        msg = j.error?.message || msg;
      } catch { /* ignore non-JSON error bodies */ }
      return new Response(JSON.stringify({ error: msg }), { status: 502, headers });
    }
    const j = await res.json();
    const text = (j.choices?.[0]?.message?.content || "").trim();
    if (!text) {
      return new Response(JSON.stringify({ error: "empty response from provider" }), { status: 502, headers });
    }
    return new Response(
      JSON.stringify({ ok: true, text, resolvedModel: resolved.model, source: resolved.source }),
      { status: 200, headers }
    );
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError"
      ? "provider timed out — try again"
      : (e as Error).message ?? "ai-chat failed";
    return new Response(JSON.stringify({ error: msg }), { status: 502, headers });
  } finally {
    clearTimeout(timer);
  }
});
