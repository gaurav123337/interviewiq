export type PageType = "json" | "sitemap" | "repo" | "html" | "unknown";

export interface FetchTextResult {
  ok: boolean;
  status: number;
  text: string;
  error?: string;
}

export interface Fetcher {
  fetchText(url: string): Promise<FetchTextResult>;
}

export declare class Budget {
  maxDepth: number;
  maxPagesPerSeed: number;
  maxTotal: number;
  consumed: number;
  perSeed: Map<string, number>;
  constructor(opts?: { maxDepth?: number; maxPagesPerSeed?: number; maxTotal?: number });
  reset(): void;
  addSeed(seedKey: string): this;
  canFetch(seedKey: string): boolean;
  consume(seedKey: string): boolean;
  remaining(): number;
}

export declare function normalizeUrl(raw: string, base?: string): string | null;
export declare function extractLinks(html: string, baseUrl: string): string[];
export declare function detectType(url: string, html?: string): PageType;
export declare function robotsAllowed(robotsTxt: string | null | undefined, url: string, ua?: string): boolean;
export declare function createFetcher(opts?: {
  fetchImpl?: typeof fetch;
  userAgent?: string;
  timeoutMs?: number;
  delayMs?: number;
}): Fetcher;
