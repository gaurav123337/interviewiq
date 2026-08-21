import { useState, useEffect } from "react";
import {
  adminCreateGrant, adminIssueDiscount, adminSetEntitlement, PLANS,
  type AdminEntitlementRow
} from "../../services/entitlement";
import {
  REFUND_POLICY_DEFAULTS, adminCancelSubscription, adminCreateCoupon,
  adminRefundPayment,
  adminSimulatePurchase, fmtMinor, getRefundPolicy, publishRefundPolicy,
  revenueSummary, subscriptionSummary,
  type AdminPaymentRow, type AdminSubscriptionRow,
  type RefundPolicy
} from "../../services/billing";
import { getPublishedPolicies, publishPolicies } from "../../services/policies";
import { POLICY_DEFAULTS, POLICY_META, type PolicyId } from "../../data/policies";
import { useAllBillingData } from "../../hooks/useQueryHooks";
import { toast } from "../../toast";
import { cardCls, btnPrimary, btnGhost, btnDanger, btnOk, btnSm, Chip } from "../ui";

export function BillingSection() {
  const { data: billingData, isLoading: loading, refetch: load } = useAllBillingData();
  const { entitlements: rows, payments, subscriptions: subs, audit, coupons } = billingData;
  const revenue = revenueSummary(payments);
  const subsSummary = subscriptionSummary(subs);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, "grant" | "discount" | undefined>>({});
  /* create-grant form */
  const [cPlan, setCPlan] = useState<string>("monthly");
  const [cDays, setCDays] = useState(30);
  const [cPct, setCPct] = useState(0);
  const [code, setCode] = useState<string>("");
  /* coupon form */
  const [coCode, setCoCode] = useState("");
  const [coPct, setCoPct] = useState(20);
  const [coMax, setCoMax] = useState(0);
  const [coExp, setCoExp] = useState("");
  /* per-row grant form */
  const [gPlan, setGPlan] = useState<string>("monthly");
  const [gDays, setGDays] = useState(30);
  /* per-row discount form */
  const [dPct, setDPct] = useState(30);
  const [dDays, setDDays] = useState(90);

  useEffect(() => {
    void getRefundPolicy().then(p => { setPolicyDraft(p); setPresetsText((p.reason_presets ?? []).join(", ")); }).catch(() => {});
    void getPublishedPolicies().then(p => { if (Object.keys(p).length) setPolicyDocs({ ...POLICY_DEFAULTS, ...p }); }).catch(() => {});
  }, []);
  /* cancel-with-reason — row being cancelled + its reason input */
  const [cancelTarget, setCancelTarget] = useState<AdminSubscriptionRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundTarget, setRefundTarget] = useState<AdminPaymentRow | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundOverride, setRefundOverride] = useState(false);
  /* refund policy editor + enforcement preview */
  const [policyDraft, setPolicyDraft] = useState<RefundPolicy>({ ...REFUND_POLICY_DEFAULTS });
  const [presetsText, setPresetsText] = useState((REFUND_POLICY_DEFAULTS.reason_presets ?? []).join(", "));
  /* legal policy template editor (Terms / Privacy / Refunds / Shipping) */
  const [policyDocs, setPolicyDocs] = useState<Record<PolicyId, string>>({ ...POLICY_DEFAULTS });

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

  const grant = async (u: AdminEntitlementRow) => {
    setBusy(true);
    try {
      await adminSetEntitlement(u.userId, "pro", gPlan, gPlan === "lifetime" ? null : new Date(Date.now() + gDays * 86400000).toISOString());
      toast(`💎 Granted Pro (${gPlan}) to ${u.email || u.userId.slice(0, 8)}`);
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Grant failed")); }
    finally { setBusy(false); }
  };

  const revoke = async (u: AdminEntitlementRow) => {
    setBusy(true);
    try {
      await adminSetEntitlement(u.userId, "free", null, null);
      toast(`⛔ Revoked Pro from ${u.email || u.userId.slice(0, 8)}`);
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Revoke failed")); }
    finally { setBusy(false); }
  };

  const simulate = async (u: AdminEntitlementRow) => {
    setBusy(true);
    try {
      const ext = await adminSimulatePurchase(u.userId, gPlan);
      toast(`🪙 Simulated ${gPlan} purchase for ${u.email || u.userId.slice(0, 8)} (${ext}) — same grant path as a real webhook`);
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

  const savePolicy = async () => {
    setBusy(true);
    try {
      const next: RefundPolicy = {
        grace_days: Math.max(0, Number(policyDraft.grace_days) || 0),
        max_refunds_per_user: Math.max(0, Number(policyDraft.max_refunds_per_user) || 0),
        reason_presets: presetsText.split(",").map(s => s.trim()).filter(Boolean)
      };
      await publishRefundPolicy(next);
      setPolicyDraft(next);
      toast("📋 Refund policy published — pay-refund enforces it on the next refund");
    } catch (e) { toast("✗ " + ((e as Error).message || "Publish failed")); }
    finally { setBusy(false); }
  };

  const savePolicies = async () => {
    setBusy(true);
    try {
      await publishPolicies(policyDocs);
      toast("⚖️ Legal pages published — public site now shows the edited templates");
    } catch (e) { toast("✗ " + ((e as Error).message || "Publish failed")); }
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

  const createCode = async () => {
    setBusy(true);
    try {
      const c = await adminCreateGrant(cPlan, cDays, cPct);
      setCode(c);
      toast("🎟️ Grant code created — copy it to your user");
    } catch (e) { toast("✗ " + ((e as Error).message || "Create failed")); }
    finally { setBusy(false); }
  };

  const planLabel = (p: string | null) => (PLANS as readonly { id: string; label: string }[]).find(x => x.id === p)?.label ?? p ?? "—";

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">💰 Billing — server-verified Pro</h2>
        <p className="mt-1 text-[12.5px] text-mut">
          Pro is an <span className="font-bold">account property</span>, not a local flag: only admins (and single-use grant codes)
          can write it, and the app checks it on every sign-in. Grant Pro to a test account to try the gating end-to-end —
          sign in as that user and the paywall opens instantly; revoke it and the limits come right back.
        </p>
      </div>

      {/* create a shareable grant code */}
      <div className={`${cardCls} p-5`}>
        <h3 className="text-[14.5px] font-extrabold">🎟️ Create a grant code</h3>
        <p className="mb-3 text-[12px] text-mut">Single-use, server-verified. The user signs in and redeems it in Settings — no storefront needed.</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <select value={cPlan} onChange={e => setCPlan(e.target.value)} className="inp w-32">
            {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            days
            <input type="number" min={1} value={cDays} onChange={e => setCDays(Math.max(1, Number(e.target.value) || 30))} className="inp w-20 py-1.5 text-center" />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            −% off
            <input type="number" min={0} max={100} value={cPct} onChange={e => setCPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="inp w-20 py-1.5 text-center" />
          </label>
          <button className={btnPrimary + btnSm} disabled={busy} onClick={createCode}>Create code</button>
        </div>
        {code && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-3 py-2">
            <span className="font-mono text-[13px] font-extrabold">{code}</span>
            <button
              className={btnGhost + btnSm}
              onClick={() => { navigator.clipboard?.writeText(code).then(() => toast("📋 Copied"), () => {}); }}
            >
              Copy
            </button>
            <button className={btnGhost + btnSm} onClick={() => setCode("")}>✕</button>
          </div>
        )}
      </div>

      {/* revenue snapshot — the storefront's scoreboard */}
      <div className={`${cardCls} p-5`}>
        <h3 className="text-[14.5px] font-extrabold">📈 Revenue snapshot</h3>
        <p className="mb-3 text-[12px] text-mut">Computed from confirmed payments. MRR counts recurring subscription revenue (yearly ÷ 12).</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Total paid</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{fmtMinor(revenue.totalPaidMinor, "USD")}</div>
            <div className="text-[11px] text-fnt">{revenue.paidCount} payments</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">MRR</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{fmtMinor(revenue.mrrMinor, "USD")}</div>
            <div className="text-[11px] text-fnt">{revenue.activeSubscriberUsers} subscriber{revenue.activeSubscriberUsers === 1 ? "" : "s"}</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">One-time</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{fmtMinor(revenue.oneTimeRevenueMinor, "USD")}</div>
            <div className="text-[11px] text-fnt">recurring {fmtMinor(revenue.subscriptionRevenueMinor, "USD")}</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Refunded</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{fmtMinor(revenue.refundedMinor, "USD")}</div>
            <div className="text-[11px] text-fnt">{revenue.refundedCount} payment{revenue.refundedCount === 1 ? "" : "s"}</div>
          </div>
        </div>
        {Object.keys(revenue.byPlan).length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {Object.entries(revenue.byPlan).map(([plan, v]) => (
              <Chip key={plan} tone="lvl">{plan} ×{v.count} · {fmtMinor(v.amountMinor, "USD")}</Chip>
            ))}
            {Object.entries(revenue.byProvider).map(([p, n]) => (
              <Chip key={p}>{p} ×{n}</Chip>
            ))}
          </div>
        )}
      </div>

      {/* subscription health — active/cancelled, renewals, churn */}
      <div className={`${cardCls} p-5`}>
        <h3 className="text-[14.5px] font-extrabold">🔁 Subscription health</h3>
        <p className="mb-3 text-[12px] text-mut">From the subscriptions table — renewals estimate the next 30 days at catalog prices.</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Active</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{subsSummary.activeCount}</div>
            <div className="text-[11px] text-fnt">cancelled {subsSummary.cancelledCount}</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Renewing ≤ 30d</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{subsSummary.renewals30d}</div>
            <div className="text-[11px] text-fnt">≈ {fmtMinor(subsSummary.renewals30dMinor, "USD")}</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Expired</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{subsSummary.expiredCount}</div>
            <div className="text-[11px] text-fnt">no longer active</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Churn rate</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{subsSummary.churnRate}%</div>
            <div className="text-[11px] text-fnt">cancelled ÷ decided</div>
          </div>
        </div>
      </div>

      {/* reusable coupon codes — storefront discount codes */}
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
                    <div className="text-[11px] text-fnt">{u.userId.slice(0, 8)}… · {u.source ?? "none"}</div>
                  </td>
                  <td className="px-3 py-3">
                    {u.active ? <Chip tone="ok">PRO</Chip> : <Chip>free</Chip>}
                  </td>
                  <td className="px-3 py-3">{u.tier === "pro" ? planLabel(u.plan) : "—"}</td>
                  <td className="px-3 py-3 text-[12px] text-fnt">
                    {u.tier === "pro" ? (u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : "never") : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {u.discountPct > 0 ? (
                      <Chip tone="lvl">−{u.discountPct}%{u.discountExpiresAt ? ` · ${new Date(u.discountExpiresAt).toLocaleDateString()}` : ""}</Chip>
                    ) : <span className="text-[12px] text-fnt">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {u.active ? (
                        <button className={btnDanger + btnSm} disabled={busy} onClick={() => revoke(u)}>⛔ Revoke</button>
                      ) : (
                        <button className={btnOk + btnSm} disabled={busy} onClick={() => setOpen(o => ({ ...o, [u.userId]: o[u.userId] === "grant" ? undefined : "grant" }))}>
                          💎 Grant Pro
                        </button>
                      )}
                      <button className={btnGhost + btnSm} disabled={busy} onClick={() => setOpen(o => ({ ...o, [u.userId]: o[u.userId] === "discount" ? undefined : "discount" }))}>
                        🏷️ Discount
                      </button>
                      <button className={btnGhost + btnSm} disabled={busy} onClick={() => simulate(u)} title="Simulate a confirmed purchase — same apply_purchase grant path as the real webhook">
                        🪙 Sim purchase
                      </button>
                    </div>
                    {open[u.userId] === "grant" && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <select value={gPlan} onChange={e => setGPlan(e.target.value)} className="inp w-28 py-1 text-[12px]">
                          {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                        <input type="number" min={1} value={gDays} onChange={e => setGDays(Math.max(1, Number(e.target.value) || 30))} className="inp w-16 py-1 text-center text-[12px]" title="days (lifetime ignores this)" />
                        <button className={btnOk + btnSm} disabled={busy} onClick={() => grant(u)}>Grant</button>
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

      {/* refund policy — grace window + per-user cap + reason presets */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">📋 Refund policy</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Purchases inside the grace window always refund; outside it, a per-user refund cap applies unless the admin overrides. pay-refund enforces this server-side — no deploy needed.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Grace window (days)</span>
            <input type="number" min={0} className="inp" value={policyDraft.grace_days ?? 0} onChange={e => setPolicyDraft({ ...policyDraft, grace_days: Number(e.target.value) || 0 })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Max refunds per user</span>
            <input type="number" min={0} className="inp" value={policyDraft.max_refunds_per_user ?? 0} onChange={e => setPolicyDraft({ ...policyDraft, max_refunds_per_user: Number(e.target.value) || 0 })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Reason presets (comma-separated)</span>
            <input className="inp" value={presetsText} onChange={e => setPresetsText(e.target.value)} placeholder="Duplicate purchase, Requested by user, …" />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line/10 px-5 py-3.5">
          <span className="text-[11.5px] text-fnt">0 = unlimited. Presets appear as a picker in the refund form.</span>
          <button className={btnPrimary + btnSm} onClick={savePolicy} disabled={busy}>📋 Publish policy</button>
        </div>
      </div>

      {/* legal & policies — the four provider-required pages, editable templates */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14.5px] font-extrabold">⚖️ Legal &amp; Policies</h3>
            <span className="text-[11.5px] font-bold text-ok">✓ 4/4 published</span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-fnt">Terms, Privacy, Refund &amp; Cancellation and Shipping are the pages payment providers require before international payments can be enabled. Edit the templates and publish — no deploy. The public site shows these at the landing footer → Terms / Privacy / Refunds / Shipping.</p>
        </div>
        <div className="grid gap-4 p-5">
          {POLICY_META.map(m => (
            <div key={m.id} className="rounded-xl border border-line/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-extrabold">{m.icon} {m.title}</span>
                <button
                  className="rounded-lg border border-line/15 bg-wht/10 px-2.5 py-1 text-[11px] font-bold text-mut transition-all hover:bg-wht/20 hover:text-ink"
                  onClick={() => setPolicyDocs(d => ({ ...d, [m.id]: POLICY_DEFAULTS[m.id] }))}
                >↺ Reset to default</button>
              </div>
              <textarea
                className="inp mt-2 h-40 w-full resize-y font-mono text-[12px] leading-relaxed"
                value={policyDocs[m.id]}
                onChange={e => setPolicyDocs(d => ({ ...d, [m.id]: e.target.value }))}
              />
              <p className="mt-1 text-[10.5px] text-mut">Placeholders {"{{company}}"}, {"{{url}}"} and {"{{email}}"} are filled automatically on the public page.</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line/10 px-5 py-3.5">
          <span className="text-[11.5px] text-fnt">Live at https://gaurav123337.github.io/interviewiq — footer → Terms / Privacy / Refunds / Shipping.</span>
          <button className={btnPrimary + btnSm} onClick={savePolicies} disabled={busy}>⚖️ Publish legal pages</button>
        </div>
      </div>

      {/* payments — every confirmed provider purchase */}
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
