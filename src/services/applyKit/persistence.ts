/* Persistence — offline-first, per-job ApplyKit storage */

import { STORAGE_KEYS, storageGet, storageSet } from "../storage";
import type { ApplyKit } from "./types";

type ApplyKitMap = Record<string, ApplyKit>;

export function getApplyKit(jobId: string): ApplyKit | null {
  return storageGet<ApplyKitMap>(STORAGE_KEYS.applyKit, {})[jobId] ?? null;
}

export function saveApplyKit(kit: ApplyKit): void {
  const map = storageGet<ApplyKitMap>(STORAGE_KEYS.applyKit, {});
  map[kit.jobId] = kit;
  storageSet(STORAGE_KEYS.applyKit, map);
}
