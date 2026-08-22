/* Subscription summary and revenue analytics (pure functions, unit-tested) */

import { AdminPaymentRow } from "./payments";
import { AdminSubscriptionRow } from "./subscriptions";

/* Subscription summary (pure — unit-tested)                           */
/* ------------------------------------------------------------------ */

/* Catalog amounts (minor units) used for renewal estimates — mirror the
   server's PLAN_CATALOG defaults. */
const SUB_PLAN_AMOUNT_MINOR: Record<string, number> = { monthly: 900, yearly: 7900 };

export interface SubscriptionSummary {
  activeCount: number;
  cancelledCount: number;
  expiredCount: number;
  /** Active subscriptions whose next billing date falls within 30 days. */
  renewals30d: number;
  /** Estimated value of renewals30d (catalog prices). */
  renewals30dMinor: number;
  /** cancelled / (active + cancelled), rounded. 0 when no decided subs. */
  churnRate: number;
}

/** Aggregates the subscriptions table for the admin dashboard — how many
    active/cancelled subs, what's renewing this month, and the churn rate.
    Pure and deterministic so the numbers are unit-testable. */
export function subscriptionSummary(subs: AdminSubscriptionRow[]): SubscriptionSummary {
  const s: SubscriptionSummary = { activeCount: 0, cancelledCount: 0, expiredCount: 0, renewals30d: 0, renewals30dMinor: 0, churnRate: 0 };
  const now = Date.now();
  const soon = now + 30 * 86400000;
  for (const sub of subs) {
    if (sub.status === "active") {
      s.activeCount++;
      const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null;
      if (end && end > now && end <= soon) {
        s.renewals30d++;
        s.renewals30dMinor += SUB_PLAN_AMOUNT_MINOR[sub.plan] ?? 0;
      }
    } else if (sub.status === "cancelled") {
      s.cancelledCount++;
    } else if (sub.status === "expired") {
      s.expiredCount++;
    }
  }
  const decided = s.activeCount + s.cancelledCount;
  s.churnRate = decided > 0 ? Math.round((s.cancelledCount / decided) * 100) : 0;
  return s;
}

/* Revenue analytics (pure — unit-tested)                              */
/* ------------------------------------------------------------------ */

export interface RevenueSummary {
  paidCount: number;
  totalPaidMinor: number;
  refundedCount: number;
  refundedMinor: number;
  /** Recurring monthly revenue from active subscription payments
      (yearly = amount / 12). */
  mrrMinor: number;
  /** Distinct users with a paid subscription payment. */
  activeSubscriberUsers: number;
  oneTimeRevenueMinor: number;
  subscriptionRevenueMinor: number;
  byPlan: Record<string, { count: number; amountMinor: number }>;
  byProvider: Record<string, number>;
}

/** Aggregates confirmed payments into a revenue snapshot for the admin
    dashboard. Pure and deterministic so the numbers are unit-testable. */
export function revenueSummary(rows: AdminPaymentRow[]): RevenueSummary {
  const s: RevenueSummary = {
    paidCount: 0, totalPaidMinor: 0, refundedCount: 0, refundedMinor: 0,
    mrrMinor: 0, activeSubscriberUsers: 0, oneTimeRevenueMinor: 0, subscriptionRevenueMinor: 0,
    byPlan: {}, byProvider: {}
  };
  const subUsers = new Set<string>();
  for (const r of rows) {
    s.byProvider[r.provider] = (s.byProvider[r.provider] ?? 0) + 1;
    if (r.status === "refunded") {
      s.refundedCount++;
      s.refundedMinor += r.amountMinor;
      continue;
    }
    s.paidCount++;
    s.totalPaidMinor += r.amountMinor;
    s.byPlan[r.plan] = s.byPlan[r.plan] ?? { count: 0, amountMinor: 0 };
    s.byPlan[r.plan].count++;
    s.byPlan[r.plan].amountMinor += r.amountMinor;
    if (r.kind === "subscription") {
      s.subscriptionRevenueMinor += r.amountMinor;
      subUsers.add(r.userId);
      s.mrrMinor += r.plan === "yearly" ? Math.round(r.amountMinor / 12) : r.plan === "monthly" ? r.amountMinor : 0;
    } else {
      s.oneTimeRevenueMinor += r.amountMinor;
    }
  }
  s.activeSubscriberUsers = subUsers.size;
  return s;
}

