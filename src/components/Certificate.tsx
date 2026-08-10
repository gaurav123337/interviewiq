import type { Certificate as Cert } from "../services/certificates";
import { btnPrimary, btnGhost, btnSm } from "./ui";

export function CertificateView({ cert, onClose }: { cert: Cert; onClose: () => void }) {

  return (
    <div className="anim-view mx-auto max-w-[860px]">
      {/* print-only certificate card */}
      <div
        id="certificate-print"
        className="relative overflow-hidden rounded-[24px] border-2 border-double border-acc1/40 bg-gradient-to-b from-panel to-deep p-8 text-center shadow-[0_24px_80px_rgba(99,102,241,.2)] print:border-acc1/60 print:shadow-none"
        style={{ minHeight: "520px" }}
      >
        {/* decorative top bar */}
        <div className="absolute inset-x-0 top-0 h-2 grad-bg" />

        <div className="flex flex-col items-center justify-center pt-8" style={{ minHeight: "460px" }}>
          <span className="text-[48px]">🎓</span>

          <h1 className="mt-2 text-[clamp(28px,4vw,40px)] font-extrabold tracking-tight">
            Certificate of <span className="grad-text">Achievement</span>
          </h1>

          <p className="mt-2 text-[14.5px] text-mut">
            This certifies that the recipient has successfully completed an interview preparation session.
          </p>

          {/* score circle */}
          <div className="mx-auto mt-6 grid h-[100px] w-[100px] place-items-center rounded-full grad-bg shadow-[0_8px_28px_rgba(99,102,241,.35)]">
            <div className="text-center">
              <div className="text-[28px] font-extrabold leading-none text-white">{(cert.pct * 100).toFixed(0)}%</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">Score</div>
            </div>
          </div>

          {/* meta */}
          <div className="mt-5 space-y-1 text-[14.5px] text-ink">
            <p><span className="font-bold">{cert.level}</span> · <span className="font-bold">{cert.field}</span> · <span className="font-bold">{cert.company}</span></p>
            <p className="text-[13px] text-mut">Grade <span className="font-bold text-acc3">{cert.grade}</span> · {cert.date}</p>
          </div>

          {/* verification */}
          <div className="mt-5 rounded-xl border border-line/10 bg-wht/5 px-5 py-3 font-mono text-[12px] text-mut">
            Verify: <span className="font-bold text-ink">{cert.hash}</span>
            <span className="ml-3 text-[11px]">InterviewIQ · {cert.sessionId.slice(0, 10)}</span>
          </div>
        </div>
      </div>

      {/* non-print controls */}
      <div className="mt-6 flex flex-wrap justify-center gap-3 no-print">
        <button className={btnPrimary + " px-8 py-3.5 text-[15.5px]"} onClick={() => window.print()}>
          🖨 Print / Save as PDF
        </button>
        <button className={btnGhost + btnSm} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}