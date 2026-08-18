#!/usr/bin/env node
/* Shared AI-provider config loader for the content pipeline.
   Reads the LIVE provider config from Supabase (public.ai_provider_config,
   key 'provider' — editable from the Admin dashboard → Secrets → AI pipeline),
   falling back to the legacy env vars (AI_CLEAN_KEY / AI_CLEAN_BASE /
   AI_CLEAN_MODEL) when the row is absent or no Supabase credentials exist.

   This is what lets the owner change the AI key from the APP itself — the
   GitHub Actions secrets are no longer the source of truth.

   Usage:
     import { loadAiProviderConfig } from "./ai-config.js";
     const cfg = await loadAiProviderConfig({ token, projectRef });

   Returns { key, base, model, source } — source is "supabase" or "env".
   key may be null when nothing is configured (callers skip gracefully). */

const API = "https://api.supabase.com/v1";

/** One Management-API SQL query (same shape as the other pipeline scripts). */
async function runSql(token, projectRef, sql) {
  const res = await fetch(`${API}/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SQL ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

/** Loads the AI provider config. Prefers the Supabase row; env is the legacy
    fallback so local runs and pre-migration setups keep working. */
export async function loadAiProviderConfig({ token, projectRef } = {}) {
  const t = token ?? process.env.SUPABASE_ACCESS_TOKEN;
  const ref = projectRef ?? process.env.SUPABASE_PROJECT_REF;
  if (t && ref) {
    try {
      const rows = await runSql(
        t, ref,
        "select value from public.ai_provider_config where key = 'provider' limit 1"
      );
      const v = Array.isArray(rows) && rows[0]?.value;
      if (v && typeof v === "object" && v.key) {
        return {
          key: String(v.key),
          base: String(v.base || "").replace(/\/+$/, "") || "https://api.openai.com/v1",
          model: String(v.model || "") || "gpt-4o-mini",
          source: "supabase"
        };
      }
    } catch (e) {
      console.warn(`(ai-config: Supabase read failed — falling back to env: ${e.message})`);
    }
  }
  return {
    key: process.env.AI_CLEAN_KEY ?? null,
    base: (process.env.AI_CLEAN_BASE || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: process.env.AI_CLEAN_MODEL || "gpt-4o-mini",
    source: "env"
  };
}
