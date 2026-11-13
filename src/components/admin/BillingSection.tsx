import { useState, useEffect } from "react";
import {
  adminGrantComplimentary, adminIssueDiscount, adminListComplimentaryGrants,
  adminRevokeComplimentary, COMPLIMENTARY_PRODUCTS,
  type AdminEntitlementRow, type ComplimentaryGrantRow, type ComplimentaryProduct
} from "../../services/entitlement";
import {
  REFUND_POLICY_DEFAULTS, adminCancelSubscription, adminCreateCoupon,
  adminRefundPayment,
  adminSimulatePurchase, fmtMinor, getRefundPolicy,
  revenueSummary, subscriptionSummary,
  type AdminPaymentRow, type AdminSubscriptionRow,
  type RefundPolicy
} from "../../services/billing";
import { useAllBillingData } from "../../hooks/useQueryHooks";
import { toast } from "../../toast";
import { cardCls, btnPrimary, btnGhost, btnDanger, btnOk, btnSm, Chip } from "../ui";
import { GrantCodeCard } from "./billing/GrantCodeCard";
import { RevenueSnapshotCard } from "./billing/RevenueSnapshotCard";

import { RefundPolicyCard } from "./billing/RefundPolicyCard";

export function BillingSection() {
  const { data: billingData, isLoading: loading, refetch: load } = useAllBillingData();
  const { entitlements: rows, payments, subscriptions: subs, audit, coupons } = billingData;
  const _revenue = revenueSummary(payments);
  const _subsSummary = subscriptionSummary(subs);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, "grant" | "discount" | undefined>>({});
  const [gifts, setGifts] = useState<ComplimentaryGrantRow[]>([]);
  /* coupon form */
  const [coCode, setCoCode] = useState("");
  const [coPct, setCoPct] = useState(20);
  const [coMax, setCoMax] = useState(0);
  const [coExp, setCoExp] = useState("");
  /* per-row complimentary form */
  const [gProduct, setGProduct] = useState<ComplimentaryProduct>("monthly");
  const [gExpiry, setGExpiry] = useState<"standard" | "lifetime" | "custom">("standard");
  const [gDays, setGDays] = useState(30);
  const [gReason, setGReason] = useState("");
  /* per-row discount form */
  const [dPct, setDPct] = useState(30);
  const [dDays, setDDays] = useState(90);
  const [policyDraft, setPolicyDraft] = useState<RefundPolicy>({ ...REFUND_POLICY_DEFAULTS });
  const [_presetsText, setPresetsText] = useState((REFUND_POLICY_DEFAULTS.reason_presets ?? []).join(", "));

  useEffect(() => {
    void getRefundPolicy().then(p => { setPolicyDraft(p); setPresetsText((p.reason_presets ?? []).join(", ")); }).catch(() => {});
  }, []);

  const loadGifts = () => {
    void adminListComplimentaryGrants(null, true).then(setGifts).catch(() => setGifts([]));
  };
  useEffect(loadGifts, []);

  const reload = () => { load(); loadGifts(); };

  /* cancel-with-reason — row being cancelled + its reason input */
  const [cancelTarget, setCancelTarget] = useState<AdminSubscriptionRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundTarget, setRefundTarget] = useState<AdminPaymentRow | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundOverride, setRefundOverride] = useState(false);
  /* refund policy editor + enforcement preview */
  /* legal policy template editor (Terms / Privacy / Refunds / Shipping) */

  const createCoupon = async () => {
    if (!coCode.trim() || coPct < 1) { toast("Code and a 1–100% discount are required"); return; }
    setBusy(true);
    try {
      const code = await adminCreateCoupon(coCode, coPct, coMax, coExp ? new Date(coExp + "T23:59:59").toISOString() : undefined);
      toast(`🎟️ Coupon ${code} created — users can apply it at checkout`);
      setCoCode(""); setCoExp("");
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Create failed")); }
    finally { setBusy(false); }
  };

  const selectGrantProduct = (product: ComplimentaryProduct) => {
    const selected = COMPLIMENTARY_PRODUCTS.find(item => item.id === product)!;
    setGProduct(product);
    setGExpiry(selected.defaultDays > 0 ? "standard" : "lifetime");
    if (selected.defaultDays > 0) setGDays(selected.defaultDays);
  };

  const grant = async (u: AdminEntitlementRow) => {
    const reason = gReason.trim();
    if (!reason) { toast("A reason is required for the complimentary audit trail"); return; }
    const selected = COMPLIMENTARY_PRODUCTS.find(item => item.id === gProduct)!;
    const days = gExpiry === "custom" ? gDays : gExpiry === "standard" ? selected.defaultDays : 0;
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
    setBusy(true);
    try {
      await adminGrantComplimentary(u.userId, gProduct, expiresAt, reason);
      toast(`🎁 Granted complimentary ${selected.label} to ${u.email || u.userId.slice(0, 8)}`);
      setGReason("");
      setOpen(o => ({ ...o, [u.userId]: undefined }));
      reload();
    } catch (e) { toast("✗ " + ((e as Error).message || "Grant failed")); }
    finally { setBusy(false); }
  };

  const revokeGift = async (gift: ComplimentaryGrantRow) => {
    setBusy(true);
    try {
      await adminRevokeComplimentary(gift.grantId, "Revoked from Admin Billing");
      toast(`⛔ Revoked complimentary ${gift.product} from ${gift.email || gift.userId.slice(0, 8)} — paid access is unchanged`);
      reload();
    } catch (e) { toast("✗ " + ((e as Error).message || "Revoke failed")); }
    finally { setBusy(false); }
  };

  const simulate = async (u: AdminEntitlementRow) => {
    const paidPlan = gProduct === "auto_apply" ? "auto_apply" : gProduct;
    setBusy(true);
    try {
      const ext = await adminSimulatePurchase(u.userId, paidPlan);
      toast(`🪙 Simulated ${paidPlan} purchase for ${u.email || u.userId.slice(0, 8)} (${ext}) — same grant path as a real webhook`);
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Simulate failed")); }
    finally { setBusy(false); }
  };

  const cancelSub = async (s: AdminSubscriptionRow) => {
    setBusy(true);
    try {
      const r = await adminCancelSubscription(s.providerSubscriptionId, s.userId, cancelReason);
      toast(`🔁 Cancelled ${s.plan} subscription for ${s.email || s.userId.slice(0, 8)} — access stays until ${r.currentPeriodEnd ? new Date(r.currentPeriodEnd).toLocaleDateString() : "period end"}`);
      setCancelTarget(null); setCancelReason("");
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Cancel failed")); }
    finally { setBusy(false); }
  };

  /* refund policy preview — mirrors the server's check (server stays authoritative) */
  const policyDecision = (p: AdminPaymentRow) => {
    const graceDays = policyDraft.grace_days ?? REFUND_POLICY_DEFAULTS.grace_days ?? 7;
    const max = policyDraft.max_refunds_per_user ?? REFUND_POLICY_DEFAULTS.max_refunds_per_user ?? 3;
    const refundCount = payments.filter(x => x.userId === p.userId && x.status === "refunded").length;
    const ageDays = Math.max(0, (Date.now() - new Date(p.createdAt).getTime()) / 86_400_000);
    const withinGrace = ageDays <= graceDays;
    return { withinGrace, refundCount, max, graceDays, blocked: max > 0 && refundCount >= max && !withinGrace && !refundOverride };
  };

  const refund = async (p: AdminPaymentRow) => {
    setBusy(true);
    try {
      const amt = parseFloat(refundAmount);
      const amountMinor = Number.isFinite(amt) && amt > 0 ? Math.round(amt * 100) : undefined;
      const r = await adminRefundPayment(p.providerPaymentId, refundReason, amountMinor);
      toast(`💸 Refunded ${fmtMinor(r.amountMinor ?? p.amountMinor, p.currency)} ${p.plan} for ${p.email || p.userId.slice(0, 8)} — ${r.note}${r.emailSent ? " 📧 user notified" : ""}`);
      setRefundTarget(null); setRefundReason(""); setRefundOverride(false);
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Refund failed")); }
    finally { setBusy(false); }
  };

  const discount = async (u: AdminEntitlementRow) => {
    setBusy(true);
    try {
      await adminIssueDiscount(u.userId, dPct, dDays);
      toast(dPct > 0 ? `🏷️ Issued −${dPct}% for ${dDays}d to ${u.email || u.userId.slice(0, 8)}` : "Discount cleared");
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Discount failed")); }
    finally { setBusy(false); }
  };

  const planLabel = (product: string | null) => COMPLIMENTARY_PRODUCTS.find(x => x.id === product)?.label ?? product ?? "—";

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">💰 Billing — paid + complimentary access</h2>
        <p className="mt-1 text-[12.5px] text-mut">
          Paid entitlements stay in their original ledger. Complimentary and Gift access is layered separately, so revoking a gift never removes a purchase.
          Use gift codes for one-time sharing; coupons below remain checkout discounts.
        </p>
      </div>

      <GrantCodeCard busy={busy} setBusy={setBusy} />

      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">🎁 Active Complimentary & Gift access ({gifts.length})</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Revoke removes only this ledger row. Paid entitlements and payment history are never changed.</p>
        </div>
        <div className="space-y-1.5 p-5">
          {gifts.length === 0 && <p className="text-[12.5px] text-mut">No active complimentary access.</p>}
          {gifts.map(gift => (
            <div key={gift.grantId} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
              <span className="font-bold">{gift.email || `${gift.userId.slice(0, 8)}…`}</span>
              <Chip tone="lvl">{gift.source === "gift_code" ? "Gift" : "Complimentary"}</Chip>
              <Chip>{planLabel(gift.product)}</Chip>
              <span className="text-fnt">{gift.expiresAt ? `until ${new Date(gift.expiresAt).toLocaleDateString()}` : "no expiry"}</span>
              {gift.code && <span className="font-mono text-[11px] text-fnt">{gift.code}</span>}
              {gift.reason && <span className="min-w-[120px] flex-1 truncate text-[11px] text-fnt" title={gift.reason}>{gift.reason}</span>}
              <button className={btnDanger + btnSm} disabled={busy} onClick={() => void revokeGift(gift)}>Revoke gift</button>
            </div>
          ))}
        </div>
      </div>

      <RevenueSnapshotCard payments={payments} />
      <div className={`${cardCls} p-5`}>
        <h3 className="text-[14.5px] font-extrabold">🎟️ Coupon codes</h3>
        <p className="mb-3 text-[12px] text-mut">Reusable discount codes users apply at checkout (LAUNCH20…). Usage is consumed only when a payment confirms — an abandoned checkout doesn't burn a use.</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={coCode}
            onChange={e => setCoCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH20"
            className="inp w-36 font-mono uppercase"
          />
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            −%
            <input type="number" min={1} max={100} value={coPct} onChange={e => setCoPct(Math.max(1, Math.min(100, Number(e.target.value) || 20)))} className="inp w-20 py-1.5 text-center" />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            max uses (0 = ∞)
            <input type="number" min={0} value={coMax} onChange={e => setCoMax(Math.max(0, Number(e.target.value) || 0))} className="inp w-20 py-1.5 text-center" />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            expires
            <input type="date" value={coExp} onChange={e => setCoExp(e.target.value)} className="inp py-1.5" />
          </label>
          <button className={btnPrimary + btnSm} disabled={busy || !coCode.trim() || coPct < 1} onClick={() => void createCoupon()}>Create</button>
        </div>
        {coupons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {coupons.map(c => (
              <div key={c.code} className="flex items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-3 py-1.5 text-[12px]">
                <span className="font-mono font-extrabold">{c.code}</span>
                <Chip tone="lvl">−{c.discountPct}%</Chip>
                <Chip tone={c.maxUses > 0 && c.usedCount >= c.maxUses ? "bad" : "default"}>{c.usedCount}/{c.maxUses || "∞"}</Chip>
                {c.expiresAt && <Chip tone={new Date(c.expiresAt) < new Date() ? "bad" : "default"}>until {new Date(c.expiresAt).toLocaleDateString()}</Chip>}
                <button
                  className={btnGhost + btnSm}
                  title="Copy code"
                  onClick={() => { navigator.clipboard?.writeText(c.code).then(() => toast(`📋 ${c.code} copied`), () => {}); }}
                >
                  📋
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* per-user grants + discounts */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">👥 Entitlements ({rows.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line/10 bg-wht/[.04] text-[11px] uppercase tracking-wider text-mut">
                <th className="px-4 py-2.5 font-bold">User</th>
                <th className="px-3 py-2.5 font-bold">Tier</th>
                <th className="px-3 py-2.5 font-bold">Plan</th>
                <th className="px-3 py-2.5 font-bold">Expires</th>
                <th className="px-3 py-2.5 font-bold">Discount</th>
                <th className="px-3 py-2.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-mut">No users yet — they appear after the first sign-up.</td></tr>
              )}
              {rows.map(u => (
                <tr key={u.userId} className="border-b border-line/5 align-top last:border-0 hover:bg-wht/5">
                  <td className="px-4 py-3">
                    <div className="font-bold">{u.email || "—"}</div>
                    <div className="flex flex-wrap gap-1 text-[11px] text-fnt">
                      <span>{u.userId.slice(0, 8)}…</span>
                      {u.complimentary && <Chip tone="lvl">{u.complimentarySource === "gift_code" ? "Gift" : "Complimentary"}</Chip>}
                      {u.paidSource && <span>paid via {u.paidSource}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {u.isPlatinum || u.tier === "platinum" ? <Chip tone="lvl">💎 PLATINUM</Chip> : u.active ? <Chip tone="ok">PRO</Chip> : u.autoApply ? <Chip tone="ok">AUTO-APPLY</Chip> : <Chip>free</Chip>}
                  </td>
                  <td className="px-3 py-3">
                    {u.active ? planLabel(u.plan) : u.autoApply ? "Auto-apply add-on" : "—"}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-fnt">
                    {u.active ? (u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : "never") : u.complimentaryProduct === "auto_apply" ? (u.complimentaryExpiresAt ? new Date(u.complimentaryExpiresAt).toLocaleDateString() : "never") : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {u.discountPct > 0 ? (
                      <Chip tone="lvl">−{u.discountPct}%{u.discountExpiresAt ? ` · ${new Date(u.discountExpiresAt).toLocaleDateString()}` : ""}</Chip>
                    ) : <span className="text-[12px] text-fnt">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button className={btnOk + btnSm} disabled={busy} onClick={() => setOpen(o => ({ ...o, [u.userId]: o[u.userId] === "grant" ? undefined : "grant" }))}>
                        🎁 Complimentary
                      </button>
                      <button className={btnGhost + btnSm} disabled={busy} onClick={() => setOpen(o => ({ ...o, [u.userId]: o[u.userId] === "discount" ? undefined : "discount" }))}>
                        🏷️ Discount
                      </button>
                      <button className={btnGhost + btnSm} disabled={busy} onClick={() => simulate(u)} title="Simulate a confirmed purchase — same paid apply_purchase path as the real webhook">
                        🪙 Sim purchase
                      </button>
                    </div>
                    {open[u.userId] === "grant" && (
                      <div className="mt-2 grid max-w-[520px] grid-cols-1 gap-1.5 sm:grid-cols-[1fr_1fr_auto]">
                        <select value={gProduct} onChange={e => selectGrantProduct(e.target.value as ComplimentaryProduct)} className="inp py-1 text-[12px]">
                          {COMPLIMENTARY_PRODUCTS.map(product => <option key={product.id} value={product.id}>{product.label}</option>)}
                        </select>
                        <select value={gExpiry} onChange={e => setGExpiry(e.target.value as typeof gExpiry)} className="inp py-1 text-[12px]" aria-label="Complimentary expiry">
                          {(COMPLIMENTARY_PRODUCTS.find(product => product.id === gProduct)?.defaultDays ?? 0) > 0 && (
                            <option value="standard">Standard ({COMPLIMENTARY_PRODUCTS.find(product => product.id === gProduct)?.defaultDays} days)</option>
                          )}
                          <option value="lifetime">No expiry</option>
                          <option value="custom">Custom days</option>
                        </select>
                        {gExpiry === "custom" && <input type="number" min={1} value={gDays} onChange={e => setGDays(Math.max(1, Number(e.target.value) || 1))} className="inp w-24 py-1 text-center text-[12px]" aria-label="Custom days" />}
                        <input value={gReason} onChange={e => setGReason(e.target.value)} maxLength={500} placeholder="Reason (required; audited)" className="inp py-1 text-[12px] sm:col-span-2" />
                        <button className={btnOk + btnSm} disabled={busy || !gReason.trim()} onClick={() => grant(u)}>Grant</button>
                      </div>
                    )}
                    {open[u.userId] === "discount" && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <input type="number" min={0} max={100} value={dPct} onChange={e => setDPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="inp w-16 py-1 text-center text-[12px]" title="percent off" />
                        <input type="number" min={1} value={dDays} onChange={e => setDDays(Math.max(1, Number(e.target.value) || 90))} className="inp w-16 py-1 text-center text-[12px]" title="days the discount is valid" />
                        <button className={btnGhost + btnSm} disabled={busy} onClick={() => discount(u)}>Apply</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* subscriptions — every provider subscription across users */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">🔁 Subscriptions ({subs.length})</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Active and cancelled provider subscriptions. Cancelling stops future billing at the period end — the user keeps Pro until then (verified server-side; the provider API is called only when the provider keys are configured).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line/10 bg-wht/[.04] text-[11px] uppercase tracking-wider text-mut">
                <th className="px-4 py-2.5 font-bold">User</th>
                <th className="px-3 py-2.5 font-bold">Plan</th>
                <th className="px-3 py-2.5 font-bold">Provider</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Next billing date</th>
                <th className="px-3 py-2.5 font-bold">Created</th>
                <th className="px-4 py-2.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-mut">No subscriptions yet — they appear after the first recurring checkout (or a 🔁 sub simulate) completes.</td></tr>
              )}
              {subs.map((s, i) => (
                <tr key={i} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                  <td className="px-4 py-3">
                    <div className="font-bold">{s.email || "—"}</div>
                    <div className="text-[11px] text-fnt">{s.userId.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-3 font-bold capitalize">{s.plan}</td>
                  <td className="px-3 py-3"><Chip>{s.provider}</Chip></td>
                  <td className="px-3 py-3">
                    <Chip tone={s.status === "active" ? "ok" : s.status === "cancelled" ? "warn" : "bad"}>{s.status}</Chip>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-fnt">
                    {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-fnt">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {s.status === "active" && cancelTarget?.providerSubscriptionId === s.providerSubscriptionId ? (
                      <div className="flex flex-col gap-1.5">
                        <input
                          value={cancelReason}
                          onChange={e => setCancelReason(e.target.value)}
                          placeholder="Reason (recorded in the audit trail)"
                          className="inp py-1 text-[12px]"
                          autoFocus
                        />
                        <div className="flex gap-1.5">
                          <button className={btnDanger + btnSm} disabled={busy} onClick={() => cancelSub(s)}>Confirm cancel</button>
                          <button className={btnGhost + btnSm} disabled={busy} onClick={() => { setCancelTarget(null); setCancelReason(""); }}>Back</button>
                        </div>
                      </div>
                    ) : s.status === "active" ? (
                      <button
                        className={btnDanger + btnSm}
                        disabled={busy}
                        onClick={() => { setCancelTarget(s); setCancelReason(""); }}
                        title="Cancel at period end — the user keeps Pro until the next billing date"
                      >
                        🔁 Cancel
                      </button>
                    ) : <span className="text-[12px] text-fnt">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RefundPolicyCard busy={busy} />
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">🧾 Payments ({payments.length})</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Confirmed purchases recorded by the pay-webhook function after signature verification.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line/10 bg-wht/[.04] text-[11px] uppercase tracking-wider text-mut">
                <th className="px-4 py-2.5 font-bold">User</th>
                <th className="px-3 py-2.5 font-bold">Provider</th>
                <th className="px-3 py-2.5 font-bold">Plan</th>
                <th className="px-3 py-2.5 font-bold">Amount</th>
                <th className="px-3 py-2.5 font-bold">Discount</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Date</th>
                <th className="px-4 py-2.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-mut">No confirmed payments yet — they appear after the first real purchase (or a 🪙 Sim purchase) completes.</td></tr>
              )}
              {payments.map((p, i) => (
                <tr key={i} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                  <td className="px-4 py-3">
                    <div className="font-bold">{p.email || "—"}</div>
                    <div className="text-[11px] text-fnt">{p.userId.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-3"><Chip>{p.provider}</Chip></td>
                  <td className="px-3 py-3 font-bold capitalize">{p.plan}</td>
                  <td className="px-3 py-3 font-bold tabular-nums">{fmtMinor(p.amountMinor, p.currency)}</td>
                  <td className="px-3 py-3">{p.discountPct > 0 ? <Chip tone="lvl">−{p.discountPct}%</Chip> : "—"}</td>
                  <td className="px-3 py-3">
                    <Chip tone={p.status === "paid" ? "ok" : "warn"}>{p.status}</Chip>
                    {p.kind === "subscription" && <Chip tone="lvl">🔁 sub</Chip>}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-fnt">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {p.status === "paid" && refundTarget?.providerPaymentId === p.providerPaymentId ? (
                      <div className="flex w-[220px] flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" min={0.01} max={(p.amountMinor / 100).toFixed(2)} step={0.01}
                            value={refundAmount}
                            onChange={e => setRefundAmount(e.target.value)}
                            placeholder={(p.amountMinor / 100).toFixed(2)}
                            className="inp py-1 text-[12px]"
                          />
                          <span className="whitespace-nowrap text-[10.5px] text-fnt">of {fmtMinor(p.amountMinor, p.currency)}</span>
                        </div>
                        <input
                          value={refundReason}
                          list="refund-reasons"
                          onChange={e => setRefundReason(e.target.value)}
                          placeholder="Reason (audit trail)"
                          className="inp py-1 text-[12px]"
                          autoFocus
                        />
                        <datalist id="refund-reasons">
                          {(policyDraft.reason_presets ?? []).map(r => <option key={r} value={r} />)}
                        </datalist>
                        {(() => { const d = policyDecision(p); return d.blocked ? (
                          <label className="flex cursor-pointer items-start gap-1.5 text-[11px] leading-snug text-mut">
                            <input type="checkbox" className="mt-0.5" checked={refundOverride} onChange={e => setRefundOverride(e.target.checked)} />
                            Override policy cap — already {d.refundCount} refund{d.refundCount === 1 ? "" : "s"}, outside the {d.graceDays}-day grace window
                          </label>
                        ) : null; })()}
                        <div className="flex gap-1.5">
                          <button className={btnDanger + btnSm} disabled={busy} onClick={() => refund(p)}>Confirm refund</button>
                          <button className={btnGhost + btnSm} disabled={busy} onClick={() => { setRefundTarget(null); setRefundReason(""); setRefundOverride(false); }}>Back</button>
                        </div>
                      </div>
                    ) : p.status === "paid" ? (
                      <button
                        className={btnDanger + btnSm}
                        disabled={busy}
                        onClick={() => { setRefundTarget(p); setRefundReason(""); setRefundAmount(""); setRefundOverride(false); }}
                        title="Refund — full or partial; calls the provider when its keys are configured, then marks it refunded and subtracts the plan's days"
                      >
                        💸 Refund
                      </button>
                    ) : <span className="text-[12px] text-fnt">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* audit trail — who did what, when */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">📜 Billing audit trail</h3>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {audit.length === 0 && (
            <p className="px-5 py-8 text-center text-mut">No billing actions yet — grants, revokes, discounts, codes, redeems and purchases all land here.</p>
          )}
          {audit.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 border-b border-line/5 px-5 py-2.5 text-[12.5px] last:border-0">
              <Chip tone={a.action === "purchase" ? "ok" : a.action === "revoke" ? "bad" : a.action === "discount" ? "lvl" : "default"}>{a.action}</Chip>
              <span className="min-w-[140px] flex-1 font-bold">{a.email || a.userId?.slice(0, 8) || "system"}</span>
              {a.detail && <span className="font-mono text-[11px] text-fnt">{JSON.stringify(a.detail).slice(0, 120)}</span>}
              <span className="text-[11px] text-fnt">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
