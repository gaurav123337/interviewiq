/**
 * Environment Configuration
 * 
 * Reads VITE_* environment variables to determine the current deployment environment.
 * Supports staging and production with feature flags.
 */

export type AppEnvironment = "staging" | "production";

interface EnvConfig {
  /** Current environment */
  env: AppEnvironment;
  /** Whether this is a staging deployment */
  isStaging: boolean;
  /** App URL (including trailing slash) */
  appUrl: string;
  /** App title */
  appTitle: string;
  /** Enabled feature flags (comma-separated) */
  featureFlags: string[];
}

function getEnvVar(key: string, fallback: string = ""): string {
  // Vite exposes VITE_* vars via import.meta.env
  try {
    return (import.meta.env as Record<string, string>)[key] ?? fallback;
  } catch {
    return fallback;
  }
}

const rawEnv = getEnvVar("VITE_APP_ENV", "production");

export const ENV: EnvConfig = {
  env: rawEnv === "staging" ? "staging" : "production",
  isStaging: rawEnv === "staging",
  appUrl: getEnvVar("VITE_APP_URL", "https://gaurav123337.github.io/interviewiq/"),
  appTitle: getEnvVar("VITE_APP_TITLE", "InterviewIQ"),
  featureFlags: getEnvVar("VITE_FEATURE_FLAGS", "")
    .split(",")
    .map(f => f.trim())
    .filter(Boolean),
};

/** Check if a feature flag is enabled */
export function featureEnabled(flag: string): boolean {
  if (ENV.isStaging) return true; // staging enables all features
  return ENV.featureFlags.includes(flag);
}

/** Get the base path for the current environment */
export function getBasePath(): string {
  if (ENV.isStaging) return "/interviewiq-staging/";
  return "/interviewiq/";
}

/** Get the canonical URL for the current environment */
export function getCanonicalUrl(): string {
  return ENV.appUrl;
}
