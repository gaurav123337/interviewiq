import type { PairedApplyAgentRuntimeContext } from './apply-agent-runtime.js';
import type { ApplicationField, ApplyTaskJob } from './apply-pipeline-lib.js';
import type { PortalAdapter, SubmissionSnapshot } from './apply-adapters-lib.js';
export interface PortalHandle {
  adapter: PortalAdapter;
  session(): Promise<{ ok: boolean; jobUrl: string; checkedAt: string; reason: string }>;
  fields(): Promise<ApplicationField[]>;
  fill(field: ApplicationField, value: string): Promise<void>;
  clear?(field: ApplicationField): Promise<boolean>;
  upload(field: ApplicationField, artifact: string): Promise<void>;
  complete(): Promise<boolean>;
  verifyFilled(expected: { field: ApplicationField; value?: string; artifact?: string; empty?: boolean }[]): Promise<boolean>;
  inPlaceEvidence?(): Promise<import('./apply-pipeline-lib.js').InPlacePortalEvidence>;
  snapshot(): Promise<SubmissionSnapshot>;
  submit(reservation: { id: string; nonce: string; status: string }): Promise<SubmissionSnapshot>;
  close(): Promise<void>;
  waitForLogin(options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<{ ok: boolean; reason?: string }>;
}
export interface ReviewQuestion { id: string; question_text: string; control_type: string; options: string[]; context: Record<string, string>; status: string; task_ids: string[] }
export interface ManualObservation { jobUrl: string; checkedAt: string; accountIdentity: string; session: { ok: boolean; jobUrl: string; checkedAt: string }; receipt: { selector: string; text: string; url: string } | null }
export interface PortalBrowser {
  open(job: ApplyTaskJob): Promise<PortalHandle>;
  login(job: ApplyTaskJob, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<{ ok: boolean; reason?: string }>;
  manual?(job: ApplyTaskJob, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<{ opened: boolean; before?: ManualObservation; after?: ManualObservation }>;
  review?(job: ApplyTaskJob, question: ReviewQuestion, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<{ opened: boolean }>;
  close(): Promise<void>;
}
export function createPortalBrowser(runtime: PairedApplyAgentRuntimeContext, options?: { fixtureOrigin?: string; headless?: boolean; acquire?: typeof import('./apply-browser.js').acquirePipelineBrowser }): PortalBrowser;
