export interface ApplyAgentRuntimeOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  repoRoot?: string;
  home?: string;
  platform?: NodeJS.Platform;
}

export interface PairedApplyAgentRuntimeContext {
  mode: "paired";
  configPath: string;
  endpoint: string;
  token: string;
  bindingId: string;
  stateRoot: string;
  profilePath: string;
}

export interface LegacyApplyAgentRuntimeContext {
  mode: "legacy";
  profilePath: string;
}

export type ApplyAgentRuntimeContext =
  | PairedApplyAgentRuntimeContext
  | LegacyApplyAgentRuntimeContext;

export function getApplyAgentRuntimeContext(options?: ApplyAgentRuntimeOptions): ApplyAgentRuntimeContext;
export function applyAgentChildArgs(context: ApplyAgentRuntimeContext, profilePath?: string): string[];
export function applyAgentChildEnv(
  context: ApplyAgentRuntimeContext,
  env?: NodeJS.ProcessEnv
): NodeJS.ProcessEnv;
