/* Chip.tsx — colored badge for status, categories, levels */
import type { ReactNode } from "react";

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
