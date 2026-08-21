/* Drawer.tsx — portaled side panel */
import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

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
