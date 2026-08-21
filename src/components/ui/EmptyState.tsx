/* EmptyState.tsx — empty state placeholder with icon */
import type { ReactNode } from "react";
import { cardCls } from "./buttons";

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className={`${cardCls} flex flex-col items-center px-5 py-16 text-center text-fnt`}>
      <div className="mb-3 text-[42px]">{icon}</div>
      <h3 className="mb-1 text-lg font-bold text-ink">{title}</h3>
      {children}
    </div>
  );
}
