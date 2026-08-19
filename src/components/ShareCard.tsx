/* Shareable result card — generates a branded card that users can share
   on social media. Acts as organic marketing / viral growth channel.
   
   Features:
   - Beautiful branded card with user's stats
   - Copy-to-clipboard with pre-formatted tweet/post text
   - "Powered by InterviewIQ" branding
   - Download as image (via canvas) */

import { useRef, useState } from "react";
import { toast } from "../toast";
import { cardCls, btnPrimary, btnGhost } from "./ui";

interface ShareCardProps {
  score: number;
  total: number;
  level: string;
  field: string;
  company: string;
  streak?: number;
  onClose: () => void;
}

export function ShareCard({ score, total, level, field, company, streak, onClose }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const emoji = pct >= 80 ? "🔥" : pct >= 60 ? "💪" : "📚";
  const verdict = pct >= 80 ? "Crushed it!" : pct >= 60 ? "Solid prep!" : "Keep practicing!";

  const shareText = `${emoji} I scored ${score}/${total} (${pct}%) on my ${level} ${field} interview prep with InterviewIQ!\n\n${verdict}\n\nFree, offline-first, AI-powered interview prep:\nhttps://gaurav123337.github.io/interviewiq/\n\n#InterviewPrep #TechInterview #InterviewIQ`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      toast("📋 Copied! Paste on Twitter, LinkedIn, or anywhere.");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      // Dynamic import — html2canvas is optional
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await (Function("return import('html2canvas')")() as Promise<any>).catch(() => null);
      const html2canvas = mod?.default;
      if (html2canvas) {
        const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 });
        const link = document.createElement("a");
        link.download = `interviewiq-${level}-${field}-${pct}pct.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast("📥 Downloaded! Share it on social media.");
      } else {
        handleCopy();
      }
    } catch {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-[440px]" onClick={e => e.stopPropagation()}>
        {/* Shareable card preview */}
        <div ref={cardRef} className={`${cardCls} overflow-hidden`}>
          {/* Header */}
          <div className="grad-bg px-6 py-5 text-center">
            <div className="text-[14px] font-extrabold text-white/80">InterviewIQ</div>
            <div className="mt-1 text-[11px] font-bold text-white/60">AI Interview Coach</div>
          </div>

          {/* Stats */}
          <div className="px-6 py-5 text-center">
            <div className="text-[48px]">{emoji}</div>
            <div className="mt-2 text-[28px] font-extrabold tracking-tight">
              {score}/{total}
            </div>
            <div className="mt-1 text-[14px] font-bold text-acctxt">{pct}% accuracy</div>
            <div className="mt-2 text-[13px] font-bold text-ink">{verdict}</div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-acc1/30 bg-acc1/10 px-3 py-1 text-[11px] font-bold text-acctxt">{level}</span>
              <span className="rounded-full border border-line/15 bg-wht/5 px-3 py-1 text-[11px] font-bold text-fnt">{field}</span>
              {company && company !== "general" && (
                <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[11px] font-bold text-purple-400">{company}</span>
              )}
            </div>

            {streak && streak > 1 && (
              <div className="mt-3 text-[12px] font-bold text-amber-400">🔥 {streak} day streak</div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-line/10 bg-wht/5 px-6 py-3 text-center">
            <div className="text-[12px] font-extrabold text-ink">
              Practice free at <span className="text-acctxt">gaurav123337.github.io/interviewiq</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <button onClick={handleCopy} className={btnPrimary + " flex-1"}>
            {copied ? "✓ Copied!" : "📋 Copy tweet"}
          </button>
          <button onClick={handleDownload} className={btnGhost + " flex-1"}>
            📥 Download image
          </button>
        </div>

        <button onClick={onClose} className="mt-3 w-full text-center text-[12px] text-mut hover:text-ink">
          Close
        </button>
      </div>
    </div>
  );
}
