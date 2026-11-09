import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ORIGIN, LOCAL_SITES, LIVE_SITES, assertIsolatedBuild, proxyTarget, requestPolicy } from "./virtual-tester-lib.js";

describe("virtual tester containment", () => {
  it("allows only the exact static site origin and approved fixture origin", () => {
    assert.equal(requestPolicy(LOCAL_SITES[0] + "assets/index-a.js", "GET", LOCAL_SITES[0], "fixture"), "static");
    assert.equal(requestPolicy(FIXTURE_ORIGIN + "/auth/v1/token", "POST", LOCAL_SITES[0], "fixture"), "fixture");
    assert.equal(requestPolicy(FIXTURE_ORIGIN + "/auth/v1/token", "POST", LOCAL_SITES[1], "offline"), "deny");
  });
  it("blocks all production mutations, arbitrary GET endpoints, and lookalike hosts", () => {
    const denied = [
      "https://ndrusywvceojsoirhkhl.supabase.co/rest/v1/user_sync",
      "https://ndrusywvceojsoirhkhl.supabase.co/rest/v1/rpc/admin_request_run",
      "https://ndrusywvceojsoirhkhl.supabase.co/functions/v1/pay-checkout",
      "https://api.openai.com/v1/chat/completions", "https://api.telegram.org/sendMessage",
      "https://virtual-tester.invalid.evil.example/auth/v1/token",
      "https://user@virtual-tester.invalid/auth/v1/token", "http://127.0.0.1:9222/json",
      "mailto:user@example.com", "file:///etc/passwd", "wss://example.com/socket"
    ];
    for (const url of denied) for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      assert.equal(requestPolicy(url, method, LOCAL_SITES[0], "fixture"), "deny");
      assert.equal(proxyTarget(url, method), null);
    }
  });
  it("live mode never permits fixtures or backend operations", () => {
    for (const base of LIVE_SITES) {
      assert.equal(requestPolicy(base, "GET", base, "live"), "static");
      assert.equal(requestPolicy(base, "POST", base, "live"), "deny");
      assert.equal(requestPolicy(base + "admin_request_run", "GET", base, "live"), "deny");
      assert.equal(requestPolicy(FIXTURE_ORIGIN + "/rest/v1/profiles", "POST", base, "live"), "deny");
    }
    assert.equal(requestPolicy("https://unapproved.example/", "GET", "https://unapproved.example/", "live"), "deny");
  });
  it("the proxy rejects CONNECT-style and nonstatic requests", () => {
    assert.equal(proxyTarget("example.com:443", "CONNECT"), null);
    assert.equal(proxyTarget(LOCAL_SITES[0] + "assets/a.js", "GET")?.port, "8140");
    assert.equal(proxyTarget(LOCAL_SITES[0] + "rest/v1/data", "GET"), null);
    assert.equal(proxyTarget("http://127.0.0.1:8137/", "GET"), null);
  });
  it("remote checkout script is replaced, never allowed through the proxy", () => {
    const url = "https://checkout.razorpay.com/v1/checkout.js";
    assert.equal(requestPolicy(url, "GET", LOCAL_SITES[0], "fixture"), "checkout-fixture");
    assert.equal(proxyTarget(url, "GET"), null);
    assert.equal(requestPolicy(url, "GET", LIVE_SITES[0], "live"), "deny");
  });
  it("isolated builds cannot silently use production or replace dist", () => {
    assert.doesNotThrow(() => assertIsolatedBuild("fixture", FIXTURE_ORIGIN, "sb_publishable_virtual_tester", ".virtual-tester/fixture"));
    assert.doesNotThrow(() => assertIsolatedBuild("offline", "", "", ".virtual-tester/offline"));
    assert.throws(() => assertIsolatedBuild("fixture", LIVE_SITES[0], "key", ".virtual-tester/fixture"));
    assert.throws(() => assertIsolatedBuild("offline", "https://example.com", "key", ".virtual-tester/offline"));
    assert.throws(() => assertIsolatedBuild("fixture", FIXTURE_ORIGIN, "sb_publishable_virtual_tester", "dist"));
  });
});
