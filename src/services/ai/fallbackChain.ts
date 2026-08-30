/**
 * Fallback Chain — manages model fallback strategies per provider.
 * 
 * SRP: Only responsible for determining which models to try on failure.
 * No API calls, no settings management, no token estimation.
 */

/** Fallback chains per provider — only models the provider actually serves */
const FALLBACK_CHAINS: Record<string, string[]> = {
  // OpenAI direct
  openai: ["gpt-4o-mini", "gpt-4.1-nano"],
  // Google Gemini
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
  // OpenRouter / OrcaRouter / any OpenAI-compatible router
  default: [], // Don't fall back to other providers — retry the same model
};

/**
 * Get the fallback chain for a given provider base URL.
 * 
 * @param base - The API base URL (used to detect provider)
 * @param model - The primary model to start with
 * @returns Array of models to try (primary + fallbacks)
 */
export function getFallbackModels(base: string, model: string): string[] {
  const lower = base.toLowerCase();
  
  let chain: string[];
  if (lower.includes("openai.com")) {
    chain = FALLBACK_CHAINS.openai;
  } else if (lower.includes("gemini") || lower.includes("google")) {
    chain = FALLBACK_CHAINS.gemini;
  } else {
    // For OrcaRouter, OpenRouter, etc — only retry the same model
    chain = FALLBACK_CHAINS.default;
  }

  // Build ordered list: primary first, then fallbacks (excluding primary)
  return [model, ...chain.filter(m => m !== model)];
}
