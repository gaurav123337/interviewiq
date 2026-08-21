import { useQuery } from "@tanstack/react-query";
import {
  adminQuestionQuality, adminFeedbackFeed, adminCodingQuality, adminCoachGaps,
  adminRagHealth, adminRagDocuments, adminRagWeeklyDigest, adminRagDomains, adminKbSuggestions,
  type QualityRow, type FeedbackFeedRow, type CodingQualityRow, type CoachGapRow,
  type RagHealthRow, type RagDocRow, type RagWeeklyDigest, type RagDomainRow, type KbSuggestionRow,
} from "../services/quality";
import { listPdfDocuments, type PdfDocumentRow } from "../services/admin";
import { adminListEntitlements, type AdminEntitlementRow } from "../services/entitlement";
import {
  adminListPayments, adminListSubscriptions,
  adminBillingActions, adminListCoupons,
  type AdminPaymentRow, type AdminSubscriptionRow, type AdminCoupon, type BillingActionRow,
} from "../services/billing";

/* ------------------------------------------------------------------ */
/* Query keys — stable references for cache invalidation               */
/* ------------------------------------------------------------------ */

export const qk = {
  quality: ["admin", "quality"] as const,
  feedback: ["admin", "feedback"] as const,
  coding: ["admin", "coding"] as const,
  coachGaps: ["admin", "coachGaps"] as const,
  ragHealth: ["admin", "ragHealth"] as const,
  ragDocs: ["admin", "ragDocs"] as const,
  ragDigest: ["admin", "ragDigest"] as const,
  ragDomains: ["admin", "ragDomains"] as const,
  kbSuggestions: ["admin", "kbSuggestions"] as const,
  pdfDocs: ["admin", "pdfDocs"] as const,
  entitlements: ["admin", "entitlements"] as const,
  payments: ["admin", "payments"] as const,
  subscriptions: ["admin", "subscriptions"] as const,
  billingAudit: ["admin", "billingAudit"] as const,
  coupons: ["admin", "coupons"] as const,
};

/* ------------------------------------------------------------------ */
/* Quality data hooks                                                  */
/* ------------------------------------------------------------------ */

export function useQualityRows() {
  return useQuery({
    queryKey: qk.quality,
    queryFn: () => adminQuestionQuality(),
    staleTime: 60_000,
  });
}

export function useFeedbackFeed() {
  return useQuery({
    queryKey: qk.feedback,
    queryFn: () => adminFeedbackFeed(50),
    staleTime: 60_000,
  });
}

export function useCodingQuality() {
  return useQuery({
    queryKey: qk.coding,
    queryFn: () => adminCodingQuality(),
    staleTime: 60_000,
  });
}

export function useCoachGaps() {
  return useQuery({
    queryKey: qk.coachGaps,
    queryFn: () => adminCoachGaps(),
    staleTime: 60_000,
  });
}

export function useRagHealth() {
  return useQuery({
    queryKey: qk.ragHealth,
    queryFn: () => adminRagHealth(),
    staleTime: 60_000,
  });
}

export function useRagDocs() {
  return useQuery({
    queryKey: qk.ragDocs,
    queryFn: () => adminRagDocuments(),
    staleTime: 60_000,
  });
}

export function useRagDigest() {
  return useQuery({
    queryKey: qk.ragDigest,
    queryFn: () => adminRagWeeklyDigest(),
    staleTime: 60_000,
  });
}

export function useRagDomains() {
  return useQuery({
    queryKey: qk.ragDomains,
    queryFn: () => adminRagDomains(),
    staleTime: 60_000,
  });
}

export function useKbSuggestions() {
  return useQuery({
    queryKey: qk.kbSuggestions,
    queryFn: () => adminKbSuggestions(),
    staleTime: 60_000,
  });
}

export function usePdfDocuments() {
  return useQuery({
    queryKey: qk.pdfDocs,
    queryFn: () => listPdfDocuments(),
    staleTime: 60_000,
  });
}

/* ------------------------------------------------------------------ */
/* Billing data hooks                                                  */
/* ------------------------------------------------------------------ */

export function useEntitlements() {
  return useQuery({
    queryKey: qk.entitlements,
    queryFn: () => adminListEntitlements(),
    staleTime: 30_000,
  });
}

export function usePayments() {
  return useQuery({
    queryKey: qk.payments,
    queryFn: () => adminListPayments(),
    staleTime: 30_000,
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: qk.subscriptions,
    queryFn: () => adminListSubscriptions(),
    staleTime: 30_000,
  });
}

export function useBillingAudit() {
  return useQuery({
    queryKey: qk.billingAudit,
    queryFn: () => adminBillingActions(50),
    staleTime: 30_000,
  });
}

export function useCoupons() {
  return useQuery({
    queryKey: qk.coupons,
    queryFn: () => adminListCoupons(),
    staleTime: 30_000,
  });
}

/* ------------------------------------------------------------------ */
/* Combined hook for QualitySection — fetches all quality data at once  */
/* ------------------------------------------------------------------ */

export interface QualityData {
  rows: QualityRow[];
  feed: FeedbackFeedRow[];
  coding: CodingQualityRow[];
  coachGaps: CoachGapRow[];
  ragRows: RagHealthRow[];
  ragDocs: RagDocRow[];
  ragDigest: RagWeeklyDigest | null;
  ragDomains: RagDomainRow[];
  kbSuggestions: KbSuggestionRow[];
  kbDocs: PdfDocumentRow[];
}

export function useAllQualityData() {
  const rows = useQualityRows();
  const feed = useFeedbackFeed();
  const coding = useCodingQuality();
  const coachGaps = useCoachGaps();
  const ragRows = useRagHealth();
  const ragDocs = useRagDocs();
  const ragDigest = useRagDigest();
  const ragDomains = useRagDomains();
  const kbSuggestions = useKbSuggestions();
  const kbDocs = usePdfDocuments();

  const isLoading = rows.isLoading || feed.isLoading || coding.isLoading ||
    coachGaps.isLoading || ragRows.isLoading || ragDocs.isLoading ||
    ragDigest.isLoading || ragDomains.isLoading || kbSuggestions.isLoading || kbDocs.isLoading;

  return {
    data: {
      rows: rows.data ?? [],
      feed: feed.data ?? [],
      coding: coding.data ?? [],
      coachGaps: coachGaps.data ?? [],
      ragRows: ragRows.data ?? [],
      ragDocs: ragDocs.data ?? [],
      ragDigest: ragDigest.data ?? null,
      ragDomains: ragDomains.data ?? [],
      kbSuggestions: kbSuggestions.data ?? [],
      kbDocs: kbDocs.data ?? [],
    } as QualityData,
    isLoading,
    refetch: () => {
      void rows.refetch();
      void feed.refetch();
      void coding.refetch();
      void coachGaps.refetch();
      void ragRows.refetch();
      void ragDocs.refetch();
      void ragDigest.refetch();
      void ragDomains.refetch();
      void kbSuggestions.refetch();
      void kbDocs.refetch();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Combined hook for BillingSection                                    */
/* ------------------------------------------------------------------ */

export interface BillingData {
  entitlements: AdminEntitlementRow[];
  payments: AdminPaymentRow[];
  subscriptions: AdminSubscriptionRow[];
  audit: BillingActionRow[];
  coupons: AdminCoupon[];
}

export function useAllBillingData() {
  const entitlements = useEntitlements();
  const payments = usePayments();
  const subscriptions = useSubscriptions();
  const audit = useBillingAudit();
  const coupons = useCoupons();

  const isLoading = entitlements.isLoading || payments.isLoading ||
    subscriptions.isLoading || audit.isLoading || coupons.isLoading;

  return {
    data: {
      entitlements: entitlements.data ?? [],
      payments: payments.data ?? [],
      subscriptions: subscriptions.data ?? [],
      audit: audit.data ?? [],
      coupons: coupons.data ?? [],
    } as BillingData,
    isLoading,
    refetch: () => {
      void entitlements.refetch();
      void payments.refetch();
      void subscriptions.refetch();
      void audit.refetch();
      void coupons.refetch();
    },
  };
}
