/**
 * Model Capability Registry
 *
 * Maps model families to their strengths/weaknesses and modules to their requirements.
 * Used by:
 * 1. Product Config UI — show warnings when admin selects unsuitable model
 * 2. Edge function — smart fallback when model doesn't match task
 * 3. Client — suggest better models
 */

/* ── Model Types ────────────────────────────────────────────────────────── */

export type ModelType = "thinking" | "general" | "code" | "creative";

export interface ModelCapability {
  type: ModelType;
  /** Human-readable description */
  description: string;
  /** What this model excels at */
  strengths: string[];
  /** What this model struggles with */
  weaknesses: string[];
  /** Recommended model families (by provider prefix) */
  recommendedAlternatives: string[];
}

/* ── Module Requirements ────────────────────────────────────────────────── */

export interface ModuleRequirement {
  /** Human-readable module name */
  name: string;
  /** What this module needs */
  needs: {
    structuredJson: boolean;
    longFormContent: boolean;
    reasoning: boolean;
    codeGeneration: boolean;
  };
  /** Minimum recommended tokens */
  minTokens: number;
  /** Ideal model types for this module */
  idealModelTypes: ModelType[];
  /** Models that should NOT be used */
  avoidModelPatterns: string[];
}

/* ── Registry ───────────────────────────────────────────────────────────── */

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  thinking: {
    type: "thinking",
    description: "Chain-of-thought reasoning model",
    strengths: ["Complex reasoning", "Math/logic problems", "Multi-step analysis", "Nuanced conversations"],
    weaknesses: ["Structured JSON output", "Bulk content generation", "Fast responses"],
    recommendedAlternatives: ["gpt-4o-mini", "gemini-2.5-flash", "claude-3.5-haiku"],
  },
  general: {
    type: "general",
    description: "General-purpose model",
    strengths: ["Structured output", "Content generation", "Fast responses", "JSON formatting"],
    weaknesses: ["Deep reasoning", "Complex multi-step problems"],
    recommendedAlternatives: [],
  },
  code: {
    type: "code",
    description: "Code-specialized model",
    strengths: ["Code generation", "Code review", "Technical documentation"],
    weaknesses: ["Creative writing", "Conversational responses"],
    recommendedAlternatives: ["gpt-4o-mini", "deepseek-coder"],
  },
  creative: {
    type: "creative",
    description: "Creative writing model",
    strengths: ["Creative content", "Marketing copy", "Storytelling"],
    weaknesses: ["Structured data", "Precise JSON output"],
    recommendedAlternatives: ["gpt-4o-mini", "gemini-2.5-flash"],
  },
};

export const MODULE_REQUIREMENTS: Record<string, ModuleRequirement> = {
  contentRefine: {
    name: "Content Refinement",
    needs: {
      structuredJson: true,
      longFormContent: true,
      reasoning: false,
      codeGeneration: false,
    },
    minTokens: 4000,
    idealModelTypes: ["general"],
    avoidModelPatterns: ["qwen3", "deepseek-r1", "o1", "o3"],
  },
  articleNormalize: {
    name: "Article Normalization",
    needs: {
      structuredJson: true,
      longFormContent: false,
      reasoning: false,
      codeGeneration: false,
    },
    minTokens: 4000,
    idealModelTypes: ["general"],
    avoidModelPatterns: ["qwen3", "deepseek-r1", "o1", "o3"],
  },
  contentIndex: {
    name: "Content Indexing",
    needs: {
      structuredJson: true,
      longFormContent: false,
      reasoning: false,
      codeGeneration: false,
    },
    minTokens: 2000,
    idealModelTypes: ["general"],
    avoidModelPatterns: ["qwen3", "deepseek-r1", "o1", "o3"],
  },
  coach: {
    name: "AI Coach Chat",
    needs: {
      structuredJson: false,
      longFormContent: false,
      reasoning: true,
      codeGeneration: false,
    },
    minTokens: 800,
    idealModelTypes: ["thinking", "general"],
    avoidModelPatterns: [],
  },
  hint: {
    name: "Interview Hints",
    needs: {
      structuredJson: false,
      longFormContent: false,
      reasoning: true,
      codeGeneration: false,
    },
    minTokens: 200,
    idealModelTypes: ["thinking", "general"],
    avoidModelPatterns: [],
  },
  feedback: {
    name: "Answer Feedback",
    needs: {
      structuredJson: false,
      longFormContent: false,
      reasoning: true,
      codeGeneration: false,
    },
    minTokens: 600,
    idealModelTypes: ["thinking", "general"],
    avoidModelPatterns: [],
  },
  deepdive: {
    name: "Deep Dive Analysis",
    needs: {
      structuredJson: false,
      longFormContent: true,
      reasoning: true,
      codeGeneration: false,
    },
    minTokens: 1000,
    idealModelTypes: ["thinking", "general"],
    avoidModelPatterns: [],
  },
  rag: {
    name: "RAG Response",
    needs: {
      structuredJson: false,
      longFormContent: false,
      reasoning: false,
      codeGeneration: false,
    },
    minTokens: 500,
    idealModelTypes: ["general", "thinking"],
    avoidModelPatterns: [],
  },
};

/* ── Detection Helpers ──────────────────────────────────────────────────── */

/** Detect if a model name is a thinking/reasoning model */
export function isThinkingModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return (
    lower.includes("qwen3") ||
    lower.includes("deepseek-r1") ||
    lower.includes("o1") ||
    lower.includes("o3") ||
    lower.includes("thinking")
  );
}

/** Detect model type from name */
export function detectModelType(modelName: string): ModelType {
  const lower = modelName.toLowerCase();
  if (isThinkingModel(lower)) return "thinking";
  if (lower.includes("coder") || lower.includes("code")) return "code";
  if (lower.includes("creative") || lower.includes("story")) return "creative";
  return "general";
}

/* ── Suitability Check ──────────────────────────────────────────────────── */

export interface SuitabilityResult {
  suitable: boolean;
  severity: "ok" | "warning" | "error";
  message: string;
  suggestions: string[];
}

/** Check if a model is suitable for a given module */
export function checkModelSuitability(
  modelName: string,
  moduleId: string,
): SuitabilityResult {
  const req = MODULE_REQUIREMENTS[moduleId];
  if (!req) {
    return { suitable: true, severity: "ok", message: "Unknown module — cannot evaluate", suggestions: [] };
  }

  const modelType = detectModelType(modelName);
  const modelCap = MODEL_CAPABILITIES[modelType];
  const isThinking = isThinkingModel(modelName);

  // Check: thinking model used for JSON-output module
  if (req.needs.structuredJson && isThinking) {
    const alternatives = modelCap?.recommendedAlternatives ?? ["gpt-4o-mini", "gemini-2.5-flash"];
    return {
      suitable: false,
      severity: "warning",
      message: `"${modelName}" is a thinking model. It will waste all output tokens on internal reasoning instead of producing the structured JSON that ${req.name} needs. Thinking mode should be disabled for this module.`,
      suggestions: alternatives.map(a => `Use "${a}" instead (better for structured output)`),
    };
  }

  // Check: model type doesn't match module needs
  if (!req.idealModelTypes.includes(modelType)) {
    return {
      suitable: false,
      severity: "warning",
      message: `"${modelName}" (${modelCap?.description ?? modelType}) is not ideal for ${req.name}.`,
      suggestions: req.idealModelTypes.map(t => `Use a ${t} model for better results`),
    };
  }

  return {
    suitable: true,
    severity: "ok",
    message: `"${modelName}" is suitable for ${req.name}`,
    suggestions: [],
  };
}

/** Get all suitability warnings for a model across all modules */
export function getModelWarnings(modelName: string): { moduleId: string; result: SuitabilityResult }[] {
  return Object.keys(MODULE_REQUIREMENTS)
    .map(moduleId => ({ moduleId, result: checkModelSuitability(modelName, moduleId) }))
    .filter(w => !w.result.suitable);
}

/** Suggest the best model for a module from available options */
export function suggestModel(moduleId: string, availableModels: string[]): string | null {
  const req = MODULE_REQUIREMENTS[moduleId];
  if (!req) return null;

  // Find first available model that matches ideal types
  for (const model of availableModels) {
    const type = detectModelType(model);
    if (req.idealModelTypes.includes(type)) return model;
  }

  return null;
}
