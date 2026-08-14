import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/* ---------- button classes ---------- */
/* h-10 on the base gives every text button one uniform height — and stops
   flex-stretch from ever growing a button to match a taller sibling (like
   a textarea). Large CTAs opt back up via btnLg (h-12). */
export const btn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl font-bold transition-all duration-150 active:scale-[.99] disabled:opacity-45 disabled:cursor-not-allowed";
export const btnPrimary = btn + " grad-bg px-6 py-3 text-white shadow-[0_10px_26px_rgba(99,102,241,.35)] hover:-translate-y-px hover:brightness-110";
export const btnGhost = btn + " border border-line/20 px-4 py-2 text-sm text-mut hover:bg-wht/10 hover:text-ink";
export const btnSoft = btn + " grad-bg-soft border border-acc1/50 px-4 py-2 text-sm text-acctxt hover:bg-acc1/40";
export const btnOk = btn + " bg-gradient-to-br from-emerald-600 to-emerald-500 px-6 py-3 text-white shadow-[0_10px_26px_rgba(16,185,129,.3)] hover:-translate-y-px hover:brightness-110";
export const btnDanger = btn + " border border-bad/40 px-4 py-2 text-sm text-bad hover:bg-bad/10";
export const btnLg = " h-12 px-8 py-4 text-[17px] rounded-2xl";
export const btnSm = " px-3.5 py-1.5 text-[13px] rounded-lg";

/* ---------- card ---------- */
export const cardCls =
  "rounded-2xl border border-line/10 bg-gradient-to-b from-panel to-panel2 card-shadow";

/* ---------- chip ---------- */
const tones: Record<string, string> = {
  default: "bg-wht/10 text-mut border-line/10",
  cat: "bg-acc3/10 text-acc3 border-acc3/30",
  lvl: "bg-acc2/10 text-acc2 border-acc2/35",
  co: "bg-acc1/10 text-acctxt border-acc1/35",
  ok: "bg-ok/10 text-ok border-ok/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  bad: "bg-bad/10 text-bad border-bad/35"
};

export function Chip({ tone = "default", title, children }: { tone?: keyof typeof tones; title?: string; children: ReactNode }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Kp({ children, hit }: { children: ReactNode; hit?: boolean }) {
  return (
    <span className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold ${hit ? "border-ok/40 bg-ok/10 text-ok" : "border-bad/40 bg-bad/10 text-bad"}`}>
      {children}
    </span>
  );
}

export function KpNeutral({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-lg border border-line/10 bg-wht/10 px-2.5 py-1 text-[12.5px] font-semibold text-mut">
      {children}
    </span>
  );
}

/* ---------- segmented control ---------- */
export function Seg<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-xl bg-wht/10 p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-bold transition-all ${value === o.value ? "grad-bg text-white shadow-[0_4px_12px_rgba(99,102,241,.4)]" : "text-mut hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- toggle switch ---------- */
export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-block h-[26px] w-[46px] flex-none cursor-pointer">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="absolute inset-0 rounded-full bg-wht/20 transition-colors peer-checked:grad-bg" />
      <span className="absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
    </label>
  );
}

/* ---------- modal ---------- */
/* Portaled to document.body so no animated/transformed view container can
   ever become the containing block of the fixed overlay (a non-none
   transform on an ancestor traps position:fixed modals mid-page). */
export function Modal({ onClose, title, desc, children }: {
  onClose: () => void;
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return createPortal(
    <div className="anim-fade fixed inset-0 z-[100] grid place-items-center bg-deep/70 p-5 backdrop-blur-sm" onClick={onClose}>
      <div
        className="anim-pop max-h-[90vh] w-full max-w-[520px] overflow-auto rounded-[20px] border border-line/30 bg-gradient-to-b from-panel to-panel2 p-7 shadow-[0_30px_80px_rgba(0,0,0,.6)]"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mb-1 text-xl font-extrabold tracking-tight">{title}</h3>
        {desc && <p className="mb-5 text-sm text-mut">{desc}</p>}
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ---------- side drawer ---------- */
/* Right-hand panel for content that should NOT hide the page behind it
   (e.g. reading a roadmap topic while the topic list stays on screen).
   Portaled to body; the page stays visible through a transparent click-away. */
export function Drawer({ onClose, title, desc, children }: {
  onClose: () => void;
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* transparent click-away — the page stays visible behind the drawer */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="anim-drawer absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-line/10 bg-gradient-to-b from-panel to-panel2 shadow-[0_0_60px_rgba(0,0,0,.5)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line/10 px-6 py-5">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
            {desc && <p className="mt-0.5 text-[12.5px] text-mut">{desc}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 flex-none place-items-center rounded-lg border border-line/15 bg-wht/5 text-sm transition-colors hover:bg-wht/10">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ---------- empty state ---------- */
export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="cardCls flex flex-col items-center px-5 py-16 text-center text-fnt">
      <div className="mb-3 text-[42px]">{icon}</div>
      <h3 className="mb-1 text-lg font-bold text-ink">{title}</h3>
      {children}
    </div>
  );
}

/* ---------- difficulty dots ---------- */
export function Difficulty({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`Difficulty ${level}/5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`h-1 w-3 rounded-[2px] ${i <= level ? "grad-bg" : "bg-wht/20"}`} />
      ))}
    </span>
  );
}

/* ---------- score badge ---------- */
export function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 4 ? "border-ok/35 bg-ok/10 text-ok" : score >= 3 ? "border-warn/35 bg-warn/10 text-warn" : "border-bad/35 bg-bad/10 text-bad";
  return <span className={`rounded-full border px-3 py-1 text-[12.5px] font-extrabold ${cls}`}>{score}/5</span>;
}
