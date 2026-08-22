/* Coupon code validation, admin CRUD */

import { getSupabaseClient } from "../cloud";

/* Coupon codes                                                        */
/* ------------------------------------------------------------------ */

export interface CouponCheck {
  valid: boolean;
  discountPct: number;
  message: string;
}

/** Read-only storefront check — shows the discount before checkout. Usage
    is consumed server-side only when the payment actually confirms. */
export async function validateCoupon(code: string): Promise<CouponCheck> {
  const client = await getSupabaseClient();
  if (!client) return { valid: false, discountPct: 0, message: "Cloud not configured" };
  const { data, error } = await client.rpc("validate_coupon", { p_code: code });
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (error || !row) return { valid: false, discountPct: 0, message: error?.message ?? "Couldn't check that code" };
  return { valid: Boolean(row.valid), discountPct: Number(row.discount_pct ?? 0), message: String(row.message ?? "") };
}

export interface AdminCoupon {
  code: string;
  discountPct: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export async function adminListCoupons(): Promise<AdminCoupon[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_list_coupons");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    code: String(r.code ?? ""),
    discountPct: Number(r.discount_pct ?? 0),
    maxUses: Number(r.max_uses ?? 0),
    usedCount: Number(r.used_count ?? 0),
    expiresAt: (r.expires_at as string | null) ?? null,
    createdAt: r.created_at as string
  }));
}

/** Admin: create a reusable coupon code (upper-cased, audit-logged). */
export async function adminCreateCoupon(code: string, discountPct: number, maxUses = 0, expiresAt?: string): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_create_coupon", {
    p_code: code, p_discount_pct: discountPct, p_max_uses: maxUses, p_expires_at: expiresAt ?? null
  });
  if (error) throw new Error(error.message);
  return String(data ?? "");
}

