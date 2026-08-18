/* AI provider config for the content pipeline (AI cleaner + AI problem bank).
   The live key/base/model live in public.ai_provider_config (key='provider')
   — a PRIVATE admin-only table (RLS is_admin()), unlike app_config which is
   publicly readable. The Admin dashboard edits it here; the pipeline scripts
   (scripts/ai-config.js) read the same row server-side via the Management
   API, so changing the key in the app is all that's needed — no GitHub
   Actions secret edits. */

import { getCloudState, getSupabaseClient } from "./cloud";

export interface AiProviderConfig {
  key: string;
  base: string;
  model: string;
}

/** The modules that can have their own model. Order = Admin UI order. */
export const AI_MODULES: Record<string, { label: string; hint: string }> = {
  deepdive: { label: "System design deep-dives", hint: "best at explaining concepts" },
  rag: { label: "RAG tutor & knowledge answers", hint: "best at grounded retrieval answers" },
  feedback: { label: "Interview feedback", hint: "strict, concise graders" },
  hint: { label: "Hints", hint: "fast, cheap models" },
  coach: { label: "AI coach chat", hint: "conversational" }
};

export type AiModuleId = keyof typeof AI_MODULES;

export interface AiProviderStatus {
  configured: boolean;
  source: "supabase" | "none";
  base: string;
  model: string;
  keyHint: string;
  updatedAt: number | null;
}

function hint(key: string): string {
  if (!key) return "";
  return key.length <= 12 ? "••••" + key.slice(-4) : key.slice(0, 8) + "…" + key.slice(-4);
}

/** Reads the stored provider config (admin-only via RLS). Returns null when
    no row exists yet. Throws for non-admins / connection errors. */
export async function getAiProviderConfig(): Promise<AiProviderStatus> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data, error } = await client
    .from("ai_provider_config")
    .select("value, updated_at")
    .eq("key", "provider")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const v = (data?.value ?? null) as AiProviderConfig | null;
  if (!v || !v.key) return { configured: false, source: "none", base: "", model: "", keyHint: "", updatedAt: null };
  return {
    configured: true,
    source: "supabase",
    base: v.base || "",
    model: v.model || "",
    keyHint: hint(v.key),
    updatedAt: typeof data?.updated_at === "number" ? data.updated_at : null
  };
}

/** Saves the provider config. RLS enforces is_admin() server-side — a
    non-admin gets a permission error and the row is untouched. */
export async function saveAiProviderConfig(cfg: AiProviderConfig): Promise<void> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const value = {
    key: cfg.key.trim(),
    base: cfg.base.trim().replace(/\/+$/, ""),
    model: cfg.model.trim()
  };
  if (!value.key) throw new Error("API key is required");
  const { error } = await client.from("ai_provider_config").upsert(
    { key: "provider", value, updated_at: Date.now() },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

/** One live call to the provider's /models endpoint with the given key —
    proves the key + base URL work before you save. CORS permitting. */
export async function testAiProvider(cfg: { key: string; base: string }): Promise<{ ok: boolean; note: string }> {
  const base = (cfg.base.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!cfg.key.trim()) return { ok: false, note: "Enter a key first" };
  try {
    const res = await fetch(`${base}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cfg.key.trim()}` }
    });
    if (res.ok) return { ok: true, note: "Key accepted — provider reachable" };
    if (res.status === 401) return { ok: false, note: "HTTP 401 — key rejected by the provider" };
    if (res.status === 402) return { ok: false, note: "HTTP 402 — provider account out of credits" };
    if (res.status === 429) return { ok: false, note: "HTTP 429 — rate limited, try again shortly" };
    return { ok: false, note: `HTTP ${res.status} from ${base}` };
  } catch (e) {
    return { ok: false, note: `Couldn't reach ${base} — ${(e as Error).message}` };
  }
}
