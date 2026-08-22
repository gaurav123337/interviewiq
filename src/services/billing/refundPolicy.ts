import { getSupabaseClient } from "../cloud";

export interface RefundPolicy {
  grace_days?: number;
  max_refunds_per_user?: number;
  reason_presets?: string[];
}

export const REFUND_POLICY_DEFAULTS: RefundPolicy = {
  grace_days: 7,
  max_refunds_per_user: 3,
  reason_presets: ["Duplicate purchase", "Requested by user", "Billing error", "User cancelled"]
};

/** Admin-published refund policy (public-read so the admin form can render
    the reason presets). Falls back to the defaults when unpublished. */
export async function getRefundPolicy(): Promise<RefundPolicy> {
  const client = await getSupabaseClient();
  if (!client) return { ...REFUND_POLICY_DEFAULTS };
  const { data, error } = await client.from("app_config").select("value").eq("key", "refund_policy").maybeSingle();
  if (error || !data) return { ...REFUND_POLICY_DEFAULTS };
  return { ...REFUND_POLICY_DEFAULTS, ...(data.value as RefundPolicy) };
}

/** Publish the refund policy (RLS enforces is_admin server-side). */
export async function publishRefundPolicy(policy: RefundPolicy): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("app_config").upsert(
    { key: "refund_policy", value: policy, updated_at: Date.now() },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

/** Admin: simulate a confirmed purchase — funnels through the exact same
    apply_purchase grant as a real webhook, so it's the full test path
    (grant + payment row + audit entry). Returns the synthetic payment id. */
export async function adminSimulatePurchase(userId: string, plan: string, kind = "one_time"): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_simulate_purchase", { p_user: userId, p_plan: plan, p_kind: kind });
  if (error) throw new Error(error.message);
  return String(data ?? "");
}

export interface BillingActionRow {
  action: string;
  adminId: string | null;
  userId: string | null;
  email: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

/** The billing audit trail — grants, revokes, discounts, codes, redeems, purchases. */
export async function adminBillingActions(limit = 50): Promise<BillingActionRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client.rpc("admin_billing_actions", { max_rows: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    action: String(r.action ?? ""),
    adminId: (r.admin_id as string | null) ?? null,
    userId: (r.user_id as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    detail: (r.detail as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at as string
  }));
}

export function fmtMinor(amountMinor: number, currency: string): string {
  const sym = currency === "INR" ? "₹" : "$";
  return sym + (amountMinor / 100).toFixed(2);
}

/* ------------------------------------------------------------------ */
