import { useState } from "react";
import { CONFIG } from "../config";
import { getTier, setTier } from "../services/entitlements";
import { queueEvent, updateProfile } from "../services/events";
import { toast } from "../toast";
import { btnGhost, btnOk, btnPrimary, btnSm, Modal } from "./ui";

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

  const unlock = () => {
    sessionStorage.removeItem(CHECKOUT_KEY);
    /* clean the success param so reloads don't re-trigger */
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

      {CONFIG.proUrl ? (
        paid ? (
          <div className="mb-4 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-[13.5px] text-ink">
            🎉 Payment complete — tap below to unlock your account instantly.
          </div>
        ) : (
          <p className="mb-4 text-[12.5px] text-fnt">
            Checkout opens in a new tab. When you're done, come back and tap <span className="font-bold text-ink">“I've paid — unlock”</span>.
          </p>
        )
      ) : (
        <p className="mb-4 text-[12.5px] text-warn">
          Self-serve checkout isn't wired up yet — email us and we'll set you up manually. (Paste your
          Lemon Squeezy/Stripe link into <span className="font-mono">CONFIG.proUrl</span> to enable instant checkout.)
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button className={btnGhost} onClick={onClose}>{CONFIG.proUrl && !paid ? "Not now" : "Close"}</button>
        {CONFIG.proUrl ? (
          paid
            ? <button className={btnOk + btnSm} onClick={unlock}>✅ I've paid — unlock Pro</button>
            : <button className={btnPrimary + btnSm} onClick={getPro}>💳 Buy Pro</button>
        ) : (
          <>
            <button className={btnPrimary + btnSm} onClick={getPro}>📬 Email to purchase</button>
            <button className={btnOk + btnSm} onClick={unlock}>I've already paid — unlock</button>
          </>
        )}
      </div>
      {getTier() === "pro" && <p className="mt-3 text-[12.5px] text-ok">You're already Pro — this modal shouldn't have appeared.</p>}
    </Modal>
  );
}
