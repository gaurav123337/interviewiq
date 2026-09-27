/* Type declarations for scripts/apply-engine-lib.js (pure, no I/O). */

export interface ApplySiteRule {
  label: string;
  jobsUrlHosts: string[];
  loginPathHints: string[];
  loggedInHint: string;
  applyButtonText: RegExp;
  submitButtonText?: RegExp;
  steps: string[];
  autoSubmit: boolean;
  successText: RegExp;
  listSelectorHints: string[];
  minIntervalMs: number;
}

export const SITE_RULES: Record<string, ApplySiteRule>;

export function siteFromUrl(url: string): string;

export function titleRelevant(title: string | null | undefined, profile: { headline?: string; skills?: string[] } | null | undefined): boolean;

export function looksLikeRefusal(text: string | null | undefined): boolean;

export function isChallengePage(title: string | null | undefined, bodyText: string | null | undefined): boolean;

export function detectAccountProblem(bodyText: string | null | undefined): string | null;

export function looksLoggedIn(opts: {
  url: string;
  title?: string | null;
  bodyText?: string | null;
  loggedInHint?: string;
  loginPathHints?: string[];
}): boolean;

export interface QuestionClass {
  kind:
    | "email" | "phone" | "phoneCountryCode" | "years" | "notice" | "salary" | "relocation" | "remote"
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
  extraAnswers?: Record<string, string>;
}

export interface ApplyJobLike {
  title?: string; company?: string; location?: string; url?: string;
  skills?: string[]; __coverLetter?: string; __fit?: number | null;
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
  detail: string; fit?: number | null; at: number;
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

/* ── JD skill relevance gate ─────────────────────────────────────────── */

export function canonicalSkill(raw: string | null | undefined): string | null;

export function profileSkillSet(profile: ApplyProfileLike | null | undefined): Set<string>;

export interface JdSkillMatchResult {
  ok: boolean;
  reason: string;
  matched: string[];
  missing: string[];
  jdSkills?: string[];
}

export function jdSkillMatch(
  jdText: string | null | undefined,
  profile: ApplyProfileLike | null | undefined,
  opts?: { minJd?: number; minProfile?: number }
): JdSkillMatchResult;

export function postingRelevant(
  posting: { title: string | null | undefined; description?: string | null },
  profile: ApplyProfileLike | null | undefined
): JdSkillMatchResult;

export function extraAnswerFor(profile: ApplyProfileLike | null | undefined, kind: string): string;

export function fitScore(matched: string[] | null | undefined, missing: string[] | null | undefined): number | null;
