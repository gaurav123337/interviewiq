import { useEffect, useState } from "react";
import { CONFIG } from "../config";
import { getTier, setTier } from "../services/entitlements";
import {
  PLANS, discountedPrice, discountLive, fmtMoney, getCachedEntitlement, refreshEntitlement, tierSource
} from "../services/entitlement";
import { createCheckout, createStandardOrder, getRemotePricing, paymentProviderName, validateCoupon, verifyPayment, type CouponCheck, type RemotePricing } from "../services/billing";
import { getCloudState, isCloudConfigured } from "../services/cloud";
import { queueEvent, updateProfile } from "../services/events";
import { toast } from "../toast";
import { btnGhost, btnOk, btnPrimary, btnSm, Modal, Chip } from "./ui";

const BENEFITS = [
  "Unlimited interview sessions",
  "All 12 company question sets",
  "Journey mode and mock interviews",
  "Unlimited AI feedback & hints",
  "Voice mode — the interviewer speaks, you answer aloud",
  "Full history and progress analytics"
];

const CHECKOUT_KEY = "iq.checkout";

/** Lazily inject checkout.js (never bundled; only when the modal opens). */
let rzpScriptPromise: Promise<boolean> | null = null;
function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (rzpScriptPromise) return rzpScriptPromise;
  rzpScriptPromise = new Promise(resolve => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(Boolean(window.Razorpay));
    s.onerror = () => resolve(false);
    setTimeout(() => resolve(Boolean(window.Razorpay)), 8000);
    document.head.appendChild(s);
  });
  return rzpScriptPromise;
}

/** True when the URL says the payment flow completed (e.g. checkout redirect). */
function returnedFromCheckout(): boolean {
  return new URLSearchParams(window.location.search).get("pro") === "success";
}

export function UpgradeModal({ onClose, reason }: { onClose: () => void; reason: string }) {
  /* paid → show the unlock CTA instead of the buy CTA */
  const [paid] = useState(() => sessionStorage.getItem(CHECKOUT_KEY) === "pending" || returnedFromCheckout());
  const [verifying, setVerifying] = useState(false);
  const [ent, setEnt] = useState(getCachedEntitlement());
  const [remote, setRemote] = useState<RemotePricing | null>(null);
  const [subscribe, setSubscribe] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponCheck, setCouponCheck] = useState<CouponCheck | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  /* pull the latest server entitlement (discount + grant status) and the
     admin-published pricing on open */
  useEffect(() => {
    void refreshEntitlement().then(setEnt);
    void getRemotePricing().then(rp => { if (rp) setRemote(rp); });
  }, []);

  const discount = discountLive(ent);
  /* the better of the per-user discount and a validated coupon code wins */
  const effDiscount = Math.max(discount, couponCheck?.valid ? couponCheck.discountPct : 0);
  /* admin-published price wins over the baked-in catalog (dollars) */
  const planPrice = (id: string) => (remote && remote[id as keyof RemotePricing] != null ? remote[id as keyof RemotePricing] as number : PLANS.find(p => p.id === id)!.price);

  const applyCoupon = async () => {
    const code = coupon.trim();
    if (!code) { setCouponCheck(null); return; }
    setCouponBusy(true);
    try {
      const c = await validateCoupon(code);
      setCouponCheck(c);
      toast(c.valid ? `🎟️ Code applied — ${c.discountPct}% off at checkout` : "✗ " + (c.message || "Invalid code"));
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Couldn't check that code"));
    } finally {
      setCouponBusy(false);
    }
  };

  const unlock = async () => {
    /* "I've paid" no longer unlocks blindly — the server must confirm the
       grant (admin grant / redeemed code / Stripe webhook) on the account */
    setVerifying(true);
    try {
      const fresh = await refreshEntitlement();
      setEnt(fresh);
      if (fresh?.active) {
        sessionStorage.removeItem(CHECKOUT_KEY);
        const url = new URL(window.location.href);
        if (url.searchParams.get("pro")) {
          url.searchParams.delete("pro");
          window.history.replaceState(null, "", url);
        }
        setTier("pro");
        void queueEvent("tier", { tier: "pro" });
        void updateProfile({ tier: "pro" }).catch(() => {});
        toast("💎 Welcome to Pro — all limits lifted 🎉");
        onClose();
        return;
      }
      toast("No Pro grant found on your account yet — payment may still be confirming, or ask your admin (Billing → Grant Pro).");
    } finally {
      setVerifying(false);
    }
  };

  const [buying, setBuying] = useState(false);
  const checkout = () => isCloudConfigured();

  /* Razorpay Standard Checkout — creates an order, opens the checkout.js
     modal, and on success sends { payment_id, order_id, signature } to
     pay-verify (the server re-checks the signature + capture before
     granting). Returns true when the modal actually opened; false (or
     throws) when it can't, so the caller falls back to the payment link. */
  const payWithModal = async (plan: string): Promise<boolean> => {
    let order;
    try {
      order = await createStandardOrder(plan, effDiscount, coupon);
    } catch {
      return false; /* e.g. Razorpay not configured — link flow will explain */
    }
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) return false;
    const user = getCloudState().user;
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountMinor,
      currency: order.currency,
      name: CONFIG.productName,
      description: `Pro — ${PLANS.find(p => p.id === plan)?.label ?? plan}`,
      prefill: { email: user?.email, name: user?.email?.split("@")[0] },
      theme: { color: "#6366f1" },
      handler: async (res) => {
        try {
          const v = await verifyPayment(res.razorpay_payment_id, res.razorpay_order_id, res.razorpay_signature);
          if (v.ok) {
            sessionStorage.removeItem(CHECKOUT_KEY);
            setTier("pro");
            void queueEvent("tier", { tier: "pro" });
            void updateProfile({ tier: "pro" }).catch(() => {});
            toast("💎 Payment verified — Pro unlocked 🎉");
            onClose();
          }
        } catch (e) {
          toast("✗ " + ((e as Error).message || "Verification failed — tap “I've paid” to re-check"));
        }
      },
      modal: { ondismiss: () => toast("Checkout cancelled — no charge was made.") }
    });
    rzp.open();
    return true;
  };

  const getPro = async (plan: string) => {
    /* provider-agnostic checkout: the pay-checkout Edge Function picks the
       provider (Razorpay today, swap via PAYMENT_PROVIDER env later).
       One-time Razorpay purchases open the checkout.js modal; subscriptions
       and other providers use the hosted payment link. */
    if (checkout()) {
      setBuying(true);
      try {
        sessionStorage.setItem(CHECKOUT_KEY, "pending");
        const recurring = subscribe && plan !== "lifetime";
        if (!recurring && paymentProviderName() === "razorpay") {
          if (await payWithModal(plan)) return; /* modal open — wait for it */
          /* fall through to the hosted link (also toasts the real error) */
        }
        const r = await createCheckout(plan, effDiscount, recurring, coupon);
        window.open(r.url, "_blank", "noopener");
        const mode = r.mode === "subscription" ? "🔁 subscription" : "one-time";
        toast(`💳 ${paymentProviderName()} ${mode} checkout opened — complete it, then tap “I've paid” to verify`);
      } catch (e) {
        toast("✗ " + ((e as Error).message || "Checkout unavailable"));
      } finally {
        setBuying(false);
      }
      return;
    }
    if (CONFIG.proUrl) {
      sessionStorage.setItem(CHECKOUT_KEY, "pending");
      window.open(CONFIG.proUrl, "_blank", "noopener");
      toast("💳 Opening checkout — return here and tap “I've paid” to unlock instantly");
      return; /* keep the modal open so the user can unlock on return */
    }
    const subject = encodeURIComponent(`Pro license — ${CONFIG.productName}`);
    const body = encodeURIComponent("Hi, I'd like to buy a Pro license.\n\n");
    try {
      window.location.href = `mailto:${CONFIG.supportEmail}?subject=${subject}&body=${body}`;
    } catch {
      navigator.clipboard?.writeText(CONFIG.supportEmail).catch(() => {});
    }
    toast("📬 Opening your mail app — mention 'Pro license'");
  };

  return (
    <Modal onClose={onClose} title="✨ InterviewIQ Pro" desc={reason}>
      <ul className="mb-5 space-y-2">
        {BENEFITS.map(b => (
          <li key={b} className="flex items-center gap-2 text-[14px] text-ink before:content-['✓'] before:text-ok">
            {b}
          </li>
        ))}
      </ul>

      {ent?.active ? (
        <div className="mb-4 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-[13.5px] text-ink">
          💎 You're already Pro — server-verified
          {ent.expiresAt && <> · until <span className="font-bold">{new Date(ent.expiresAt).toLocaleDateString()}</span></>}
          {ent.plan && <> · {ent.plan}</>}.
        </div>
      ) : (
        <>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {PLANS.map(p => {
            const base = planPrice(p.id);
            const was = effDiscount > 0 ? base : 0;
            const now = discountedPrice(base, effDiscount);
            const recurring = subscribe && p.id !== "lifetime";
            return (
              <button
                key={p.id}
                type="button"
                disabled={buying}
                onClick={() => getPro(p.id)}
                className={`rounded-xl border p-3 text-center transition-all hover:border-acc1/60 disabled:opacity-60 ${p.id === "yearly" ? "border-acc1/50 bg-acc1/10" : "border-line/10 bg-deep/40 hover:bg-deep/60"}`}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-mut">{p.label}</div>
                <div className="mt-1 text-[17px] font-extrabold tabular-nums">
                  {discount > 0 && <span className="mr-1 text-[12px] text-fnt line-through">{fmtMoney(was)}</span>}
                  {fmtMoney(now)}<span className="text-[11px] font-bold text-mut">{recurring ? "/mo" : p.per}</span>
                </div>
                {recurring && <div className="text-[10px] font-bold text-acc1">billed {p.id === "yearly" ? "yearly" : "monthly"} · cancel anytime</div>}
                {effDiscount > 0 && <div className="text-[10.5px] font-bold text-ok">−{effDiscount}%{couponCheck?.valid ? ` (${couponCheck.discountPct}% code)` : " for you"}</div>}
                {!recurring && p.id === "yearly" && <div className="text-[10px] font-bold text-acc1">best value</div>}
                <div className="mt-1.5 text-[10.5px] font-bold text-acctxt">{buying ? "Opening…" : "Choose"}</div>
              </button>
            );
          })}
        </div>
        {checkout() && (
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-mut select-none">
            <input
              type="checkbox"
              checked={subscribe}
              onChange={e => setSubscribe(e.target.checked)}
              className="h-4 w-4 accent-acc1"
            />
            🔁 Subscribe (recurring) — monthly/yearly renew automatically; cancel anytime. Off = one-time purchase.
          </label>
        )}
        {checkout() && (
          <div className="mb-4">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <div className="text-[12px] font-bold text-mut">🎟️ Have a discount code?</div>
              {couponCheck?.valid && <Chip tone="ok">−{couponCheck.discountPct}% applied</Chip>}
              {couponCheck && !couponCheck.valid && <Chip tone="bad">{couponCheck.message}</Chip>}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={coupon}
                onChange={e => { setCoupon(e.target.value); setCouponCheck(null); }}
                onKeyDown={e => { if (e.key === "Enter") void applyCoupon(); }}
                placeholder="LAUNCH20"
                className="min-w-[160px] flex-1 rounded-xl border border-line/15 bg-deep/80 px-3 py-2 font-mono text-[13px] uppercase placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
              />
              <button className={btnGhost + btnSm} disabled={couponBusy || !coupon.trim()} onClick={() => void applyCoupon()}>
                {couponBusy ? "Checking…" : "Apply"}
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {!ent?.active && CONFIG.proUrl && !paid && (
        <p className="mb-4 text-[12.5px] text-fnt">
          Checkout opens in a new tab. When you're done, come back and tap <span className="font-bold text-ink">“I've paid — unlock”</span> — Pro activates once the payment is confirmed on your account.
        </p>
      )}
      {!ent?.active && CONFIG.proUrl && paid && (
        <div className="mb-4 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-[13.5px] text-ink">
          🎉 Payment window — tap below and we'll verify the grant on your account.
        </div>
      )}
      {!ent?.active && !CONFIG.proUrl && !checkout() && (
        <p className="mb-4 text-[12.5px] text-warn">
          Self-serve checkout isn't wired up yet. Paste a checkout link into <span className="font-mono">CONFIG.proUrl</span> — or ask your admin for a Pro grant code to redeem in Settings.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className={btnGhost} onClick={onClose}>{CONFIG.proUrl && !paid && !ent?.active ? "Not now" : "Close"}</button>
        {ent?.active ? (
          <button className={btnOk + btnSm} onClick={onClose}>✅ Already Pro</button>
        ) : CONFIG.proUrl || checkout() ? (
          paid
            ? <button className={btnOk + btnSm} disabled={verifying} onClick={unlock}>{verifying ? "Verifying…" : "✅ I've paid — unlock Pro"}</button>
            : <button className={btnPrimary + btnSm} onClick={() => getPro("yearly")}>💳 Buy Pro</button>
        ) : (
          <>
            <button className={btnPrimary + btnSm} onClick={() => getPro("yearly")}>📬 Email to purchase</button>
            <button className={btnOk + btnSm} disabled={verifying} onClick={unlock}>{verifying ? "Verifying…" : "Check my account"}</button>
          </>
        )}
      </div>
      {checkout() && !ent?.active && (
        <p className="mt-3 text-center text-[10.5px] font-bold uppercase tracking-wider text-mut">
          secure checkout by {paymentProviderName()}
        </p>
      )}
      {!ent?.active && (
        <p className="mt-3 text-[11.5px] text-fnt">
          Access is tied to your <span className="font-bold">signed-in account</span> — grants and codes are server-verified, not a local flag.
        </p>
      )}
      {ent?.active && getTier() !== "pro" && <p className="mt-3 text-[11.5px] text-fnt">Sync status: {tierSource()}</p>}
      {getTier() === "pro" && !ent?.active && <Chip tone="warn">local {tierSource()} tier — server says free</Chip>}
    </Modal>
  );
}
