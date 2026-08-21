/* Kp.tsx — key point badge (hit/miss) */
import type { ReactNode } from "react";

export function Kp({ children, hit }: { children: ReactNode; hit?: boolean }) {
  return (
    <span className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold ${hit ? "border-ok/40 bg-ok/10 text-ok" : "border-bad/40 bg-bad/10 text-bad"}`}>
      {children}
    </span>
  );
}
