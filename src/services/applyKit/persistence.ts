/* Persistence — offline-first, per-job ApplyKit storage */

import { STORAGE_KEYS, storageGet, storageSet } from "../storage";
import type { ApplyKit } from "./types";

type ApplyKitMap = Record<string, ApplyKit>;

export function getApplyKit(jobId: string): ApplyKit | null {
  return storageGet<ApplyKitMap>(STORAGE_KEYS.applyKit, {})[jobId] ?? null;
}

export function saveApplyKit(kit: ApplyKit): void {
  const map = storageGet<ApplyKitMap>(STORAGE_KEYS.applyKit, {});
  /* Stamp updatedAt at write time so it always reflects the true last edit —
     the honest tie-break for cross-device sync (see SYNC_POLICIES.applyKit). */
  map[kit.jobId] = { ...kit, updatedAt: Date.now() };
  storageSet(STORAGE_KEYS.applyKit, map);
}
