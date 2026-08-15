/* MFA recovery codes — pure helpers shared by the client and (as a Deno
   copy in supabase/functions/_shared/recoveryCodes.ts) the mfa-recovery edge
   function. Only WebCrypto, so it runs identically in the browser, Deno,
   and Node (vitest).

   Codes are 15 chars in three 5-char groups, from an alphabet that drops
   lookalikes (0/O, 1/I/L): XXXX-XXXXX-XXXXX. Stored server-side as
   sha256(lower(email) + ":" + code) — never plaintext. */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; /* 32 chars -> 5 bits each; no 0/O/1/I/L */
const GROUPS = 3;
const GROUP_LEN = 5;

export function generateRecoveryCodes(count = 10): string[] {
  const out: string[] = [];
  for (let n = 0; n < count; n++) {
    const chars: string[] = [];
    for (let i = 0; i < GROUPS * GROUP_LEN; i++) {
      const r = new Uint32Array(1);
      globalThis.crypto.getRandomValues(r);
      chars.push(ALPHABET[r[0] % ALPHABET.length]);
    }
    const parts: string[] = [];
    for (let g = 0; g < GROUPS; g++) {
      parts.push(chars.slice(g * GROUP_LEN, (g + 1) * GROUP_LEN).join(""));
    }
    out.push(parts.join("-"));
  }
  return out;
}

/** Normalizes a user-typed code: uppercases and strips spaces/dashes, then
    re-inserts group separators. Accepts the formatted form or a raw string. */
export function normalizeRecoveryCode(raw: string): string {
  const cleaned = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== GROUPS * GROUP_LEN) return "";
  const parts: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    parts.push(cleaned.slice(g * GROUP_LEN, (g + 1) * GROUP_LEN));
  }
  return parts.join("-");
}

export function isValidRecoveryCode(raw: string): boolean {
  return normalizeRecoveryCode(raw) !== "";
}

/** sha256(lower(email) + ":" + code) as lowercase hex — the stored form. */
export async function hashRecoveryCode(email: string, code: string): Promise<string> {
  const norm = normalizeRecoveryCode(code);
  const data = new TextEncoder().encode(`${(email ?? "").trim().toLowerCase()}:${norm}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Hash a whole generated set (what the client sends to save_recovery_codes). */
export async function hashRecoveryCodeSet(email: string, codes: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const c of codes) out.push(await hashRecoveryCode(email, c));
  return out;
}
