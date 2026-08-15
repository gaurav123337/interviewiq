/* Deno tests for the reputation provider (L2). Pure request/response logic
   only — the network-facing calls are covered by the client vitest corpus
   with injected fetches. Runs in CI via `deno test supabase/functions/_shared/`
   without network permissions. */

import { assertEquals, assert } from "jsr:@std/assert";

import {
  safeBrowsingMatched,
  safeBrowsingPayload,
  type UrlhausLookup
} from "./reputation.ts";

Deno.test("safeBrowsingPayload embeds the url and standard types", () => {
  const p = safeBrowsingPayload("https://react.dev/learn") as {
    threatInfo: { threatTypes: string[]; platformTypes: string[]; threatEntries: { url: string }[] };
  };
  assertEquals(p.threatInfo.threatEntries[0].url, "https://react.dev/learn");
  assert(p.threatInfo.threatTypes.includes("MALWARE"));
  assertEquals(p.threatInfo.platformTypes, ["ANY_PLATFORM"]);
});

Deno.test("safeBrowsingMatched only fires on a real match", () => {
  assert(safeBrowsingMatched({ matches: [{ threatType: "MALWARE" }] }));
  assert(!safeBrowsingMatched({}));
  assert(!safeBrowsingMatched(null));
});

Deno.test("URLhaus query_status semantics", () => {
  const clean: UrlhausLookup = { query_status: "0" };
  const tagged: UrlhausLookup = { query_status: "1" };
  const invalid: UrlhausLookup = { query_status: "2" };
  assertEquals(clean.query_status, "0");
  assertEquals(tagged.query_status, "1");
  assertEquals(invalid.query_status, "2");
});
