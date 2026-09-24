export interface ScrapeItem {
  fieldId: string;
  level: string;
  question: string;
  answer: string;
  keyPoints: string[];
  /** Canonical skill tags (Bank filter) — derived from question+answer text
      when the source didn't provide any (draft-quality-lib.deriveSkills). */
  skills?: string[];
  meta?: Record<string, unknown>;
  sourceId?: string;
  sourceUrl?: string;
}

export interface ScrapeSource {
  id?: string;
  enabled?: boolean;
  url?: string;
  type?: "json" | "html" | "markdown" | "company-list" | "hackernews";
  fieldId?: string;
  level?: string;
  maxItems?: number;
  keyPoints?: string[];
  headingDepth?: number;
  questionFromHeading?: boolean;
  groupAs?: string;
  company?: string;
  difficulty?: number;
  meta?: Record<string, unknown>;
  [k: string]: unknown;
}

export function normalizeItem(raw: Record<string, unknown>, source: ScrapeSource): ScrapeItem | null;
export function extractFromJson(body: unknown, source: ScrapeSource): ScrapeItem[];
export function extractFromHtml(html: string, source: ScrapeSource): ScrapeItem[];
export function extractFromMarkdown(md: string, source: ScrapeSource): ScrapeItem[];
export function extractCompanyList(md: string, source: ScrapeSource): ScrapeItem[];
export function extractFromHn(body: unknown, source: ScrapeSource): ScrapeItem[];
export function cleanMarkdown(md: string): string[];
export function extractItems(body: unknown, source: ScrapeSource): ScrapeItem[];
export function sqlStr(v: string | number): string;
export const MAX_QUESTION_CHARS: number;
export function partitionOversizeQuestions(
  rows: ScrapeItem[] | null | undefined,
  maxChars?: number
): [ScrapeItem[], ScrapeItem[]];
export function buildSuppressionClause(
  suppressions: (string | { question_text?: string | null })[] | null | undefined,
  questionCol?: string
): string;
export function buildUpsertSql(
  rows: ScrapeItem[],
  suppressions?: (string | { question_text?: string | null })[]
): string;
