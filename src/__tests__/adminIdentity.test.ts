// @vitest-environment jsdom
/* Admin grants belong to a validated account, never a late auth/RPC response. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const cloud = vi.hoisted(() => ({
  user: null as { id: string; email?: string } | null,
  listeners: new Set<(s: { user: { id: string; email?: string } | null }) => void>()
}));
const client = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { getUser: vi.fn() },
  rpc: vi.fn()
}));
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: cloud.user }),
  subscribeCloud: vi.fn((fn: (s: { user: typeof cloud.user }) => void) => {
    cloud.listeners.add(fn);
    fn({ user: cloud.user });
    return () => { cloud.listeners.delete(fn); };
  }),
  getSupabaseClient: vi.fn(async () => {
    /* Model configured/sync notifications during client access: same identity must not recurse. */
    for (const fn of cloud.listeners) fn({ user: cloud.user });
    return client;
  })
}));
vi.mock("../services/events", () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
  queueEvent: vi.fn(),
  flushEvents: vi.fn().mockResolvedValue(undefined)
}));

import { getSupabaseClient, subscribeCloud } from "../services/cloud";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function publish(userId: string | null): void {
  cloud.user = userId ? { id: userId } : null;
  for (const fn of cloud.listeners) fn({ user: cloud.user });
}

type Result = { data: boolean; error: { message: string } | null };
const result = (data: boolean): Result => ({ data, error: null });

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  cloud.listeners.clear();
  cloud.user = { id: "A" };
  client.rpc.mockReset().mockResolvedValue(result(true));
  client.auth.getUser.mockReset().mockImplementation(async () => ({ data: { user: cloud.user }, error: null }));
  client.from.mockReset().mockImplementation(() => {
    const query = { select: () => query, order: () => query, then: (done: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(done) };
    return query;
  });
});

describe("account-bound admin state", () => {
  it("clears A synchronously on switching to B and ignores A's late admin RPC", async () => {
    const admin = await import("../services/admin/state");
    await admin.refreshAdminData();
    expect(admin.getAdminState()).toEqual({ ready: true, userId: "A", isAdmin: true });
    const listener = vi.fn();
    admin.subscribeAdmin(listener);
    const late = deferred<Result>();
    client.rpc.mockImplementationOnce(() => late.promise).mockResolvedValue(result(false));
    const recheckA = admin.refreshAdminData();
    await vi.waitFor(() => expect(client.rpc).toHaveBeenCalledTimes(2));
    publish("B");
    expect(admin.getAdminState()).toMatchObject({ userId: null, isAdmin: false });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ userId: null, isAdmin: false }));
    listener.mockClear();
    await vi.waitFor(() => expect(admin.getAdminState()).toEqual({ ready: true, userId: "B", isAdmin: false }));
    late.resolve(result(true));
    await recheckA;
    expect(admin.getAdminState()).toEqual({ ready: true, userId: "B", isAdmin: false });
    expect(listener.mock.calls.every(([s]) => !s.isAdmin)).toBe(true);
  });

  it("signout clears subscribers immediately before a slow public configuration fetch", async () => {
    const admin = await import("../services/admin/state");
    await admin.initAdmin();
    const listener = vi.fn();
    admin.subscribeAdmin(listener);
    expect(admin.getAdminState().isAdmin).toBe(true);
    const slow = deferred<{ data: unknown[]; error: null }>();
    client.from.mockImplementation((table: string) => {
      const query = {
        select: () => query, order: () => query,
        then: (done: (value: unknown) => unknown) => (table === "app_config" ? slow.promise : Promise.resolve({ data: [], error: null })).then(done)
      };
      return query;
    });
    publish(null);
    expect(admin.getAdminState()).toMatchObject({ userId: null, isAdmin: false });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ userId: null, isAdmin: false }));
    await vi.waitFor(() => expect(getSupabaseClient).toHaveBeenCalledTimes(2));
    slow.resolve({ data: [{ key: "features", value: { roadmap: false } }], error: null });
    await vi.waitFor(async () => {
      const { getRemoteConfig: readConfig } = await import("../services/remoteConfig");
      expect(readConfig().features?.roadmap).toBe(false);
    });
    expect(admin.getAdminState()).toMatchObject({ userId: null, isAdmin: false });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(subscribeCloud).toHaveBeenCalledTimes(1);
  });

  it("an older overlapping recheck cannot overwrite the newer role for the same account", async () => {
    const admin = await import("../services/admin/state");
    const old = deferred<Result>();
    client.rpc.mockImplementationOnce(() => old.promise).mockResolvedValue(result(false));
    const first = admin.refreshAdminData();
    await vi.waitFor(() => expect(client.rpc).toHaveBeenCalledTimes(1));
    await admin.refreshAdminData();
    expect(admin.getAdminState()).toEqual({ ready: true, userId: "A", isAdmin: false });
    old.resolve(result(true));
    await first;
    expect(admin.getAdminState()).toEqual({ ready: true, userId: "A", isAdmin: false });
  });

  it("ignores an old auth lookup before calling the admin RPC", async () => {
    const admin = await import("../services/admin/state");
    const old = deferred<{ data: { user: { id: string } }; error: null }>();
    client.auth.getUser.mockImplementationOnce(() => old.promise);
    client.rpc.mockResolvedValue(result(false));
    const first = admin.refreshAdminData();
    await vi.waitFor(() => expect(client.auth.getUser).toHaveBeenCalledTimes(1));
    publish("B");
    await vi.waitFor(() => expect(admin.getAdminState().userId).toBe("B"));
    old.resolve({ data: { user: { id: "A" } }, error: null });
    await first;
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(admin.getAdminState()).toMatchObject({ userId: "B", isAdmin: false });
  });

  it("getters and subscription seeds fail closed even before an identity notification", async () => {
    const admin = await import("../services/admin/state");
    await admin.refreshAdminData();
    cloud.user = { id: "B" };
    expect(admin.getAdminState()).toMatchObject({ userId: null, isAdmin: false });
    const listener = vi.fn();
    admin.subscribeAdmin(listener);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ userId: null, isAdmin: false }));
    cloud.user = null;
    expect(admin.getAdminState()).toMatchObject({ userId: null, isAdmin: false });
  });

  it("does not grant a persisted or mismatched auth identity absent matching cloud identity", async () => {
    const admin = await import("../services/admin/state");
    client.auth.getUser.mockResolvedValue({ data: { user: { id: "B", email: "gaurav.123337@gmail.com" } }, error: null });
    await admin.refreshAdminData();
    expect(client.rpc).not.toHaveBeenCalled();
    expect(admin.getAdminState()).toMatchObject({ userId: null, isAdmin: false });
    publish(null);
    await admin.refreshAdminData();
    expect(client.rpc).not.toHaveBeenCalled();
    expect(admin.getAdminState()).toMatchObject({ userId: null, isAdmin: false });
  });

  it("RPC errors fail closed and a stale rejection cannot clear a newer account", async () => {
    const admin = await import("../services/admin/state");
    client.rpc.mockResolvedValue({ data: true, error: { message: "forbidden" } });
    await admin.refreshAdminData();
    expect(admin.getAdminState()).toMatchObject({ userId: "A", isAdmin: false });
    const old = deferred<Result>();
    client.rpc.mockImplementationOnce(() => old.promise).mockResolvedValue(result(true));
    const first = admin.refreshAdminData().catch(() => {});
    await vi.waitFor(() => expect(client.rpc).toHaveBeenCalledTimes(2));
    publish("B");
    await vi.waitFor(() => expect(admin.getAdminState()).toMatchObject({ userId: "B", isAdmin: true }));
    old.reject(new Error("old request failed"));
    await first;
    expect(admin.getAdminState()).toMatchObject({ userId: "B", isAdmin: true });
  });
});
