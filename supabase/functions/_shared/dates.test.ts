/* Deno tests for the shared timestamp normalizer (the exact code jobs-fetch
   runs for Lever's createdAt). Run: deno test supabase/functions/_shared/ */

import { assertEquals } from "jsr:@std/assert";
import { toEpochMs } from "./dates.ts";

Deno.test("toEpochMs: milliseconds are passed through unchanged", () => {
  /* a real Lever createdAt — 2026-08-04T11:27:25.029Z */
  assertEquals(toEpochMs(1785842845029), 1785842845029);
});

Deno.test("toEpochMs: seconds-scale is converted to ms", () => {
  /* the same instant expressed in seconds */
  assertEquals(toEpochMs(1785842845), 1785842845000);
});

Deno.test("toEpochMs: small-ish epoch (post-1970, seconds) still converts", () => {
  /* 2001-09-09T01:46:40Z in seconds — under the 1e11 ms threshold */
  assertEquals(toEpochMs(1000000000), 1000000000000);
});

Deno.test("toEpochMs: produced ISO string is a sane year", () => {
  const ms = toEpochMs(1785842845029);
  const iso = ms ? new Date(ms).toISOString() : null;
  assertEquals(iso, "2026-08-04T11:27:25.029Z");
});

Deno.test("toEpochMs: missing/invalid values return null", () => {
  assertEquals(toEpochMs(0), null);
  assertEquals(toEpochMs(NaN), null);
  assertEquals(toEpochMs(-5), null);
  assertEquals(toEpochMs(Infinity), null);
});
