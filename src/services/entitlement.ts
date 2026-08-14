/* Server-verified entitlements — Pro is an ACCOUNT property now.
   The entitlements table (supabase/billing.sql) is the single source of
   truth; the client reads its own row via get_my_entitlement() and can
   never self-grant. The old local checksum keys remain only as a
   test-mode fallback (see CONFIG.features.testLicensing). */

import { getCloudState, getSupabaseClient } from "./cloud";
import { adminUnlockedActive, getTier, setTier, type Tier } from "./entitlements";
import { STORAGE_KEYS, storageGet } from "./storage";
import { CONFIG } from "../config";

export interface ServerEntitlement {
  tier: Tier;
  plan: string | null;
  expiresAt: string | null;
  source: string | null;
  discountPct: number;
  discountExpiresAt: string | null;
  /** Server-computed: pro and not expired. */
  active: boolean;
  issuedBy: string | null;
  updatedAt: string | null;
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
  updatedAt: string | null;
}

/* Pricing shown in the Upgrade modal — discounts apply on top. */
export const PLANS = [
  { id: "monthly", label: "Monthly", price: 9, per: "/mo" },
  { id: "yearly", label: "Yearly", price: 79, per: "/yr" },
  { id: "lifetime", label: "Lifetime", price: 199, per: " once" }
] as const;

let cached: ServerEntitlement | null = null;

export function getCachedEntitlement(): ServerEntitlement | null {
  return cached;
}

/** Drops the cached server entitlement (e.g. on sign-out) so a revoked user
    isn't pro on the next boot. The local tier is left untouched. */
export function clearServerEntitlement(): void {
  cached = null;
}

function mapRow(r: Record<string, unknown>): ServerEntitlement {
  return {
    tier: (r.tier as Tier) ?? "free",
    plan: (r.plan as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
    source: (r.source as string | null) ?? null,
    discountPct: Number(r.discount_pct ?? 0),
    discountExpiresAt: (r.discount_expires_at as string | null) ?? null,
    active: Boolean(r.active),
    issuedBy: (r.issued_by as string | null) ?? null,
    updatedAt: (r.updated_at as string | null) ?? null
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
  return cached?.active === true;
}

/** Fetches the signed-in user's entitlement from the server and makes it
    authoritative: when signed in, the server tier REPLACES the local one
    (a revoked user is downgraded, a granted user is upgraded). Returns null
    when not signed in (local tier stays untouched). */
export async function refreshEntitlement(): Promise<ServerEntitlement | null> {
  try {
    const client = await getSupabaseClient();
    if (!client || !getCloudState().user) return null;
    const { data, error } = await client.rpc("get_my_entitlement");
    if (error) throw new Error(error.message);
    const row = (data ?? [])[0] as Record<string, unknown> | undefined;
    cached = row ? mapRow(row) : { tier: "free", plan: null, expiresAt: null, source: null, discountPct: 0, discountExpiresAt: null, active: false, issuedBy: null, updatedAt: null };
    /* the server is authoritative when signed in — mirror it locally so the
       offline experience matches, but never downgrade a team-seat pro */
    if (getTier() !== "pro" || !cached.active) setTier(cached.active ? "pro" : "free");
    return cached;
  } catch {
    return null; /* offline / transient — keep the last known state */
  }
}

/** Redeems a single-use admin-issued grant code. Server-verified; only the
    server can mark a code used. On success the entitlement is refreshed. */
export async function redeemGrant(code: string): Promise<{ ok: boolean; error?: string; entitlement?: ServerEntitlement }> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) {
    return { ok: false, error: "Sign in to your cloud account first — codes are tied to your account." };
  }
  const { data, error } = await client.rpc("redeem_grant", { p_code: code.trim().toUpperCase() });
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    const friendly = msg.includes("already_used") ? "That code was already used." : msg.includes("invalid_code") ? "That code doesn't exist — double-check it." : msg.includes("expired") ? "That code has expired." : error.message;
    return { ok: false, error: friendly };
  }
  cached = (data ?? [])[0] ? mapRow((data as Record<string, unknown>[])[0]) : null;
  if (cached?.active) setTier("pro");
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

/** Create a shareable single-use grant code; returns the code to copy. */
export async function adminCreateGrant(plan: string, days: number, discountPct: number): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_create_grant", { p_plan: plan, p_days: Math.round(days), p_discount_pct: Math.round(discountPct) });
  if (error) throw new Error(error.message);
  return String(data ?? "");
}

export async function adminListEntitlements(): Promise<AdminEntitlementRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_list_entitlements");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    userId: String(r.user_id ?? ""),
    email: String(r.email ?? ""),
    tier: String(r.tier ?? "free"),
    plan: (r.plan as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
    source: (r.source as string | null) ?? null,
    discountPct: Number(r.discount_pct ?? 0),
    discountExpiresAt: (r.discount_expires_at as string | null) ?? null,
    active: Boolean(r.active),
    updatedAt: (r.updated_at as string | null) ?? null
  }));
}

/** The format-key test mode — when the config flag is off, format keys are
    rejected entirely (they're forgeable; real Pro comes from the server). */
export function testLicensing(): boolean {
  return CONFIG.features.testLicensing === true;
}

/** Local tier source, for the Settings readout: server (verified), admin
    (all restrictions lifted), team seat, local/test key, or free. */
export function tierSource(): "server" | "admin" | "team" | "local" | "free" {
  if (adminUnlockedActive()) return "admin";
  if (serverPro()) return "server";
  if (getTier() === "pro") return storageGet<string>(STORAGE_KEYS.licenseKey, "") ? "local" : "team";
  return "free";
}
