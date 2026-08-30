/**
 * Token Estimator — dynamically estimates output token limits.
 * 
 * SRP: Only responsible for estimating how many tokens the AI should output.
 * No API calls, no settings management, no caching.
 */

// ChatMessage type — defined locally to avoid circular dependency
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Module-specific token hints — baseline estimates per module type */
const MODULE_OUTPUT_HINTS: Record<string, number> = {
  hint: 128,
  feedback: 600,
  coach: 1200,
  deepdive: 800,
  rag: 500,
  contentRefine: 4000,
  articleNormalize: 6000,
};

const TOKEN_FLOOR = 128;
const TOKEN_CEILING = 8192;

/**
 * Detect whether the prompt likely asks for structured/JSON output.
 * Used to decide between prose vs structured token estimates.
 */
function expectsStructuredOutput(messages: ChatMessage[]): boolean {
  const allText = messages.map(m => m.content).join(" ").toLowerCase();
  return (
    allText.includes("json") ||
    allText.includes("respond in exactly this") ||
    allText.includes("respond with a json") ||
    allText.includes('" begin') ||
    allText.match(/\{[\s\S]{0,50}"[a-z]+"\s*:/) !== null
  );
}

/**
 * Estimate the ideal output token limit for a request.
 * 
 * Strategy:
 * 1. Count input tokens (English ~ 4 chars per token)
 * 2. Detect structured vs prose output
 * 3. Pick HIGHER of: input-based estimate OR module-specific hint
 * 4. Clamp to [TOKEN_FLOOR, TOKEN_CEILING]
 * 
 * @param messages - The chat messages being sent
 * @param moduleId - The module identifier (e.g. "contentRefine")
 * @returns Estimated token count
 */
export function estimateOutputTokens(
  messages: ChatMessage[],
  moduleId: string,
): number {
  // 1. Estimate input tokens
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  const inputTokens = Math.ceil(totalChars / 4);

  // 2. Base estimate: structured output needs ~1.5x input; prose needs ~0.4x
  const isStructured = expectsStructuredOutput(messages);
  const baseEstimate = isStructured
    ? Math.ceil(inputTokens * 1.5)
    : Math.ceil(inputTokens * 0.4);

  // 3. Module-specific hint (absolute token count)
  const moduleHint = MODULE_OUTPUT_HINTS[moduleId] ?? 0;

  // 4. Take HIGHER of base estimate or module hint — never compound
  const estimated = Math.max(baseEstimate, moduleHint);

  // 5. Clamp to sane bounds
  return Math.max(TOKEN_FLOOR, Math.min(estimated, TOKEN_CEILING));
}

/**
 * Resolve the final maxTokens for a request.
 * Validates against caller's explicit maxTokens to prevent truncation.
 */
export function resolveMaxTokens(
  messages: ChatMessage[],
  moduleId: string,
  callerMaxTokens?: number,
): number {
  const estimated = estimateOutputTokens(messages, moduleId);

  if (callerMaxTokens) {
    if (callerMaxTokens < estimated) {
      // Caller is under-requesting — use estimate to prevent truncation
      console.warn(
        `[ai] Token estimate ${estimated} > caller's maxTokens ${callerMaxTokens} for module "${moduleId}". Using estimate to prevent truncation.`
      );
      return estimated;
    }
    // Caller needs more — honor their request
    return callerMaxTokens;
  }

  // No explicit request — use dynamic estimate
  return estimated;
}
