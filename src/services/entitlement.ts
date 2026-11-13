/* Server-verified entitlements — Pro is an ACCOUNT property now.
   The entitlements table (supabase/billing.sql) is the single source of
   truth; the client reads its own row via get_my_entitlement() and can
   never self-grant. The old local checksum keys remain only as a
   test-mode fallback (see CONFIG.features.testLicensing). */

import { getCloudState, getSupabaseClient } from "./cloud";
import { validateCoupon } from "./billing/coupons";
import { adminUnlockedActive, getTier, setTier, type Tier } from "./entitlements";
import { STORAGE_KEYS, storageGet } from "./storage";
import { CONFIG } from "../config";

export type ComplimentaryProduct = "monthly" | "yearly" | "lifetime" | "platinum" | "auto_apply";
export type ComplimentarySource = "admin" | "gift_code";

export interface ServerEntitlement {
  tier: Tier;
  plan: string | null;
  expiresAt: string | null;
  source: string | null;
  discountPct: number;
  discountExpiresAt: string | null;
  /** Server-computed: pro and not expired. */
  active: boolean;
  /** Server-computed: platinum and not expired (optional — older readers omit it). */
  isPlatinum?: boolean;
  /** Server-computed: the auto-apply ADD-ON is active (purchased on any plan,
      implied by Platinum, or complimentary). Optional — older readers omit it. */
  autoApply?: boolean;
  issuedBy: string | null;
  updatedAt: string | null;
  /** Paid-row provenance is separate so a gift never disguises or overwrites it. */
  paidTier?: string | null;
  paidPlan?: string | null;
  paidExpiresAt?: string | null;
  paidSource?: string | null;
  complimentary?: boolean;
  complimentaryGrantId?: number | null;
  complimentaryProduct?: ComplimentaryProduct | null;
  complimentarySource?: ComplimentarySource | null;
  complimentaryExpiresAt?: string | null;
}

export interface AdminEntitlementRow {
  userId: string;
  email: string;
  tier: string;
  plan: string | null;
  expiresAt: string | null;
  source: string | null;
  discountPct: number;
  discountExpiresAt: string | null;
  active: boolean;
  isPlatinum?: boolean;
  /** auto-apply access (paid add-on, Platinum, admin bypass, or complimentary). */
  autoApply?: boolean;
  issuedBy?: string | null;
  updatedAt: string | null;
  paidTier?: string | null;
  paidPlan?: string | null;
  paidExpiresAt?: string | null;
  paidSource?: string | null;
  complimentary?: boolean;
  complimentaryGrantId?: number | null;
  complimentaryProduct?: ComplimentaryProduct | null;
  complimentarySource?: ComplimentarySource | null;
  complimentaryExpiresAt?: string | null;
}

export interface ComplimentaryGrantRow {
  grantId: number;
  userId: string;
  email: string;
  product: ComplimentaryProduct;
  source: ComplimentarySource;
  startsAt: string;
  expiresAt: string | null;
  issuedBy: string | null;
  code: string | null;
  reason: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

/* Pricing shown in the Upgrade modal — discounts apply on top. */
export const PLANS = [
  { id: "monthly", label: "Monthly", price: 9, per: "/mo" },
  { id: "yearly", label: "Yearly", price: 79, per: "/yr" },
  { id: "lifetime", label: "Lifetime", price: 199, per: " once" },
  { id: "platinum", label: "Platinum", price: 349, per: " once" }
] as const;

/** Gift/admin products include auto-apply without making it a checkout plan. */
export const COMPLIMENTARY_PRODUCTS: readonly {
  id: ComplimentaryProduct; label: string; defaultDays: number;
}[] = [
  { id: "monthly", label: "Monthly", defaultDays: 30 },
  { id: "yearly", label: "Yearly", defaultDays: 365 },
  { id: "lifetime", label: "Lifetime", defaultDays: 0 },
  { id: "platinum", label: "Platinum", defaultDays: 0 },
  { id: "auto_apply", label: "Auto-apply add-on", defaultDays: 0 }
];

type PricedProduct = (typeof PLANS)[number]["id"] | "auto_apply";

/** The add-on is priced separately, never offered as a subscription/grant plan.
    Keep its fallback aligned with the server's PLAN_CATALOG (19900 minor units). */
export function resolvePlanPrice(id: string, remote: Partial<Record<PricedProduct, unknown>> | null = null): number {
  const fallback = id === "auto_apply" ? 199 : PLANS.find(plan => plan.id === id)?.price;
  if (fallback === undefined) throw new Error("Unknown pricing product");
  const override = remote?.[id as PricedProduct];
  return typeof override === "number" && Number.isFinite(override) && override >= 0 ? override : fallback;
}

let cached: ServerEntitlement | null = null;
let cachedUserId: string | null = null;
const entitlementListeners = new Set<() => void>();

export function getCachedEntitlement(): ServerEntitlement | null {
  return cachedUserId === getCloudState().user?.id ? cached : null;
}

export function subscribeEntitlement(fn: () => void): () => void {
  entitlementListeners.add(fn);
  return () => { entitlementListeners.delete(fn); };
}

function notifyEntitlement(): void {
  for (const fn of entitlementListeners) {
    try { fn(); } catch { /* listener errors cannot invalidate a verified entitlement */ }
  }
}

/** Drops account-bound cached access; never exposes it to another identity. */
export function clearServerEntitlement(): void {
  cached = null;
  cachedUserId = null;
  notifyEntitlement();
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function complimentaryProduct(value: unknown): ComplimentaryProduct | null {
  return COMPLIMENTARY_PRODUCTS.some(product => product.id === value) ? value as ComplimentaryProduct : null;
}

function complimentarySource(value: unknown): ComplimentarySource | null {
  return value === "admin" || value === "gift_code" ? value : null;
}

function mapRow(r: Record<string, unknown>): ServerEntitlement {
  return {
    tier: (r.tier as Tier) ?? "free",
    plan: nullableString(r.plan),
    expiresAt: nullableString(r.expires_at),
    source: nullableString(r.source),
    discountPct: Number(r.discount_pct ?? 0),
    discountExpiresAt: nullableString(r.discount_expires_at),
    active: Boolean(r.active),
    isPlatinum: r.is_platinum === true,
    autoApply: r.auto_apply === true,
    issuedBy: nullableString(r.issued_by),
    updatedAt: nullableString(r.updated_at),
    paidTier: nullableString(r.paid_tier),
    paidPlan: nullableString(r.paid_plan),
    paidExpiresAt: nullableString(r.paid_expires_at),
    paidSource: nullableString(r.paid_source),
    complimentary: r.complimentary === true,
    complimentaryGrantId: nullableNumber(r.complimentary_grant_id),
    complimentaryProduct: complimentaryProduct(r.complimentary_product),
    complimentarySource: complimentarySource(r.complimentary_source),
    complimentaryExpiresAt: nullableString(r.complimentary_expires_at)
  };
}

/** Discount still in effect (window not passed). */
export function discountLive(e: ServerEntitlement | null): number {
  if (!e || !e.discountPct) return 0;
  if (e.discountExpiresAt && new Date(e.discountExpiresAt).getTime() < Date.now()) return 0;
  return e.discountPct;
}

export function discountedPrice(base: number, pct: number): number {
  return Math.round(base * (1 - Math.max(0, Math.min(100, pct)) / 100) * 100) / 100;
}

export function fmtMoney(n: number): string {
  return "$" + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}

/** True when the signed-in user's SERVER entitlement grants Pro. Local tier
    (incl. team seats) still counts for guests / offline. */
export function serverPro(): boolean {
  return getCachedEntitlement()?.active === true;
}

/** Server-verified Platinum (Pro + the local auto-apply engine). When the
    server response predates is_platinum, fall back to matching the tier/plan
    fields — still server data, still never client-set. */
export function serverPlatinum(): boolean {
  const entitlement = getCachedEntitlement();
  if (!entitlement?.active) return false;
  if (entitlement.isPlatinum != null) return entitlement.isPlatinum;
  return entitlement.tier === "platinum" || entitlement.plan === "platinum";
}

/** Server-verified auto-apply access: the ADD-ON purchased on any plan, or
    bundled with Platinum. This is the gate the AutoApplyCard uses — a free-
    or pro-tier user who pays the add-on gets the engine without Platinum. */
export function serverAutoApply(): boolean {
  if (serverPlatinum()) return true;
  return getCachedEntitlement()?.autoApply === true;
}

/** Fetches the signed-in user's entitlement from the server and makes it
    authoritative: when signed in, the server tier REPLACES the local one
    (a revoked user is downgraded, a granted user is upgraded). Returns null
    when not signed in (local tier stays untouched). */
export async function refreshEntitlement(): Promise<ServerEntitlement | null> {
  try {
    const client = await getSupabaseClient();
    const userId = getCloudState().user?.id;
    if (!client || !userId) { clearServerEntitlement(); return null; }
    if (cachedUserId !== userId) clearServerEntitlement();
    const { data, error } = await client.rpc("get_my_entitlement");
    if (getCloudState().user?.id !== userId) return null; // a late response must never populate another account's cache
    if (error) throw new Error(error.message);
    const row = (data ?? [])[0] as Record<string, unknown> | undefined;
    cached = row ? mapRow(row) : {
      tier: "free", plan: null, expiresAt: null, source: null,
      discountPct: 0, discountExpiresAt: null, active: false,
      isPlatinum: false, autoApply: false, issuedBy: null, updatedAt: null,
      paidTier: null, paidPlan: null, paidExpiresAt: null, paidSource: null,
      complimentary: false, complimentaryGrantId: null, complimentaryProduct: null,
      complimentarySource: null, complimentaryExpiresAt: null
    };
    /* the server is authoritative when signed in — mirror it locally so the
       offline experience matches, but never downgrade a team-seat pro */
    if (getTier() !== "pro" || !cached.active) setTier(cached.active ? "pro" : "free");
    cachedUserId = userId;
    notifyEntitlement();
    return cached;
  } catch {
    return null; /* offline / transient — keep the last known state */
  }
}

/** Redeems a single-use admin-issued grant code. Server-verified; only the
    server can mark a code used. On success the entitlement is refreshed. */
export async function redeemGrant(code: string): Promise<{ ok: boolean; error?: string; entitlement?: ServerEntitlement }> {
  const client = await getSupabaseClient();
  const userId = getCloudState().user?.id;
  if (!client || !userId) {
    return { ok: false, error: "Sign in to your cloud account first — codes are tied to your account." };
  }
  const normalized = code.trim().toUpperCase();
  const { data, error } = await client.rpc("redeem_grant", { p_code: normalized });
  if (getCloudState().user?.id !== userId) {
    return { ok: false, error: "Account changed during redemption. Sign back in to the original account to check its grant." };
  }
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    /* A checkout coupon and a grant code are the same shape (short uppercase
       string), so pasting a coupon into this box is the mistake to expect —
       and `redeem_grant` can only answer "unknown code", because coupons live
       in a different table (supabase/billing3.sql) and lexically look identical
       here. Ask the coupon validator — read-only, security definer, callable by
       any signed-in user — before telling someone their code doesn't exist. */
    if (msg.includes("invalid_code")) {
      const coupon = await validateCoupon(normalized).catch(() => null);
      if (coupon?.valid) {
        return {
          ok: false,
          error: `That's a checkout coupon (−${coupon.discountPct}% off with the Apply button in the Upgrade dialog), not a Pro code — redeem it at checkout.`
        };
      }
      if (coupon?.message) {
        const fm = coupon.message.endsWith(".") ? coupon.message : coupon.message + ".";
        return { ok: false, error: fm };
      }
    }
    const friendly = msg.includes("already_used") ? "That code was already used." : msg.includes("invalid_code") ? "That code doesn't exist — double-check it." : msg.includes("expired") ? "That code has expired." : error.message;
    return { ok: false, error: friendly };
  }
  cached = (data ?? [])[0] ? mapRow((data as Record<string, unknown>[])[0]) : null;
  cachedUserId = userId;
  if (cached?.active) setTier("pro");
  notifyEntitlement();
  return { ok: true, entitlement: cached ?? undefined };
}

/* ------------------------------------------------------------------ */
/* Admin actions (server enforces the is_admin gate)                    */
/* ------------------------------------------------------------------ */

async function adminRpc(name: string, params: Record<string, unknown>): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.rpc(name, params);
  if (error) throw new Error(error.message);
}

/** Grant/revoke Pro on a user — the admin dashboard's Grant Pro button (and
    the test path for trying the gating end-to-end). */
export async function adminSetEntitlement(
  userId: string, tier: Tier, plan: string | null, expiresAt: string | null, source = "admin"
): Promise<void> {
  await adminRpc("admin_set_entitlement", { p_user: userId, p_tier: tier, p_plan: plan, p_expires: expiresAt, p_source: source });
}

/** Issue (or clear) a discount on a user. */
export async function adminIssueDiscount(userId: string, pct: number, days = 90): Promise<void> {
  await adminRpc("admin_issue_discount", { p_user: userId, p_pct: Math.round(pct), p_days: Math.round(days) });
}

/** Grant/revoke the auto-apply ADD-ON on a user — independent of their tier
    (a free user can own the add-on; a Platinum user has it bundled anyway). */
export async function adminSetAddon(userId: string, addon: string, on: boolean): Promise<void> {
  await adminRpc("admin_set_addon", { p_user: userId, p_addon: addon, p_on: on });
}

/** Create a shareable single-use gift code; zero days means no access expiry.
    `discountPct` remains for the deployed RPC signature only—coupons own payment discounts. */
export async function adminCreateGrant(
  product: ComplimentaryProduct, days: number, discountPct = 0
): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_create_grant", {
    p_plan: product,
    p_days: Math.max(0, Math.round(days)),
    p_discount_pct: Math.round(discountPct)
  });
  if (error) throw new Error(error.message);
  return String(data ?? "");
}

/** Add complimentary access without mutating the user's paid entitlement. */
export async function adminGrantComplimentary(
  userId: string,
  product: ComplimentaryProduct,
  expiresAt: string | null,
  reason: string
): Promise<number> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_grant_complimentary", {
    p_user: userId,
    p_product: product,
    p_expires: expiresAt,
    p_reason: reason.trim()
  });
  if (error) throw new Error(error.message);
  return Number(data);
}

/** Revoke only a complimentary ledger row; paid access/payments are untouched. */
export async function adminRevokeComplimentary(grantId: number, reason = ""): Promise<void> {
  await adminRpc("admin_revoke_complimentary", {
    p_grant_id: grantId,
    p_reason: reason.trim() || null
  });
}

export async function adminListComplimentaryGrants(
  userId: string | null = null,
  activeOnly = true
): Promise<ComplimentaryGrantRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_list_complimentary_grants", {
    p_user: userId,
    p_active_only: activeOnly
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    grantId: Number(r.grant_id),
    userId: String(r.user_id ?? ""),
    email: String(r.email ?? ""),
    product: complimentaryProduct(r.product) ?? "monthly",
    source: complimentarySource(r.source) ?? "admin",
    startsAt: String(r.starts_at ?? ""),
    expiresAt: nullableString(r.expires_at),
    issuedBy: nullableString(r.issued_by),
    code: nullableString(r.code),
    reason: nullableString(r.reason),
    revokedAt: nullableString(r.revoked_at),
    revokedBy: nullableString(r.revoked_by),
    revokedReason: nullableString(r.revoked_reason),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
    active: r.active === true
  }));
}

export async function adminListEntitlements(): Promise<AdminEntitlementRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_list_entitlements");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => {
    const effective = mapRow(r);
    return {
      userId: String(r.user_id ?? ""),
      email: String(r.email ?? ""),
      ...effective
    };
  });
}

/** The format-key test mode — when the config flag is off, format keys are
    rejected entirely (they're forgeable; real Pro comes from the server). */
export function testLicensing(): boolean {
  return CONFIG.features.testLicensing;
}

/** Local tier source, for the Settings readout: server (verified), admin
    (all restrictions lifted), team seat, local/test key, or free. */
export function tierSource(): "server" | "admin" | "team" | "local" | "free" {
  if (adminUnlockedActive()) return "admin";
  if (serverPro()) return "server";
  if (getTier() === "pro") return storageGet<string>(STORAGE_KEYS.licenseKey, "") ? "local" : "team";
  return "free";
}
