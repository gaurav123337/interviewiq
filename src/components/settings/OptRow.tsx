import { memo, type ReactNode } from "react";

export const OptRow = memo(function OptRow({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 py-3.5 last:border-0">
      <div>
        <div className="text-[14.5px] font-bold">{title}</div>
        <div className="text-[12.5px] text-fnt">{sub}</div>
      </div>
      {children}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* AI Models per Feature section                                       */
/* ------------------------------------------------------------------ */
