import { memo } from "react";
import { revenueSummary, fmtMinor } from "../../../services/billing";
import { Chip, cardCls } from "../../ui";

import type { AdminPaymentRow } from "../../../services/billing";

export const RevenueSnapshotCard = memo(function RevenueSnapshotCard({ payments }: { payments: AdminPaymentRow[] }) {
  const revenue = revenueSummary(payments);
  return (
    <div className={`${cardCls} p-5`}>
        <h3 className="text-[14.5px] font-extrabold">📈 Revenue snapshot</h3>
        <p className="mb-3 text-[12px] text-mut">Computed from confirmed payments. MRR counts recurring subscription revenue (yearly ÷ 12).</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Total paid</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{fmtMinor(revenue.totalPaidMinor, "USD")}</div>
            <div className="text-[11px] text-fnt">{revenue.paidCount} payments</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">MRR</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{fmtMinor(revenue.mrrMinor, "USD")}</div>
            <div className="text-[11px] text-fnt">{revenue.activeSubscriberUsers} subscriber{revenue.activeSubscriberUsers === 1 ? "" : "s"}</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">One-time</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{fmtMinor(revenue.oneTimeRevenueMinor, "USD")}</div>
            <div className="text-[11px] text-fnt">recurring {fmtMinor(revenue.subscriptionRevenueMinor, "USD")}</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Refunded</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{fmtMinor(revenue.refundedMinor, "USD")}</div>
            <div className="text-[11px] text-fnt">{revenue.refundedCount} payment{revenue.refundedCount === 1 ? "" : "s"}</div>
          </div>
        </div>
        {Object.keys(revenue.byPlan).length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {Object.entries(revenue.byPlan).map(([plan, v]) => (
              <Chip key={plan} tone="lvl">{plan} ×{v.count} · {fmtMinor(v.amountMinor, "USD")}</Chip>
            ))}
            {Object.entries(revenue.byProvider).map(([p, n]) => (
              <Chip key={p}>{p} ×{n}</Chip>
            ))}
          </div>
        )}
      </div>

  );
});
