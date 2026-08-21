/* OptRow.tsx — option row with title/sub and right-side controls */
import type { ReactNode } from "react";

export function OptRow({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 py-3 last:border-0">
      <div>
        <div className="text-[14px] font-bold">{title}</div>
        <div className="text-[12px] text-fnt">{sub}</div>
      </div>
      {children}
    </div>
  );
}
