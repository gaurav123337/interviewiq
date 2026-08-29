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

/** Fetch available models from the provider */
export async function fetchAvailableModels(forceRefresh = false): Promise<AiModel[]> {
  if (!forceRefresh && cachedModels && Date.now() - cacheTime < CACHE_TTL) {
    return cachedModels;
  }

  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) return [];

  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) return [];

    const projectUrl = CONFIG.supabase.url;
    const fnUrl = `${projectUrl}/functions/v1/ai-chat`;

    const res = await fetch(fnUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": CONFIG.supabase.anonKey,
      },
    });

    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const models: AiModel[] = data.models ?? [];

    cachedModels = models;
    cacheTime = Date.now();
    return models;
  } catch {
    return [];
  }
}

/** Clear the model cache (e.g., after changing provider) */
export function clearModelCache(): void {
  cachedModels = null;
  cacheTime = 0;
}
