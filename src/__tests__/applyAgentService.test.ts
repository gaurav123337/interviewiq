import { beforeEach, describe, expect, it, vi } from "vitest";

const cloud = vi.hoisted(() => ({
  client: null as unknown,
  user: { id: "user-test" } as { id: string } | null,
  getSupabaseClient: vi.fn(),
}));
vi.mock("../services/cloud", () => ({
  getSupabaseClient: cloud.getSupabaseClient,
  getCloudState: vi.fn(() => ({ user: cloud.user })),
}));

import { createPairingCode, listAgentBindings, revokeAgentBinding, personalApplyReady } from "../services/applyAgent";

const invoke = vi.fn();
const rpc = vi.fn();
const client = { functions: { invoke }, rpc };

beforeEach(() => {
  cloud.user = { id: "user-test" };
  cloud.client = client;
  cloud.getSupabaseClient.mockReset().mockImplementation(async () => cloud.client);
  invoke.mockReset();
  rpc.mockReset();
});

const operations = [
  { operation: "pair.create", body: { operation: "pair.create" }, call: () => createPairingCode() },
  { operation: "bindings.list", body: { operation: "bindings.list" }, call: () => listAgentBindings() },
  { operation: "bindings.revoke", body: { operation: "bindings.revoke", binding_id: "binding-1" }, call: () => revokeAgentBinding("binding-1") },
];

describe("personal agent control operation whitelist", () => {
  it.each(operations)("signed-out $operation is denied before contacting the service", async ({ call }) => {
    cloud.user = null;
    await expect(call()).rejects.toThrow("Sign in to manage your personal agent");
    expect(cloud.getSupabaseClient).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(operations)("$operation sends only its whitelisted operation and arguments", async ({ body, call }) => {
    invoke.mockResolvedValueOnce({ data: { ok: true, pairing: {}, bindings: [] }, error: null });
    await call();
    expect(invoke.mock.calls).toEqual([["apply-agent", { body }]]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the pairing code and expiry from the service", async () => {
    const pairing = { id: "pair-1", code: "ABCD-EFGH", expires_at: "2026-11-13T12:10:00Z" };
    invoke.mockResolvedValueOnce({ data: { ok: true, pairing }, error: null });
    expect(await createPairingCode()).toEqual(pairing);
  });

  it("returns existing agent bindings without changing their lifecycle fields", async () => {
    const bindings = [{
      binding_id: "binding-1", label: "My laptop", created_at: "2026-11-13T12:00:00Z",
      last_used_at: null, revoked_at: null,
    }];
    invoke.mockResolvedValueOnce({ data: { ok: true, bindings }, error: null });
    expect(await listAgentBindings()).toEqual(bindings);
  });

  it("returns an empty binding list when the service has no bindings", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    expect(await listAgentBindings()).toEqual([]);
  });

  it.each(operations)("$operation propagates transport errors without any RPC fallback", async ({ body, call }) => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "personal agent endpoint unavailable" } });
    await expect(call()).rejects.toThrow("personal agent endpoint unavailable");
    expect(invoke.mock.calls).toEqual([["apply-agent", { body }]]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("propagates the server entitlement denial instead of returning a pairing code", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: false, error: "auto-apply entitlement required" }, error: null });
    await expect(createPairingCode()).rejects.toThrow("auto-apply entitlement required");
    expect(invoke).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports an honest unavailable error for an empty service response", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(createPairingCode()).rejects.toThrow("Personal agent service unavailable");
    expect(invoke).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails when cloud is not configured without issuing a request", async () => {
    cloud.client = null;
    await expect(createPairingCode()).rejects.toThrow("cloud not configured");
    expect(invoke).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("personalApplyReady", () => {
  it("probes only one own result using the tenant RPC", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(personalApplyReady()).resolves.toBeUndefined();
    expect(rpc.mock.calls).toEqual([["my_apply_action", { p_action: "results.list", p_args: { limit: 1 } }]]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each(["function my_apply_action does not exist", "forbidden"])(
    "RPC error %s fails closed without a global fallback",
    async message => {
      rpc.mockResolvedValueOnce({ data: null, error: { message } });
      await expect(personalApplyReady()).rejects.toThrow("Personal application data is unavailable until the tenant migration is applied.");
      expect(rpc.mock.calls).toEqual([["my_apply_action", { p_action: "results.list", p_args: { limit: 1 } }]]);
      expect(invoke).not.toHaveBeenCalled();
    },
  );

  it("does not retry a rejected RPC through another reader", async () => {
    rpc.mockRejectedValueOnce(new Error("network offline"));
    await expect(personalApplyReady()).rejects.toThrow("network offline");
    expect(rpc.mock.calls).toEqual([["my_apply_action", { p_action: "results.list", p_args: { limit: 1 } }]]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("fails when cloud is not configured without issuing any RPC", async () => {
    cloud.client = null;
    await expect(personalApplyReady()).rejects.toThrow("cloud not configured");
    expect(rpc).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });
});
