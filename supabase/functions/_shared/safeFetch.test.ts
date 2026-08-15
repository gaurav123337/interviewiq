/* Deno tests for the shared security helpers (safeFetch pure logic, cors,
   ratelimit). Runs in CI via `deno test supabase/functions/_shared/` WITHOUT
   network permissions, so every test here is pure — the network-facing
   behavior of safeFetch is covered by the client vitest corpus (same rules)
   and by live verification. */

import { assertEquals, assert, assertFalse } from "jsr:@std/assert";

import {
  checkUrl, isBlockedHost, isIpv4Literal, isPrivateIpv4, isPrivateIpv6,
  normalizeHost, parseIpv4, SafeFetchError
} from "./safeFetch.ts";
import { isAllowedOrigin, corsHeaders, preflightResponse } from "./cors.ts";
import { makeLimiter } from "./ratelimit.ts";

Deno.test("normalizeHost strips ports/brackets/trailing dots", () => {
  assertEquals(normalizeHost("Example.COM:443"), "example.com");
  assertEquals(normalizeHost("example.com."), "example.com");
  assertEquals(normalizeHost("[::1]"), "::1");
});

Deno.test("private IPv4 ranges are classified", () => {
  assert(isPrivateIpv4(10, 0, 0, 1));
  assert(isPrivateIpv4(172, 16, 0, 1));
  assert(isPrivateIpv4(192, 168, 1, 1));
  assert(isPrivateIpv4(127, 0, 0, 1));
  assert(isPrivateIpv4(169, 254, 169, 254));
  assertFalse(isPrivateIpv4(8, 8, 8, 8));
});

Deno.test("private IPv6 ranges are classified", () => {
  assert(isPrivateIpv6("::1"));
  assert(isPrivateIpv6("fc00::1"));
  assert(isPrivateIpv6("fe80::1"));
  assert(isPrivateIpv6("::ffff:10.0.0.1"));
  assertFalse(isPrivateIpv6("2606:4700:4700::1111"));
});

Deno.test("must-block host corpus", () => {
  for (const h of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "localhost", "metadata.google.internal", "db.internal", "printer.local"]) {
    assert(!isBlockedHost(h).ok, `${h} should be blocked`);
  }
  for (const h of ["example.com", "boards-api.greenhouse.io"]) {
    assert(isBlockedHost(h).ok, `${h} should be allowed`);
  }
});

Deno.test("must-block URL corpus", () => {
  const blocked = [
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1:3000/",
    "http://10.0.0.1/",
    "http://[::1]/",
    "https://user:pass@example.com/",
    "file:///etc/passwd",
    "http://example.com/" // https-only by default
  ];
  for (const u of blocked) assert(!checkUrl(u).ok, `${u} should be rejected`);
  assert(checkUrl("https://boards-api.greenhouse.io/v1/boards/lyft/jobs").ok);
  assert(checkUrl("http://example.com/", { allowHttp: true }).ok);
});

Deno.test("ip literal parsing", () => {
  assert(isIpv4Literal("8.8.8.8"));
  assertEquals(parseIpv4("10.0.0.1"), [10, 0, 0, 1]);
  assertEquals(parseIpv4("example.com"), null);
});

Deno.test("SafeFetchError is distinguishable", () => {
  const e = new SafeFetchError("blocked");
  assert(e instanceof Error);
  assertEquals(e.name, "SafeFetchError");
});

Deno.test("cors allows only known origins", () => {
  const good = new Request("https://site/fn", { headers: { origin: "https://gaurav123337.github.io" } });
  const bad = new Request("https://site/fn", { headers: { origin: "https://evil.example.com" } });
  const none = new Request("https://site/fn"); // server-to-server
  assert(isAllowedOrigin(good));
  assert(!isAllowedOrigin(bad));
  assert(isAllowedOrigin(none));
  assertEquals(corsHeaders(good)["Access-Control-Allow-Origin"], "https://gaurav123337.github.io");
  assertEquals(corsHeaders(bad)["Access-Control-Allow-Origin"], undefined);
  assertEquals(preflightResponse(bad).status, 403);
  assertEquals(preflightResponse(none).status, 204);
});

Deno.test("ratelimit enforces a window", () => {
  const limiter = makeLimiter(2, 60_000);
  assert(limiter("a"));
  assert(limiter("a"));
  assert(!limiter("a"));
  assert(limiter("b")); // different key unaffected
});
