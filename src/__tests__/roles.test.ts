/* Roles — Pro vs Admin are fully separate. Admins have all restrictions
   lifted (getTier → pro, unlimited quotas) regardless of their Pro status,
   and only the product owner (gaurav.123337@gmail.com) counts as the owner
   for admin-management UI gating. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS, storageRemove } from "../services/storage";

const state = vi.hoisted(() => ({ user: null as { id: string; email: string } | null }));
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: state.user, configured: !!state.user, syncing: false, error: null, oauth: [] }),
  isCloudConfigured: () => !!state.user,
  getSupabaseClient: vi.fn().mockResolvedValue(null)
}));

beforeEach(() => {
  state.user = null;
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});
afterEach(() => {
  state.user = null;
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

describe("admin unlock — all restrictions lifted", () => {
  it("an admin is treated as pro regardless of the local tier", async () => {
    const { getTier, setAdminUnlocked } = await import("../services/entitlements");
    expect(getTier()).toBe("free");
    setAdminUnlocked(true);
    expect(getTier()).toBe("pro");
    setAdminUnlocked(false);
    expect(getTier()).toBe("free");
  });

  it("admins get unlimited session and AI-call quotas", async () => {
    const { aiCallsLeft, sessionsLeft, setAdminUnlocked } = await import("../services/entitlements");
    setAdminUnlocked(true);
    expect(sessionsLeft()).toBe(Infinity);
    expect(aiCallsLeft()).toBe(Infinity);
    setAdminUnlocked(false);
    expect(sessionsLeft()).toBeLessThan(Infinity);
  });

  it("tierSource reports 'admin' for an unlocked admin", async () => {
    const { setAdminUnlocked } = await import("../services/entitlements");
    const { tierSource } = await import("../services/entitlement");
    expect(tierSource()).toBe("free");
    setAdminUnlocked(true);
    expect(tierSource()).toBe("admin");
    setAdminUnlocked(false);
  });
});

describe("amOwner — only the PO manages admins", () => {
  it("true for the product owner's email (case-insensitive)", async () => {
    const { amOwner } = await import("../services/admin");
    state.user = { id: "u1", email: "GAURAV.123337@GMAIL.COM" };
    expect(amOwner()).toBe(true);
  });

  it("false for any other signed-in user and for guests", async () => {
    const { amOwner } = await import("../services/admin");
    state.user = { id: "u2", email: "someone@else.com" };
    expect(amOwner()).toBe(false);
    state.user = null;
    expect(amOwner()).toBe(false);
  });
});
