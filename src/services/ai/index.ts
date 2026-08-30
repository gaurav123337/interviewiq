/**
 * AI Module — public API for AI functionality.
 * 
 * Architecture:
 * - settings.ts: API key, base URL, model management
 * - tokenEstimator.ts: Dynamic output token estimation
 * - fallbackChain.ts: Model fallback strategies
 * - Main ai.ts: Facade that composes these concerns
 */

export { getSettings, saveSettings, clearKey, aiAvailable, aiDefaultModel, DEFAULT_BASE, DEFAULT_MODEL } from "./settings";
export type { AISettings } from "./settings";
export { estimateOutputTokens, resolveMaxTokens } from "./tokenEstimator";
export { getFallbackModels } from "./fallbackChain";
