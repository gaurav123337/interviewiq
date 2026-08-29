/**
 * AI Output Normalizer — converts ANY model output into clean structured JSON.
 *
 * Philosophy: Same as the resume normalizer — don't handle every format in
 * every consumer. Normalize once at the source.
 *
 * Works for:
 * - Clean JSON (passthrough)
 * - JSON with thinking/reasoning prefix
 * - JSON wrapped in ```json code blocks
 * - Markdown with headers (## Beginner, ## Intermediate, etc.)
 * - Plain text with sections
 * - Truncated output
 * - Mixed thinking + JSON
 * - ANY model from ANY provider
 *
 * Usage:
 *   const result = normalizeAiOutput(rawText, ['beginner', 'intermediate', 'advanced']);
 *   if (result.parsed) { ... }
 */

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface NormalizeResult {
  /** Whether we got valid structured output */
  parsed: Record<string, unknown> | null;
  /** How we extracted it (for logging/debugging) */
  strategy: string;
  /** Cleaned text (thinking stripped, trimmed) */
  cleanedText: string;
  /** Original response length */
  rawLength: number;
  /** How much was stripped (thinking preamble) */
  strippedLength: number;
  /** Quality validation */
  quality: QualityCheck;
}

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

/* ── Core Normalizer ───────────────────────────────────────────────────── */

/**
 * Normalize ANY AI output into structured JSON.
 *
 * @param raw - The raw AI response (may contain thinking, markdown, plain text)
 * @param requiredKeys - JSON keys we expect (e.g., ['beginner', 'intermediate', 'advanced'])
 * @returns NormalizeResult with parsed JSON or null
 */
export function normalizeAiOutput(
  raw: string,
  requiredKeys: string[],
): NormalizeResult {
  if (!raw || raw.trim().length < 50) {
    return { parsed: null, strategy: 'empty', cleanedText: raw, rawLength: raw.length, strippedLength: 0, quality: { score: 0, passed: false, issues: ['Response too short'], suggestions: [] } };
  }

  const rawLength = raw.length;

  // ═══ Step 1: Strip thinking preamble ═══
  const cleaned = stripThinkingPreamble(raw);
  const strippedLength = rawLength - cleaned.length;

  // Helper to build result with quality check
  const result = (parsed: Record<string, unknown> | null, strategy: string): NormalizeResult => {
    const quality = validateQuality(parsed, requiredKeys, strategy, rawLength);
    // Penalize if too much was stripped (model wasted tokens on thinking)
    if (rawLength > 0 && strippedLength / rawLength > 0.5) {
      quality.issues.push(`Model wasted ${Math.round(strippedLength / rawLength * 100)}% of output on thinking`);
      quality.score = Math.max(0, quality.score - 15);
      quality.suggestions.push('Use a non-thinking model to get more actual content');
    }
    quality.passed = quality.score >= 50 && quality.issues.every(i => !i.includes('Missing'));
    return { parsed, strategy, cleanedText: cleaned, rawLength, strippedLength, quality };
  };

  // ═══ Step 2: Try to extract JSON ═══

  // Strategy A: JSON in code block
  const fromCodeBlock = extractFromCodeBlock(cleaned);
  if (fromCodeBlock && hasRequiredKeys(fromCodeBlock, requiredKeys)) {
    return result(fromCodeBlock, 'code-block');
  }

  // Strategy B: JSON by key name (handles thinking models)
  const fromKey = extractJsonByKey(cleaned, requiredKeys[0] || 'beginner');
  if (fromKey && hasRequiredKeys(fromKey, requiredKeys)) {
    return result(fromKey, 'key-extraction');
  }

  // Strategy C: Plain JSON (no prefix)
  const plainJson = tryParseJson(cleaned);
  if (plainJson && hasRequiredKeys(plainJson, requiredKeys)) {
    return result(plainJson, 'plain-json');
  }

  // ═══ Step 3: Non-JSON formats ═══

  // Strategy D: Markdown headers
  const fromHeaders = extractFromHeaders(cleaned, requiredKeys);
  if (fromHeaders) {
    return result(fromHeaders, 'markdown-headers');
  }

  // Strategy E: Content splitting (last resort)
  if (cleaned.length > 200) {
    const split = splitContent(cleaned, requiredKeys);
    return result(split, 'content-split');
  }

  return result(null, 'failed');
}

/* ── Thinking Preamble Stripper ────────────────────────────────────────── */

function stripThinkingPreamble(text: string): string {
  // Find the first '{' that's followed by a JSON key pattern
  const jsonKeyPattern = /\{"?beginner"?|{"?intermediate"?|{"?summary"?|{"?content"?/;
  const match = text.match(jsonKeyPattern);

  if (match && match.index !== undefined && match.index > 0) {
    // Walk backward from the key to find the opening {
    let start = match.index;
    while (start > 0 && text[start] !== '{') start--;
    if (text[start] === '{' && start > 0) {
      console.log('[aiOutputNormalizer] Stripping', start, 'chars of thinking preamble');
      return text.slice(start);
    }
  }

  // Fallback: find first { and check if preceding text looks like thinking
  const firstBrace = text.indexOf('{');
  if (firstBrace > 20) {
    const before = text.slice(0, firstBrace).toLowerCase().trim();
    const thinkingStarts = /^(we|let|need|must|should|first|the|based|given|from|after|since|because|if|when|before|okay|alright|here|i |my |so |now |to |for |this )/i;
    if (thinkingStarts.test(before)) {
      console.log('[aiOutputNormalizer] Stripping', firstBrace, 'chars of thinking preamble (fallback)');
      return text.slice(firstBrace);
    }
  }

  return text;
}

/* ── JSON Extraction ───────────────────────────────────────────────────── */

function extractFromCodeBlock(text: string): Record<string, unknown> | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!match) return null;
  return tryParseJson(match[1].trim());
}

function extractJsonByKey(text: string, key: string): Record<string, unknown> | null {
  const searchKey = `"${key}"`;
  const keyIdx = text.indexOf(searchKey);
  if (keyIdx < 0) return null;

  // Walk backward to find opening {
  let start = keyIdx;
  while (start > 0 && text[start] !== '{') start--;
  if (text[start] !== '{') return null;

  // Brace-count forward to find matching }
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end <= start) return null;

  return tryParseJson(text.slice(start, end + 1));
}

function tryParseJson(text: string): Record<string, unknown> | null {
  // Direct parse
  try { return JSON.parse(text); } catch { /* next */ }

  // Fix common issues
  const fixed = text
    .replace(/'/g, '"')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":'); // unquoted keys

  try { return JSON.parse(fixed); } catch { return null; }
}

function hasRequiredKeys(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(k => obj[k] !== undefined && obj[k] !== null && String(obj[k]).length > 0);
}

/* ── Markdown Header Extraction ────────────────────────────────────────── */

function extractFromHeaders(
  text: string,
  keys: string[],
): Record<string, unknown> | null {
  const lines = text.split('\n');
  const sections: Record<string, string[]> = {};
  let currentSection = '';
  let capturing = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(/^#{1,3}\s+(.+)/i);

    if (headerMatch) {
      const title = headerMatch[1].toLowerCase();
      // Map header to our keys
      for (const key of keys) {
        if (title.includes(key.toLowerCase()) ||
            (key === 'beginner' && /^(what is|introduction|intro|overview|simplified|getting started)/i.test(title)) ||
            (key === 'intermediate' && /^(how|implementation|details|patterns|working)/i.test(title)) ||
            (key === 'advanced' && /^(deep|advanced|interview|performance|internals)/i.test(title))) {
          currentSection = key;
          capturing = true;
          sections[key] = [];
          break;
        }
      }
      if (capturing && !sections[currentSection]) {
        capturing = false;
      }
    } else if (capturing && currentSection && trimmed) {
      sections[currentSection].push(line);
    }
  }

  // Check if we got all required sections
  const result: Record<string, unknown> = {};
  let allFound = true;
  for (const key of keys) {
    if (sections[key] && sections[key].length > 0) {
      result[key] = sections[key].join('\n').trim();
    } else {
      allFound = false;
    }
  }

  return allFound ? result : null;
}

/* ── Content Splitting ─────────────────────────────────────────────────── */

function splitContent(
  text: string,
  keys: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (keys.length === 0) return result;

  const words = text.split(/\s+/).filter(Boolean);
  const perSection = Math.ceil(words.length / keys.length);

  for (let i = 0; i < keys.length; i++) {
    const start = i * perSection;
    const end = Math.min(start + perSection, words.length);
    result[keys[i]] = words.slice(start, end).join(' ');
  }

  return result;
}

/* ── Quality Validation ─────────────────────────────────────────────────── */

function validateQuality(
  parsed: Record<string, unknown> | null,
  keys: string[],
  strategy: string,
  rawLength: number,
): QualityCheck {
  if (!parsed) {
    return { score: 0, passed: false, issues: ['No structured output extracted'], suggestions: ['Try a different model or check API configuration'] };
  }

  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Check 1: All required keys present
  const missingKeys = keys.filter(k => !parsed[k] || String(parsed[k]).trim().length === 0);
  if (missingKeys.length > 0) {
    issues.push(`Missing keys: ${missingKeys.join(', ')}`);
    score -= missingKeys.length * 20;
  }

  // Check 2: Content length per key (too short = bad)
  const minWords = 20;
  for (const key of keys) {
    const val = String(parsed[key] || '');
    const words = val.split(/\s+/).filter(Boolean).length;
    if (words < minWords) {
      issues.push(`"${key}" has only ${words} words (minimum ${minWords})`);
      score -= 15;
    }
  }

  // Check 3: Identical content across levels (sign of bad extraction)
  const values = keys.map(k => String(parsed[k] || '').trim());
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
          // Simple overlap check: first 100 chars
          const overlap = values[i].slice(0, 100) === values[j].slice(0, 100);
          if (overlap) {
            issues.push(`"${keys[i]}" and "${keys[j]}" start with identical text`);
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

  // Check 6: Response was mostly thinking (stripped a lot)
  if (rawLength > 0) {
    // This check is done in the caller (strippedLength / rawLength)
  }

  // Normalize score
  score = Math.max(0, Math.min(100, score));

  const passed = score >= 50 && missingKeys.length === 0;

  if (passed && issues.length === 0) {
    suggestions.push('Output looks good');
  }

  return { score, passed, issues, suggestions };
}
