export type SeedKind = "github-topic" | "github-repo" | "json" | "sitemap" | "html";

export interface SeedClassification {
  kind: SeedKind;
  url: string;
  host: string;
  path: string;
  topic?: string;
  owner?: string;
  repo?: string;
  attributionSource: string;
  licenseCheck: boolean;
}

export interface DiscoveryStep {
  action: "github-topic-listing" | "github-repo-meta" | "crawl" | "extract-json" | "enumerate-sitemap";
  url: string;
  note?: string;
}

export interface DiscoveryPlan {
  seed: SeedClassification;
  steps: DiscoveryStep[];
  budget: { maxDepth: number; maxPagesPerSeed: number; maxTotal: number };
  attribution: { source: string; licenseCheck: boolean };
  needsApproval: boolean;
}

export declare function canonicalSeedUrl(raw: string): string | null;
export declare function classifySeed(url: string): SeedClassification | null;
export declare function planDiscovery(
  seed: string | SeedClassification,
  opts?: { maxDepth?: number; maxPagesPerSeed?: number; maxTotal?: number }
): DiscoveryPlan | null;
