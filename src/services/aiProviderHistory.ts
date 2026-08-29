/**
 * AI Provider History — saves previous provider configs so admins can
 * quickly switch between providers without re-typing everything.
 *
 * Stored in ai_provider_config table with key pattern: provider_history:<id>
 * Admin-only RLS — keys are safe in Supabase.
 */

import { getSupabaseClient, getCloudState } from "./cloud";

export interface ProviderHistoryEntry {
  id: string;
  base: string;
  model: string;
  keyHint: string; // masked key for display (sk-…S6OS)
  fullKey: string; // actual key (only loaded on restore)
  savedAt: number; // timestamp
}

const MAX_HISTORY = 20;

/** Read all history entries (newest first) */
export async function listProviderHistory(): Promise<ProviderHistoryEntry[]> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) return [];

  const { data, error } = await client
    .from("ai_provider_config")
    .select("key, value, updated_at")
    .like("key", "provider_history:%");

  if (error || !data) return [];

  return data
    .map((row) => {
      const v = (typeof row.value === "string" ? JSON.parse(row.value) : row.value) ?? {};
      return {
        id: (row.key ?? "").replace("provider_history:", ""),
        base: v.base ?? "",
        model: v.model ?? "",
        keyHint: v.keyHint ?? "",
        fullKey: v.key ?? "",
        savedAt: typeof row.updated_at === "number" ? row.updated_at : Date.now(),
      };
    })
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** Save current config to history */
export async function saveToHistory(cfg: {
  base: string;
  model: string;
  key: string;
}): Promise<void> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) return;

  // Generate key hint (masked)
  const k = cfg.key;
  const keyHint = k.length <= 12 ? "••••" + k.slice(-4) : k.slice(0, 8) + "…" + k.slice(-4);

  // Detect provider family from base URL
  const base = cfg.base.toLowerCase();
  let family = "Custom";
  if (base.includes("openrouter")) family = "OpenRouter";
  else if (base.includes("openai")) family = "OpenAI";
  else if (base.includes("anthropic")) family = "Anthropic";
  else if (base.includes("google") || base.includes("gemini")) family = "Google";
  else if (base.includes("deepseek")) family = "DeepSeek";
  else if (base.includes("orca")) family = "OrcaRouter";
  else if (base.includes("groq")) family = "Groq";
  else if (base.includes("together")) family = "Together";

  const id = `${family.toLowerCase()}_${Date.now()}`;
  const value = {
    base: cfg.base,
    model: cfg.model,
    key: cfg.key,
    keyHint,
    family,
  };

  const { error } = await client.from("ai_provider_config").upsert(
    { key: `provider_history:${id}`, value, updated_at: Date.now() },
    { onConflict: "key" },
  );

  if (error) console.error("[aiProviderHistory] Save failed:", error.message);

  // Trim old entries (keep max 20)
  const all = await listProviderHistory();
  if (all.length > MAX_HISTORY) {
    const toDelete = all.slice(MAX_HISTORY);
    for (const entry of toDelete) {
      await client.from("ai_provider_config").delete().eq("key", `provider_history:${entry.id}`);
    }
  }
}

/** Delete a history entry */
export async function deleteHistoryEntry(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) return;
  await client.from("ai_provider_config").delete().eq("key", `provider_history:${id}`);
}

/** Format timestamp for display */
export function formatHistoryDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}
