export const FIXTURE_ORIGIN: string;
export const LOCAL_SITES: string[];
export const LIVE_SITES: string[];
export const PROXY_URL: string;
export function isStaticRequest(rawUrl: string, method: string, baseURL: string): boolean;
export function requestPolicy(rawUrl: string, method: string, baseURL: string, mode: string): "static" | "fixture" | "checkout-fixture" | "deny";
export function proxyTarget(rawUrl: string, method: string): URL | null;
export function assertIsolatedBuild(mode: string, url: string, key: string, outDir: string): void;
