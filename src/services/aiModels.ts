/**
 * Fetch available models from the admin-configured AI provider.
 * Calls the ai-chat edge function's GET /models endpoint.
 */

import { getSupabaseClient, getCloudState } from "./cloud";
import { CONFIG } from "../config";

export interface AiModel {
  id: string;
  name: string;
  owner: string;
  isThinking: boolean;
  tags: string[];
}

let cachedModels: AiModel[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Fetch available models from the provider.
    THROWS on failure (never silently resolves to []): callers must be able to
    SHOW why listing failed. A silent [] once surfaced as the scan's
    "Couldn't list models" while the same call worked from curl — the browser
    had CORS-blocked the response and this wrapper ate the error. Only a
    provider that genuinely lists zero models resolves to an empty array. */
export async function fetchAvailableModels(forceRefresh = false): Promise<AiModel[]> {
  if (!forceRefresh && cachedModels && Date.now() - cacheTime < CACHE_TTL) {
    return cachedModels;
  }

  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) {
    throw new Error("Sign in to your cloud account to list models.");
  }

  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sign in to your cloud account to list models.");
  }

  let res: Response;
  try {
    res = await fetch(`${CONFIG.supabase.url}/functions/v1/ai-chat`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": CONFIG.supabase.anonKey,
      },
    });
  } catch (e) {
    /* network/CORS — the browser masks the real status as "Failed to fetch" */
    throw new Error(`Couldn't reach the model list (network or CORS): ${(e as Error).message}`);
  }

  const body = await res.json().catch(() => ({} as { models?: AiModel[]; error?: string }));
  if (!res.ok || !Array.isArray(body.models)) {
    throw new Error(body.error ?? `Listing models failed (HTTP ${res.status}).`);
  }

  /* don't cache an empty list — a transient gateway hiccup would stick for 5 min */
  if (body.models.length) {
    cachedModels = body.models;
    cacheTime = Date.now();
  } else {
    cachedModels = null;
    cacheTime = 0;
  }
  return body.models;
}

/** Clear the model cache (e.g., after changing provider) */
export function clearModelCache(): void {
  cachedModels = null;
  cacheTime = 0;
}
