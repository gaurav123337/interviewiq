/** Target categories the pipeline knows how to render. */
export const TARGET_KINDS: readonly string[];

export interface PwTarget {
  id: string;
  kind: string;
  url: string;
  host: string;
  selectors: {
    item: string;
    title: string;
    company: string | null;
    location: string | null;
    link: string | null;
    description: string | null;
    postedAt: string | null;
  };
  company: string | null;
  maxItems: number;
  delayMs: number;
  enabled: boolean;
  ua: string | null;
}

export interface PwJob {
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string;
  postedAt: string | null;
  pageText?: string;
  skills?: string[];
  targetId?: string;
  host?: string;
  extractedAt?: string;
  source?: string;
  externalId?: string;
  [k: string]: unknown;
}

export interface ValidatedTarget {
  ok: boolean;
  target?: PwTarget;
  errors?: string[];
}

export interface SkippedTarget {
  id: string;
  errors: string[];
}

export function validateTarget(raw: Record<string, unknown>): ValidatedTarget;
export function loadTargets(body: { targets?: Record<string, unknown>[] }): { targets: PwTarget[]; skipped: SkippedTarget[] };
export function extractJob(
  node: unknown,
  target: PwTarget,
  q: (node: any, css: string) => { textContent?: string; getAttribute?: (a: string) => string | null; href?: string } | null
): PwJob | null;
export function jobIdentity(targetHost: string, targetId: string, job: PwJob): { source: string; externalId: string; targetId: string };
export function dedupeJobs<T extends { externalId?: string; targetId?: string }>(jobs: T[], perTargetCap?: number, totalCap?: number): T[];
export function sqlStr(v: string | number): string;
export function buildJobsUpsertSql(jobs: PwJob[]): string;
export function buildReport(perTarget: { targetId: string; host: string; found?: number; added?: number; error?: string }[], startedAt: number): {
  added: number;
  updated: number;
  total: number;
  per_target: { targetId: string; host: string; found: number; added: number; error?: string }[];
  errors: Record<string, string>;
};
export function buildReportSql(report: unknown, startedAt: number): string;
export function normalizeUrl(href: string, baseUrl: string): string;
export function parseRelativeDate(raw: string): string | null;
