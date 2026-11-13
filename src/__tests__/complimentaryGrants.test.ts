/* Complimentary access regression contract.

   The migration cannot run in jsdom, so this pins its security/atomicity shape
   as raw SQL while the service tests below pin every client-facing RPC and OUT
   field. A real database apply remains the rollout gate. */

import { beforeEach, describe, expect, it, vi } from "vitest";
import migrationSql from "../../supabase/migrations/20261113_complimentary_grants.sql?raw";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "user@example.com" } }),
  getSupabaseClient: vi.fn().mockResolvedValue({ rpc })
}));

const compact = (sql: string) => sql.replace(/\s+/g, " ").trim().toLowerCase();
const body = compact(migrationSql);

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("complimentary grants migration", () => {
  it("keeps a separate audited ledger for all products and sources", () => {
    expect(body).toContain("create table if not exists public.complimentary_grants");
    expect(body).toContain("product in ('monthly', 'yearly', 'lifetime', 'platinum', 'auto_apply')");
    expect(body).toContain("source in ('admin', 'gift_code')");
    for (const field of [
      "starts_at timestamptz", "expires_at timestamptz", "revoked_at timestamptz",
      "issued_by uuid", "grant_code_id bigint", "code text", "reason text",
      "revoked_by uuid", "revoked_reason text", "created_at timestamptz", "updated_at timestamptz"
    ]) expect(body).toContain(field);
    expect(body).toContain("'complimentary_grant'");
    expect(body).toContain("'complimentary_revoke'");
    const grant = body.match(/create or replace function public\.admin_grant_complimentary[\s\S]*?end \$\$;/)?.[0] ?? "";
    expect(grant).toContain("insert into public.complimentary_grants");
    expect(grant).not.toContain("update public.entitlements");
    expect(grant).not.toContain("insert into public.entitlements");
    expect(grant).not.toContain("public.payments");
    /* Revoke targets only the ledger row; it never updates paid entitlements. */
    const revoke = body.match(/create or replace function public\.admin_revoke_complimentary[\s\S]*?end \$\$;/)?.[0] ?? "";
    expect(revoke).toContain("update public.complimentary_grants");
    expect(revoke).not.toContain("update public.entitlements");
    expect(revoke).not.toContain("update public.payments");
  });

  it("makes arbitrary-user auto-apply access service-only and includes every source", () => {
    const access = body.match(/create or replace function public\.has_auto_apply_access[\s\S]*?\$\$;/)?.[0] ?? "";
    expect(access).toContain("from auth.users u");
    expect(access).not.toContain("from public.profiles p");
    expect(access).toContain("public.app_admins");
    expect(access).toContain("e.tier = 'platinum'");
    expect(access).toContain("e.addons -> 'auto_apply'");
    expect(access).toContain("g.product in ('platinum', 'auto_apply')");
    expect(body).toContain("revoke execute on function public.has_auto_apply_access(uuid) from anon, public, authenticated");
    expect(body).toContain("grant execute on function public.has_auto_apply_access(uuid) to service_role");
    expect(body).toContain("select * from public.effective_entitlement(auth.uid())");
  });

  it("preserves legacy reader columns and appends paid plus complimentary provenance", () => {
    const selfReader = body.match(/create function public\.get_my_entitlement\(\)[\s\S]*?\$\$;/)?.[0] ?? "";
    const adminReader = body.match(/create function public\.admin_list_entitlements\(\)[\s\S]*?end \$\$;/)?.[0] ?? "";
    for (const field of [
      "tier text", "plan text", "expires_at timestamptz", "source text",
      "discount_pct integer", "discount_expires_at timestamptz", "active boolean",
      "is_platinum boolean", "auto_apply boolean", "issued_by uuid", "updated_at timestamptz",
      "paid_tier text", "paid_plan text", "paid_expires_at timestamptz", "paid_source text",
      "complimentary boolean", "complimentary_grant_id bigint", "complimentary_product text",
      "complimentary_source text", "complimentary_expires_at timestamptz"
    ]) expect(selfReader).toContain(field);
    expect(adminReader).toContain("if not public.is_admin() then raise exception 'forbidden'");
    expect(adminReader).toContain("cross join lateral public.effective_entitlement(p.id)");
  });

  it("redeems one locked code into the ledger without checkout or paid mutations", () => {
    expect(body).toContain("alter table public.grant_codes add column if not exists product text");
    expect(body).toContain("alter table public.grant_codes add column if not exists grant_days integer");
    expect(body).toContain("replace(gen_random_uuid()::text, '-', '')");
    expect(body).not.toContain("md5(random()::text");
    const redeem = body.match(/create function public\.redeem_grant\(p_code text\)[\s\S]*?end \$\$;/)?.[0] ?? "";
    expect(redeem).toContain("for update");
    expect(redeem).toContain("insert into public.complimentary_grants");
    expect(redeem).toContain("update public.grant_codes");
    expect(redeem).toContain("'gift_code_redeemed'");
    expect(redeem).not.toContain("insert into public.payments");
    expect(redeem).not.toContain("insert into public.entitlements");
    expect(body).toContain("grant_code_id bigint unique");
  });

  it("normalizes paid add-on JSON and coalesces a first-time user's null addons", () => {
    const purchase = body.match(/create or replace function public\.apply_purchase[\s\S]*?end \$\$;/)?.[0] ?? "";
    expect(purchase).toContain("coalesce(cur.addons, '{}'::jsonb)");
    expect(purchase).toContain("'active', true");
    expect(purchase).toContain("'expires_at', null");
    expect(body).toContain("jsonb_set(coalesce(addons, '{}'::jsonb), '{auto_apply,active}', 'true'::jsonb, true)");
  });
});

describe("complimentary entitlement service", () => {
  it("maps effective and underlying paid provenance", async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        user_id: "u1", email: "user@example.com", tier: "platinum", plan: "platinum",
        expires_at: null, source: "gift", discount_pct: 0, discount_expires_at: null,
        active: true, auto_apply: true, updated_at: "2026-11-13T00:00:00Z",
        is_platinum: true, issued_by: "admin-1",
        paid_tier: "pro", paid_plan: "yearly", paid_expires_at: "2027-01-01T00:00:00Z", paid_source: "razorpay",
        complimentary: true, complimentary_grant_id: 42, complimentary_product: "platinum",
        complimentary_source: "gift_code", complimentary_expires_at: null
      }],
      error: null
    });
    const { adminListEntitlements } = await import("../services/entitlement");
    const [row] = await adminListEntitlements();
    expect(row).toMatchObject({
      userId: "u1", source: "gift", isPlatinum: true, autoApply: true,
      paidTier: "pro", paidPlan: "yearly", paidSource: "razorpay",
      complimentary: true, complimentaryGrantId: 42,
      complimentaryProduct: "platinum", complimentarySource: "gift_code"
    });
  });

  it("calls direct grant, list, revoke and all-product gift-code RPCs", async () => {
    rpc
      .mockResolvedValueOnce({ data: 17, error: null })
      .mockResolvedValueOnce({ data: [{
        grant_id: 17, user_id: "u1", email: "user@example.com", product: "auto_apply",
        source: "admin", starts_at: "2026-11-13T00:00:00Z", expires_at: null,
        issued_by: "admin-1", code: null, reason: "Support gift", revoked_at: null,
        revoked_by: null, revoked_reason: null, created_at: "2026-11-13T00:00:00Z",
        updated_at: "2026-11-13T00:00:00Z", active: true
      }], error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: "IQGRANT-AUTO", error: null });

    const {
      adminCreateGrant, adminGrantComplimentary,
      adminListComplimentaryGrants, adminRevokeComplimentary
    } = await import("../services/entitlement");

    expect(await adminGrantComplimentary("u1", "auto_apply", null, "  Support gift  ")).toBe(17);
    expect(rpc).toHaveBeenNthCalledWith(1, "admin_grant_complimentary", {
      p_user: "u1", p_product: "auto_apply", p_expires: null, p_reason: "Support gift"
    });

    const grants = await adminListComplimentaryGrants("u1");
    expect(grants[0]).toMatchObject({ grantId: 17, product: "auto_apply", source: "admin", active: true });
    expect(rpc).toHaveBeenNthCalledWith(2, "admin_list_complimentary_grants", { p_user: "u1", p_active_only: true });

    await adminRevokeComplimentary(17, "  No longer needed  ");
    expect(rpc).toHaveBeenNthCalledWith(3, "admin_revoke_complimentary", { p_grant_id: 17, p_reason: "No longer needed" });

    expect(await adminCreateGrant("auto_apply", 0)).toBe("IQGRANT-AUTO");
    expect(rpc).toHaveBeenNthCalledWith(4, "admin_create_grant", {
      p_plan: "auto_apply", p_days: 0, p_discount_pct: 0
    });
  });
});
