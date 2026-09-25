import type { RoutedKind } from "./crawl-orchestrate-lib.js";

export interface L5ProbeInput {
  ok: boolean;
  status?: number;
  finalUrl?: string | null;
  originalUrl?: string | null;
  contentMarker?: string | null;
  storedMarker?: string | null;
}

export interface L5Verdict {
  verdict: "pass" | "quarantine";
  reason: string | null;
}

export interface L5ResourceResult {
  verdict: "pass" | "quarantine";
  reason?: string | null;
}

export declare function l5Verdict(input: L5ProbeInput): L5Verdict;
export declare function buildQuarantineSql(
  rows: { id: number; reason?: string | null }[] | null | undefined
): string;
export declare function buildL5RunSummary(
  results: Record<string, L5ResourceResult> | null | undefined,
  startedAt: number
): { ranAt: string; status: "ok" | "partial" | "failed"; perSource: Record<string, L5ResourceResult>; inserted: number; errors: number };

/** Pure: cheap content fingerprint for L5 drift detection — first ~200 chars of
    visible text (scripts/styles stripped, whitespace collapsed). Null for empty
    input. Stored at approval time (meta.contentMarker) and compared on
    re-validation; a real mismatch quarantines the resource. */
export declare function markerFromText(html: string | null | undefined): string | null;
