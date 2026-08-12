/* Server-verified billing tests — pricing math, entitlement refresh
   (server is authoritative), single-use grant redemption, and the admin
   grant/discount/code actions. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS, storageRemove, storageSet } from "../services/storage";
import { getTier, setTier } from "../services/entitlements";

interface CloudUser { id: string; email: string }
const signedIn = vi.hoisted(() => vi.fn((): { user: CloudUser | null; configured: boolean; syncing: boolean; error: string | null; oauth: unknown[] } =>
  ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] })));

const baseImpl = vi.hoisted(() => (name: string): Promise<{ data: unknown; error: unknown }> => {
  if (name === "get_my_entitlement") {
    return Promise.resolve({
      data: [{ tier: "pro", plan: "monthly", expires_at: null, source: "grant", discount_pct: 0, discount_expires_at: null, active: true, issued_by: null, updated_at: null }],
      error: null
    });
  }
  if (name === "redeem_grant") {
    return Promise.resolve({
      data: [{ tier: "pro", plan: "yearly", expires_at: null, source: "grant", discount_pct: 25, discount_expires_at: null, active: true }],
      error: null
    });
  }
  if (name === "admin_create_grant") {
    return Promise.resolve({ data: "IQGRANT-TEST1234", error: null });
  }
  return Promise.resolve({ data: null, error: null });
});

const rpc = vi.hoisted(() => vi.fn(baseImpl));
const from = vi.hoisted(() => vi.fn());

vi.mock("../services/cloud", () => ({
  getCloudState: () => signedIn(),
  getSupabaseClient: vi.fn().mockResolvedValue({
    rpc,
    from,
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok-123" } } }) }
  })
}));

afterEach(() => {
  storageRemove(STORAGE_KEYS.tier);
  storageRemove(STORAGE_KEYS.licenseKey);
  vi.unstubAllGlobals();
});

describe("discount pricing", () => {
  it("applies a percent discount and clamps it", async () => {
    const { discountedPrice, fmtMoney } = await import("../services/entitlement");
    expect(discountedPrice(9, 30)).toBe(6.3);
    expect(discountedPrice(79, 10)).toBe(71.1);
    expect(discountedPrice(9, 0)).toBe(9);
    expect(discountedPrice(9, 150)).toBe(0);
    expect(fmtMoney(6.3)).toBe("$6.30");
    expect(fmtMoney(9)).toBe("$9");
  });

  it("discountLive only counts inside the window", async () => {
    const { discountLive } = await import("../services/entitlement");
    const e = { tier: "free" as const, plan: null, expiresAt: null, source: null, discountPct: 20, discountExpiresAt: null, active: false, issuedBy: null, updatedAt: null };
    expect(discountLive(e)).toBe(20);
    const past = { ...e, discountExpiresAt: new Date(Date.now() - 86400000).toISOString() };
    expect(discountLive(past)).toBe(0);
    expect(discountLive({ ...e, discountPct: 0 })).toBe(0);
    expect(discountLive(null)).toBe(0);
  });
});

describe("entitlement refresh (server is authoritative when signed in)", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockImplementation(baseImpl);
  });

  it("mirrors a server pro grant into the local tier", async () => {
    setTier("free");
    const { refreshEntitlement } = await import("../services/entitlement");
    const e = await refreshEntitlement();
    expect(e?.active).toBe(true);
    expect(getTier()).toBe("pro");
  });

  it("downgrades when the server says free or the grant expired", async () => {
    setTier("pro");
    rpc.mockResolvedValueOnce({
      data: [{ tier: "free", plan: null, expires_at: null, source: null, discount_pct: 0, discount_expires_at: null, active: false, issued_by: null, updated_at: null }],
      error: null
    });
    const { refreshEntitlement } = await import("../services/entitlement");
    await refreshEntitlement();
    expect(getTier()).toBe("free");
  });

  it("leaves the local tier untouched when signed out", async () => {
    signedIn.mockReturnValueOnce({ user: null, configured: true, syncing: false, error: null, oauth: [] });
    setTier("pro");
    const { refreshEntitlement, serverPro } = await import("../services/entitlement");
    expect(await refreshEntitlement()).toBeNull();
    expect(getTier()).toBe("pro");
    expect(serverPro()).toBe(false);
  });
});

describe("redeem grant code", () => {
  it("redeems a single-use code and activates pro on the account", async () => {
    const { redeemGrant, getCachedEntitlement } = await import("../services/entitlement");
    const r = await redeemGrant(" iqgrant-test1234 ");
    expect(r.ok).toBe(true);
    expect(r.entitlement?.active).toBe(true);
    expect(r.entitlement?.plan).toBe("yearly");
    expect(r.entitlement?.discountPct).toBe(25);
    /* the RPC got the normalized uppercase code */
    expect(rpc).toHaveBeenCalledWith("redeem_grant", { p_code: "IQGRANT-TEST1234" });
    expect(getCachedEntitlement()?.active).toBe(true);
    expect(getTier()).toBe("pro");
  });

  it("maps server errors to friendly messages", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "invalid_code" } });
    const { redeemGrant } = await import("../services/entitlement");
    const r = await redeemGrant("IQGRANT-NOPE");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("doesn't exist");
  });

  it("requires a signed-in account", async () => {
    signedIn.mockReturnValueOnce({ user: null, configured: true, syncing: false, error: null, oauth: [] });
    const { redeemGrant } = await import("../services/entitlement");
    const r = await redeemGrant("IQGRANT-ANYTHING");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Sign in");
  });
});

describe("admin subscription management", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockImplementation(baseImpl);
  });

  it("lists every subscription across users with the RPC mapping", async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        user_id: "u1", email: "a@b.c", provider: "razorpay", provider_subscription_id: "sub_1",
        plan: "yearly", status: "active", current_period_end: "2027-01-01T00:00:00Z",
        cancelled_at: null, created_at: "2026-08-01T00:00:00Z"
      }],
      error: null
    });
    const { adminListSubscriptions } = await import("../services/billing");
    const rows = await adminListSubscriptions();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "u1", email: "a@b.c", provider: "razorpay", providerSubscriptionId: "sub_1",
      plan: "yearly", status: "active", currentPeriodEnd: "2027-01-01T00:00:00Z", cancelledAt: null
    });
    expect(rpc).toHaveBeenCalledWith("admin_list_subscriptions");
  });

  it("admin cancel calls pay-cancel with the target user id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, status: "cancelled", currentPeriodEnd: "2027-02-01T00:00:00Z" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const { adminCancelSubscription } = await import("../services/billing");
    const r = await adminCancelSubscription("sub_1", "u1");
    expect(r.status).toBe("cancelled");
    expect(r.currentPeriodEnd).toBe("2027-02-01T00:00:00Z");
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/pay-cancel");
    expect(opts.headers).toMatchObject({ Authorization: "Bearer tok-123" });
    expect(JSON.parse(String(opts.body))).toEqual({ providerSubscriptionId: "sub_1", targetUserId: "u1" });
  });

  it("admin cancel carries the reason into the audit trail", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, status: "cancelled", currentPeriodEnd: null })
    });
    vi.stubGlobal("fetch", fetchMock);
    const { adminCancelSubscription } = await import("../services/billing");
    await adminCancelSubscription("sub_1", "u1", "  Payment failed twice  ");
    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(opts.body))).toEqual({
      providerSubscriptionId: "sub_1", targetUserId: "u1", reason: "Payment failed twice"
    });
  });

  it("admin cancel surfaces a server rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "Not your subscription" })
    }));
    const { adminCancelSubscription } = await import("../services/billing");
    await expect(adminCancelSubscription("sub_1", "u2")).rejects.toThrow("Not your subscription");
  });
});

describe("admin refund flow", () => {
  it("admin refund calls pay-refund with the auth header and reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        providerStatus: "processed",
        providerRefundId: "rfnd_9",
        amountMinor: 7900,
        withinGrace: true,
        emailSent: true,
        note: "Refunded via razorpay (refund rfnd_9) — entitlement days subtracted."
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const { adminRefundPayment } = await import("../services/billing");
    const r = await adminRefundPayment("pay_1", "  Overcharged  ");
    expect(r).toMatchObject({ ok: true, providerRefundId: "rfnd_9", emailSent: true });
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/pay-refund");
    expect(opts.headers).toMatchObject({ Authorization: "Bearer tok-123" });
    expect(JSON.parse(String(opts.body))).toEqual({ providerPaymentId: "pay_1", reason: "Overcharged" });
  });

  it("admin refund carries a partial amount when given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, amountMinor: 500, withinGrace: false, emailSent: false, note: "Refunded." })
    });
    vi.stubGlobal("fetch", fetchMock);
    const { adminRefundPayment } = await import("../services/billing");
    const r = await adminRefundPayment("pay_1", "Partial", 500);
    expect(r.amountMinor).toBe(500);
    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(opts.body))).toEqual({ providerPaymentId: "pay_1", reason: "Partial", amountMinor: 500 });
  });

  it("reads the published refund policy (defaults when unpublished)", async () => {
    from.mockReset();
    from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    });
    const { getRefundPolicy } = await import("../services/billing");
    const p = await getRefundPolicy();
    expect(p.grace_days).toBe(7);
    expect(p.max_refunds_per_user).toBe(3);
    expect(p.reason_presets).toContain("Duplicate purchase");
    expect(from).toHaveBeenCalledWith("app_config");
  });

  it("publishes the refund policy via app_config upsert", async () => {
    from.mockReset();
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });
    const { publishRefundPolicy } = await import("../services/billing");
    await publishRefundPolicy({ grace_days: 14, max_refunds_per_user: 5, reason_presets: ["A", "B"] });
    expect(from).toHaveBeenCalledWith("app_config");
    const [arg] = upsert.mock.calls[0] as [{ key: string; value: Record<string, unknown> }];
    expect(arg.key).toBe("refund_policy");
    expect(arg.value).toMatchObject({ grace_days: 14, max_refunds_per_user: 5 });
  });

  it("admin refund surfaces a server rejection (e.g. non-admin caller)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "Admins only — this account isn't on the admin allow-list" })
    }));
    const { adminRefundPayment } = await import("../services/billing");
    await expect(adminRefundPayment("pay_1")).rejects.toThrow(/Admins only/);
  });
});

describe("razorpay standard checkout (client)", () => {
  it("createStandardOrder posts mode=standard and maps the order fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ provider: "razorpay", order_id: "order_1", amount_minor: 7900, currency: "USD", key_id: "rzp_test_key", mode: "standard" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const { createStandardOrder } = await import("../services/billing");
    const r = await createStandardOrder("yearly", 0, "WELCOME");
    expect(r).toMatchObject({ orderId: "order_1", amountMinor: 7900, keyId: "rzp_test_key" });
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/pay-checkout");
    expect(JSON.parse(String(opts.body))).toEqual({ plan: "yearly", discountPct: 0, coupon: "WELCOME", mode: "standard" });
  });

  it("createStandardOrder surfaces a fallback as an error (caller falls back to the link)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Razorpay not configured — set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET", fallback: true })
    }));
    const { createStandardOrder } = await import("../services/billing");
    await expect(createStandardOrder("monthly")).rejects.toThrow(/Razorpay not configured/);
  });

  it("verifyPayment posts the three callback fields and maps the grant", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, granted: "u1", plan: "yearly", paymentId: "pay_1" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const { verifyPayment } = await import("../services/billing");
    const r = await verifyPayment("pay_1", "order_1", "abc123");
    expect(r).toMatchObject({ ok: true, granted: "u1", plan: "yearly" });
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/pay-verify");
    expect(JSON.parse(String(opts.body))).toEqual({ paymentId: "pay_1", orderId: "order_1", signature: "abc123" });
  });

  it("verifyPayment surfaces a signature rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "Signature verification failed" })
    }));
    const { verifyPayment } = await import("../services/billing");
    await expect(verifyPayment("pay_1", "order_1", "bad")).rejects.toThrow(/Signature verification failed/);
  });
});

describe("admin billing actions", () => {
  it("calls the grant, discount and create-code RPCs", async () => {
    rpc.mockClear();
    const { adminSetEntitlement, adminIssueDiscount, adminCreateGrant } = await import("../services/entitlement");
    await adminSetEntitlement("u1", "pro", "lifetime", null);
    expect(rpc).toHaveBeenCalledWith("admin_set_entitlement", { p_user: "u1", p_tier: "pro", p_plan: "lifetime", p_expires: null, p_source: "admin" });
    await adminIssueDiscount("u1", 30, 90);
    expect(rpc).toHaveBeenCalledWith("admin_issue_discount", { p_user: "u1", p_pct: 30, p_days: 90 });
    const code = await adminCreateGrant("monthly", 30, 0);
    expect(code).toBe("IQGRANT-TEST1234");
  });
});

describe("tier source readout", () => {
  it("reports server / local / free", async () => {
    const { clearServerEntitlement, refreshEntitlement, tierSource } = await import("../services/entitlement");
    /* seed the server pro cache deterministically */
    await refreshEntitlement();
    expect(tierSource()).toBe("server");
    /* a local test key — but the server grant still wins while it's active */
    storageSet(STORAGE_KEYS.licenseKey, "IQPRO-ABCD-EFGH-0000");
    setTier("pro");
    expect(tierSource()).toBe("server");
    /* after sign-out the server cache clears → the local key shows */
    clearServerEntitlement();
    expect(tierSource()).toBe("local");
    setTier("free");
    storageRemove(STORAGE_KEYS.licenseKey);
    expect(tierSource()).toBe("free");
  });
});
