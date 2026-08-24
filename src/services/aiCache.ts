/* AI Response Cache — semantic dedup layer for LLM calls.
   Cache key = SHA-256(system + user + model). Same question across users
   returns the cached response instantly. TTL: 7 days (configurable per module).
   Falls through to the real API on miss, then stores the response. */

import { getSupabaseClient, getCloudState } from "./cloud";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface CacheEntry {
  response: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

/* Modules with their TTL in days — hints are short-lived, feedback longer */
const MODULE_TTL_DAYS: Record<string, number> = {
  hint: 3,
  feedback: 7,
  coach: 5,
  deepdive: 7,
  rag: 7,
};

const DEFAULT_TTL_DAYS = 7;

/* ── Hash helper (Web Crypto, works in browsers + Edge Runtime) ────────── */

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ── Cost estimation (per model, USD per 1M tokens) ───────────────────── */

const MODEL_COST: Record<string, { input: number; output: number }> = {
  "gpt-4o":       { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":  { input: 0.15,  output: 0.60  },
  "gpt-4.1-nano": { input: 0.10,  output: 0.40  },
  "gpt-3.5-turbo":{ input: 0.50,  output: 1.50  },
  "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
  "claude-haiku-3.5":         { input: 0.80, output: 4.00  },
  "gemini-2.5-flash":         { input: 0.30, output: 2.50  },
  "gemini-2.5-flash-lite":    { input: 0.10, output: 0.40  },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const c = MODEL_COST[model] ?? MODEL_COST["gpt-4o-mini"];
  return (inputTokens * c.input + outputTokens * c.output) / 1_000_000;
}

/* ── Cache lookup ──────────────────────────────────────────────────────── */

export async function cacheLookup(
  systemPrompt: string,
  userPrompt: string,
  model: string,
): Promise<CacheEntry | null> {
  try {
    const client = await getSupabaseClient();
    if (!client) return null;

    const key = await sha256(`${systemPrompt}\n${userPrompt}\n${model}`);
    const { data, error } = await client
      .from("ai_response_cache")
      .select("response, model, input_tokens, output_tokens")
      .eq("cache_key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;

    // Update hit count asynchronously (fire-and-forget)
    Promise.resolve(
      client
        .from("ai_response_cache")
        .update({ hit_count: (data as any).hit_count ? (data as any).hit_count + 1 : 1, last_hit_at: new Date().toISOString() })
        .eq("cache_key", key)
    ).then(() => {}).catch(() => {});

    return {
      response: data.response,
      model: data.model,
      input_tokens: 0, // cache hits cost nothing
      output_tokens: 0,
    };
  } catch {
    return null; // cache failures should never block the real call
  }
}

/* ── Cache store ───────────────────────────────────────────────────────── */

export async function cacheStore(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  response: string,
  inputTokens: number,
  outputTokens: number,
  module: string,
): Promise<void> {
  try {
    const client = await getSupabaseClient();
    if (!client) return;

    const key = await sha256(`${systemPrompt}\n${userPrompt}\n${model}`);
    const ttlDays = MODULE_TTL_DAYS[module] ?? DEFAULT_TTL_DAYS;
    const expiresAt = new Date(Date.now() + ttlDays * 86400_000).toISOString();

    await client.from("ai_response_cache").upsert(
      {
        cache_key: key,
        module,
        response,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        hit_count: 0,
        expires_at: expiresAt,
      },
      { onConflict: "cache_key" },
    );
  } catch {
    // silent — caching is best-effort
  }
}

/* ── Cost logging ──────────────────────────────────────────────────────── */

export async function logAiCost(params: {
  userId?: string;
  module: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
  latencyMs?: number;
  error?: boolean;
}): Promise<void> {
  try {
    const client = await getSupabaseClient();
    if (!client) return;

    const cost = params.cached
      ? 0
      : estimateCost(params.model, params.inputTokens, params.outputTokens);

    await client.from("ai_cost_log").insert({
      user_id: params.userId ?? null,
      module: params.module,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_cost: cost,
      cached: params.cached,
      latency_ms: params.latencyMs ?? 0,
      error: params.error ?? false,
    });
  } catch {
    // silent — logging should never block
  }
}

/* ── Rate limiting ─────────────────────────────────────────────────────── */

const RATE_LIMITS: Record<string, number> = {
  free: 5,   // calls per minute for free users
  pro: 15,   // calls per minute for pro users
  admin: 999,
};

/** Check per-user AI quota (daily + monthly limits from ai_user_quotas). */
export async function checkUserQuota(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const client = await getSupabaseClient();
    if (!client) return { allowed: true };

    const { data: quota } = await client
      .from("ai_user_quotas")
      .select("daily_limit, monthly_limit, daily_tokens, monthly_tokens, enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (quota && !(quota as any).enabled) return { allowed: false, reason: "AI access has been disabled for your account." };
    if (!quota) return { allowed: true }; // no custom quota = unlimited

    const q = quota as { daily_limit: number; monthly_limit: number; daily_tokens: number; monthly_tokens: number };

    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);

    // Check daily call limit
    if (q.daily_limit > 0) {
      const { count } = await client
        .from("ai_cost_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00Z`);
      if ((count ?? 0) >= q.daily_limit) return { allowed: false, reason: `Daily AI limit reached (${q.daily_limit}/day). Upgrade to Pro for more.` };
    }

    // Check monthly call limit
    if (q.monthly_limit > 0) {
      const { count } = await client
        .from("ai_cost_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", `${month}-01T00:00:00Z`);
      if ((count ?? 0) >= q.monthly_limit) return { allowed: false, reason: `Monthly AI limit reached (${q.monthly_limit}/month). Upgrade to Pro for more.` };
    }

    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open
  }
}

export async function checkRateLimit(
  userId: string,
  module: string,
  tier: string,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const client = await getSupabaseClient();
    if (!client) return { allowed: true, remaining: 999 };

    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    const limit = RATE_LIMITS[tier] ?? RATE_LIMITS.free;

    const { data } = await client
      .from("ai_rate_limits")
      .select("call_count")
      .eq("user_id", userId)
      .eq("module", module)
      .eq("window_start", windowStart)
      .maybeSingle();

    const current = (data as any)?.call_count ?? 0;
    if (current >= limit) return { allowed: false, remaining: 0 };

    // Upsert increment
    try {
      await client.rpc("increment_rate_limit", {
        p_user_id: userId,
        p_module: module,
        p_window: windowStart,
      });
    } catch {
      // Fallback: direct upsert if RPC doesn't exist
      await client.from("ai_rate_limits").upsert(
        {
          user_id: userId,
          module,
          window_start: windowStart,
          call_count: current + 1,
        },
        { onConflict: "user_id,module,window_start" },
      );
    }

    return { allowed: true, remaining: limit - current - 1 };
  } catch {
    return { allowed: true, remaining: 999 }; // fail open
  }
}
