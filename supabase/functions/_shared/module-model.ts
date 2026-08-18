/* Per-module AI model wiring (docs/deep-dive-system-design-plan.md §2).
   Modules can override the default provider (ai_provider_config key='provider')
   with their own row (key='module:<id>'). Resolution rule, applied everywhere
   (edge functions here, scripts/ai-config.js, src/services/aiProvider.ts):

     module:<id> row  →  provider row  →  none

   A module row may carry only { model } to inherit key/base from the provider
   (same account, different model), or a full { key, base, model } to use a
   completely different provider for that module. Keep AI_MODULE_IDS in sync
   with src/services/aiProvider.ts and scripts/ai-config.js. */

export const AI_MODULE_IDS = ["deepdive", "rag", "feedback", "hint", "coach"] as const;
export type AiModuleId = (typeof AI_MODULE_IDS)[number];

export function isModuleId(id: string): id is AiModuleId {
  return (AI_MODULE_IDS as readonly string[]).includes(id);
}

export interface ResolvedModel {
  key: string;
  base: string;
  model: string;
  source: "module" | "provider" | "none";
}

/** Pure resolution from the two rows — unit-testable without a client. */
export function resolveModuleFromRows(
  modRow: { value?: unknown } | null,
  defRow: { value?: unknown } | null
): ResolvedModel {
  const mod = (modRow?.value ?? null) as { key?: string; base?: string; model?: string } | null;
  const def = (defRow?.value ?? null) as { key?: string; base?: string; model?: string } | null;
  if (mod && (mod.model || mod.key)) {
    return {
      key: mod.key ?? def?.key ?? "",
      base: (mod.base ?? def?.base ?? "").replace(/\/+$/, ""),
      model: mod.model ?? def?.model ?? "",
      source: "module"
    };
  }
  if (def && def.key) {
    return {
      key: def.key,
      base: (def.base ?? "").replace(/\/+$/, ""),
      model: def.model ?? "",
      source: "provider"
    };
  }
  return { key: "", base: "", model: "", source: "none" };
}

/** Resolve a module's model from the DB via the service role (bypasses RLS). */
export async function moduleModel(
  admin: import("npm:@supabase/supabase-js@2").SupabaseClient,
  moduleId: AiModuleId
): Promise<ResolvedModel> {
  const [{ data: modRow }, { data: defRow }] = await Promise.all([
    admin.from("ai_provider_config").select("value").eq("key", `module:${moduleId}`).maybeSingle(),
    admin.from("ai_provider_config").select("value").eq("key", "provider").maybeSingle()
  ]);
  return resolveModuleFromRows(modRow, defRow);
}
