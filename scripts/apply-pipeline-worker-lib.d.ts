/// <reference types="node" />
import type { PairedApplyAgentRuntimeContext } from './apply-agent-runtime.js';
import type { ApplyTaskJob, SavedAnswer, VerifiedProfile } from './apply-pipeline-lib.js';
import type { PortalBrowser } from './apply-portal-adapters.js';
export const PIPELINE_ENGINE_VERSION: string;
export type PipelineAction = (action: string, args?: Record<string, unknown>) => Promise<Record<string, any>>;
export interface WorkerTask { id: string; run_id: string; target_binding_id?: string; job: ApplyTaskJob; status: string; lease_version: number; lease_nonce: string; lease_until: string; profile_revision: number; settings_revision: number; answers_revision: number }
export interface ApprovedResumeArtifact { path: string; bindingId: string; profileRevision: number; sha256: string; textSha256: string }
export function normalizePipelineProfile(row: any): VerifiedProfile | null;
export function normalizePipelineAnswers(rows: any[]): SavedAnswer[];
export function createApprovedResumeArtifact(profile: VerifiedProfile, runtime: PairedApplyAgentRuntimeContext): Promise<ApprovedResumeArtifact>;
export function verifyApprovedResumeArtifact(artifact: ApprovedResumeArtifact, profile: VerifiedProfile, runtime: PairedApplyAgentRuntimeContext): string;
export interface WorkerNotification { taskId: string; runId: string; eventId: string; status: string; title: string; company: string; jobUrl: string; occurredAt: string }
export function createPipelineWorker(options: { runtime: PairedApplyAgentRuntimeContext; action: PipelineAction; browser: PortalBrowser; signal?: AbortSignal; notify?: (event: WorkerNotification) => Promise<unknown>; notifySummary?: (batch: { runId: string; startedAt: string; endedAt: string; site: string; results: { result: string }[] }) => Promise<unknown>; discover?: (options: { action: PipelineAction; signal?: AbortSignal }) => Promise<unknown>; pollMs?: number; leaseSeconds?: number; maxSteps?: number; maxTaskMs?: number; onState?: (event: { status: string; engineVersion: string; bindingId: string; at: string }) => void }): { run(options?: { maxCycles?: number }): Promise<{ cycles: number; status: string }>; processTask(task: WorkerTask): Promise<unknown>; stop(): void; getState(): { status: string; paused: boolean; engineVersion: string } };
