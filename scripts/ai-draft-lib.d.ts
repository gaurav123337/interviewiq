export interface DraftPattern {
  id: string;
  aliases: string[];
}

export interface DraftCandidate {
  title: string;
  slug: string;
  companies: Set<string>;
  difficulties: Set<number>;
  urls: Set<string>;
}

export interface DraftProblem {
  kind: "cli";
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  prompt: string;
  io: string;
  starters: Record<string, string>;
  tests: { stdin: string; expect: string }[];
  hidden: { stdin: string; expect: string }[];
  hint: string;
  reference: string;
  pattern: string;
}

export const PATTERNS: DraftPattern[];
export const PATTERN_IDS: string[];
export const PATTERN_TOPIC: Record<string, string>;
export function canonicalPattern(raw: unknown): string | null;
export const CURATED_TITLES: string[];
export function patternFromTitle(title: string): string;
export function slugify(title: string): string;
export function normalizeTitle(title: string): string;
export function companyIdForName(name: string): string | null;
export function buildCandidates(items: unknown[], existingIds?: Set<string>): DraftCandidate[];
export function buildDraftPrompt(candidate: DraftCandidate): string;
export function parseDraftJson(text: string): Record<string, unknown> | null;
export function validateProblem(candidate: DraftCandidate, parsed: unknown): { ok: boolean; errors: string[] };
export function normalizeProblem(candidate: DraftCandidate, parsed: Record<string, unknown>): DraftProblem;
export function runJudge(reference: string, stdin: string): { ok: boolean; stdout: string; error?: string };
export function normalizeOutput(s: string): string;
export function matchesExpected(got: string, expect: string): boolean;
export function gateProblem(problem: DraftProblem): { pass: boolean; results: { stdin: string; expect: string; got: string; error?: string; pass: boolean }[] };
export function emitProblemsFile(args: { problems: DraftProblem[]; companies: Record<string, string[]>; topics: Record<string, string>; generatedAt?: string }): string;
export function existingAiIds(fileContent: string): Set<string>;
export interface GeneratedBank {
  problems: DraftProblem[];
  companies: Record<string, string[]>;
  topics: Record<string, string>;
}
export function parseGeneratedProblems(fileContent: string): GeneratedBank;
