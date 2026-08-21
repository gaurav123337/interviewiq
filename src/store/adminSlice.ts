import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { type RemoteConfig } from "../services/remoteConfig";
import { type AdminEntitlementRow } from "../services/entitlement";
import {
  type AdminPaymentRow,
  type AdminSubscriptionRow,
  type AdminCoupon,
  type BillingActionRow,
  type RefundPolicy,
  REFUND_POLICY_DEFAULTS,
} from "../services/billing";
import { type PolicyId, POLICY_DEFAULTS } from "../data/policies";

/* ------------------------------------------------------------------ */
/* Admin slice — shared state for ConfigSection + BillingSection      */
/* ------------------------------------------------------------------ */

export interface AdminState {
  /* ConfigSection */
  config: RemoteConfig | null;
  configBusy: boolean;
  vocabJson: string;
  brandJson: string;
  brandCo: string;
  brandAccent: string;
  brandFont: string;
  /* Job Feed config */
  jobsHours: number;
  jobsSources: string;
  enrProvider: string;
  enrCountry: string;
  enrCap: number;
  /* Frequency editor */
  freqCo: string | null;
  activeWeek: number | null;
  /* BillingSection */
  entitlements: AdminEntitlementRow[];
  payments: AdminPaymentRow[];
  subscriptions: AdminSubscriptionRow[];
  billingAudit: BillingActionRow[];
  coupons: AdminCoupon[];
  billingLoading: boolean;
  billingBusy: boolean;
  /* Grant form */
  cPlan: string;
  cDays: number;
  cPct: number;
  code: string;
  /* Coupon form */
  coCode: string;
  coPct: number;
  coMax: number;
  coExp: string;
  /* Per-row grant/discount */
  gPlan: string;
  gDays: number;
  dPct: number;
  dDays: number;
  open: Record<string, "grant" | "discount" | undefined>;
  /* Cancel/refund */
  cancelTarget: AdminSubscriptionRow | null;
  cancelReason: string;
  refundTarget: AdminPaymentRow | null;
  refundReason: string;
  refundAmount: string;
  refundOverride: boolean;
  /* Refund policy */
  policyDraft: RefundPolicy;
  presetsText: string;
  policyDocs: Record<PolicyId, string>;
}

const initialState: AdminState = {
  config: null,
  configBusy: false,
  vocabJson: "{}",
  brandJson: "{}",
  brandCo: "_default",
  brandAccent: "#4f46e5",
  brandFont: "system",
  jobsHours: 24,
  jobsSources: "",
  enrProvider: "none",
  enrCountry: "us",
  enrCap: 30,
  freqCo: null,
  activeWeek: null,
  entitlements: [],
  payments: [],
  subscriptions: [],
  billingAudit: [],
  coupons: [],
  billingLoading: true,
  billingBusy: false,
  cPlan: "monthly",
  cDays: 30,
  cPct: 0,
  code: "",
  coCode: "",
  coPct: 20,
  coMax: 0,
  coExp: "",
  gPlan: "monthly",
  gDays: 30,
  dPct: 30,
  dDays: 90,
  open: {},
  cancelTarget: null,
  cancelReason: "",
  refundTarget: null,
  refundReason: "",
  refundAmount: "",
  refundOverride: false,
  policyDraft: { ...REFUND_POLICY_DEFAULTS },
  presetsText: (REFUND_POLICY_DEFAULTS.reason_presets ?? []).join(", "),
  policyDocs: { ...POLICY_DEFAULTS },
};

export const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    /* Config */
    setConfig(state, action: PayloadAction<RemoteConfig | null>) {
      state.config = action.payload;
    },
    setConfigBusy(state, action: PayloadAction<boolean>) {
      state.configBusy = action.payload;
    },
    setVocabJson(state, action: PayloadAction<string>) {
      state.vocabJson = action.payload;
    },
    setBrandJson(state, action: PayloadAction<string>) {
      state.brandJson = action.payload;
    },
    setBrandCo(state, action: PayloadAction<string>) {
      state.brandCo = action.payload;
    },
    setBrandAccent(state, action: PayloadAction<string>) {
      state.brandAccent = action.payload;
    },
    setBrandFont(state, action: PayloadAction<string>) {
      state.brandFont = action.payload;
    },
    setJobsHours(state, action: PayloadAction<number>) {
      state.jobsHours = action.payload;
    },
    setJobsSources(state, action: PayloadAction<string>) {
      state.jobsSources = action.payload;
    },
    setEnrProvider(state, action: PayloadAction<string>) {
      state.enrProvider = action.payload;
    },
    setEnrCountry(state, action: PayloadAction<string>) {
      state.enrCountry = action.payload;
    },
    setEnrCap(state, action: PayloadAction<number>) {
      state.enrCap = action.payload;
    },
    setFreqCo(state, action: PayloadAction<string | null>) {
      state.freqCo = action.payload;
    },
    setActiveWeek(state, action: PayloadAction<number | null>) {
      state.activeWeek = action.payload;
    },
    /* Billing */
    setEntitlements(state, action: PayloadAction<AdminEntitlementRow[]>) {
      state.entitlements = action.payload;
    },
    setPayments(state, action: PayloadAction<AdminPaymentRow[]>) {
      state.payments = action.payload;
    },
    setSubscriptions(state, action: PayloadAction<AdminSubscriptionRow[]>) {
      state.subscriptions = action.payload;
    },
    setBillingAudit(state, action: PayloadAction<BillingActionRow[]>) {
      state.billingAudit = action.payload;
    },
    setCoupons(state, action: PayloadAction<AdminCoupon[]>) {
      state.coupons = action.payload;
    },
    setBillingLoading(state, action: PayloadAction<boolean>) {
      state.billingLoading = action.payload;
    },
    setBillingBusy(state, action: PayloadAction<boolean>) {
      state.billingBusy = action.payload;
    },
    setCPlan(state, action: PayloadAction<string>) {
      state.cPlan = action.payload;
    },
    setCDays(state, action: PayloadAction<number>) {
      state.cDays = action.payload;
    },
    setCPct(state, action: PayloadAction<number>) {
      state.cPct = action.payload;
    },
    setCode(state, action: PayloadAction<string>) {
      state.code = action.payload;
    },
    setCoCode(state, action: PayloadAction<string>) {
      state.coCode = action.payload;
    },
    setCoPct(state, action: PayloadAction<number>) {
      state.coPct = action.payload;
    },
    setCoMax(state, action: PayloadAction<number>) {
      state.coMax = action.payload;
    },
    setCoExp(state, action: PayloadAction<string>) {
      state.coExp = action.payload;
    },
    setGPlan(state, action: PayloadAction<string>) {
      state.gPlan = action.payload;
    },
    setGDays(state, action: PayloadAction<number>) {
      state.gDays = action.payload;
    },
    setDPct(state, action: PayloadAction<number>) {
      state.dPct = action.payload;
    },
    setDDays(state, action: PayloadAction<number>) {
      state.dDays = action.payload;
    },
    setOpen(state, action: PayloadAction<Record<string, "grant" | "discount" | undefined>>) {
      state.open = action.payload;
    },
    setCancelTarget(state, action: PayloadAction<AdminSubscriptionRow | null>) {
      state.cancelTarget = action.payload;
    },
    setCancelReason(state, action: PayloadAction<string>) {
      state.cancelReason = action.payload;
    },
    setRefundTarget(state, action: PayloadAction<AdminPaymentRow | null>) {
      state.refundTarget = action.payload;
    },
    setRefundReason(state, action: PayloadAction<string>) {
      state.refundReason = action.payload;
    },
    setRefundAmount(state, action: PayloadAction<string>) {
      state.refundAmount = action.payload;
    },
    setRefundOverride(state, action: PayloadAction<boolean>) {
      state.refundOverride = action.payload;
    },
    setPolicyDraft(state, action: PayloadAction<RefundPolicy>) {
      state.policyDraft = action.payload;
    },
    setPresetsText(state, action: PayloadAction<string>) {
      state.presetsText = action.payload;
    },
    setPolicyDocs(state, action: PayloadAction<Record<PolicyId, string>>) {
      state.policyDocs = action.payload;
    },
    /* Batch init from API response */
    initBillingData(
      state,
      action: PayloadAction<{
        entitlements: AdminEntitlementRow[];
        payments: AdminPaymentRow[];
        subscriptions: AdminSubscriptionRow[];
        audit: BillingActionRow[];
        coupons: AdminCoupon[];
      }>
    ) {
      state.entitlements = action.payload.entitlements;
      state.payments = action.payload.payments;
      state.subscriptions = action.payload.subscriptions;
      state.billingAudit = action.payload.audit;
      state.coupons = action.payload.coupons;
      state.billingLoading = false;
    },
  },
});

export const {
  setConfig, setConfigBusy, setVocabJson, setBrandJson, setBrandCo, setBrandAccent, setBrandFont,
  setJobsHours, setJobsSources, setEnrProvider, setEnrCountry, setEnrCap,
  setFreqCo, setActiveWeek,
  setEntitlements, setPayments, setSubscriptions, setBillingAudit, setCoupons,
  setBillingLoading, setBillingBusy,
  setCPlan, setCDays, setCPct, setCode,
  setCoCode, setCoPct, setCoMax, setCoExp,
  setGPlan, setGDays, setDPct, setDDays, setOpen,
  setCancelTarget, setCancelReason, setRefundTarget, setRefundReason, setRefundAmount, setRefundOverride,
  setPolicyDraft, setPresetsText, setPolicyDocs,
  initBillingData,
} = adminSlice.actions;
