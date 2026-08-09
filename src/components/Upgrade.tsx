import { CONFIG } from "../config";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSm, Modal } from "./ui";

const BENEFITS = [
  "Unlimited interview sessions",
  "All 12 company question sets",
  "Journey mode and mock interviews",
  "Unlimited AI feedback & hints",
  "Full history and progress analytics"
];

export function UpgradeModal({ onClose, reason }: { onClose: () => void; reason: string }) {
  const getPro = () => {
    if (CONFIG.proUrl) {
      window.open(CONFIG.proUrl, "_blank", "noopener");
    } else {
      const subject = encodeURIComponent(`Pro license — ${CONFIG.productName}`);
      const body = encodeURIComponent("Hi, I'd like to buy a Pro license.\n\n");
      try {
        window.location.href = `mailto:${CONFIG.supportEmail}?subject=${subject}&body=${body}`;
      } catch {
        navigator.clipboard?.writeText(CONFIG.supportEmail).catch(() => {});
      }
      toast("📬 Opening your mail app — mention 'Pro license'");
    }
    onClose();
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
      <div className="flex gap-3">
        <button className={btnGhost} onClick={onClose}>Not now</button>
        <button className={btnPrimary + btnSm} onClick={getPro}>Get Pro</button>
      </div>
    </Modal>
  );
}
