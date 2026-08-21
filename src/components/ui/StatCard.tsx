/* StatCard.tsx — stat card with icon, label, value, sub-text */
import { cardCls } from "./buttons";

export function StatCard({ icon, label, value, sub }: {
  icon: string; label: string; value: string | number; sub: string;
}) {
  return (
    <div className={`${cardCls} p-4 sm:p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-extrabold uppercase tracking-wider text-mut">{label}</span>
        <span className="text-[18px]">{icon}</span>
      </div>
      <div className="mt-1.5 text-[26px] font-extrabold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[12px] text-fnt">{sub}</div>
    </div>
  );
}
