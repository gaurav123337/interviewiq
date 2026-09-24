export interface CrawlSeedRow {
  id?: string | number | null;
  url: string;
  kind?: string;
  license?: string | null;
  skill?: string | null;
  fieldId?: string;
  level?: string;
  originDetail?: string;
}

export interface CrawlSeedResult {
  perSeed: Record<string, Record<string, unknown>>;
  qa: Record<string, unknown>[];
  problems: { id: string; title: unknown; pattern: string }[];
  resources: Record<string, unknown>[];
}

/** Crawls ONE approved seed: BFS within budget, robots+politeness via the
    crawl-lib fetcher, extraction + link routing per page. Never throws for
    per-page failures — those are counted notices in perSeed. */
export declare function crawlSeed(
  seed: CrawlSeedRow,
  opts?: {
    maxTotal?: number;
    maxPagesPerSeed?: number;
    maxDepth?: number;
    fetcher?: import("./crawl-lib.js").Fetcher;
    dryRun?: boolean;
    robotsCache?: Map<string, string | null>;
  }
): Promise<CrawlSeedResult>;
