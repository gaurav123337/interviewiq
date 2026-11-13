export interface ApplyAgentConfig {
  version: 1;
  endpoint: string;
  token: string;
}

export interface ParsedApplyAgentToken {
  token: string;
  bindingId: string;
  secret: string;
}

export interface ApplyAgentContext extends ApplyAgentConfig {
  bindingId: string;
  dataRoot: string;
  stateRoot: string;
}

export interface ApplyAgentPathOptions {
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  home?: string;
}

export const APPLY_AGENT_CONFIG_VERSION: 1;
export const DEFAULT_APPLY_AGENT_ENDPOINT: string;

export function parseApplyAgentToken(raw: unknown): ParsedApplyAgentToken | null;
export function normalizeApplyAgentEndpoint(raw: unknown): string;
export function validateApplyAgentConfig(value: unknown): ApplyAgentConfig;
export function resolveApplyAgentDataRoot(options?: ApplyAgentPathOptions): string;
export function applyAgentConfigPath(dataRoot: string, platform?: NodeJS.Platform): string;
export function deriveBindingStateRoot(
  dataRoot: string,
  tokenOrBindingId: string,
  platform?: NodeJS.Platform
): string;
export function createApplyAgentContext(
  config: unknown,
  dataRoot: string,
  platform?: NodeJS.Platform
): ApplyAgentContext;
