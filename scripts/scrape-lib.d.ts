export interface ScrapeItem {
  fieldId: string;
  level: string;
  question: string;
  answer: string;
  keyPoints: string[];
}

export interface ScrapeSource {
  id?: string;
  enabled?: boolean;
  url?: string;
  type?: "json" | "html" | "markdown";
  fieldId?: string;
  level?: string;
  maxItems?: number;
  keyPoints?: string[];
  [k: string]: unknown;
}

export function normalizeItem(raw: Record<string, unknown>, source: ScrapeSource): ScrapeItem | null;
export function extractFromJson(body: unknown, source: ScrapeSource): ScrapeItem[];
export function extractFromHtml(html: string, source: ScrapeSource): ScrapeItem[];
export function extractItems(body: unknown, source: ScrapeSource): ScrapeItem[];
export function sqlStr(v: string | number): string;
export function buildUpsertSql(rows: ScrapeItem[]): string;
