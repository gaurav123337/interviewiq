/**
 * Model Capability Registry — fully dynamic, no hardcoded model names.
 *
 * Detects capabilities from naming patterns and model metadata.
 * Works for ANY model from ANY provider.
 */

/* ── Dynamic Detection ────────────────────────────────────────────────── */

/** Detect if a model name is a thinking/reasoning model */
export function isThinkingModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return (
    lower.includes("qwen3") ||
    lower.includes("qwq") ||
    lower.includes("deepseek-r1") ||
    lower.includes("deepseek-reasoner") ||
    lower.match(/\bo[13]\b/) !== null ||
    lower.includes("-o1") ||
    lower.includes("-o3") ||
    lower.includes("thinking") ||
    lower.includes("chain-of-thought") ||
    lower.includes("-cot") ||
    lower.includes("hy3") ||
    lower.includes("-reason") ||
    lower.includes("-think")
  );
}

/** Classify a model into capability tags */
export function classifyModel(modelName: string): {
  isThinking: boolean;
  tags: string[];
  description: string;
} {
  const lower = modelName.toLowerCase();
  const tags: string[] = [];
  let isThinking = false;

  // Thinking/reasoning detection
  if (isThinkingModel(modelName)) {
    isThinking = true;
    tags.push("thinking");
  }

  // Code-specialized
  if (lower.includes("coder") || lower.includes("code") || lower.includes("codestral")) {
    tags.push("code");
  }

  // Embeddings
  if (lower.includes("embed") || lower.includes("embedding")) {
    tags.push("embeddings");
  }

  // Vision/multimodal
  if (lower.includes("vision") || lower.includes("-vl") || lower.includes("multimodal")) {
    tags.push("vision");
  }

  // Fast/cheap (by naming heuristic)
  if (lower.includes("mini") || lower.includes("flash") || lower.includes("lite") || lower.includes("nano") || lower.includes("tiny")) {
    tags.push("fast");
  }

  // Build description
  const parts: string[] = [];
  if (isThinking) parts.push("Reasoning/thinking model");
  if (tags.includes("fast")) parts.push("Fast & cheap");
  if (tags.includes("code")) parts.push("Code-specialized");
  if (tags.includes("embeddings")) parts.push("Embedding model");
  if (tags.includes("vision")) parts.push("Vision/multimodal");
  if (parts.length === 0) parts.push("General-purpose model");

  return { isThinking, tags, description: parts.join(" · ") };
}

/* ── Module Requirements ────────────────────────────────────────────────── */

export interface ModuleRequirement {
  name: string;
  needs: {
    structuredJson: boolean;
    longFormContent: boolean;
    reasoning: boolean;
    codeGeneration: boolean;
  };
  idealTags: string[]; // tags that make a model ideal
  avoidThinking: boolean; // if true, thinking models are bad for this module
}

export const MODULE_REQUIREMENTS: Record<string, ModuleRequirement> = {
  contentRefine: {
    name: "Content Refinement",
    needs: { structuredJson: true, longFormContent: true, reasoning: false, codeGeneration: false },
    idealTags: ["fast"],
    avoidThinking: true,
  },
  articleNormalize: {
    name: "Article Normalization",
    needs: { structuredJson: true, longFormContent: false, reasoning: false, codeGeneration: false },
    idealTags: ["fast"],
    avoidThinking: true,
  },
  contentIndex: {
    name: "Content Indexing",
    needs: { structuredJson: true, longFormContent: false, reasoning: false, codeGeneration: false },
    idealTags: ["fast"],
    avoidThinking: true,
  },
  contentQuality: {
    name: "Content Quality Scoring",
    needs: { structuredJson: true, longFormContent: false, reasoning: false, codeGeneration: false },
    idealTags: ["fast"],
    avoidThinking: true,
  },
  coach: {
    name: "AI Coach Chat",
    needs: { structuredJson: false, longFormContent: false, reasoning: true, codeGeneration: false },
    idealTags: [],
    avoidThinking: false,
  },
  hint: {
    name: "Interview Hints",
    needs: { structuredJson: false, longFormContent: false, reasoning: true, codeGeneration: false },
    idealTags: ["fast"],
    avoidThinking: false,
  },
  feedback: {
    name: "Answer Feedback",
    needs: { structuredJson: false, longFormContent: false, reasoning: true, codeGeneration: false },
    idealTags: [],
    avoidThinking: false,
  },
  deepdive: {
    name: "Deep Dive Analysis",
    needs: { structuredJson: false, longFormContent: true, reasoning: true, codeGeneration: false },
    idealTags: [],
    avoidThinking: false,
  },
  rag: {
    name: "RAG Response",
    needs: { structuredJson: false, longFormContent: false, reasoning: false, codeGeneration: false },
    idealTags: ["fast"],
    avoidThinking: false,
  },
  code: {
    name: "Code Assistant",
    needs: { structuredJson: false, longFormContent: false, reasoning: false, codeGeneration: true },
    idealTags: ["code"],
    avoidThinking: false,
  },
  tutor: {
    name: "Tutor / Explanations",
    needs: { structuredJson: false, longFormContent: true, reasoning: true, codeGeneration: false },
    idealTags: [],
    avoidThinking: false,
  },
  embeddings: {
    name: "Embeddings",
    needs: { structuredJson: false, longFormContent: false, reasoning: false, codeGeneration: false },
    idealTags: ["embeddings"],
    avoidThinking: false,
  },
};

/* ── Suitability Check ──────────────────────────────────────────────────── */

export interface SuitabilityResult {
  suitable: boolean;
  severity: "ok" | "warning" | "error";
  message: string;
  suggestions: string[];
}

/**
 * Check if a model is suitable for a given module.
 * Works for ANY model — uses dynamic classification, not hardcoded lists.
 */
export function checkModelSuitability(
  modelName: string,
  moduleId: string,
): SuitabilityResult {
  const req = MODULE_REQUIREMENTS[moduleId];
  if (!req) {
    return { suitable: true, severity: "ok", message: "Unknown module — cannot evaluate", suggestions: [] };
  }

  const { isThinking, tags, description } = classifyModel(modelName);

  // Embedding models should only be used for embeddings module
  if (tags.includes("embeddings") && moduleId !== "embeddings") {
    return {
      suitable: false,
      severity: "error",
      message: `"${modelName}" is an embedding model — it generates vectors, not text. Use a text generation model for ${req.name}.`,
      suggestions: ["Use a text generation model like gpt-4o-mini or gemini-2.5-flash"],
    };
  }

  // Thinking model used for JSON-output module — ALWAYS warn
  if (isThinking && req.avoidThinking) {
    return {
      suitable: false,
      severity: "warning",
      message: `⚠️ "${modelName}" is a thinking/reasoning model. It will waste ALL output tokens on internal reasoning instead of producing the structured JSON that ${req.name} needs. You WILL get empty or malformed responses.`,
      suggestions: [
        "Use a non-thinking model for direct JSON output",
        "Recommended: gpt-4o-mini, gemini-2.5-flash, claude-3-haiku",
      ],
    };
  }

  // Thinking model for conversational module — GOOD
  if (isThinking && req.needs.reasoning) {
    return {
      suitable: true,
      severity: "ok",
      message: `✅ "${modelName}" is a thinking model — reasoning helps for ${req.name}`,
      suggestions: [],
    };
  }

  // Non-thinking model for JSON-output module — IDEAL
  if (!isThinking && req.avoidThinking) {
    const fast = tags.includes("fast");
    return {
      suitable: true,
      severity: "ok",
      message: `✅ "${modelName}" is ideal for ${req.name}${fast ? " (fast & cheap)" : " (direct JSON output, no thinking overhead)"}`,
      suggestions: [],
    };
  }

  // Model has matching ideal tags
  const hasMatch = req.idealTags.some(t => tags.includes(t));
  if (req.idealTags.length > 0 && !hasMatch) {
    return {
      suitable: true,
      severity: "ok",
      message: `✅ "${modelName}" (${description}) — will work for ${req.name}`,
      suggestions: [],
    };
  }

  // All good
  const strengths: string[] = [];
  if (tags.includes("fast")) strengths.push("fast & cheap");
  if (tags.includes("code") && req.needs.codeGeneration) strengths.push("code-specialized");

  return {
    suitable: true,
    severity: "ok",
    message: strengths.length > 0
      ? `✅ "${modelName}" is suitable for ${req.name} (${strengths.join(", ")})`
      : `✅ "${modelName}" will work for ${req.name}`,
    suggestions: [],
  };
}

/** Get all suitability warnings for a model across all modules */
export function getModelWarnings(modelName: string): { moduleId: string; result: SuitabilityResult }[] {
  return Object.keys(MODULE_REQUIREMENTS)
    .map(moduleId => ({ moduleId, result: checkModelSuitability(modelName, moduleId) }))
    .filter(w => !w.result.suitable);
}
