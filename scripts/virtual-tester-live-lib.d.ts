import type { Route } from "@playwright/test";
export function isLiveMutationRequest(rawUrl: string, method: string): boolean;
export function fulfillLiveStatic(route: Route, errors: string[]): Promise<void>;
