/* KpNeutral.tsx — neutral key point badge */
import type { ReactNode } from "react";

export function KpNeutral({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-lg border border-line/10 bg-wht/10 px-2.5 py-1 text-[12.5px] font-semibold text-mut">
      {children}
    </span>
  );
}
