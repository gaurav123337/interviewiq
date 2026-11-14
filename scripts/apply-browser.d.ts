/// <reference types="node" />
import type { ApplyAgentRuntimeContext, PairedApplyAgentRuntimeContext } from './apply-agent-runtime.js';
import type { BrowserContext } from 'playwright';
export function applyBrowserPaths(): { profileDir: string; signinProfileDir: string };
export function acquireApplyContext(options?: { headless?: boolean; endpoint?: string; signIn?: boolean; extraArgs?: string[]; runtime?: ApplyAgentRuntimeContext }): Promise<{ ctx: BrowserContext; cleanup: () => Promise<void>; remote: boolean; reused: boolean }>;
export function acquirePipelineBrowser(runtime: PairedApplyAgentRuntimeContext, options?: { headless?: boolean }): Promise<{ ctx: BrowserContext; cleanup: () => Promise<void>; profileMetadata: { bindingId: string; profilePresent: boolean } }>;
export function cloneApplyProfileForSignin(): boolean;
export function mergeSigninProfileBack(): number;
export function releaseSigninCloneOwnership(): void;
export function signinCloneOwnedByLiveRun(): boolean;
export function readLocalCdpEndpoint(retries?: number): Promise<string>;
export function isRemoteEndpoint(endpoint: unknown): boolean;
