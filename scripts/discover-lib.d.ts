export type SeedKind = "github-topic" | "github-repo" | "github-search" | "json" | "sitemap" | "html";

export interface SeedClassification {
  kind: SeedKind;
  url: string;
  host: string;
  path: string;
  topic?: string;
  owner?: string;
  repo?: string;
  /** github-search only: the decoded `q` param and the normalized result type. */
  query?: string;
  resultType?: string;
  attributionSource: string;
  licenseCheck: boolean;
}

export interface DiscoveryStep {
  action:
    | "github-topic-listing"
    | "github-search-api"
    | "github-search-render-fallback"
    | "github-repo-meta"
    | "crawl"
    | "extract-json"
    | "enumerate-sitemap";
  url: string;
  note?: string;
}

export interface RepoSearchHit {
  kind: "github-repo";
  url: string;
  owner: string;
  repo: string;
  description: string;
  stars: number;
  /** SPDX id, or null when the repo has no license (never auto-entered). */
  license: string | null;
  attributionSource: string;
  licenseCheck: boolean;
}

export interface DiscoveryPlan {
  seed: SeedClassification;
  steps: DiscoveryStep[];
  budget: { maxDepth: number; maxPagesPerSeed: number; maxTotal: number };
  attribution: { source: string; licenseCheck: boolean };
  needsApproval: boolean;
}

export declare function canonicalSeedUrl(raw: string): string | null;
export declare function githubSearchUrl(
  query: string,
  opts?: { perPage?: number; sort?: string }
): string;
export declare function parseRepoSearchHit(hit: unknown): RepoSearchHit | null;
export declare function classifySeed(url: string): SeedClassification | null;
export declare function planDiscovery(
  seed: string | SeedClassification,
  opts?: { maxDepth?: number; maxPagesPerSeed?: number; maxTotal?: number; perPage?: number; sort?: string }
): DiscoveryPlan | null;
