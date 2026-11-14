/* Pure portal contracts: static selectors, HTTPS allowlists and job-bound
 * evidence. These functions never visit a site or run generated JavaScript. */
import type { ApplyTaskJob } from './apply-pipeline-lib.js';
export type PortalId = 'greenhouse' | 'ashby' | 'lever' | 'naukri' | 'instahyre' | 'workday' | 'linkedin' | 'unknown';
export interface PortalAdapter {
  id: PortalId; supported: boolean; safeUrl: boolean; reason: string; jobUrl: string;
  boardIdentity: string | null; jobIdentity: string | null;
  mode: 'automatic' | 'reviewOnly' | 'unsupported'; autoSubmit: boolean; requiresAuth: boolean;
  loginSelectors: readonly string[]; authenticatedSelectors: readonly string[]; fieldSelectors: readonly string[];
  sessionCookieNames: readonly string[]; applyButtonText?: RegExp; submitButtonText?: RegExp; submitSelector: string | null; receiptSelector: string | null;
}
export interface VerifiedDomainEvidence {
  /** Unknown custom domains remain review-only even with verified ATS evidence. */
  domain: string; adapter: Exclude<PortalId, 'unknown' | 'linkedin'>; verifiedAt: string;
  formActionUrl: string; requiredFields: string[]; jobIdentity: string; source: 'observed';
}
export function validatePublicJobUrl(url: unknown, options?: { allowedHosts?: readonly string[] }): { ok: boolean; url?: string; hostname?: string; reason: string };
export function adapterForJob(job: Partial<ApplyTaskJob> | string, options?: { overrides?: { autoSubmit?: boolean }; domainEvidence?: VerifiedDomainEvidence; now?: number }): PortalAdapter;
export function clampPortalPolicy(adapter: PortalAdapter, overrides?: { autoSubmit?: boolean }): PortalAdapter;
export function validateAdapterRedirect(from: Partial<ApplyTaskJob> | string, to: unknown): { ok: boolean; adapter: PortalAdapter; reason: string };
export interface SessionEvidence {
  url: string; checkedAt: string; now: number; error?: boolean; challenge?: boolean; loginVisible?: boolean;
  cookies?: { name: string; value: string; domain: string; expires?: number; secure?: boolean }[];
  observedSelectors: string[];
  /** Selectors must come from adapter.fieldSelectors, not invented page-label CSS. */
  verifiedFields: { selector: string; required: boolean }[];
  /** Known in-place boards may expose only their pinned semantic apply control. */
  applyControl?: { role: 'button'; name: string; enabled: boolean };
}
export function validateAdapterSession(adapter: PortalAdapter, evidence: SessionEvidence): { ok: boolean; jobUrl: string; checkedAt: string; reason: string };
export interface SubmissionSnapshot {
  url: string; observedAt: string; jobIdentity: string;
  receipt?: { selector: string; text: string; jobIdentity: string; receiptId?: string };
  network?: { url: string; method: string; status: number; jobIdentity: string; receiptId: string }[];
}
export interface SubmissionEvidence {
  before: SubmissionSnapshot; after: SubmissionSnapshot; clickedAt: string;
  expectedNetworkUrl?: string; now: number;
}
export function validateSubmissionEvidence(job: Partial<ApplyTaskJob> | string, evidence: SubmissionEvidence): { verified: boolean; status: 'submitted' | 'unverified'; reason: string; receiptId?: string };
