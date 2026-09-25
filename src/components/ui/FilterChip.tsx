import type { ReactNode } from "react";

/** Toggleable pill used by the skill/filter chip rows (public Bank + admin lists).
    Active = filled gradient; inactive = ghost. */
export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12.5px] font-bold transition-all ${active ? "grad-bg border-transparent text-white shadow-[0_4px_12px_rgba(99,102,241,.4)]" : "border-line/15 bg-wht/5 text-mut hover:bg-wht/10 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
