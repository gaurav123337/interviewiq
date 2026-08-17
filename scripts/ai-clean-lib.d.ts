export interface CleanDraft {
  question: string;
  fieldId?: string;
  level?: string;
  meta?: Record<string, unknown>;
}

export interface CleanResult {
  question: string;
  answer: string;
  keyPoints: string[];
  difficulty: number | null;
  company: string | null;
}

export function buildCleanPrompt(item: CleanDraft): string;
export function parseCleanJson(text: string): Record<string, unknown> | null;
export function applyClean(item: CleanDraft, clean: unknown): CleanResult | null;
