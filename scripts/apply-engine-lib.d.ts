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
  /** the site's own application tracker — --outcomes reads views/replies */
  outcomes?: { url: string };
}

export const SITE_RULES: Record<string, ApplySiteRule>;

export function siteFromUrl(url: string): string;

/* posted-age parsing + freshness ordering (freshness beats fit at the margin) */
export const FRESH_MAX_HOURS: number;
export const POSTED_AGE_TEXT_RE: RegExp;
export function cardAgeText(text: string | null | undefined): string;
export function parsePostedAge(text: string | null | undefined, now?: number): number | null;
export function isFreshPosted(ageHours: number | null | undefined): boolean;
export function sortByFreshness<T extends { __ageText?: string }>(jobs: T[] | null | undefined, now?: number): (T & { __ageH: number | null; __fresh: boolean })[];

export interface JobLinkClass {
  kind: "posting" | "nav" | "unknown";
  id: string | null;
  routeKey: string | null;
}

/** Discriminate a posting detail link from site chrome (nav/category tiles). */
export function classifyJobLink(opts: { href?: string; text?: string; host?: string }): JobLinkClass;

export function titleFieldMismatch(jobTitle: string | null | undefined, profileHeadline: string | null | undefined): boolean;

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
  skills?: string[]; seniority?: string; instaMatch?: string | null;
  __coverLetter?: string; __fit?: number | null; __fitNote?: string; __judge?: { verdict?: string; reason?: string; missingCore?: string[] };
  __submitted?: boolean; __successText?: string;
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

export function extractJdSkills(description: string | null | undefined): string[];

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
  opts?: { minJd?: number; minProfile?: number; critical?: string[]; learnedCritical?: string[] }
): JdSkillMatchResult;

export function postingRelevant(
  posting: { title: string | null | undefined; description?: string | null },
  profile: ApplyProfileLike | null | undefined,
  opts?: { learnedCritical?: string[]; ownerConfirmed?: boolean }
): JdSkillMatchResult;

export function extraAnswerFor(profile: ApplyProfileLike | null | undefined, kind: string): string;

export function isExternalApplyButton(text: string | null | undefined): boolean;

export function detectSubmissionSuccess(pageText: string | null | undefined, siteKey: string): boolean;

export function fitScore(matched: string[] | null | undefined, missing: string[] | null | undefined, coreMissing?: string[]): number | null;

/* ── feedback learning loop (skip rows + strike decay + buzz gating) ── */

/** Strikes older than this stop rejecting (owner taste changes; a stale
    hard-reject list must not zero a whole job class forever). */
export const STRIKE_DECAY_MS: number;

/** Strike rows ({skill, strikes, updated_at}) with 30-day decay applied:
    rows older than STRIKE_DECAY_MS collapse to 0 and are filtered out. */
export function strikesWithDecay(
  rows: { skill: string; strikes: number; updated_at?: string | null }[] | null | undefined,
  now?: number
): { skill: string; strikes: number; updated_at?: string | null }[];

/** Skills named in a row's skip/applied detail line — covers "JD requires
    a, b — not on the resume", "core skill missing: a — required by title/JD",
    and returns [] for formats without skill names (title gate, judge skips).
    Lowercase, deduped, capped at 6. */
export function extractFeedbackSkills(detail: string | null | undefined): string[];

/** True when the skill appears in the JD only next to buzz markers ("we work
    with AI", "AI-first company") and never in a requirement context
    ("experience with", "required", "X+ years"). Conservative: exact token
    matches only; empty skill or empty JD → false. */
export function skillIsBuzzOnly(jdText: string | null | undefined, skill: string): boolean;

/* ── per-ATS selector packs ─────────────────────────────────────────── */

export interface AtsPack {
  label: string;
  hostHints: string[];
  fieldSelectorHints: string[];
  submitButtonText: RegExp;
  successText: RegExp;
}

export const ATS_PACKS: Record<"greenhouse" | "lever" | "workable" | "generic", AtsPack>;

export function detectAts(url: string | null | undefined): AtsPack;

/* ── form-answer memory (store + reuse) ─────────────────────────────── */

export function normalizeFieldKey(label: string | null | undefined): string;

export function canStoreAnswer(kind: string | null | undefined): boolean;

export interface FormFieldMeta {
  label: string; tag: string; type?: string; required: boolean; options?: string[];
}

export interface PlannedAnswer {
  cls: QuestionClass;
  key: string;
  answer: string;
}

export function planFormAnswers(
  fields: FormFieldMeta[] | null | undefined,
  profile: ApplyProfileLike | null | undefined,
  job: ApplyJobLike | null | undefined,
  stored?: Record<string, string>
): PlannedAnswer[];

export interface FormFieldPreview {
  label: string; kind: string; required: boolean; answered: boolean;
}

export function formFieldsPreview(
  fields: FormFieldMeta[] | null | undefined,
  plan?: PlannedAnswer[] | null
): FormFieldPreview[];

/* ── AI judge (JD reading comprehension) ───────────────────────────── */

export function titleSkills(title: string | null | undefined): string[];

export interface JudgeVerdict {
  verdict: "apply" | "skip" | "unknown";
  confidence?: number;
  reason?: string;
  missingCore?: string[];
}

export function judgeMessages(
  job: (ApplyJobLike & { description?: string | null }) | null | undefined,
  profile: ApplyProfileLike | null | undefined,
  exemplars?: { positive?: string[]; negative?: string[] } | null,
  outcomePriorText?: string
): { system: string; user: string };

/* employer-behavior learning (outcome scraper feedback loop) */
export function classifyOutcome(text: string | null | undefined): { viewed: boolean; responseKind: "reply" | "interview" | "rejected" | "offer" | null };
export function outcomePrior(stats: { fit_band: string; applications: number; responded: number; response_rate?: number | null }[] | null | undefined): string;
export function outcomeRowShouldRecord(text: string | null | undefined, url: string | null | undefined, applied: boolean | ((url: string | null | undefined) => boolean)): { viewed: boolean; responseKind: "reply" | "interview" | "rejected" | "offer" | null } | null;
export function trackerRowLinkRe(site: string | null | undefined): RegExp;
export function outcomeDigestLines(outcomeRows: { site_host: string; fit_band: string; applications: number; viewed: number; responded: number; interviews?: number; rejected?: number }[] | null | undefined, stats: { fit_band: string; applications: number; responded: number; response_rate?: number | null }[] | null | undefined): string;
export function matchSiteRow(rows: { host: string; jobs_url?: string | null }[] | null | undefined, url: string): { host: string; jobs_url?: string | null } | undefined;

export function exemplarBlock(positive?: string[], negative?: string[]): string;

/** Owner-confirmed-positive exemplar matching this job (by posting id or
    strong title-token overlap) — empty string when none. */
export function ownerExemplarFor(
  job: { url?: string | null; title?: string | null } | null | undefined,
  exemplars: { positive?: string[]; negative?: string[] } | null | undefined
): string;

export function parseJudgeReply(text: string | null | undefined): JudgeVerdict;
