/* Pure verified-fact/answer-bank contracts. Page labels and legacy memory are
 * untrusted; only source:user facts and explicitly confirmed SavedAnswers fill.
 * The Playwright worker is intentionally separate and supplies all I/O evidence. */
export type FactValue = string | number | boolean | (string | number | boolean)[];
export type AnswerScope = 'global' | 'country' | 'employer' | 'portal' | 'application';
export interface FactScope { country?: string; employer?: string; portal?: string; application?: string }
export interface VerifiedFact { value: FactValue; source: 'user'; confirmedAt: string; scope?: FactScope; validUntil?: string }
export interface VerifiedProfile { revision: number; facts: Record<string, VerifiedFact>; resumeText: string; resumeApproved: boolean }
export interface QuestionContext extends FactScope { currency?: string }
export type ControlType = 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'date' | 'url' | 'select' | 'radio' | 'checkbox' | 'file' | 'unknown';
export interface ApplicationField {
  id?: string; question?: string; label?: string; controlType?: ControlType; type?: string; tag?: string;
  required?: boolean; options?: string[]; context?: QuestionContext;
}
export interface SavedAnswer {
  id: string; meaning: string; question: string; controlType: ControlType; options: string[];
  context: QuestionContext; scope: AnswerScope; scopeKey?: string; answer: string;
  confirmedAt: string; validUntil?: string; profileRevision: number; autoReuse: true; source: 'user';
}
export interface JobSalary { min?: number; max?: number; currency: string; period?: 'year' | 'month' | 'hour' }
export interface ApplyTaskJob {
  jobUrl: string; title: string; company: string; description: string; skills: string[];
  location: string; country?: string; salary?: JobSalary; postedAt?: string;
}
export interface ClassifiedQuestion {
  meaning: string; controlType: ControlType; options: string[]; question: string;
  scope: AnswerScope; scopeKey?: string; context: QuestionContext;
  disposition: 'answer' | 'ask' | 'optionalLeave' | 'manualAttestation'; reason?: string;
}
export type VerifiedAnswerResolution =
  | { kind: 'fill'; value: string; source: 'fact' | 'savedAnswer'; answerId?: string; factKey?: string; profileRevision: number }
  | { kind: 'ask'; questionKey: string; meaning: string; scope: AnswerScope; scopeKey?: string;
      question: string; controlType: ControlType; options: string[]; context: QuestionContext; reason: string; profileRevision: number }
  | { kind: 'optionalLeave'; meaning: string; reason: string }
  | { kind: 'manualAttestation'; meaning: string; question: string; reason: string };
export const VERIFIED_FACT_KEYS: readonly string[];
export const PIPELINE_LIMITS: Readonly<{ question: number; option: number; options: number; answer: number; resume: number; description: number; facts: number; savedAnswers: number; jobs: number }>;
export function canonicalCountry(value: unknown): string;
export function canonicalCurrency(value: unknown): string;
export function canonicalVerifiedSkill(value: unknown): string;
export function extractVerifiedJobSkills(description: string): string[];
export function classifyQuestion(field: ApplicationField | string, job?: Partial<ApplyTaskJob>): ClassifiedQuestion;
export function isTrustedResumeField(field: ApplicationField, job?: Partial<ApplyTaskJob>): boolean;
export function questionBatchKey(field: ApplicationField | string, job?: Partial<ApplyTaskJob>, scope?: { scope: AnswerScope; scopeKey?: string }): string;
export function validateVerifiedProfile(profile: unknown, now: number | string | Date): { ok: boolean; reasons: string[] };
export function resolveVerifiedAnswer(field: ApplicationField | string, input: { profile: VerifiedProfile; answers?: SavedAnswer[]; job?: Partial<ApplyTaskJob>; now: number | string | Date }): VerifiedAnswerResolution;
export { resolveVerifiedAnswer as resolveAnswer };
export function buildVerifiedResume(profile: VerifiedProfile): { ok: true; text: string; profileRevision: number; source: 'user' } | { ok: false; reason: string };
export interface VerifiedMatchSettings {
  roles?: string[]; excludedRoles?: string[]; locations?: string[]; excludedLocations?: string[];
  countries?: string[]; excludeCompanies?: string[]; excludedSkills?: string[];
  threshold?: number;
  requireWorkAuthorization?: boolean; allowSponsorship?: boolean; maxAgeDays?: number;
  minSkillOverlap?: number; minimumSalary?: { value: number; currency: string; period?: 'year' | 'month' | 'hour' };
}
export interface VerifiedJobMatch {
  eligible: boolean; score: number; reason: string; reasons: string[]; missing: string[]; matched: string[];
  ageHours: number | null; profileRevision: number; source: 'deterministic';
}
export function matchVerifiedJob(job: ApplyTaskJob, input: { profile: VerifiedProfile; settings?: VerifiedMatchSettings; now: number | string | Date }): VerifiedJobMatch;
export function rankVerifiedJobs(jobs: ApplyTaskJob[], input: { profile: VerifiedProfile; settings?: VerifiedMatchSettings; now: number | string | Date }): { job: ApplyTaskJob; match: VerifiedJobMatch }[];
export interface InPlacePortalEvidence {
  accountIdentity: string; noQuestionsObserved: boolean; profileReady: boolean;
  applyControl: { role: 'button'; name: string; enabled: boolean };
}
export function validateInPlaceApplication(input: {
  job: ApplyTaskJob; profile: VerifiedProfile;
  evidence: InPlacePortalEvidence; now: number | string | Date;
}): { ok: boolean; reason: string };
export interface ApplicationApproval {
  jobUrl: string; profileRevision: number; answerBankVersion: number; resumeText: string;
  approvedAt: string; validUntil?: string;
  /** Manual attestations are exact-question/application-bound, never saved for reuse. */
  attestations?: { questionKey: string; confirmedAt: string; source: 'user' }[];
}
export interface ApplicationPreflightInput {
  job: ApplyTaskJob; profile: VerifiedProfile; answers: SavedAnswer[]; fields: ApplicationField[];
  approval: ApplicationApproval; answerBankVersion: number; now: number | string | Date;
  cancelled: boolean; budget: { allowed: boolean; remaining: number };
  session: { ok: boolean; jobUrl: string; checkedAt: string; inPlace?: InPlacePortalEvidence }; policy: { autoSubmit: boolean };
}
export function preflightApplication(input: ApplicationPreflightInput): { ok: boolean; reasons: string[]; resolutions: VerifiedAnswerResolution[] };
