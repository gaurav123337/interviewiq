import { assertEquals } from "jsr:@std/assert";
import { handleApplyAgent } from "./handler.ts";
import { generateBindingCredential, sha256Hex } from "../_shared/applyAgent.ts";

function fixture(owner = crypto.randomUUID()) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const state = { entitled: true, revoked: false, hash: "", auth: true };
  const client = {
    auth: { getUser: (_token: string) => Promise.resolve({ data: { user: state.auth ? { id: owner } : null }, error: null }) },
    rpc: (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ name, args });
      const data = name === "service_apply_agent_rate_limit" ? true
        : name === "service_apply_agent_has_access" ? state.entitled
        : name === "service_apply_agent_list_bindings" ? []
        : name === "service_apply_agent_revoke_binding" ? true
        : name === "service_apply_agent_get_binding" ? [{ owner_id: owner, token_hash: state.hash, revoked_at: state.revoked ? new Date().toISOString() : null }]
        : name === "service_apply_agent_issue_code" ? crypto.randomUUID()
        : name === "service_apply_agent_dispatch" ? [{ title: "own synthetic history" }]
        : null;
      return Promise.resolve({ data, error: null });
    },
  };
  return { client, state, calls };
}
const request = (body: unknown, token = "synthetic-user-jwt", origin?: string) => new Request("https://example.test/functions/v1/apply-agent", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(origin ? { Origin: origin } : {}) },
  body: JSON.stringify(body),
});

Deno.test("paired handler derives owner and uses only transactional binding dispatcher", async () => {
  const f = fixture();
  const credential = generateBindingCredential();
  f.state.hash = await sha256Hex(credential.secret);
  const res = await handleApplyAgent(request({ operation: "agent.action", action: "results.list", args: {} }, credential.token), () => f.client);
  assertEquals(res.status, 200);
  const dispatch = f.calls.find(c => c.name === "service_apply_agent_dispatch")!;
  assertEquals(dispatch.args.p_binding_id, credential.bindingId);
  assertEquals(dispatch.args.p_token_hash, f.state.hash);
  assertEquals("p_user" in dispatch.args, false);
  assertEquals(f.calls.some(c => c.name === "apply_agent_action"), false);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
});

Deno.test("revoked and malformed credentials cannot execute private data actions", async () => {
  const f = fixture();
  const credential = generateBindingCredential();
  f.state.hash = await sha256Hex(credential.secret);
  f.state.revoked = true;
  assertEquals((await handleApplyAgent(request({ operation: "agent.action", action: "results.list", args: {} }, credential.token), () => f.client)).status, 401);
  assertEquals((await handleApplyAgent(request({ operation: "agent.action", action: "results.list", args: {} }, "invalid"), () => f.client)).status, 401);
  assertEquals(f.calls.some(c => c.name === "service_apply_agent_dispatch"), false);
});

Deno.test("agent request rejects browser origins, arbitrary actions and owner spoofing", async () => {
  const f = fixture();
  const credential = generateBindingCredential();
  f.state.hash = await sha256Hex(credential.secret);
  assertEquals((await handleApplyAgent(request({ operation: "agent.action", action: "results.list", args: {} }, credential.token, "https://job-assist.wasmer.app"), () => f.client)).status, 403);
  assertEquals((await handleApplyAgent(request({ operation: "agent.action", action: "arbitrary.rpc", args: {} }, credential.token), () => f.client)).status, 404);
  assertEquals((await handleApplyAgent(request({ operation: "agent.action", action: "results.list", args: { user_id: crypto.randomUUID() } }, credential.token), () => f.client)).status, 400);
  assertEquals(f.calls.some(c => c.name === "service_apply_agent_dispatch"), false);
});

Deno.test("expired entitlement permits own revocation but not new pairing", async () => {
  const f = fixture();
  f.state.entitled = false;
  const origin = "https://job-assist.wasmer.app";
  const list = await handleApplyAgent(request({ operation: "bindings.list" }, "user-token", origin), () => f.client);
  assertEquals(list.status, 200);
  assertEquals(list.headers.get("Access-Control-Allow-Origin"), origin);
  assertEquals((await handleApplyAgent(request({ operation: "bindings.revoke", binding_id: crypto.randomUUID() }, "user-token", origin), () => f.client)).status, 200);
  assertEquals((await handleApplyAgent(request({ operation: "pair.create" }, "user-token", origin), () => f.client)).status, 403);
});

Deno.test("pairing controls deny unauthenticated callers and disallowed origins", async () => {
  const f = fixture(); f.state.auth = false;
  assertEquals((await handleApplyAgent(request({ operation: "pair.create" }), () => f.client)).status, 401);
  assertEquals((await handleApplyAgent(request({ operation: "pair.create" }, "user-token", "https://evil.example"), () => f.client)).status, 403);
  assertEquals(f.calls.some(c => c.name === "service_apply_agent_issue_code"), false);
});

Deno.test("oversized JSON and service construction failures are contained", async () => {
  const f = fixture();
  assertEquals((await handleApplyAgent(request({ value: "x".repeat(300000) }), () => f.client)).status, 413);
  const res = await handleApplyAgent(request({ operation: "bindings.list" }), () => { throw new Error("sensitive config must never escape"); });
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { ok: false, error: "apply_agent_failed" });
});
