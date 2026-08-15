import { describe, it, expect } from "vitest";
import { generateRecoveryCodes, hashRecoveryCode, isValidRecoveryCode, normalizeRecoveryCode } from "../../src/services/recoveryCodes";

describe("recovery codes", () => {
  it("generates the requested count of formatted codes", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    }
  });

  it("generates unique codes within a set", () => {
    const codes = generateRecoveryCodes(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("never emits lookalike characters (0, O, 1, I, L)", () => {
    const codes = generateRecoveryCodes(20).join("");
    expect(codes).not.toMatch(/[0O1IL]/);
  });

  it("normalizes messy input to the canonical form", () => {
    const raw = "abcde fghij klmno";
    expect(normalizeRecoveryCode(raw)).toBe("ABCDE-FGHIJ-KLMNO");
    expect(normalizeRecoveryCode("abcde-fghij-klmno")).toBe("ABCDE-FGHIJ-KLMNO");
  });

  it("rejects wrong-length input", () => {
    expect(normalizeRecoveryCode("abcde-fghij")).toBe("");
    expect(isValidRecoveryCode("abcde-fghij")).toBe(false);
    expect(isValidRecoveryCode("")).toBe(false);
  });

  it("hashes deterministically and is email-scoped", async () => {
    const h1 = await hashRecoveryCode("Gaurav@Example.com", "ABCDE-FGHIJ-KLMNO");
    const h2 = await hashRecoveryCode("gaurav@example.com", "abcde fghij klmno");
    const h3 = await hashRecoveryCode("other@example.com", "ABCDE-FGHIJ-KLMNO");
    expect(h1).toBe(h2);           /* case + formatting agnostic */
    expect(h1).not.toBe(h3);       /* different email -> different hash */
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("parity with the Deno copy", async () => {
    /* both copies must hash identically — the edge function and the client
       compare against the same stored hashes */
    const { hashRecoveryCode: denoHash } = await import("../../supabase/functions/_shared/recoveryCodes.ts");
    const a = await hashRecoveryCode("me@example.com", "ZZZZZ-YYYYY-XXXXX");
    const b = await denoHash("me@example.com", "ZZZZZ-YYYYY-XXXXX");
    expect(a).toBe(b);
  });
});
