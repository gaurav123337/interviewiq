import { useEffect, useState } from "react";
import { CONFIG } from "../config";
import { getTier, setTier } from "../services/entitlements";
import {
  PLANS, discountedPrice, discountLive, fmtMoney, getCachedEntitlement, refreshEntitlement, tierSource
} from "../services/entitlement";
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

/** True when the URL says the payment flow completed (e.g. checkout redirect). */
function returnedFromCheckout(): boolean {
  return new URLSearchParams(window.location.search).get("pro") === "success";
}

export function UpgradeModal({ onClose, reason }: { onClose: () => void; reason: string }) {
  /* paid → show the unlock CTA instead of the buy CTA */
  const [paid] = useState(() => sessionStorage.getItem(CHECKOUT_KEY) === "pending" || returnedFromCheckout());
  const [verifying, setVerifying] = useState(false);
  const [ent, setEnt] = useState(getCachedEntitlement());

  /* pull the latest server entitlement (discount + grant status) on open */
  useEffect(() => {
    void refreshEntitlement().then(setEnt);
  }, []);

  const discount = discountLive(ent);

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

  const getPro = () => {
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
        <div className="mb-4 grid grid-cols-3 gap-2">
          {PLANS.map(p => {
            const was = discount > 0 ? p.price : 0;
            const now = discountedPrice(p.price, discount);
            return (
              <div key={p.id} className={`rounded-xl border p-3 text-center ${p.id === "yearly" ? "border-acc1/50 bg-acc1/10" : "border-line/10 bg-deep/40"}`}>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-mut">{p.label}</div>
                <div className="mt-1 text-[17px] font-extrabold tabular-nums">
                  {discount > 0 && <span className="mr-1 text-[12px] text-fnt line-through">{fmtMoney(was)}</span>}
                  {fmtMoney(now)}<span className="text-[11px] font-bold text-mut">{p.per}</span>
                </div>
                {discount > 0 && <div className="text-[10.5px] font-bold text-ok">−{discount}% for you</div>}
                {p.id === "yearly" && <div className="text-[10px] font-bold text-acc1">best value</div>}
              </div>
            );
          })}
        </div>
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
      {!ent?.active && !CONFIG.proUrl && (
        <p className="mb-4 text-[12.5px] text-warn">
          Self-serve checkout isn't wired up yet. Paste a Lemon Squeezy/Stripe link into <span className="font-mono">CONFIG.proUrl</span> — or ask your admin for a Pro grant code to redeem in Settings.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className={btnGhost} onClick={onClose}>{CONFIG.proUrl && !paid && !ent?.active ? "Not now" : "Close"}</button>
        {ent?.active ? (
          <button className={btnOk + btnSm} onClick={onClose}>✅ Already Pro</button>
        ) : CONFIG.proUrl ? (
          paid
            ? <button className={btnOk + btnSm} disabled={verifying} onClick={unlock}>{verifying ? "Verifying…" : "✅ I've paid — unlock Pro"}</button>
            : <button className={btnPrimary + btnSm} onClick={getPro}>💳 Buy Pro</button>
        ) : (
          <>
            <button className={btnPrimary + btnSm} onClick={getPro}>📬 Email to purchase</button>
            <button className={btnOk + btnSm} disabled={verifying} onClick={unlock}>{verifying ? "Verifying…" : "Check my account"}</button>
          </>
        )}
      </div>
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
