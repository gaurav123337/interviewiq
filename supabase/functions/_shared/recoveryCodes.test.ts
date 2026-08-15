/* Deno parity test — mirrors src/__tests__/recoveryCodes.test.ts. Run with:
     deno test supabase/functions/_shared/recoveryCodes.test.ts            */

import { assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert";
import { generateRecoveryCodes, hashRecoveryCode, isValidRecoveryCode, normalizeRecoveryCode } from "./recoveryCodes.ts";

Deno.test("generates 10 formatted, unique codes", () => {
  const codes = generateRecoveryCodes(10);
  assertEquals(codes.length, 10);
  for (const c of codes) assertMatch(c, /^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assertEquals(new Set(codes).size, 10);
});

Deno.test("never emits lookalike characters", () => {
  assertEquals(generateRecoveryCodes(20).join("").match(/[0O1IL]/), null);
});

Deno.test("normalizes and validates", () => {
  assertEquals(normalizeRecoveryCode("abcde fghij klmno"), "ABCDE-FGHIJ-KLMNO");
  assertEquals(normalizeRecoveryCode("abcde-fghij"), "");
  assertEquals(isValidRecoveryCode("abcde-fghij"), false);
});

Deno.test("hashes deterministically and is email-scoped", async () => {
  const h1 = await hashRecoveryCode("Gaurav@Example.com", "ABCDE-FGHIJ-KLMNO");
  const h2 = await hashRecoveryCode("gaurav@example.com", "abcde fghij klmno");
  const h3 = await hashRecoveryCode("other@example.com", "ABCDE-FGHIJ-KLMNO");
  assertEquals(h1, h2);
  assertNotEquals(h1, h3);
  assertMatch(h1, /^[0-9a-f]{64}$/);
});
