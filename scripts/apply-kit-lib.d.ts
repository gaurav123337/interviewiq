/* Hand-written types for scripts/apply-kit-lib.js (Phase 2 tailoring
   preview). Mirrors scripts/apply-engine-lib.d.ts conventions: public
   shapes the driver, tests and (later) the app UI consume. */

export interface DiffLine {
  type: "same" | "add" | "del";
  text: string;
}

export interface ResumeSection {
  heading: string;
  lines: string[];
}

export interface TailoredSection {
  heading: string;
  status: "unchanged" | "changed";
  lines: DiffLine[];
  /** JD keywords found on the section's ADDED lines only — the edit
      justification (never keywords the master already carried). */
  matchedKeywords: string[];
}

export interface TailoredPreview {
  sections: TailoredSection[];
  changedCount: number;
  matchedKeywords: string[];
}

export interface TailorGateDecision {
  canSubmit: boolean;
  reason: string;
}

export interface TailorGateInput {
  /** the kit carried an AI-rewritten resume/cover (kit.ai truthy) */
  llmAuthored?: boolean;
  /** apply profile's `autoTailor` — owner pre-consent to LLM tailoring */
  autoTailor?: boolean;
  /** this variant already passed human approval */
  approved?: boolean;
}

export interface ResumeVariantRecord {
  id?: string;
  resume?: string;
  text?: string;
  [k: string]: unknown;
}

export function stableVariantId(text: unknown): string;

export function splitResumeSections(text: unknown): ResumeSection[];

export function keywordsSupportingChange(addedLines: string[], jdKeywords: Array<string | null | undefined>): string[];

export function previewTailoredResume(
  masterText: unknown,
  variantText: unknown,
  opts?: { jdKeywords?: Array<string | null | undefined> }
): TailoredPreview;

export function tailorSubmitGate(input?: TailorGateInput): TailorGateDecision;

export function appendResumeVariant(
  history: Array<ResumeVariantRecord> | null | undefined,
  entry: ResumeVariantRecord,
  opts?: { max?: number }
): ResumeVariantRecord[];
