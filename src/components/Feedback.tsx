import { useState } from "react";
import type { ReactNode } from "react";
import { CONFIG } from "../config";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSm, Modal } from "./ui";

type Mode = "early" | "feedback";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Feedback & early access"
        className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-[13px] font-bold text-mut transition-all hover:bg-white/10 hover:text-ink"
      >
        ✉️ Feedback
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("early");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = () => {
    const subject = mode === "early"
      ? `Early access — ${CONFIG.productName} Pro`
      : `Feedback — ${CONFIG.productName}`;
    const body = (mode === "early" ? `Email: ${email}\n\n` : "") +
      `Message:\n${message.trim() || "(no message)"}\n\n---\nSent from ${CONFIG.productName}`;
    const href = `mailto:${CONFIG.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    /* Try the user's mail client; fall back to copying the composed message. */
    try {
      window.location.href = href;
      toast(mode === "early" ? "📬 Opening your mail app — thanks for joining the waitlist!" : "📬 Opening your mail app — thanks for the feedback!");
    } catch {
      navigator.clipboard?.writeText(`${subject}\n\n${body}`).catch(() => {});
      toast("Copied to clipboard — send it to " + CONFIG.supportEmail);
    }
    onClose();
  };

  return (
    <Modal onClose={onClose} title={mode === "early" ? "🚀 Get early access to Pro" : "💬 Feedback"} desc={mode === "early"
      ? "Unlimited interviews, all companies, and AI coaching are coming. Leave your email and you'll be first in line."
      : "Found a bug or want a feature? Tell us — it takes 10 seconds."
    }>
      <div className="mb-4 flex gap-2">
        <ModeTab active={mode === "early"} onClick={() => setMode("early")}>Early access</ModeTab>
        <ModeTab active={mode === "feedback"} onClick={() => setMode("feedback")}>Feedback</ModeTab>
      </div>
      {mode === "early" && (
        <label className="mb-4 block">
          <span className="mb-1 block text-[12.5px] font-bold text-mut">Your email</span>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/15 bg-[#0b1120]/80 px-4 py-2.5 text-[14px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
          />
        </label>
      )}
      <label className="mb-5 block">
        <span className="mb-1 block text-[12.5px] font-bold text-mut">Message</span>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)} rows={4}
          placeholder={mode === "early" ? "What level are you preparing for? (optional)" : "Tell us what you'd improve…"}
          className="w-full resize-y rounded-xl border border-white/15 bg-[#0b1120]/80 px-4 py-2.5 text-[14px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
        />
      </label>
      <div className="flex gap-3">
        <button className={btnGhost} onClick={onClose}>Cancel</button>
        <button className={btnPrimary + btnSm} onClick={submit} disabled={mode === "early" && !email.trim()}>
          {mode === "early" ? "Join the waitlist" : "Send feedback"}
        </button>
      </div>
    </Modal>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition-all ${active ? "grad-bg text-white" : "text-mut hover:bg-white/10 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
