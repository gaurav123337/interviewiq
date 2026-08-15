/* Deno copy of src/services/recoveryCodes.ts — keep in sync. Pure WebCrypto,
   so browser / Deno / Node all compute identical results. */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUPS = 3;
const GROUP_LEN = 5;

export function generateRecoveryCodes(count = 10): string[] {
  const out: string[] = [];
  for (let n = 0; n < count; n++) {
    const chars: string[] = [];
    for (let i = 0; i < GROUPS * GROUP_LEN; i++) {
      const r = new Uint32Array(1);
      crypto.getRandomValues(r);
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

export async function hashRecoveryCode(email: string, code: string): Promise<string> {
  const norm = normalizeRecoveryCode(code);
  const data = new TextEncoder().encode(`${(email ?? "").trim().toLowerCase()}:${norm}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
