/** Tier-4 VLM form fallback (Phase 3). Field METADATA only — the model never
 *  supplies values; answers still come from the verified profile via
 *  planFormAnswers, so hallucinated answers stay structurally impossible. */

export interface VlmField {
  label: string;
  kind: "text" | "textarea" | "email" | "tel" | "url" | "number" | "date" | "select" | "checkbox" | "radio" | "file" | "other";
  /** false when the kind cannot be acted on safely (other/radio/file semantics
   *  need DOM grounding a screenshot cannot give) — driver routes these to
   *  needs-review with an honest reason instead of touching the control. */
  fillable: boolean;
  required: boolean;
  options?: string[];
}

export interface ParsedVlmFields {
  fields: VlmField[];
  /** count of malformed/unusable entries dropped from the reply */
  skipped: number;
}

export interface VlmEligibilityInput {
  fieldsCount?: number;
  hasAi?: boolean;
  /** the site's registry rules — `vlmFill: false` vetoes the tier */
  rules?: Record<string, unknown> | null;
}

export interface VlmEligibility {
  ok: boolean;
  reason: string;
}

export const MAX_VLM_FIELDS: number;
export const VLM_FILLABLE_KINDS: string[];
export const MAX_VLM_FILLS_PER_ATTEMPT: number;

export function vlmFillEligible(input?: VlmEligibilityInput): VlmEligibility;

export function vlmFieldsPrompt(
  pageTitle?: string
): { system: string; user: string };

export function parseVlmFields(raw: string | null | undefined): ParsedVlmFields;
