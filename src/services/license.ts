/* Pro license keys — TEST MODE ONLY.
   The IQPRO-XXXX checksum format is forgeable, so it is gated behind
   CONFIG.features.testLicensing and must be off in production. Real Pro is
   server-verified: admin grants, single-use grant codes (redeem_grant) and
   Stripe webhooks write the entitlements table; the client only reads it. */

import { setTier } from "./entitlements";
import { testLicensing } from "./entitlement";
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "./storage";
import { queueEvent } from "./events";

const KEY_RE = /^IQPRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function checksum(body: string): string {
  let sum = 0;
  for (const ch of body) sum = (sum * 31 + ch.charCodeAt(0)) % 9973;
  return String(sum).padStart(4, "0");
}

/** Creates a checksum-valid key (used by tests / for issuing placeholder licenses). */
export function generateProKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = () => alphabet[Math.floor(Math.random() * alphabet.length)];
  const part = (n: number) => Array.from({ length: n }, rand).join("");
  const body = part(8);
  return `IQPRO-${body.slice(0, 4)}-${body.slice(4)}-${checksum(body)}`;
}

export function isValidProKey(key: string): boolean {
  const k = key.trim().toUpperCase();
  if (!KEY_RE.test(k)) return false;
  const parts = k.split("-");
  return parts[3] === checksum(parts[1] + parts[2]);
}

export function getStoredKey(): string {
  return storageGet<string>(STORAGE_KEYS.licenseKey, "");
}

export function activatePro(key: string): { ok: boolean; error?: string } {
  if (!testLicensing()) {
    return {
      ok: false,
      error: "Format keys aren't accepted anymore — Pro is issued to your account. Sign in and redeem a grant code, or ask your admin for one."
    };
  }
  if (!isValidProKey(key)) {
    return { ok: false, error: "That key doesn't look valid — check the format (IQPRO-XXXX-XXXX-XXXX) and try again." };
  }
  storageSet(STORAGE_KEYS.licenseKey, key.trim().toUpperCase());
  setTier("pro");
  void queueEvent("tier", { tier: "pro" });
  return { ok: true };
}

export function deactivatePro(): void {
  storageRemove(STORAGE_KEYS.licenseKey);
  setTier("free");
  void queueEvent("tier", { tier: "free" });
}
