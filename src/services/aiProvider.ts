/* AI provider config for the content pipeline (AI cleaner + AI problem bank).
   The live key/base/model live in public.ai_provider_config (key='provider')
   — a PRIVATE admin-only table (RLS is_admin()), unlike app_config which is
   publicly readable. The Admin dashboard edits it here; the pipeline scripts
   (scripts/ai-config.js) read the same row server-side via the Management
   API, so changing the key in the app is all that's needed — no GitHub
   Actions secret edits. */

import { getCloudState, getSupabaseClient } from "./cloud";
import { DEFAULT_EMBED_MODEL } from "./embeddings";

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
  coach: { label: "AI coach chat", hint: "conversational" },
  contentRefine: { label: "Content refinement", hint: "transforms raw content into structured articles" },
  contentQuality: { label: "Content quality scoring", hint: "evaluates content accuracy and relevance" },
  articleNormalize: { label: "Article normalization", hint: "transforms any article into multi-level structured content" },
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

/* ── Embeddings provider (key='embeddings') ──────────────────────────────────
   A dedicated row because the chat provider and the embeddings provider are
   often NOT the same service: OpenRouter (the documented chat default) has no
   /embeddings endpoint at all. Server-side, _shared/embedProvider.ts resolves
   embeddings row → provider row → env; these three functions are the admin UI
   for the first tier. */

export interface EmbeddingsProviderStatus extends AiProviderStatus {
  /** True when there is NO dedicated embeddings row and this status reflects the
      chat provider (key='provider') being used as the fallback — the UI warns
      that the chat provider may not speak /embeddings. */
  inherited: boolean;
}

/** Reads the embeddings provider config. When no dedicated key='embeddings' row
    exists, falls back to the chat provider (key='provider') flagged
    inherited:true — mirroring the server resolver's ladder. In that inherited
    case the effective model is DEFAULT_EMBED_MODEL (the server never embeds with
    the provider's CHAT model), so that is what we surface, not prov.model. */
export async function getEmbeddingsProviderConfig(): Promise<EmbeddingsProviderStatus> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data, error } = await client
    .from("ai_provider_config")
    .select("value, updated_at")
    .eq("key", "embeddings")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const v = (data?.value ?? null) as AiProviderConfig | null;
  if (v && v.key) {
    return {
      configured: true,
      source: "supabase",
      inherited: false,
      base: v.base || "",
      model: v.model || DEFAULT_EMBED_MODEL,
      keyHint: hint(v.key),
      updatedAt: typeof data?.updated_at === "number" ? data.updated_at : null
    };
  }
  const prov = await getAiProviderConfig();
  return {
    configured: prov.configured,
    source: prov.source,
    inherited: prov.configured,
    base: prov.base,
    /* server embeds with the default embed model when the row has none — never
       the chat provider's model — so show that, not prov.model. */
    model: prov.configured ? DEFAULT_EMBED_MODEL : "",
    keyHint: prov.keyHint,
    updatedAt: prov.updatedAt
  };
}

/** Saves the dedicated embeddings provider config (key='embeddings'). RLS
    enforces is_admin() server-side. A blank key keeps the existing dedicated
    key (so the admin can edit base/model alone); it's only required when
    creating the row for the first time. */
export async function saveEmbeddingsProviderConfig(cfg: AiProviderConfig): Promise<void> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  let key = cfg.key.trim();
  if (!key) {
    /* keep the existing dedicated key — admin RLS lets us read the full row. */
    const { data } = await client.from("ai_provider_config").select("value").eq("key", "embeddings").maybeSingle();
    key = ((data?.value ?? null) as AiProviderConfig | null)?.key?.trim() ?? "";
    if (!key) throw new Error("API key is required");
  }
  const value = {
    key,
    base: cfg.base.trim().replace(/\/+$/, ""),
    model: cfg.model.trim()
  };
  const { error } = await client.from("ai_provider_config").upsert(
    { key: "embeddings", value, updated_at: Date.now() },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

/** One live call to the provider's /embeddings endpoint — proves the key + base
    actually speak embeddings (many chat providers, e.g. OpenRouter, do NOT) and
    that the model returns 1536-dim vectors to match the pdf_chunks column. Uses
    /embeddings, NOT /models, precisely because /models passes for providers that
    can't embed. */
export async function testEmbeddingsProvider(cfg: { key: string; base: string; model: string }): Promise<{ ok: boolean; note: string }> {
  const base = (cfg.base.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = cfg.model.trim() || DEFAULT_EMBED_MODEL;
  if (!cfg.key.trim()) return { ok: false, note: "Enter a key first" };
  try {
    const res = await fetch(`${base}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key.trim()}` },
      body: JSON.stringify({ model, input: ["ping"] })
    });
    if (!res.ok) {
      if (res.status === 401) return { ok: false, note: "HTTP 401 — key rejected by the provider" };
      if (res.status === 402) return { ok: false, note: "HTTP 402 — provider account out of credits" };
      if (res.status === 404) return { ok: false, note: `HTTP 404 — ${base} has no /embeddings endpoint (this provider can't embed)` };
      if (res.status === 429) return { ok: false, note: "HTTP 429 — rate limited, try again shortly" };
      let note = `HTTP ${res.status} from ${base}`;
      try { const j = await res.json(); if (j?.error?.message) note = j.error.message; } catch { /* keep status note */ }
      return { ok: false, note };
    }
    const j = await res.json().catch(() => ({}));
    const dim = ((j?.data?.[0]?.embedding ?? []) as number[]).length;
    if (dim === 0) return { ok: false, note: "Provider replied but returned no embedding vector" };
    if (dim !== 1536) return { ok: false, note: `Model returns ${dim}-dim vectors — the KB needs 1536-dim (use text-embedding-3-small).` };
    return { ok: true, note: "Embeddings OK — 1536-dim vectors returned" };
  } catch (e) {
    return { ok: false, note: `Couldn't reach ${base} — ${(e as Error).message}` };
  }
}

export interface ModuleModelRow {
  model: string;
  key: string;
  base: string;
}

/** Reads every module:<id> override row (admin-only via RLS). */
export async function getModuleModels(): Promise<Record<string, ModuleModelRow>> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data, error } = await client.from("ai_provider_config").select("key, value").like("key", "module:%");
  if (error) throw new Error(error.message);
  const out: Record<string, ModuleModelRow> = {};
  for (const r of (data ?? []) as { key: string; value: unknown }[]) {
    const id = r.key.replace(/^module:/, "");
    const v = (r.value ?? {}) as Partial<AiProviderConfig>;
    out[id] = { model: v.model ?? "", key: v.key ?? "", base: v.base ?? "" };
  }
  return out;
}

/** Saves a module override (blank key/base = inherit from provider); pass
    null/blank to delete the override and fall back to the default provider. */
export async function saveModuleModel(id: string, cfg: { model: string; key?: string; base?: string } | null): Promise<void> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  if (!cfg || (!cfg.model.trim() && !(cfg.key ?? "").trim())) {
    const { error } = await client.from("ai_provider_config").delete().eq("key", `module:${id}`);
    if (error) throw new Error(error.message);
    return;
  }
  const value = {
    model: cfg.model.trim(),
    key: (cfg.key ?? "").trim(),
    base: (cfg.base ?? "").trim().replace(/\/+$/, "")
  };
  const { error } = await client.from("ai_provider_config").upsert(
    { key: `module:${id}`, value, updated_at: Date.now() },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

/** Pure resolution preview — mirrors supabase/functions/_shared/module-model.ts.
    moduleRow null/blank = provider; provider null = none. Display-only (the
    real resolution happens server-side in the ai-chat function). */
export function resolveModulePreview(
  moduleRow: ModuleModelRow | null | undefined,
  provider: { keyHint: string; model: string } | null | undefined
): { model: string; source: "module" | "provider" | "none"; keyHint: string } {
  if (moduleRow && (moduleRow.model || moduleRow.key)) {
    return {
      model: moduleRow.model || provider?.model || "",
      source: "module",
      keyHint: moduleRow.key ? hint(moduleRow.key) : (provider?.keyHint ?? "")
    };
  }
  if (provider?.model) return { model: provider.model, source: "provider", keyHint: provider.keyHint ?? "" };
  return { model: "", source: "none", keyHint: "" };
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
