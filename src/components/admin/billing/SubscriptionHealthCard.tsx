import { memo } from "react";
import { subscriptionSummary, fmtMinor } from "../../../services/billing";
import {cardCls} from "../../ui";

import type { AdminSubscriptionRow } from "../../../services/billing";

export const SubscriptionHealthCard = memo(function SubscriptionHealthCard({ subs }: { subs: AdminSubscriptionRow[] }) {
  const subsSummary = subscriptionSummary(subs);
  return (
    <div className={`${cardCls} p-5`}>
        <h3 className="text-[14.5px] font-extrabold">🔁 Subscription health</h3>
        <p className="mb-3 text-[12px] text-mut">From the subscriptions table — renewals estimate the next 30 days at catalog prices.</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Active</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{subsSummary.activeCount}</div>
            <div className="text-[11px] text-fnt">cancelled {subsSummary.cancelledCount}</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Renewing ≤ 30d</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{subsSummary.renewals30d}</div>
            <div className="text-[11px] text-fnt">≈ {fmtMinor(subsSummary.renewals30dMinor, "USD")}</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Expired</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{subsSummary.expiredCount}</div>
            <div className="text-[11px] text-fnt">no longer active</div>
          </div>
          <div className="rounded-xl border border-line/10 bg-deep/40 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Churn rate</div>
            <div className="mt-0.5 text-[17px] font-extrabold tabular-nums">{subsSummary.churnRate}%</div>
            <div className="text-[11px] text-fnt">cancelled ÷ decided</div>
          </div>
        </div>
      </div>

  );
});
