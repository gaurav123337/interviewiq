/**
 * AI Quality Validator — validates the quality of extracted AI output.
 * 
 * SRP: Only responsible for scoring and validating extracted content.
 * No JSON extraction, no thinking stripping, no parsing.
 * 
 * Used by aiOutputNormalizer and contentRefiner to assess output quality.
 */

export interface QualityCheck {
  /** Overall quality score (0-100) */
  score: number;
  /** Whether the output passes quality gates */
  passed: boolean;
  /** Issues found */
  issues: string[];
  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Validate the quality of extracted AI output.
 * 
 * @param parsed - The extracted JSON object (or null)
 * @param requiredKeys - Expected JSON keys
 * @param strategy - How the content was extracted (for scoring)
 * @param rawLength - Original response length (for thinking waste detection)
 * @returns QualityCheck with score, issues, and suggestions
 */
export function validateQuality(
  parsed: Record<string, unknown> | null,
  requiredKeys: string[],
  strategy: string,
  rawLength: number,
): QualityCheck {
  if (!parsed) {
    return {
      score: 0,
      passed: false,
      issues: ['No structured output extracted'],
      suggestions: ['Try a different model or check API configuration']
    };
  }

  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Check 1: All required keys present
  const missingKeys = requiredKeys.filter(k => !parsed[k] || String(parsed[k]).trim().length === 0);
  if (missingKeys.length > 0) {
    issues.push(`Missing keys: ${missingKeys.join(', ')}`);
    score -= missingKeys.length * 20;
  }

  // Check 2: Content length per key (too short = bad)
  const minWords = 20;
  for (const key of requiredKeys) {
    const val = String(parsed[key] || '');
    const words = val.split(/\s+/).filter(Boolean).length;
    if (words < minWords) {
      issues.push(`"${key}" has only ${words} words (minimum ${minWords})`);
      score -= 15;
    }
  }

  // Check 3: Identical content across levels (sign of bad extraction)
  const values = requiredKeys.map(k => String(parsed[k] || '').trim());
  const uniqueValues = new Set(values);
  if (uniqueValues.size === 1 && values.length > 1 && values[0].length > 0) {
    issues.push('All difficulty levels have identical content — extraction likely failed');
    score -= 50;
    suggestions.push('Model may not be following format instructions — try gpt-4o-mini');
  }

  // Check 4: Similarity between levels (partial duplication)
  if (uniqueValues.size > 1) {
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        if (values[i].length > 50 && values[j].length > 50) {
          const overlap = values[i].slice(0, 100) === values[j].slice(0, 100);
          if (overlap) {
            issues.push(`"${requiredKeys[i]}" and "${requiredKeys[j]}" start with identical text`);
            score -= 20;
          }
        }
      }
    }
  }

  // Check 5: Strategy quality bonus
  if (strategy === 'code-block' || strategy === 'key-extraction' || strategy === 'plain-json') {
    score += 5; // JSON extraction is highest quality
  } else if (strategy === 'markdown-headers') {
    score += 2; // Markdown is good
  } else if (strategy === 'content-split') {
    score -= 10; // Content split is lowest quality
    suggestions.push('Content was split into thirds — difficulty levels may not be differentiated');
  }

  // Normalize score
  score = Math.max(0, Math.min(100, score));

  const passed = score >= 50 && missingKeys.length === 0;

  if (passed && issues.length === 0) {
    suggestions.push('Output looks good');
  }

  return { score, passed, issues, suggestions };
}

/**
 * Apply thinking waste penalty to quality check.
 * Called when a large portion of the response was thinking/reasoning.
 */
export function applyThinkingPenalty(
  quality: QualityCheck,
  rawLength: number,
  strippedLength: number,
): QualityCheck {
  if (rawLength > 0 && strippedLength / rawLength > 0.5) {
    const penalty = Math.round(strippedLength / rawLength * 100);
    quality.issues.push(`Model wasted ${penalty}% of output on thinking`);
    quality.score = Math.max(0, quality.score - 15);
    quality.suggestions.push('Use a non-thinking model to get more actual content');
  }
  quality.passed = quality.score >= 50 && quality.issues.every(i => !i.includes('Missing'));
  return quality;
}
