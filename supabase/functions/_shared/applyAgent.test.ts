import {
  assert,
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertRejects,
} from "jsr:@std/assert";
import {
  AGENT_ACTIONS,
  PAIRING_CODE_TTL_MS,
  bindingState,
  browserOperationRequiresEntitlement,
  constantTimeEqual,
  generateBindingCredential,
  generatePairingCode,
  normalizePairingCode,
  pairingCodeState,
  parseBindingToken,
  readJsonObject,
  sha256Hex,
  validateAgentActionRequest,
} from "./applyAgent.ts";

Deno.test("pairing codes are random, normalized, and carry a short fixed expiry policy", () => {
  const first = generatePairingCode();
  const second = generatePairingCode();
  assertMatch(first, /^[2-9A-HJ-NP-Z]{5}(?:-[2-9A-HJ-NP-Z]{5}){3}$/);
  assertNotEquals(first, second);
  assertEquals(normalizePairingCode(first.toLowerCase().replaceAll("-", " ")), first);
  assertEquals(normalizePairingCode("AAAAA-AAAAA-AAAAA"), null);
  assertEquals(PAIRING_CODE_TTL_MS, 10 * 60_000);
});

Deno.test("pairing code state fails closed for expiry and enforces one-time use", () => {
  const now = "2026-11-13T12:00:00.000Z";
  assertEquals(pairingCodeState({ expiresAt: "2026-11-13T12:00:01.000Z" }, now), "usable");
  assertEquals(pairingCodeState({ expiresAt: now }, now), "expired");
  assertEquals(pairingCodeState({ expiresAt: "bad timestamp" }, now), "expired");
  assertEquals(pairingCodeState({ expiresAt: "2026-11-13T12:05:00.000Z", usedAt: now }, now), "used");
  assertEquals(pairingCodeState({ expiresAt: "2026-11-13T12:05:00.000Z", usedAt: now }, now), "used");
  assertEquals(pairingCodeState({ expiresAt: "2026-11-13T12:05:00.000Z", revokedAt: now }, now), "revoked");
});

Deno.test("binding tokens expose only an indexed public id plus a 256-bit secret", async () => {
  const credential = generateBindingCredential();
  const parsed = parseBindingToken(credential.token);
  assert(parsed);
  assertEquals(parsed.bindingId, credential.bindingId);
  assertEquals(parsed.secret, credential.secret);
  assertMatch(credential.token, /^aiq1_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
  assertMatch(await sha256Hex(parsed.secret), /^[0-9a-f]{64}$/);
  assertEquals(parseBindingToken(credential.token + "x"), null);
  assertEquals(parseBindingToken(credential.token.replace("aiq1_", "Bearer ")), null);
  assertEquals(parseBindingToken("aiq1_00000000-0000-0000-0000-000000000000.short"), null);
});

Deno.test("revocation and entitlement checks fail closed in the pure binding state", () => {
  assertEquals(bindingState({ entitled: true }), "active");
  assertEquals(bindingState({ entitled: false }), "not_entitled");
  assertEquals(bindingState({ entitled: true, revokedAt: "2026-11-13T12:00:00Z" }), "revoked");
  assertEquals(bindingState({ entitled: false, revokedAt: "2026-11-13T12:00:00Z" }), "revoked");
});

Deno.test("only code creation requires current entitlement; owners can still list/revoke after expiry", () => {
  assertEquals(browserOperationRequiresEntitlement("pair.create"), true);
  assertEquals(browserOperationRequiresEntitlement("bindings.list"), false);
  assertEquals(browserOperationRequiresEntitlement("bindings.revoke"), false);
});

Deno.test("constant-time comparator covers equal, unequal, and unequal-length digests", () => {
  const a = new TextEncoder().encode("a".repeat(64));
  const same = new TextEncoder().encode("a".repeat(64));
  const other = new TextEncoder().encode("a".repeat(63) + "b");
  assertEquals(constantTimeEqual(a, same), true);
  assertEquals(constantTimeEqual(a, other), false);
  assertEquals(constantTimeEqual(a, a.slice(1)), false);
});

Deno.test("bounded JSON reader rejects declared and streamed oversized bodies before parsing", async () => {
  const valid = await readJsonObject(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ operation: "bindings.list" }),
  }), 64);
  assertEquals(valid, { operation: "bindings.list" });

  await assertRejects(
    () => readJsonObject(new Request("https://example.test", {
      method: "POST",
      headers: { "Content-Length": "65" },
      body: "{}",
    }), 64),
    Error,
    "body_too_large",
  );
  await assertRejects(
    () => readJsonObject(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(128) }),
    }), 64),
    Error,
    "body_too_large",
  );
});

Deno.test("every documented action is allowlisted and arbitrary RPC proxying is impossible", () => {
  for (const action of AGENT_ACTIONS) {
    assertEquals(validateAgentActionRequest({ action, args: {} }), { ok: true, action, args: {} });
  }
  assert(AGENT_ACTIONS.includes("reviews.unresolve"));
  assertEquals(
    validateAgentActionRequest({ action: "rpc", args: { function: "admin_list_users" } }),
    { ok: false, error: "unsupported_action" },
  );
  assertEquals(
    validateAgentActionRequest({ action: "results.record", args: [] }),
    { ok: false, error: "invalid_args" },
  );
});

Deno.test("agent action JSON cannot supply an authoritative user identity", () => {
  for (const request of [
    { action: "results.list", userId: crypto.randomUUID(), args: {} },
    { action: "results.list", args: { user_id: crypto.randomUUID() } },
    { action: "results.list", args: { filter: { ownerUuid: crypto.randomUUID() } } },
    { action: "results.list", args: { uid: crypto.randomUUID() } },
  ]) {
    assertEquals(validateAgentActionRequest(request), { ok: false, error: "authoritative_user_forbidden" });
  }
  assertEquals(
    validateAgentActionRequest({ action: "results.list", args: { host: "example.com", limit: 20 } }),
    { ok: true, action: "results.list", args: { host: "example.com", limit: 20 } },
  );
});
