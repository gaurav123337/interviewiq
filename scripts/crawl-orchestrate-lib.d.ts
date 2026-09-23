import type { SeedClassification } from "./discover-lib.js";

export type RoutedKind = "qa" | "problem" | "resource";

export interface ClassifiedLink {
  url: string;
  title: string;
  kind: RoutedKind;
  pattern?: string;
}

export interface Attribution {
  source: string;
  kind: string;
  url: string;
  owner?: string;
  repo?: string;
  topic?: string;
  license?: string;
}

export interface RoutedItems {
  qa: Record<string, unknown>[];
  problems: { id: string; title: unknown; pattern: string }[];
  resources: unknown[];
  attribution: Attribution;
}

export declare function titleFromUrl(url: string): string;
export declare function classifyLink(
  rawUrl: string,
  baseUrl: string,
  linkText?: string
): ClassifiedLink | null;
export declare function attributionFor(
  seed: SeedClassification | Record<string, unknown> | null | undefined,
  extra?: Record<string, unknown>
): Attribution;
export declare function licenseGate(
  license: string | null | undefined
): { known: boolean; license: string; needsReview: boolean };
export declare function routeItems(
  items: Record<string, unknown>[] | null | undefined,
  seed: SeedClassification | Record<string, unknown> | null | undefined,
  license?: string | null
): RoutedItems;
export declare function mapSeedRows(rows: Record<string, unknown>[] | null | undefined): {
  seeds: { id: unknown; url: string; kind: string; skill: string | null; originDetail: string }[];
  skipped: { id: unknown; reason: string }[];
};
export declare function buildSeedInsertSql(seeds: Record<string, unknown>[] | null | undefined): string;
export declare function buildResourcesInsertSql(resources: Record<string, unknown>[] | null | undefined): string;
export declare function buildRunSummary(
  perSeed: Record<string, Record<string, unknown>>,
  startedAt: number,
  inserted?: number,
  errors?: number
): { ranAt: string; status: "ok" | "partial" | "failed"; perSource: Record<string, Record<string, unknown>>; inserted: number; errors: number };
export declare function buildRunReportSql(
  summary: { ranAt: string; status: string; perSource: unknown; inserted: number; errors: number },
  trigger?: string
): string;
