/* Modal.tsx — portaled overlay dialog */
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

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
