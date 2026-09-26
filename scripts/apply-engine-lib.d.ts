/* Type declarations for scripts/apply-engine-lib.js (pure, no I/O). */

export interface ApplySiteRule {
  label: string;
  jobsUrlHosts: string[];
  loginPathHints: string[];
  loggedInHint: string;
  applyButtonText: RegExp;
  steps: string[];
  autoSubmit: boolean;
  successText: RegExp;
  listSelectorHints: string[];
  minIntervalMs: number;
}

export const SITE_RULES: Record<string, ApplySiteRule>;

export function siteFromUrl(url: string): string;

export interface QuestionClass {
  kind:
    | "email" | "phone" | "years" | "notice" | "salary" | "relocation" | "remote"
    | "location" | "workAuth" | "certificate" | "coverLetter" | "longText"
    | "link" | "firstName" | "lastName" | "fullName" | "source"
    | "reasonLeaving" | "unknown";
  confidence: "answer" | "review";
}

export function classifyQuestion(
  label: string,
  opts?: { tag?: string; required?: boolean }
): QuestionClass;

export interface ApplyProfileLike {
  name?: string; email?: string; phone?: string; headline?: string;
  years?: number | null; locations?: string[]; noticePeriod?: string;
  salaryExpectation?: string; openToRelocate?: boolean | null;
  openToRemote?: boolean | null; portfolio?: string; linkedin?: string;
  reasonLeaving?: string; summary?: string; skills?: string[];
}

export interface ApplyJobLike {
  title?: string; company?: string; location?: string; url?: string;
  skills?: string[]; __coverLetter?: string;
}

export function draftAnswer(
  kind: string,
  profile: ApplyProfileLike | null | undefined,
  job: ApplyJobLike | null | undefined
): string;

export function valueMatchesList(answer: string, optionText: string): boolean;

export interface ApplyRunResult {
  title: string; company: string; url: string;
  result: "submitted" | "needsReview" | "skipped" | "error";
  detail: string; at: number;
}

export interface ApplyRunReport {
  sourceUrl: string; site: string; startedAt: number;
  results: ApplyRunResult[];
  counts: { submitted: number; needsReview: number; skipped: number; error: number };
}

export function newReport(sourceUrl: string, site: string): ApplyRunReport;

export function recordResult(
  report: ApplyRunReport,
  job: ApplyJobLike | null | undefined,
  result: ApplyRunResult["result"],
  detail?: string
): void;

export function reportLine(report: ApplyRunReport): string;

export function buildReportMarkdown(report: ApplyRunReport): string;

export function buildApplyReportSql(
  report: ApplyRunReport,
  meta: { totalSeen: number }
): string;
