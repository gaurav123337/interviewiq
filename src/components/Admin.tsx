import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LevelId } from "../types";
import { COMPANIES, FIELDS, LEVELS, companyById } from "../data";
import { codingProblemById } from "../data/coding";
import { COMPANY_FREQ, problemsForCompany } from "../data/codingCompanies";
import { cloudFnHeaders, getCloudState, subscribeCloud } from "../services/cloud";
import { getTeamsState, selectTeam, subscribeTeams, type TeamsState } from "../services/teams";
import { chat, aiAvailable } from "../ai";
import { draftIssues, findDuplicates, triageLevel, type DuplicateMatch } from "../services/duplicates";
import {
  adminCoachGaps, adminCodingQuality, adminFeedbackFeed, adminKbSuggestions, adminQuestionQuality,
  adminRagDocuments, adminRagDomains, adminRagHealth, adminRagWeeklyDigest, bestTuningCell, evaluateRagDigest,
  mergeQuality, ragHealthSummary, ragHistogram, simulateTuning, suggestHardFloor, touchQuestion,
  type CodingQualityRow, type CoachGapRow, type FeedbackFeedRow, type KbSuggestionRow, type QualityRow,
  type RagDocRow, type RagDomainRow, type RagHealthRow, type RagWeeklyDigest
} from "../services/quality";
import { amOwner, getAdminState, subscribeAdmin } from "../services/admin";
import { cleanTextToQuestions } from "../services/cleaner";
import { parseQuestionBatch } from "../services/import";
import { extractFileText } from "../services/pdf";
import {
  adminAuditLog, adminListUsers, adminMetrics, adminMissCandidates, adminSecurityStatus, adminSetMfaEnforced,
  batchDeleteQuestions, batchSetQuestionsPublished, createAnnouncement, createPdfDocument, createQuestion,
  deleteAnnouncement, deletePdfDocument, deleteQuestion, grantAdmin, listAdmins, listPdfChunks,
  getLastJobsFetchReport, listPdfDocuments, listQuestionAudit, revokeAdmin, saveJobSalaryEnrichment, saveRemoteConfig,
  setAnnouncementPublished, setQuestionPublished, updatePdfDocument, updateQuestion,
  type AdminAuditRow, type AdminMetrics, type AdminSecurityStatus, type AdminUserRow, type AuditEntry,
  type JobsFetchReport, type MissCandidate, type PdfDocumentRow
} from "../services/admin";
import { prepareChunks, reindexDocument } from "../services/indexer";
import {
  deleteScraperSource, getScraperSchedule, listScraperSources, runScraperNow, saveScraperSchedule,
  saveScraperSource, setScraperSourceEnabled, type RunResult, type ScraperSourceRow
} from "../services/scraper";
import { CONFIG } from "../config";
import { getCareerProfile, indiaDigest, lastJobsRefresh, listJobs, rankCompanies, recommendationsDigest, refreshJobs } from "../services/jobs";
import { applyDigest } from "../services/applyTrack";
import { getAnnouncements, getPublishedQuestions, getRemoteConfig, type RemoteConfig } from "../services/remoteConfig";
import {
  adminCreateGrant, adminIssueDiscount, adminListEntitlements, adminSetEntitlement, PLANS,
  type AdminEntitlementRow
} from "../services/entitlement";
import { REFUND_POLICY_DEFAULTS, adminBillingActions, adminCancelSubscription, adminCreateCoupon, adminListCoupons, adminListPayments, adminListSubscriptions, adminRefundPayment, adminSimulatePurchase, fmtMinor, getRefundPolicy, publishRefundPolicy, revenueSummary, subscriptionSummary, type AdminCoupon, type AdminPaymentRow, type AdminSubscriptionRow, type BillingActionRow, type RefundPolicy } from "../services/billing";
import { effectiveGroundingMinSim, effectiveHardFloor, getRagDigestOpts } from "../services/rag";
import { getPublishedPolicies, publishPolicies } from "../services/policies";
import { POLICY_DEFAULTS, POLICY_META, type PolicyId } from "../data/policies";
import { weekKey } from "../services/notifications";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
import { pendingCommunityResources, reviewResource, type ResourceRow } from "../services/resources";
import { adminDecisionProposal, adminPendingProposals, type UpdateProposalRow } from "../services/trendSignals";
import { fetchSecretStatus, sendTestEmail, type SecretStatusReport, type SecretStatusRow } from "../services/secrets";
import { getAiProviderConfig, saveAiProviderConfig, testAiProvider, type AiProviderStatus } from "../services/aiProvider";
import { getEdgeSecrets, saveEdgeSecret, APP_MANAGED_SECRETS, type EdgeSecretStatus } from "../services/edgeSecrets";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, btnSoft, cardCls, Chip, Modal, Seg, Switch } from "./ui";
import { ContentSection } from "./AdminContent";

type Section = "overview" | "users" | "announcements" | "questions" | "review" | "import" | "scraper" | "config" | "activity" | "quality" | "billing" | "teams" | "security" | "secrets" | "resources" | "trends" | "content";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📈" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "billing", label: "Billing", icon: "💰" },
  { id: "announcements", label: "Announcements", icon: "📣" },
  { id: "questions", label: "Question bank", icon: "📚" },
  { id: "review", label: "Review inbox", icon: "🛂" },
  { id: "import", label: "Auto-fill", icon: "⚡" },
  { id: "scraper", label: "Scraper", icon: "🕷️" },
  { id: "config", label: "Product config", icon: "🎛️" },
  { id: "activity", label: "Activity", icon: "🧾" },
  { id: "quality", label: "Quality", icon: "🔎" },
  { id: "teams", label: "Teams", icon: "🏢" },
  { id: "security", label: "Security", icon: "🔐" },
  { id: "secrets", label: "Secrets", icon: "🔑" },
  { id: "resources", label: "Resources", icon: "🔗" },
  { id: "trends", label: "Trends", icon: "📈" },
  { id: "content", label: "Content CMS", icon: "✍️" }
];

const FEATURE_LABELS: Record<string, string> = {
  paywall: "Freemium paywall (quotas + upsells)",
  roadmap: "Career roadmap",
  playground: "Code playground",
  jd: "Job-description tailoring",
  drill: "Drill mode"
};

/* Billing — server-verified Pro entitlements, grants, discounts and codes.
   All writes go through admin RPCs that enforce is_admin() server-side, so a
   non-admin can never self-grant. Grant Pro on a test account to try the
   gating end-to-end: sign in as that user and the paywall opens instantly. */
function BillingSection() {
  const [rows, setRows] = useState<AdminEntitlementRow[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [subs, setSubs] = useState<AdminSubscriptionRow[]>([]);
  const [audit, setAudit] = useState<BillingActionRow[]>([]);
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, "grant" | "discount" | undefined>>({});
  /* create-grant form */
  const [cPlan, setCPlan] = useState<string>("monthly");
  const [cDays, setCDays] = useState(30);
  const [cPct, setCPct] = useState(0);
  const [code, setCode] = useState<string>("");
  /* coupon form */
  const [coCode, setCoCode] = useState("");
  const [coPct, setCoPct] = useState(20);
  const [coMax, setCoMax] = useState(0);
  const [coExp, setCoExp] = useState("");
  /* per-row grant form */
  const [gPlan, setGPlan] = useState<string>("monthly");
  const [gDays, setGDays] = useState(30);
  /* per-row discount form */
  const [dPct, setDPct] = useState(30);
  const [dDays, setDDays] = useState(90);

  const load = () => {
    setLoading(true);
    void Promise.all([adminListEntitlements(), adminListPayments(), adminListSubscriptions(), adminBillingActions(50), adminListCoupons()])
      .then(([e, p, s, a, c]) => { setRows(e); setPayments(p); setSubs(s); setAudit(a); setCoupons(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
    void getRefundPolicy().then(p => { setPolicyDraft(p); setPresetsText((p.reason_presets ?? []).join(", ")); }).catch(() => {});
    void getPublishedPolicies().then(p => { if (Object.keys(p).length) setPolicyDocs({ ...POLICY_DEFAULTS, ...p }); }).catch(() => {});
  };
  useEffect(load, []);

  const revenue = useMemo(() => revenueSummary(payments), [payments]);
  const subsSummary = useMemo(() => subscriptionSummary(subs), [subs]);
  /* cancel-with-reason — row being cancelled + its reason input */
  const [cancelTarget, setCancelTarget] = useState<AdminSubscriptionRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundTarget, setRefundTarget] = useState<AdminPaymentRow | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundOverride, setRefundOverride] = useState(false);
  /* refund policy editor + enforcement preview */
  const [policyDraft, setPolicyDraft] = useState<RefundPolicy>({ ...REFUND_POLICY_DEFAULTS });
  const [presetsText, setPresetsText] = useState((REFUND_POLICY_DEFAULTS.reason_presets ?? []).join(", "));
  /* legal policy template editor (Terms / Privacy / Refunds / Shipping) */
  const [policyDocs, setPolicyDocs] = useState<Record<PolicyId, string>>({ ...POLICY_DEFAULTS });

  const createCoupon = async () => {
    if (!coCode.trim() || coPct < 1) { toast("Code and a 1–100% discount are required"); return; }
    setBusy(true);
    try {
      const code = await adminCreateCoupon(coCode, coPct, coMax, coExp ? new Date(coExp + "T23:59:59").toISOString() : undefined);
      toast(`🎟️ Coupon ${code} created — users can apply it at checkout`);
      setCoCode(""); setCoExp("");
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Create failed")); }
    finally { setBusy(false); }
  };

  const grant = async (u: AdminEntitlementRow) => {
    setBusy(true);
    try {
      await adminSetEntitlement(u.userId, "pro", gPlan, gPlan === "lifetime" ? null : new Date(Date.now() + gDays * 86400000).toISOString());
      toast(`💎 Granted Pro (${gPlan}) to ${u.email || u.userId.slice(0, 8)}`);
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Grant failed")); }
    finally { setBusy(false); }
  };

  const revoke = async (u: AdminEntitlementRow) => {
    setBusy(true);
    try {
      await adminSetEntitlement(u.userId, "free", null, null);
      toast(`⛔ Revoked Pro from ${u.email || u.userId.slice(0, 8)}`);
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Revoke failed")); }
    finally { setBusy(false); }
  };

  const simulate = async (u: AdminEntitlementRow) => {
    setBusy(true);
    try {
      const ext = await adminSimulatePurchase(u.userId, gPlan);
      toast(`🪙 Simulated ${gPlan} purchase for ${u.email || u.userId.slice(0, 8)} (${ext}) — same grant path as a real webhook`);
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Simulate failed")); }
    finally { setBusy(false); }
  };

  const cancelSub = async (s: AdminSubscriptionRow) => {
    setBusy(true);
    try {
      const r = await adminCancelSubscription(s.providerSubscriptionId, s.userId, cancelReason);
      toast(`🔁 Cancelled ${s.plan} subscription for ${s.email || s.userId.slice(0, 8)} — access stays until ${r.currentPeriodEnd ? new Date(r.currentPeriodEnd).toLocaleDateString() : "period end"}`);
      setCancelTarget(null); setCancelReason("");
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Cancel failed")); }
    finally { setBusy(false); }
  };

  /* refund policy preview — mirrors the server's check (server stays authoritative) */
  const policyDecision = (p: AdminPaymentRow) => {
    const graceDays = policyDraft.grace_days ?? REFUND_POLICY_DEFAULTS.grace_days ?? 7;
    const max = policyDraft.max_refunds_per_user ?? REFUND_POLICY_DEFAULTS.max_refunds_per_user ?? 3;
    const refundCount = payments.filter(x => x.userId === p.userId && x.status === "refunded").length;
    const ageDays = Math.max(0, (Date.now() - new Date(p.createdAt).getTime()) / 86_400_000);
    const withinGrace = ageDays <= graceDays;
    return { withinGrace, refundCount, max, graceDays, blocked: max > 0 && refundCount >= max && !withinGrace && !refundOverride };
  };

  const refund = async (p: AdminPaymentRow) => {
    setBusy(true);
    try {
      const amt = parseFloat(refundAmount);
      const amountMinor = Number.isFinite(amt) && amt > 0 ? Math.round(amt * 100) : undefined;
      const r = await adminRefundPayment(p.providerPaymentId, refundReason, amountMinor);
      toast(`💸 Refunded ${fmtMinor(r.amountMinor ?? p.amountMinor, p.currency)} ${p.plan} for ${p.email || p.userId.slice(0, 8)} — ${r.note}${r.emailSent ? " 📧 user notified" : ""}`);
      setRefundTarget(null); setRefundReason(""); setRefundOverride(false);
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Refund failed")); }
    finally { setBusy(false); }
  };

  const savePolicy = async () => {
    setBusy(true);
    try {
      const next: RefundPolicy = {
        grace_days: Math.max(0, Number(policyDraft.grace_days) || 0),
        max_refunds_per_user: Math.max(0, Number(policyDraft.max_refunds_per_user) || 0),
        reason_presets: presetsText.split(",").map(s => s.trim()).filter(Boolean)
      };
      await publishRefundPolicy(next);
      setPolicyDraft(next);
      toast("📋 Refund policy published — pay-refund enforces it on the next refund");
    } catch (e) { toast("✗ " + ((e as Error).message || "Publish failed")); }
    finally { setBusy(false); }
  };

  const savePolicies = async () => {
    setBusy(true);
    try {
      await publishPolicies(policyDocs);
      toast("⚖️ Legal pages published — public site now shows the edited templates");
    } catch (e) { toast("✗ " + ((e as Error).message || "Publish failed")); }
    finally { setBusy(false); }
  };

  const discount = async (u: AdminEntitlementRow) => {
    setBusy(true);
    try {
      await adminIssueDiscount(u.userId, dPct, dDays);
      toast(dPct > 0 ? `🏷️ Issued −${dPct}% for ${dDays}d to ${u.email || u.userId.slice(0, 8)}` : "Discount cleared");
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Discount failed")); }
    finally { setBusy(false); }
  };

  const createCode = async () => {
    setBusy(true);
    try {
      const c = await adminCreateGrant(cPlan, cDays, cPct);
      setCode(c);
      toast("🎟️ Grant code created — copy it to your user");
    } catch (e) { toast("✗ " + ((e as Error).message || "Create failed")); }
    finally { setBusy(false); }
  };

  const planLabel = (p: string | null) => (PLANS as readonly { id: string; label: string }[]).find(x => x.id === p)?.label ?? p ?? "—";

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">💰 Billing — server-verified Pro</h2>
        <p className="mt-1 text-[12.5px] text-mut">
          Pro is an <span className="font-bold">account property</span>, not a local flag: only admins (and single-use grant codes)
          can write it, and the app checks it on every sign-in. Grant Pro to a test account to try the gating end-to-end —
          sign in as that user and the paywall opens instantly; revoke it and the limits come right back.
        </p>
      </div>

      {/* create a shareable grant code */}
      <div className={`${cardCls} p-5`}>
        <h3 className="text-[14.5px] font-extrabold">🎟️ Create a grant code</h3>
        <p className="mb-3 text-[12px] text-mut">Single-use, server-verified. The user signs in and redeems it in Settings — no storefront needed.</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <select value={cPlan} onChange={e => setCPlan(e.target.value)} className="inp w-32">
            {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            days
            <input type="number" min={1} value={cDays} onChange={e => setCDays(Math.max(1, Number(e.target.value) || 30))} className="inp w-20 py-1.5 text-center" />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            −% off
            <input type="number" min={0} max={100} value={cPct} onChange={e => setCPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="inp w-20 py-1.5 text-center" />
          </label>
          <button className={btnPrimary + btnSm} disabled={busy} onClick={createCode}>Create code</button>
        </div>
        {code && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-3 py-2">
            <span className="font-mono text-[13px] font-extrabold">{code}</span>
            <button
              className={btnGhost + btnSm}
              onClick={() => { navigator.clipboard?.writeText(code).then(() => toast("📋 Copied"), () => {}); }}
            >
              Copy
            </button>
            <button className={btnGhost + btnSm} onClick={() => setCode("")}>✕</button>
          </div>
        )}
      </div>

      {/* revenue snapshot — the storefront's scoreboard */}
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

      {/* subscription health — active/cancelled, renewals, churn */}
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

      {/* reusable coupon codes — storefront discount codes */}
      <div className={`${cardCls} p-5`}>
        <h3 className="text-[14.5px] font-extrabold">🎟️ Coupon codes</h3>
        <p className="mb-3 text-[12px] text-mut">Reusable discount codes users apply at checkout (LAUNCH20…). Usage is consumed only when a payment confirms — an abandoned checkout doesn't burn a use.</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={coCode}
            onChange={e => setCoCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH20"
            className="inp w-36 font-mono uppercase"
          />
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            −%
            <input type="number" min={1} max={100} value={coPct} onChange={e => setCoPct(Math.max(1, Math.min(100, Number(e.target.value) || 20)))} className="inp w-20 py-1.5 text-center" />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            max uses (0 = ∞)
            <input type="number" min={0} value={coMax} onChange={e => setCoMax(Math.max(0, Number(e.target.value) || 0))} className="inp w-20 py-1.5 text-center" />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            expires
            <input type="date" value={coExp} onChange={e => setCoExp(e.target.value)} className="inp py-1.5" />
          </label>
          <button className={btnPrimary + btnSm} disabled={busy || !coCode.trim() || coPct < 1} onClick={() => void createCoupon()}>Create</button>
        </div>
        {coupons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {coupons.map(c => (
              <div key={c.code} className="flex items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-3 py-1.5 text-[12px]">
                <span className="font-mono font-extrabold">{c.code}</span>
                <Chip tone="lvl">−{c.discountPct}%</Chip>
                <Chip tone={c.maxUses > 0 && c.usedCount >= c.maxUses ? "bad" : "default"}>{c.usedCount}/{c.maxUses || "∞"}</Chip>
                {c.expiresAt && <Chip tone={new Date(c.expiresAt) < new Date() ? "bad" : "default"}>until {new Date(c.expiresAt).toLocaleDateString()}</Chip>}
                <button
                  className={btnGhost + btnSm}
                  title="Copy code"
                  onClick={() => { navigator.clipboard?.writeText(c.code).then(() => toast(`📋 ${c.code} copied`), () => {}); }}
                >
                  📋
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* per-user grants + discounts */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">👥 Entitlements ({rows.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line/10 bg-wht/[.04] text-[11px] uppercase tracking-wider text-mut">
                <th className="px-4 py-2.5 font-bold">User</th>
                <th className="px-3 py-2.5 font-bold">Tier</th>
                <th className="px-3 py-2.5 font-bold">Plan</th>
                <th className="px-3 py-2.5 font-bold">Expires</th>
                <th className="px-3 py-2.5 font-bold">Discount</th>
                <th className="px-3 py-2.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-mut">No users yet — they appear after the first sign-up.</td></tr>
              )}
              {rows.map(u => (
                <tr key={u.userId} className="border-b border-line/5 align-top last:border-0 hover:bg-wht/5">
                  <td className="px-4 py-3">
                    <div className="font-bold">{u.email || "—"}</div>
                    <div className="text-[11px] text-fnt">{u.userId.slice(0, 8)}… · {u.source ?? "none"}</div>
                  </td>
                  <td className="px-3 py-3">
                    {u.active ? <Chip tone="ok">PRO</Chip> : <Chip>free</Chip>}
                  </td>
                  <td className="px-3 py-3">{u.tier === "pro" ? planLabel(u.plan) : "—"}</td>
                  <td className="px-3 py-3 text-[12px] text-fnt">
                    {u.tier === "pro" ? (u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : "never") : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {u.discountPct > 0 ? (
                      <Chip tone="lvl">−{u.discountPct}%{u.discountExpiresAt ? ` · ${new Date(u.discountExpiresAt).toLocaleDateString()}` : ""}</Chip>
                    ) : <span className="text-[12px] text-fnt">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {u.active ? (
                        <button className={btnDanger + btnSm} disabled={busy} onClick={() => revoke(u)}>⛔ Revoke</button>
                      ) : (
                        <button className={btnOk + btnSm} disabled={busy} onClick={() => setOpen(o => ({ ...o, [u.userId]: o[u.userId] === "grant" ? undefined : "grant" }))}>
                          💎 Grant Pro
                        </button>
                      )}
                      <button className={btnGhost + btnSm} disabled={busy} onClick={() => setOpen(o => ({ ...o, [u.userId]: o[u.userId] === "discount" ? undefined : "discount" }))}>
                        🏷️ Discount
                      </button>
                      <button className={btnGhost + btnSm} disabled={busy} onClick={() => simulate(u)} title="Simulate a confirmed purchase — same apply_purchase grant path as the real webhook">
                        🪙 Sim purchase
                      </button>
                    </div>
                    {open[u.userId] === "grant" && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <select value={gPlan} onChange={e => setGPlan(e.target.value)} className="inp w-28 py-1 text-[12px]">
                          {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                        <input type="number" min={1} value={gDays} onChange={e => setGDays(Math.max(1, Number(e.target.value) || 30))} className="inp w-16 py-1 text-center text-[12px]" title="days (lifetime ignores this)" />
                        <button className={btnOk + btnSm} disabled={busy} onClick={() => grant(u)}>Grant</button>
                      </div>
                    )}
                    {open[u.userId] === "discount" && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <input type="number" min={0} max={100} value={dPct} onChange={e => setDPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="inp w-16 py-1 text-center text-[12px]" title="percent off" />
                        <input type="number" min={1} value={dDays} onChange={e => setDDays(Math.max(1, Number(e.target.value) || 90))} className="inp w-16 py-1 text-center text-[12px]" title="days the discount is valid" />
                        <button className={btnGhost + btnSm} disabled={busy} onClick={() => discount(u)}>Apply</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* subscriptions — every provider subscription across users */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">🔁 Subscriptions ({subs.length})</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Active and cancelled provider subscriptions. Cancelling stops future billing at the period end — the user keeps Pro until then (verified server-side; the provider API is called only when the provider keys are configured).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line/10 bg-wht/[.04] text-[11px] uppercase tracking-wider text-mut">
                <th className="px-4 py-2.5 font-bold">User</th>
                <th className="px-3 py-2.5 font-bold">Plan</th>
                <th className="px-3 py-2.5 font-bold">Provider</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Next billing date</th>
                <th className="px-3 py-2.5 font-bold">Created</th>
                <th className="px-4 py-2.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-mut">No subscriptions yet — they appear after the first recurring checkout (or a 🔁 sub simulate) completes.</td></tr>
              )}
              {subs.map((s, i) => (
                <tr key={i} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                  <td className="px-4 py-3">
                    <div className="font-bold">{s.email || "—"}</div>
                    <div className="text-[11px] text-fnt">{s.userId.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-3 font-bold capitalize">{s.plan}</td>
                  <td className="px-3 py-3"><Chip>{s.provider}</Chip></td>
                  <td className="px-3 py-3">
                    <Chip tone={s.status === "active" ? "ok" : s.status === "cancelled" ? "warn" : "bad"}>{s.status}</Chip>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-fnt">
                    {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-fnt">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {s.status === "active" && cancelTarget?.providerSubscriptionId === s.providerSubscriptionId ? (
                      <div className="flex flex-col gap-1.5">
                        <input
                          value={cancelReason}
                          onChange={e => setCancelReason(e.target.value)}
                          placeholder="Reason (recorded in the audit trail)"
                          className="inp py-1 text-[12px]"
                          autoFocus
                        />
                        <div className="flex gap-1.5">
                          <button className={btnDanger + btnSm} disabled={busy} onClick={() => cancelSub(s)}>Confirm cancel</button>
                          <button className={btnGhost + btnSm} disabled={busy} onClick={() => { setCancelTarget(null); setCancelReason(""); }}>Back</button>
                        </div>
                      </div>
                    ) : s.status === "active" ? (
                      <button
                        className={btnDanger + btnSm}
                        disabled={busy}
                        onClick={() => { setCancelTarget(s); setCancelReason(""); }}
                        title="Cancel at period end — the user keeps Pro until the next billing date"
                      >
                        🔁 Cancel
                      </button>
                    ) : <span className="text-[12px] text-fnt">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* refund policy — grace window + per-user cap + reason presets */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">📋 Refund policy</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Purchases inside the grace window always refund; outside it, a per-user refund cap applies unless the admin overrides. pay-refund enforces this server-side — no deploy needed.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Grace window (days)</span>
            <input type="number" min={0} className="inp" value={policyDraft.grace_days ?? 0} onChange={e => setPolicyDraft({ ...policyDraft, grace_days: Number(e.target.value) || 0 })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Max refunds per user</span>
            <input type="number" min={0} className="inp" value={policyDraft.max_refunds_per_user ?? 0} onChange={e => setPolicyDraft({ ...policyDraft, max_refunds_per_user: Number(e.target.value) || 0 })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Reason presets (comma-separated)</span>
            <input className="inp" value={presetsText} onChange={e => setPresetsText(e.target.value)} placeholder="Duplicate purchase, Requested by user, …" />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line/10 px-5 py-3.5">
          <span className="text-[11.5px] text-fnt">0 = unlimited. Presets appear as a picker in the refund form.</span>
          <button className={btnPrimary + btnSm} onClick={savePolicy} disabled={busy}>📋 Publish policy</button>
        </div>
      </div>

      {/* legal & policies — the four provider-required pages, editable templates */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14.5px] font-extrabold">⚖️ Legal &amp; Policies</h3>
            <span className="text-[11.5px] font-bold text-ok">✓ 4/4 published</span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-fnt">Terms, Privacy, Refund &amp; Cancellation and Shipping are the pages payment providers require before international payments can be enabled. Edit the templates and publish — no deploy. The public site shows these at the landing footer → Terms / Privacy / Refunds / Shipping.</p>
        </div>
        <div className="grid gap-4 p-5">
          {POLICY_META.map(m => (
            <div key={m.id} className="rounded-xl border border-line/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-extrabold">{m.icon} {m.title}</span>
                <button
                  className="rounded-lg border border-line/15 bg-wht/10 px-2.5 py-1 text-[11px] font-bold text-mut transition-all hover:bg-wht/20 hover:text-ink"
                  onClick={() => setPolicyDocs(d => ({ ...d, [m.id]: POLICY_DEFAULTS[m.id] }))}
                >↺ Reset to default</button>
              </div>
              <textarea
                className="inp mt-2 h-40 w-full resize-y font-mono text-[12px] leading-relaxed"
                value={policyDocs[m.id]}
                onChange={e => setPolicyDocs(d => ({ ...d, [m.id]: e.target.value }))}
              />
              <p className="mt-1 text-[10.5px] text-mut">Placeholders {"{{company}}"}, {"{{url}}"} and {"{{email}}"} are filled automatically on the public page.</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line/10 px-5 py-3.5">
          <span className="text-[11.5px] text-fnt">Live at https://gaurav123337.github.io/interviewiq — footer → Terms / Privacy / Refunds / Shipping.</span>
          <button className={btnPrimary + btnSm} onClick={savePolicies} disabled={busy}>⚖️ Publish legal pages</button>
        </div>
      </div>

      {/* payments — every confirmed provider purchase */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">🧾 Payments ({payments.length})</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Confirmed purchases recorded by the pay-webhook function after signature verification.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line/10 bg-wht/[.04] text-[11px] uppercase tracking-wider text-mut">
                <th className="px-4 py-2.5 font-bold">User</th>
                <th className="px-3 py-2.5 font-bold">Provider</th>
                <th className="px-3 py-2.5 font-bold">Plan</th>
                <th className="px-3 py-2.5 font-bold">Amount</th>
                <th className="px-3 py-2.5 font-bold">Discount</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Date</th>
                <th className="px-4 py-2.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-mut">No confirmed payments yet — they appear after the first real purchase (or a 🪙 Sim purchase) completes.</td></tr>
              )}
              {payments.map((p, i) => (
                <tr key={i} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                  <td className="px-4 py-3">
                    <div className="font-bold">{p.email || "—"}</div>
                    <div className="text-[11px] text-fnt">{p.userId.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-3"><Chip>{p.provider}</Chip></td>
                  <td className="px-3 py-3 font-bold capitalize">{p.plan}</td>
                  <td className="px-3 py-3 font-bold tabular-nums">{fmtMinor(p.amountMinor, p.currency)}</td>
                  <td className="px-3 py-3">{p.discountPct > 0 ? <Chip tone="lvl">−{p.discountPct}%</Chip> : "—"}</td>
                  <td className="px-3 py-3">
                    <Chip tone={p.status === "paid" ? "ok" : "warn"}>{p.status}</Chip>
                    {p.kind === "subscription" && <Chip tone="lvl">🔁 sub</Chip>}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-fnt">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {p.status === "paid" && refundTarget?.providerPaymentId === p.providerPaymentId ? (
                      <div className="flex w-[220px] flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" min={0.01} max={(p.amountMinor / 100).toFixed(2)} step={0.01}
                            value={refundAmount}
                            onChange={e => setRefundAmount(e.target.value)}
                            placeholder={(p.amountMinor / 100).toFixed(2)}
                            className="inp py-1 text-[12px]"
                          />
                          <span className="whitespace-nowrap text-[10.5px] text-fnt">of {fmtMinor(p.amountMinor, p.currency)}</span>
                        </div>
                        <input
                          value={refundReason}
                          list="refund-reasons"
                          onChange={e => setRefundReason(e.target.value)}
                          placeholder="Reason (audit trail)"
                          className="inp py-1 text-[12px]"
                          autoFocus
                        />
                        <datalist id="refund-reasons">
                          {(policyDraft.reason_presets ?? []).map(r => <option key={r} value={r} />)}
                        </datalist>
                        {(() => { const d = policyDecision(p); return d.blocked ? (
                          <label className="flex cursor-pointer items-start gap-1.5 text-[11px] leading-snug text-mut">
                            <input type="checkbox" className="mt-0.5" checked={refundOverride} onChange={e => setRefundOverride(e.target.checked)} />
                            Override policy cap — already {d.refundCount} refund{d.refundCount === 1 ? "" : "s"}, outside the {d.graceDays}-day grace window
                          </label>
                        ) : null; })()}
                        <div className="flex gap-1.5">
                          <button className={btnDanger + btnSm} disabled={busy} onClick={() => refund(p)}>Confirm refund</button>
                          <button className={btnGhost + btnSm} disabled={busy} onClick={() => { setRefundTarget(null); setRefundReason(""); setRefundOverride(false); }}>Back</button>
                        </div>
                      </div>
                    ) : p.status === "paid" ? (
                      <button
                        className={btnDanger + btnSm}
                        disabled={busy}
                        onClick={() => { setRefundTarget(p); setRefundReason(""); setRefundAmount(""); setRefundOverride(false); }}
                        title="Refund — full or partial; calls the provider when its keys are configured, then marks it refunded and subtracts the plan's days"
                      >
                        💸 Refund
                      </button>
                    ) : <span className="text-[12px] text-fnt">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* audit trail — who did what, when */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">📜 Billing audit trail</h3>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {audit.length === 0 && (
            <p className="px-5 py-8 text-center text-mut">No billing actions yet — grants, revokes, discounts, codes, redeems and purchases all land here.</p>
          )}
          {audit.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 border-b border-line/5 px-5 py-2.5 text-[12.5px] last:border-0">
              <Chip tone={a.action === "purchase" ? "ok" : a.action === "revoke" ? "bad" : a.action === "discount" ? "lvl" : "default"}>{a.action}</Chip>
              <span className="min-w-[140px] flex-1 font-bold">{a.email || a.userId?.slice(0, 8) || "system"}</span>
              {a.detail && <span className="font-mono text-[11px] text-fnt">{JSON.stringify(a.detail).slice(0, 120)}</span>}
              <span className="text-[11px] text-fnt">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Admin() {
  const [admin, setAdmin] = useState(getAdminState());
  const [cloud, setCloud] = useState(getCloudState());
  const [teamState, setTeamState] = useState<TeamsState>(() => getTeamsState());
  const [section, setSection] = useState<Section>("overview");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [announcements, setAnnouncements] = useState(getAnnouncements());
  const [questions, setQuestions] = useState(getPublishedQuestions());
  const [config, setConfig] = useState<RemoteConfig>(() => getRemoteConfig());

  useEffect(() => subscribeAdmin(setAdmin), []);
  useEffect(() => subscribeCloud(setCloud), []);
  useEffect(() => subscribeTeams(setTeamState), []);

  const load = async () => {
    setLoading(true);
    try {
      const [m, u, a] = await Promise.all([adminMetrics(), adminListUsers(), listAdmins()]);
      setMetrics(m); setUsers(u); setAdmins(a);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load admin data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (admin.isAdmin) void load(); }, [admin.isAdmin]);
  useEffect(() => { setAnnouncements(getAnnouncements()); }, [section]);
  useEffect(() => { setQuestions(getPublishedQuestions()); }, [section]);

  if (!admin.ready) {
    return (
      <div className="anim-view mx-auto max-w-[760px] pt-16 text-center">
        <div className="mb-4 text-[44px]">🛡️</div>
        <h1 className="text-2xl font-extrabold">Checking admin access…</h1>
      </div>
    );
  }

  if (!admin.isAdmin) {
    return (
      <div className="anim-view mx-auto max-w-[560px] pt-16 text-center">
        <div className="mb-4 text-[44px]">🔒</div>
        <h1 className="text-2xl font-extrabold">Admin only</h1>
        <p className="mx-auto mt-2 max-w-[420px] text-[14.5px] text-mut">
          {cloud.user
            ? <>You're signed in as <span className="font-bold text-ink">{cloud.user.email}</span>, but that account isn't on the admin allow-list.</>
            : "Sign in with an admin account to open the dashboard."}
        </p>
        {!cloud.user && (
          <p className="mx-auto mt-4 max-w-[420px] rounded-xl border border-line/10 bg-wht/5 px-4 py-3 text-[12.5px] text-mut">
            💡 Sign in via <span className="font-bold text-ink">Settings → Cloud sync</span> with an allow-listed admin email, then come back here.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="anim-view mx-auto max-w-[1100px] overflow-x-hidden">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🛡️ Admin</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Product <span className="grad-text">command center</span>.</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">Users, metrics, releases, question-bank updates and feature toggles — published instantly to every client.</p>
      </div>

      <div className="mt-6 flex justify-center">
        <Seg options={SECTIONS.map(s => ({ value: s.id, label: `${s.icon} ${s.label}` }))} value={section} onChange={v => setSection(v as Section)} />
      </div>

      <div className="mt-6">
        {section === "overview" && <Overview metrics={metrics} loading={loading} onOpenSecrets={() => setSection("secrets")} />}
        {section === "users" && <Users users={users} admins={admins} busy={busy} setBusy={setBusy} onChanged={load} />}
        {section === "announcements" && (
          <Announcements list={announcements} busy={busy} setBusy={setBusy} onChanged={async () => { setAnnouncements(getAnnouncements()); }} />
        )}
        {section === "questions" && (
          <Questions list={questions} busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
        )}
        {section === "review" && (
          <ReviewInbox list={questions} busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
        )}
        {section === "import" && (
          <AutoFill busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />
        )}
        {section === "scraper" && <ScraperSection busy={busy} setBusy={setBusy} />}
        {section === "config" && <ConfigSection config={config} setConfig={setConfig} busy={busy} setBusy={setBusy} />}
        {section === "activity" && <Activity busy={busy} setBusy={setBusy} />}
        {section === "billing" && <BillingSection />}
        {section === "quality" && (
          <QualitySection
            busy={busy}
            setBusy={setBusy}
            onApplyHardFloor={v => {
              setConfig(c => ({ ...c, rag: { ...c.rag, hardFloor: v } }));
              setSection("config");
              toast(`🎚️ Hard floor staged at ${v.toFixed(2)} — hit “Publish config to all clients” to ship it`);
            }}
            onStageTuning={(minSim, hardFloor) => {
              setConfig(c => ({ ...c, rag: { ...c.rag, minSim, hardFloor } }));
              toast(`🎚️ Playground pick staged — cutoff ${minSim.toFixed(2)}, hard floor ${hardFloor.toFixed(2)}. Publish config to ship it.`);
            }}
          />
        )}
        {section === "teams" && <AdminTeams teamState={teamState} />}
        {section === "security" && <SecuritySection />}
        {section === "secrets" && <SecretsSection />}
        {section === "resources" && <ResourcesSection />}
        {section === "trends" && <TrendsSection />}
        {section === "content" && <ContentSection />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview — business KPIs                                            */
/* ------------------------------------------------------------------ */

function Overview({ metrics, loading, onOpenSecrets }: { metrics: AdminMetrics | null; loading: boolean; onOpenSecrets: () => void }) {
  if (loading && !metrics) {
    return <div className="text-center text-mut"><span className="spinner inline-block" /> Loading metrics…</div>;
  }
  const m = metrics ?? {
    totalUsers: 0, newThisWeek: 0, activeToday: 0, active7d: 0, proUsers: 0,
    totalSessions: 0, sessions7d: 0, aiCalls7d: 0, events7d: 0
  };
  const cards = [
    { label: "Total users", value: m.totalUsers, icon: "👥", sub: `${m.newThisWeek} new this week` },
    { label: "Active today", value: m.activeToday, icon: "⚡", sub: `${m.active7d} active in 7 days` },
    { label: "Pro users", value: m.proUsers, icon: "💎", sub: m.totalUsers ? `${Math.round((m.proUsers / m.totalUsers) * 100)}% conversion` : "no users yet" },
    { label: "Sessions (7d)", value: m.sessions7d, icon: "🎯", sub: `${m.totalSessions} all time` },
    { label: "AI calls (7d)", value: m.aiCalls7d, icon: "✨", sub: `${m.events7d} events tracked` },
    { label: "Engagement", value: m.totalUsers ? Math.round((m.active7d / m.totalUsers) * 100) + "%" : "—", icon: "📈", sub: "active 7d / total" }
  ];
  return (
    <div className="space-y-4">
      <SecretGapsBanner onOpen={onOpenSecrets} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {cards.map(c => (
          <div key={c.label} className={`${cardCls} p-4 sm:p-5`}>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold uppercase tracking-wider text-mut">{c.label}</span>
              <span className="text-[18px]">{c.icon}</span>
            </div>
            <div className="mt-1.5 text-[26px] font-extrabold tabular-nums">{c.value}</div>
            <div className="mt-0.5 text-[12px] text-fnt">{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SecretGapsBanner — missing required function secrets surfaced on the */
/* Overview so setup gaps are visible without opening the Secrets tab. */
/* ------------------------------------------------------------------ */

function SecretGapsBanner({ onOpen }: { onOpen: () => void }) {
  const [report, setReport] = useState<SecretStatusReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSecretStatus()
      .then(r => { if (alive) setReport(r); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  /* function not deployed yet — the Secrets tab explains how to deploy it */
  if (failed || !report || report.summary.missingRequired === 0) return null;

  return (
    <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-[12.5px]">
      <span className="font-bold text-warn">
        ⚠️ {report.summary.missingRequired} required function secret{report.summary.missingRequired === 1 ? "" : "s"} missing:{" "}
      </span>
      <span className="font-mono font-bold text-ink">{report.summary.missingRequiredNames.join(", ")}</span>
      <span className="text-mut"> — emails answer sent:false, crons 401, verdicts stay pending.</span>{" "}
      <button className="font-bold text-acctxt underline" onClick={onOpen}>Review in Secrets →</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Users — directory + status + plans + admin grant                    */
/* ------------------------------------------------------------------ */

function Users({ users, admins, busy, setBusy, onChanged }: {
  users: AdminUserRow[]; admins: string[]; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [grantEmail, setGrantEmail] = useState("");
  const [billingUser, setBillingUser] = useState<{ id: string; email: string } | null>(null);
  /* only the product owner can grant/revoke admin — other admins just watch */
  const owner = amOwner();
  const ownerEmail = (CONFIG.ownerEmail ?? "").toLowerCase();

  const doGrant = async () => {
    if (!grantEmail.trim()) { toast("Enter an email"); return; }
    setBusy(true);
    try { await grantAdmin(grantEmail); toast("✅ Admin granted"); setGrantEmail(""); await onChanged(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const doRevoke = async (email: string) => {
    setBusy(true);
    try { await revokeAdmin(email); toast("Admin revoked"); await onChanged(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const status = (u: AdminUserRow): { label: string; tone: "ok" | "warn" | "default" } => {
    if (!u.last_seen) return { label: "Never", tone: "default" };
    const age = Date.now() - new Date(u.last_seen).getTime();
    if (age < 86_400_000) return { label: "Active today", tone: "ok" };
    if (age < 7 * 86_400_000) return { label: "Active 7d", tone: "warn" };
    return { label: "Inactive", tone: "default" };
  };

  return (
    <div className={`${cardCls} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line/10 p-5">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">👥 Users ({users.length})</h2>
          <p className="text-[12.5px] text-mut">Everyone who signed in and synced. Status reflects their last heartbeat.</p>
        </div>
        {owner ? (
          <div className="flex gap-2">
            <input
              value={grantEmail} onChange={e => setGrantEmail(e.target.value)}
              placeholder="admin@example.com"
              className="rounded-xl border border-line/15 bg-deep/80 px-3.5 py-2 text-[13px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
            />
            <button className={btnPrimary + btnSm} onClick={doGrant} disabled={busy}>Grant admin</button>
          </div>
        ) : (
          <Chip tone="warn">🔒 Only the product owner can manage admins</Chip>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
              <th className="px-5 py-3 font-bold">User</th>
              <th className="px-3 py-3 font-bold">Status</th>
              <th className="px-3 py-3 font-bold">Plan</th>
              <th className="px-3 py-3 font-bold">Streak</th>
              <th className="px-3 py-3 font-bold">Sessions</th>
              <th className="px-3 py-3 font-bold">AI calls</th>
              <th className="px-3 py-3 font-bold">Joined</th>
              <th className="px-3 py-3 font-bold">Admin</th>
              <th className="px-5 py-3 font-bold">Billing</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-mut">No signed-in users yet — when someone creates an account and syncs, they appear here.</td></tr>
            )}
            {users.map(u => {
              const st = status(u);
              const isAdmin = admins.includes(u.email.toLowerCase());
              const isOwner = u.email.toLowerCase() === ownerEmail;
              return (
                <tr key={u.id} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 font-bold">
                      {isOwner && <span title="Product owner — the only account that can manage admins">👑</span>}
                      {u.email || "—"}
                    </div>
                    <div className="text-[11.5px] text-fnt">last seen {u.last_seen ? new Date(u.last_seen).toLocaleString() : "—"}</div>
                  </td>
                  <td className="px-3 py-3"><Chip tone={st.tone}>{st.label}</Chip></td>
                  <td className="px-3 py-3">
                    <Chip tone={u.tier === "pro" ? "co" : "default"}>{u.tier === "pro" ? "💎 Pro" : "Free"}</Chip>
                  </td>
                  <td className="px-3 py-3 font-bold tabular-nums">{u.streak}</td>
                  <td className="px-3 py-3 tabular-nums">{u.sessions_count}</td>
                  <td className="px-3 py-3 tabular-nums">{u.ai_calls}</td>
                  <td className="px-3 py-3 tabular-nums">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    {isOwner ? (
                      <Chip tone="co">👑 Owner</Chip>
                    ) : isAdmin ? (
                      owner ? (
                        <button className={btnDanger + btnSm} onClick={() => doRevoke(u.email)} disabled={busy}>Revoke</button>
                      ) : (
                        <Chip tone="ok">Admin</Chip>
                      )
                    ) : (
                      <span className="text-fnt">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button className={btnGhost + btnSm} onClick={() => setBillingUser({ id: u.id, email: u.email })} title="Entitlements, payments, subscriptions and audit trail for this user">
                      💰 Billing
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {billingUser && <UserBillingDrawer userId={billingUser.id} email={billingUser.email} onClose={() => setBillingUser(null)} />}
    </div>
  );
}

/* Per-user billing drawer — one account's full billing history in one
   place: entitlement, payments, subscriptions, and audit actions, all
   filtered client-side from the admin RPCs (no new read surface). */
function UserBillingDrawer({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const [state, setState] = useState<{ entitlements: AdminEntitlementRow[]; payments: AdminPaymentRow[]; subs: AdminSubscriptionRow[]; audit: BillingActionRow[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([adminListEntitlements(), adminListPayments(), adminListSubscriptions(), adminBillingActions(100)])
      .then(([e, p, s, a]) => {
        if (!alive) return;
        setState({
          entitlements: e.filter(r => r.userId === userId),
          payments: p.filter(r => r.userId === userId),
          subs: s.filter(r => r.userId === userId),
          audit: a.filter(r => r.userId === userId)
        });
      })
      .catch(() => { if (alive) setState({ entitlements: [], payments: [], subs: [], audit: [] }); });
    return () => { alive = false; };
  }, [userId]);

  const ent = state?.entitlements[0];
  return (
    <Modal onClose={onClose} title={`💰 Billing — ${email}`} desc="Entitlement, payments, subscriptions and the audit trail for this account.">
      {!state ? (
        <p className="py-6 text-center text-mut">Loading billing history…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Entitlement</div>
            {ent ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/40 p-3 text-[12.5px]">
                <Chip tone={ent.active ? "ok" : "default"}>{ent.active ? "💎 Pro active" : "free"}</Chip>
                {ent.plan && <Chip>{ent.plan}</Chip>}
                <span className="text-fnt">expires {ent.expiresAt ? new Date(ent.expiresAt).toLocaleDateString() : "never"}</span>
                {ent.source && <Chip tone="lvl">via {ent.source}</Chip>}
                {ent.discountPct > 0 && <Chip tone="lvl">−{ent.discountPct}%</Chip>}
              </div>
            ) : <p className="text-[12.5px] text-fnt">No entitlement row — this account has never been granted Pro.</p>}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Payments ({state.payments.length})</div>
            {state.payments.length === 0 ? (
              <p className="text-[12.5px] text-fnt">No confirmed payments.</p>
            ) : (
              <div className="space-y-1.5">
                {state.payments.map((p, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
                    <Chip tone={p.status === "paid" ? "ok" : "warn"}>{p.status}</Chip>
                    <span className="font-bold capitalize">{p.plan}</span>
                    <span className="font-bold tabular-nums">{fmtMinor(p.amountMinor, p.currency)}</span>
                    {p.discountPct > 0 && <Chip tone="lvl">−{p.discountPct}%</Chip>}
                    {p.kind === "subscription" && <Chip tone="lvl">🔁 sub</Chip>}
                    <span className="ml-auto text-[11px] text-fnt">{new Date(p.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Subscriptions ({state.subs.length})</div>
            {state.subs.length === 0 ? (
              <p className="text-[12.5px] text-fnt">No provider subscriptions.</p>
            ) : (
              <div className="space-y-1.5">
                {state.subs.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
                    <Chip tone={s.status === "active" ? "ok" : s.status === "cancelled" ? "warn" : "bad"}>{s.status}</Chip>
                    <span className="font-bold capitalize">{s.plan}</span>
                    <span className="text-fnt">{s.provider}</span>
                    <span className="ml-auto text-[11px] text-fnt">next billing {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Audit trail ({state.audit.length})</div>
            {state.audit.length === 0 ? (
              <p className="text-[12.5px] text-fnt">No billing actions for this account.</p>
            ) : (
              <div className="max-h-[200px] space-y-1.5 overflow-y-auto">
                {state.audit.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
                    <Chip tone={a.action === "purchase" ? "ok" : a.action === "revoke" ? "bad" : "default"}>{a.action}</Chip>
                    {a.detail && <span className="font-mono text-[11px] text-fnt">{JSON.stringify(a.detail).slice(0, 100)}</span>}
                    <span className="ml-auto text-[11px] text-fnt">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Announcements — release notes CRUD                                  */
/* ------------------------------------------------------------------ */

function Announcements({ list, busy, setBusy, onChanged }: {
  list: ReturnType<typeof getAnnouncements>; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [badge, setBadge] = useState("NEW");
  const [body, setBody] = useState("");

  const publish = async () => {
    if (!title.trim() || !body.trim()) { toast("Title and body are required"); return; }
    setBusy(true);
    try {
      await createAnnouncement({ title: title.trim(), body: body.trim(), badge: badge.trim() || undefined });
      toast("📣 Announcement published — clients see it on next load");
      setTitle(""); setBody("");
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">✍️ New announcement</h2>
        <p className="mb-4 text-[12.5px] text-mut">Shows as a dismissible banner under the header for every user.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={'Title — e.g. "New: Interview Roadmap"'} className="inp" />
            <input value={badge} onChange={e => setBadge(e.target.value)} placeholder="Badge (NEW)" className="inp" />
          </div>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="What's new? Keep it to one or two sentences." className="inp w-full resize-y" />
          <button className={btnPrimary + btnSm} onClick={publish} disabled={busy}>Publish</button>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">📣 Live announcements ({list.length})</h2>
        <div className="mt-3 space-y-2.5">
          {list.length === 0 && <p className="text-[13px] text-mut">Nothing published yet.</p>}
          {list.map(a => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {a.badge && <Chip tone="co">{a.badge}</Chip>}
                  <span className="text-[14px] font-bold">{a.title}</span>
                  <Chip tone={a.published ? "ok" : "default"}>{a.published ? "LIVE" : "DRAFT"}</Chip>
                </div>
                <p className="mt-1 text-[13px] text-mut">{a.body}</p>
                <div className="mt-1 text-[11.5px] text-fnt">{new Date(a.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex flex-none gap-2">
                <button className={btnGhost + btnSm} onClick={async () => { setBusy(true); try { await setAnnouncementPublished(a.id, !a.published); await onChanged(); } catch (e) { toast("✗ " + (e as Error).message); } finally { setBusy(false); } }} disabled={busy}>
                  {a.published ? "Unpublish" : "Publish"}
                </button>
                <button className={btnDanger + btnSm} onClick={async () => { setBusy(true); try { await deleteAnnouncement(a.id); await onChanged(); } catch (e) { toast("✗ " + (e as Error).message); } finally { setBusy(false); } }} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Question bank — publish admin-curated questions                     */
/* ------------------------------------------------------------------ */

function Questions({ list, busy, setBusy, onChanged }: {
  list: ReturnType<typeof getPublishedQuestions>; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [fieldId, setFieldId] = useState(FIELDS[0]?.id ?? "");
  const [level, setLevel] = useState<LevelId>("senior");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const publish = async () => {
    if (!question.trim()) { toast("Question is required"); return; }
    setBusy(true);
    try {
      await createQuestion({
        fieldId, level, question: question.trim(), answer: answer.trim(),
        keyPoints: keyPoints.split(/[,\n]/).map(k => k.trim()).filter(Boolean)
      });
      toast("📚 Question published — appears in sessions and the bank");
      setQuestion(""); setAnswer(""); setKeyPoints("");
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">✍️ Add a question</h2>
        <p className="mb-4 text-[12.5px] text-mut">Published questions merge into sessions for that field+level and appear in the Question Bank.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select value={fieldId} onChange={e => setFieldId(e.target.value)} className="inp">
              {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
            </select>
            <select value={level} onChange={e => setLevel(e.target.value as LevelId)} className="inp">
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
            </select>
          </div>
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Interview question…" className="inp w-full" />
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3} placeholder="Model answer…" className="inp w-full resize-y" />
          <input value={keyPoints} onChange={e => setKeyPoints(e.target.value)} placeholder="Key points, comma-separated (drives scoring)" className="inp w-full" />
          <button className={btnPrimary + btnSm} onClick={publish} disabled={busy}>Publish question</button>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">📚 Published questions ({list.length})</h2>
        <div className="mt-3 space-y-2.5">
          {list.length === 0 && <p className="text-[13px] text-mut">Nothing published yet.</p>}
          {list.map(q => (
            <div key={q.id} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="lvl">{LEVELS.find(l => l.id === q.level)?.icon} {LEVELS.find(l => l.id === q.level)?.name}</Chip>
                  <Chip tone="cat">{FIELDS.find(f => f.id === q.fieldId)?.name ?? q.fieldId}</Chip>
                  <Chip tone={q.published ? "ok" : "default"}>{q.published ? "LIVE" : "DRAFT"}</Chip>
                </div>
                <div className="mt-1.5 text-[14px] font-bold">{q.question}</div>
                {q.answer && <p className="mt-1 text-[13px] text-mut line-clamp-2">{q.answer}</p>}
                {q.keyPoints.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{q.keyPoints.slice(0, 5).map(k => <Chip key={k}>{k}</Chip>)}</div>}
              </div>
              <div className="flex flex-none gap-2">
                <button className={btnGhost + btnSm} onClick={async () => { setBusy(true); try { await setQuestionPublished(q.id, !q.published); await onChanged(); } catch (e) { toast("✗ " + (e as Error).message); } finally { setBusy(false); } }} disabled={busy}>
                  {q.published ? "Unpublish" : "Publish"}
                </button>
                <button className={btnDanger + btnSm} onClick={() => setConfirmDel(q.id)} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmDel !== null && (
        <Modal onClose={() => setConfirmDel(null)} title="Delete this question?" desc="It will disappear from every client on next sync.">
          <div className="flex gap-3">
            <button className={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
            <button className={btnDanger} onClick={async () => {
              setBusy(true);
              try { await deleteQuestion(confirmDel); await onChanged(); toast("Question deleted"); }
              catch (e) { toast("✗ " + (e as Error).message); }
              finally { setBusy(false); setConfirmDel(null); }
            }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Review inbox — batch review of scraped/imported drafts              */
/* ------------------------------------------------------------------ */

interface DraftEdit {
  fieldId: string;
  level: LevelId;
  question: string;
  answer: string;
  keyPoints: string[];
}

function ReviewInbox({ list, busy, setBusy, onChanged }: {
  list: ReturnType<typeof getPublishedQuestions>; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const drafts = list.filter(q => !q.published);
  /* auto-triage: heuristic issues + near-duplicate detection against the whole bank */
  const triage = useMemo(() => {
    const bank = list.map(q => q.question);
    const map: Record<number, { issues: string[]; level: "ready" | "needs-work" | "review-first"; dups: DuplicateMatch[] }> = {};
    for (const d of drafts) {
      const issues = draftIssues(d);
      const dups = findDuplicates(d.question, bank.filter(q => q !== d.question));
      map[d.id] = { issues, level: triageLevel(issues), dups };
    }
    return map;
  }, [list, drafts]);
  const sortedDrafts = [...drafts].sort((a, b) => {
    const p = { "review-first": 0, "needs-work": 1, ready: 2 };
    return (p[triage[a.id]?.level ?? "ready"] - p[triage[b.id]?.level ?? "ready"]) || a.id - b.id;
  });
  const [aiTriage, setAiTriage] = useState<Record<number, { score: number; note: string }>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [edits, setEdits] = useState<Record<number, DraftEdit>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [candidates, setCandidates] = useState<MissCandidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [addedQ, setAddedQ] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCandLoading(true);
    void adminMissCandidates().then(setCandidates).catch(() => setCandidates([])).finally(() => setCandLoading(false));
  }, []);

  const addCandidate = async (c: MissCandidate) => {
    setBusy(true);
    try {
      await createQuestion({
        fieldId: c.field_id, level: c.level as LevelId, question: c.question,
        answer: "", keyPoints: [], published: false
      });
      setAddedQ(s => new Set(s).add(c.question));
      toast(`📚 Added "${c.question.slice(0, 40)}…" to the drafts`);
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const addAllCandidates = async () => {
    const pending = candidates.filter(c => !addedQ.has(c.question));
    if (!pending.length) return;
    setBusy(true);
    try {
      for (const c of pending) {
        await createQuestion({
          fieldId: c.field_id, level: c.level as LevelId, question: c.question,
          answer: "", keyPoints: [], published: false
        });
      }
      setAddedQ(s => new Set([...s, ...pending.map(c => c.question)]));
      toast(`📚 Added ${pending.length} missed-question draft(s)`);
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  /* re-seed the editors whenever the list refreshes (post-save, section re-entry) */
  useEffect(() => {
    setEdits(Object.fromEntries(drafts.map(q => [q.id, {
      fieldId: q.fieldId, level: q.level, question: q.question, answer: q.answer, keyPoints: q.keyPoints
    }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const edit = (id: number, patch: Partial<DraftEdit>) =>
    setEdits({ ...edits, [id]: { ...(edits[id] ?? {}), ...patch } });

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () =>
    setSelected(selected.size === drafts.length ? new Set() : new Set(drafts.map(d => d.id)));

  const saveOne = async (id: number) => {
    const e = edits[id];
    if (!e || !e.question.trim()) { toast("Question is required"); return; }
    setBusy(true);
    try {
      await updateQuestion(id, {
        fieldId: e.fieldId, level: e.level, question: e.question.trim(),
        answer: e.answer.trim(), keyPoints: e.keyPoints.filter(k => k.trim())
      });
      toast("Saved");
      await onChanged();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const publishOne = async (id: number) => {
    setBusy(true);
    try { await setQuestionPublished(id, true); toast("Published — live for all users"); await onChanged(); }
    catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const deleteOne = async (id: number) => {
    setBusy(true);
    try { await deleteQuestion(id); toast("Deleted"); await onChanged(); }
    catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const publishSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    try {
      await batchSetQuestionsPublished(ids, true);
      toast(`🚀 Published ${ids.length} question(s) — live for all users`);
      setSelected(new Set());
      await onChanged();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const aiTriageAll = async () => {
    const pending = sortedDrafts.filter(d => !aiTriage[d.id]);
    if (!pending.length) return;
    setAiBusy(true);
    const out: Record<number, { score: number; note: string }> = {};
    for (const d of pending) {
      try {
        const raw = await chat([
          { role: "system", content: "You are a senior interview-question editor. Score each draft 0-10 for clarity, answer completeness and key-point quality. Reply with ONLY `N — short reason`." },
          { role: "user", content: `Question: ${d.question}\nModel answer: ${d.answer || "(missing)"}\nKey points: ${d.keyPoints.join(", ") || "(none)"}` }
        ], { temperature: 0.2, maxTokens: 60 });
        const m = raw.trim().match(/^(\d{1,2})\s*[-—:.]\s*(.+)$/s);
        const score = Math.max(0, Math.min(10, Number(m?.[1] ?? 5)));
        out[d.id] = { score, note: (m?.[2] ?? raw).slice(0, 160) };
      } catch { out[d.id] = { score: 5, note: "AI unavailable" }; }
    }
    setAiTriage(t => ({ ...t, ...out }));
    setAiBusy(false);
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    try {
      await batchDeleteQuestions(ids);
      toast(`Deleted ${ids.length} question(s)`);
      setSelected(new Set());
      await onChanged();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* harvest candidates — real user misses, one click to draft */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">📊 Harvest candidates ({candidates.length})</h2>
            <p className="text-[12.5px] text-mut">
              Questions real users scored ≤2 on (from session analytics, ≥2 attempts). One click turns a
              systemic weak spot into a draft you can review below.
            </p>
          </div>
          {candidates.length > 0 && (
            <button className={btnPrimary + btnSm} onClick={addAllCandidates} disabled={busy || candidates.every(c => addedQ.has(c.question))}>
              ➕ Add all as drafts
            </button>
          )}
        </div>
        {candLoading && <p className="mt-3 text-[12.5px] text-fnt"><span className="spinner" /> Aggregating session answers…</p>}
        {!candLoading && candidates.length === 0 && (
          <p className="mt-3 text-[13px] text-mut">No candidates yet — they appear once users complete sessions (each answer is scored server-side).</p>
        )}
        {candidates.length > 0 && (
          <div className="mt-3 space-y-2">
            {candidates.map(c => {
              const added = addedQ.has(c.question);
              return (
                <div key={c.question} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="lvl">{LEVELS.find(l => l.id === c.level)?.icon} {LEVELS.find(l => l.id === c.level)?.name ?? c.level}</Chip>
                      <Chip tone="cat">{FIELDS.find(f => f.id === c.field_id)?.name ?? c.field_id}</Chip>
                      <Chip tone="bad">{c.misses} missed</Chip>
                      <Chip>{c.miss_rate}% miss rate</Chip>
                      <Chip tone="warn">avg {c.avg_score}/5</Chip>
                    </div>
                    <div className="mt-1.5 text-[13.5px] font-bold">{c.question}</div>
                    <div className="text-[11.5px] text-fnt">{c.attempts} attempt(s)</div>
                  </div>
                  <button className={btnGhost + btnSm} onClick={() => addCandidate(c)} disabled={busy || added}>
                    {added ? "✓ Added" : "➕ Draft"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">🛂 Review inbox ({drafts.length})</h2>
            <p className="text-[12.5px] text-mut">
              Drafts from the weekly scraper, bulk import and PDF/AI cleaning. Edit inline, then
              publish in one click — published questions go live for every user on next sync.
            </p>
          </div>
          {drafts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {aiAvailable() && (
                <button className={btnSoft + btnSm} onClick={aiTriageAll} disabled={aiBusy || busy}>
                  {aiBusy ? <><span className="spinner" /> Scoring…</> : `✨ AI-triage (${sortedDrafts.filter(d => !aiTriage[d.id]).length})`}
                </button>
              )}
              <button className={btnGhost + btnSm} onClick={toggleAll} disabled={busy}>
                {selected.size === drafts.length && drafts.length > 0 ? "Deselect all" : `Select all (${drafts.length})`}
              </button>
              <button className={btnPrimary + btnSm} onClick={publishSelected} disabled={busy || selected.size === 0}>
                🚀 Publish {selected.size || ""}
              </button>
              <button className={btnDanger + btnSm} onClick={deleteSelected} disabled={busy || selected.size === 0}>
                🗑 Delete {selected.size || ""}
              </button>
            </div>
          )}
        </div>
      </div>

      {drafts.length === 0 && (
        <div className={`${cardCls} p-10 text-center`}>
          <div className="text-[30px]">✅</div>
          <p className="mt-2 text-[14px] font-bold">Nothing to review</p>
          <p className="mx-auto mt-1 max-w-[420px] text-[12.5px] text-mut">
            Drafts appear here when the weekly scraper runs, or when you import via Auto-fill.
          </p>
        </div>
      )}

      {sortedDrafts.map(d => {
        const e = edits[d.id];
        if (!e) return null;
        const sel = selected.has(d.id);
        const t = triage[d.id];
        const ai = aiTriage[d.id];
        return (
          <div key={d.id} className={`${cardCls} p-5 ${sel ? "ring-2 ring-acc1/60" : ""}`}>
            <div className="mb-3 flex items-start gap-3">
              <input type="checkbox" checked={sel} onChange={() => toggle(d.id)} className="mt-1 h-4 w-4 accent-acc1" />
              <div className="flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {t && (
                    <Chip tone={t.level === "ready" ? "ok" : t.level === "needs-work" ? "warn" : "bad"}>
                      {t.level === "ready" ? "🟢 ready" : t.level === "needs-work" ? "🟡 needs work" : "🔴 review first"}
                    </Chip>
                  )}
                  {t && t.issues.map((iss, i) => <Chip key={i} tone="warn">{iss}</Chip>)}
                  {t && t.dups.map((dup, i) => (
                    <Chip key={"dup" + i} tone="co">🔁 ~{Math.round(dup.sim * 100)}% dup</Chip>
                  ))}
                  {ai && (
                    <Chip tone={ai.score >= 7 ? "ok" : ai.score >= 4 ? "warn" : "bad"}>
                      ✨ {ai.score}/10
                    </Chip>
                  )}
                </div>
                {ai?.note && ai.note !== "AI unavailable" && <p className="text-[11.5px] text-fnt">✨ {ai.note}</p>}
                {t && t.dups.length > 0 && (
                  <p className="text-[11.5px] text-fnt">
                    Matches existing: {t.dups[0].text.slice(0, 90)}{t.dups[0].text.length > 90 ? "…" : ""}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <select value={e.fieldId} onChange={ev => edit(d.id, { fieldId: ev.target.value })} className="inp">
                    {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
                  </select>
                  <select value={e.level} onChange={ev => edit(d.id, { level: ev.target.value as LevelId })} className="inp">
                    {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                  </select>
                </div>
                <textarea value={e.question} onChange={ev => edit(d.id, { question: ev.target.value })} rows={2} className="inp w-full resize-y text-[13.5px] font-bold" />
                <textarea value={e.answer} onChange={ev => edit(d.id, { answer: ev.target.value })} rows={3} placeholder="Model answer…" className="inp w-full resize-y" />
                <input
                  value={e.keyPoints.join(", ")}
                  onChange={ev => edit(d.id, { keyPoints: ev.target.value.split(",").map(k => k.trim()).filter(Boolean) })}
                  placeholder="Key points, comma-separated"
                  className="inp w-full"
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className={btnGhost + btnSm} onClick={() => saveOne(d.id)} disabled={busy}>💾 Save</button>
              <button className={btnPrimary + btnSm} onClick={() => publishOne(d.id)} disabled={busy}>🚀 Publish</button>
              <button className={btnDanger + btnSm} onClick={() => deleteOne(d.id)} disabled={busy}>Delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scraper — sources, schedule and run-now (all admin-configurable)     */
/* ------------------------------------------------------------------ */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; /* index 0 = ISO day 1 */

function ScraperSection({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) {
  const [sources, setSources] = useState<ScraperSourceRow[]>([]);
  const [days, setDays] = useState<number[]>([1]);
  const [loading, setLoading] = useState(true);
  const [runReport, setRunReport] = useState<RunResult[] | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  /* add-source form */
  const [fUrl, setFUrl] = useState("");
  const [fType, setFType] = useState<ScraperSourceRow["type"]>("markdown");
  const [fField, setFField] = useState(FIELDS[0]?.id ?? "frontend");
  const [fLevel, setFLevel] = useState("mid");
  const [fMax, setFMax] = useState(20);

  const load = () => {
    setLoading(true);
    void Promise.all([listScraperSources(), getScraperSchedule()])
      .then(([s, d]) => { setSources(s); setDays(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleDay = (iso: number) => {
    setDays(ds => (ds.includes(iso) ? ds.filter(d => d !== iso) : [...ds, iso].sort()));
  };

  const saveSchedule = async () => {
    setBusy(true);
    try { await saveScraperSchedule(days); toast("🗓️ Schedule saved — the cron checks it daily"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const addSource = async () => {
    if (!fUrl.trim().startsWith("http")) { toast("Enter a valid source URL"); return; }
    setBusy(true);
    try {
      await saveScraperSource({ url: fUrl.trim(), type: fType, fieldId: fField, level: fLevel, maxItems: fMax });
      toast("➕ Source added — it will be scraped on the next scheduled run");
      setFUrl("");
      await load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const toggleSource = async (s: ScraperSourceRow, enabled: boolean) => {
    setBusy(true);
    try { await setScraperSourceEnabled(s.id, enabled); await load(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const removeSource = async (id: string) => {
    setBusy(true);
    try { await deleteScraperSource(id); toast("Source removed"); await load(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const runNow = async () => {
    const enabled = sources.filter(s => s.enabled);
    if (!enabled.length) { toast("Enable at least one source first"); return; }
    setRunBusy(true); setRunReport(null);
    try {
      const report = await runScraperNow(sources);
      setRunReport(report);
      const ok = report.filter(r => !r.error);
      const added = report.reduce((n, r) => n + r.inserted, 0);
      toast(`🕷️ Ran ${ok.length}/${report.length} source(s) — ${added} draft(s) landed in the Review inbox`);
    } catch (e) { toast("✗ " + ((e as Error).message || "Run failed")); }
    finally { setRunBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* schedule */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">🗓️ Schedule</h2>
            <p className="text-[12.5px] text-mut">
              Which days the weekly scraper runs (03:00 UTC). The GitHub Actions workflow runs daily
              and skips days not selected here — no repo edits needed to change cadence.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((name, i) => {
              const iso = i + 1;
              const on = days.includes(iso);
              return (
                <button
                  key={name}
                  onClick={() => toggleDay(iso)}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors ${on ? "grad-bg text-white" : "border border-line/15 bg-wht/5 text-mut hover:bg-wht/10"}`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <button className={btnPrimary + btnSm} onClick={saveSchedule} disabled={busy}>💾 Save schedule</button>
        </div>
      </div>

      {/* run now */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">▶ Run now</h2>
            <p className="text-[12.5px] text-mut">
              Fetches every enabled source from this browser and upserts new questions as drafts —
              same pipeline as the cron, no waiting. Sources that block cross-origin fetches still
              run on the scheduled server-side job.
            </p>
          </div>
          <button className={btnOk + btnSm} onClick={runNow} disabled={runBusy || busy}>
            {runBusy ? <><span className="spinner" /> Scraping…</> : `🕷️ Run now (${sources.filter(s => s.enabled).length} sources)`}
          </button>
        </div>
        {runReport && runReport.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {runReport.map(r => (
              <div key={r.sourceId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-wht/5 px-3 py-2 text-[12.5px]">
                <span className="font-bold">{r.sourceId}</span>
                <span className="min-w-[120px] flex-1 truncate text-fnt">{r.url}</span>
                {r.error
                  ? <span className="font-bold text-warn">✗ {r.error}</span>
                  : <span className="font-bold text-ok">✓ +{r.inserted} drafts (from {r.extracted} extracted)</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* sources */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🕷️ Sources ({sources.length})</h2>
        <p className="mb-4 text-[12.5px] text-mut">
          Everything scraped lands in the Review inbox as a draft. Sources are read from here by the
          cron too — <span className="font-mono">content/sources.json</span> in the repo is only the offline fallback.
        </p>
        {loading && <p className="text-[12.5px] text-fnt"><span className="spinner" /> Loading…</p>}
        {!loading && sources.length === 0 && <p className="text-[13px] text-mut">No sources yet — add your first one below.</p>}
        <div className="space-y-2">
          {sources.map(s => (
            <div key={s.id} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={s.enabled ? "ok" : "default"}>{s.enabled ? "ON" : "OFF"}</Chip>
                  <Chip tone="cat">{FIELDS.find(f => f.id === s.fieldId)?.name ?? s.fieldId}</Chip>
                  <Chip tone="lvl">{LEVELS.find(l => l.id === s.level)?.name ?? s.level}</Chip>
                  <span className="text-[11.5px] font-bold text-fnt">{s.type}</span>
                  <span className="text-[11.5px] text-fnt">max {s.maxItems}</span>
                </div>
                <div className="mt-1 truncate text-[13px] font-bold">{s.url}</div>
                {s.note && <div className="text-[11.5px] text-mut">{s.note}</div>}
              </div>
              <div className="flex flex-none items-center gap-2">
                <Switch checked={s.enabled} onChange={v => toggleSource(s, v)} />
                <button className={btnDanger + btnSm} onClick={() => removeSource(s.id)} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        {/* add source */}
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/40 p-4">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-mut">➕ Add a source</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_130px_130px_110px_90px]">
            <input value={fUrl} onChange={e => setFUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/…/README.md" className="inp" />
            <select value={fType} onChange={e => setFType(e.target.value as ScraperSourceRow["type"])} className="inp">
              <option value="markdown">markdown</option>
              <option value="json">json</option>
              <option value="html">html</option>
            </select>
            <select value={fField} onChange={e => setFField(e.target.value)} className="inp">
              {FIELDS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={fLevel} onChange={e => setFLevel(e.target.value)} className="inp">
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input type="number" min={1} value={fMax} onChange={e => setFMax(Number(e.target.value))} className="inp" title="Max items per run" />
          </div>
          <button className={`${btnPrimary + btnSm} mt-3`} onClick={addSource} disabled={busy}>Add source</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity — question-bank change history + rollback                  */
/* ------------------------------------------------------------------ */

function Activity({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    void listQuestionAudit().then(setAudit).catch(() => setAudit([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const restoreUpdate = async (e: AuditEntry) => {
    const before = e.diff.before;
    if (!before || e.question_id == null) { toast("Nothing to restore"); return; }
    setBusy(true);
    try {
      await updateQuestion(e.question_id, {
        fieldId: before.field_id, level: before.level as LevelId,
        question: before.question, answer: before.answer, keyPoints: before.key_points ?? []
      });
      toast("↩ Restored the previous version");
      load();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const restoreDelete = async (e: AuditEntry) => {
    const row = e.diff.row;
    if (!row || !row.question) { toast("Nothing to restore"); return; }
    setBusy(true);
    try {
      await createQuestion({
        fieldId: row.field_id ?? "general", level: (row.level ?? "mid") as LevelId,
        question: row.question, answer: row.answer ?? "", keyPoints: row.key_points ?? [], published: false
      });
      toast("↩ Restored as a draft — publish it to bring it back live");
      load();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">🧾 Question-bank activity ({audit.length})</h2>
          <p className="text-[12.5px] text-mut">
            Every create, edit, publish and delete — including weekly scraper imports. Restore an edit
            or bring back a deleted question from here.
          </p>
        </div>
        <button className={btnGhost + btnSm} onClick={load} disabled={busy}>↻ Refresh</button>
      </div>
      {loading && <p className="mt-4 text-[12.5px] text-fnt"><span className="spinner" /> Loading…</p>}
      {!loading && audit.length === 0 && <p className="mt-4 text-[13px] text-mut">No changes logged yet — bank edits appear here as they happen.</p>}
      {!loading && audit.length > 0 && (
        <div className="mt-4 space-y-2">
          {audit.map(e => (
            <div key={e.id} className="rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={e.action === "create" ? "ok" : e.action === "update" ? "warn" : "bad"}>
                  {e.action === "create" ? "＋ create" : e.action === "update" ? "✏️ update" : "🗑 delete"}
                </Chip>
                {e.field_id && <Chip tone="cat">{FIELDS.find(f => f.id === e.field_id)?.name ?? e.field_id}</Chip>}
                {e.level && <Chip tone="lvl">{LEVELS.find(l => l.id === e.level)?.name ?? e.level}</Chip>}
                <span className="min-w-[160px] flex-1 truncate text-[13px] font-bold">{e.question}</span>
                <span className="text-[11.5px] text-fnt">{e.actor === "system" ? "🤖 scraper" : e.actor}</span>
                <span className="text-[11.5px] text-fnt">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              {(e.action === "update" || e.action === "delete") && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer text-[11.5px] font-bold text-acc3">
                      {e.action === "delete" ? "View deleted content" : "View before → after"}
                    </summary>
                    <div className="mt-1.5 space-y-1.5 rounded-lg bg-deep/50 p-2.5 text-[12px]">
                      {e.action === "delete" && e.diff.row && (
                        <p className="whitespace-pre-wrap text-mut">
                          <span className="font-bold text-ink">{e.diff.row.question}</span>
                          {e.diff.row.answer ? `\n${e.diff.row.answer}` : ""}
                          {e.diff.row.key_points?.length ? `\nKey points: ${e.diff.row.key_points.join(", ")}` : ""}
                        </p>
                      )}
                      {e.action === "update" && e.diff.before && e.diff.after && (
                        <>
                          <p className="text-mut"><span className="font-bold text-warn">BEFORE:</span> {e.diff.before.question} — {e.diff.before.answer?.slice(0, 80) ?? ""}</p>
                          <p className="text-mut"><span className="font-bold text-ok">AFTER:</span> {e.diff.after.question} — {e.diff.after.answer?.slice(0, 80) ?? ""}</p>
                        </>
                      )}
                    </div>
                  </details>
                  <button className={btnGhost + btnSm} onClick={() => (e.action === "delete" ? restoreDelete(e) : restoreUpdate(e))} disabled={busy}>
                    ↩ Restore
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Auto-fill — PDF / bulk import / AI cleaning pipeline                */
/* ------------------------------------------------------------------ */

function AutoFill({ busy, setBusy, onChanged }: {
  busy: boolean; setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [candidates, setCandidates] = useState<ReturnType<typeof parseQuestionBatch>["ok"]>([]);
  const [batchText, setBatchText] = useState("");
  const [batchResult, setBatchResult] = useState<ReturnType<typeof parseQuestionBatch> | null>(null);
  const [busy2, setBusy2] = useState(false);
  const [docs, setDocs] = useState<PdfDocumentRow[]>([]);
  const [ragBusy, setRagBusy] = useState(false);

  useEffect(() => {
    void listPdfDocuments().then(setDocs).catch(() => {});
  }, []);

  const reloadDocs = async () => {
    try { setDocs(await listPdfDocuments()); } catch { /* ignore */ }
  };

  const indexRag = async () => {
    if (!rawText.trim()) { toast("Import a file first"); return; }
    if (!aiAvailable()) { toast("Add an AI key in Settings — indexing needs one"); return; }
    setRagBusy(true);
    try {
      if (!prepareChunks(rawText).length) { toast("Nothing to index — the extracted text is empty"); return; }
      const title = fileName || "Imported document";
      const existing = docs.find(d => d.title === title);
      const docId = existing ? existing.id : await createPdfDocument({ title, source: "pdf-import", charCount: rawText.length });
      /* incremental re-embed: unchanged chunks keep their vectors, only new/
         changed chunks are embedded — a small edit to a big PDF is cheap */
      const r = await reindexDocument(docId, rawText);
      if (existing && r.changed === 0) {
        toast(`⏭️ "${existing.title}" is unchanged — nothing to re-embed`);
        return;
      }
      if (!existing) await updatePdfDocument(docId, { charCount: rawText.length });
      await reloadDocs();
      toast(`🧠 Indexed ${r.reused + r.fresh} chunk(s) (${r.fresh} fresh embed${r.fresh === 1 ? "" : "s"}${existing ? `, reused ${r.reused}` : ""}) — the AI tutor is now grounded in this document`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Indexing failed"));
    } finally { setRagBusy(false); }
  };

  const removeDoc = async (id: number) => {
    setRagBusy(true);
    try { await deletePdfDocument(id); await reloadDocs(); toast("Document removed from the knowledge base"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setRagBusy(false); }
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    setBusy2(true);
    try {
      const text = await extractFileText(f);
      setRawText(text);
      setCandidates([]);
      toast(`📄 Extracted ${text.length.toLocaleString()} chars from ${f.name}`);
    } catch (e) {
      toast("✗ Couldn't read file: " + ((e as Error).message || "unsupported"));
    } finally { setBusy2(false); }
  };

  const clean = async () => {
    if (!rawText.trim()) { toast("Import a file first"); return; }
    if (!aiAvailable()) { toast("Add an AI key in Settings — AI cleaning needs one"); return; }
    setBusy2(true);
    try {
      const out = await cleanTextToQuestions(rawText);
      setCandidates(out);
      toast(`✨ AI extracted ${out.length} candidate question(s) — review below`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "AI cleaning failed"));
    } finally { setBusy2(false); }
  };

  const importCandidates = async () => {
    if (!candidates.length) return;
    setBusy(true);
    try {
      for (const c of candidates) {
        await createQuestion({ fieldId: c.fieldId, level: c.level, question: c.question, answer: c.answer, keyPoints: c.keyPoints, published: false });
      }
      toast(`📚 Saved ${candidates.length} draft(s) — review in Question bank`);
      setCandidates([]);
      setRawText(""); setFileName("");
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Import failed")); }
    finally { setBusy(false); }
  };

  const runBatch = async () => {
    const res = parseQuestionBatch(batchText);
    setBatchResult(res);
    if (!res.ok.length) { toast("No valid questions parsed — check the format"); return; }
    setBusy(true);
    try {
      for (const q of res.ok) {
        await createQuestion({ fieldId: q.fieldId, level: q.level, question: q.question, answer: q.answer, keyPoints: q.keyPoints, published: false });
      }
      toast(`📚 Imported ${res.ok.length} draft(s) — review in Question bank`);
      setBatchText(""); setBatchResult(null);
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Import failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* PDF / text import */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">📄 Import a document (PDF or TXT)</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Extract the text on-device (nothing is uploaded), then let the AI agent turn it into structured
          question drafts for your review.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${btnGhost} cursor-pointer`}>
            📂 {fileName || "Choose PDF / TXT…"}
            <input type="file" accept=".pdf,.txt,text/plain,application/pdf" className="hidden" onChange={e => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          {rawText && <button className={btnPrimary + btnSm} onClick={clean} disabled={busy || busy2}>✨ Clean with AI</button>}
          {rawText && <span className="text-[12px] text-mut">{rawText.length.toLocaleString()} chars</span>}
        </div>
        {rawText && (
          <div className="mt-3 rounded-lg border border-line/10 bg-deep/40 p-3">
            <div className="mb-1 text-[11.5px] font-bold uppercase tracking-wider text-mut">Extracted preview</div>
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-mut line-clamp-4">{rawText.slice(0, 900)}</p>
          </div>
        )}
        {candidates.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-acc3">AI candidates ({candidates.length})</div>
            <div className="space-y-2">
              {candidates.map((c, i) => (
                <div key={i} className="rounded-lg border border-line/10 bg-wht/5 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <Chip tone="lvl">{c.level}</Chip>
                    <Chip tone="cat">{FIELDS.find(f => f.id === c.fieldId)?.name ?? c.fieldId}</Chip>
                  </div>
                  <div className="mt-1 text-[13px] font-bold">{c.question}</div>
                  {c.answer && <p className="mt-1 text-[12.5px] text-mut line-clamp-2">{c.answer}</p>}
                </div>
              ))}
            </div>
            <button className={`${btnPrimary + btnSm} mt-3`} onClick={importCandidates} disabled={busy}>
              📚 Save {candidates.length} as drafts
            </button>
          </div>
        )}
        {rawText && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/10 pt-3">
            <button className={btnPrimary + btnSm} onClick={indexRag} disabled={busy || busy2 || ragBusy}>
              {ragBusy ? <><span className="spinner" /> Embedding…</> : "🧠 Index for RAG"}
            </button>
            <span className="text-[12px] text-mut">Chunks the extracted text into vectors — the AI tutor answers get grounded in this document.</span>
          </div>
        )}
        {!aiAvailable() && (
          <p className="mt-3 text-[12.5px] text-warn">⚠️ AI cleaning + RAG indexing need an API key — add one in Settings to use the ✨ agent. You can still paste raw text below.</p>
        )}
      </div>

      {/* RAG knowledge base */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">🧠 Knowledge base ({docs.length})</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Indexed documents are public product knowledge — every signed-in user's AI tutor can
          retrieve and cite them. Delete a document to remove its chunks.
        </p>
        {docs.length === 0 && <p className="text-[13px] text-mut">Nothing indexed yet — import a PDF/TXT above and hit “Index for RAG”.</p>}
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold">📄 {d.title}</div>
                <div className="text-[11.5px] text-fnt">
                  {d.chunk_count} chunk(s) · {(d.char_count / 1000).toFixed(1)}k chars · {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
              <button className={btnDanger + btnSm} onClick={() => removeDoc(d.id)} disabled={ragBusy}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk paste import */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">⚡ Bulk import (paste)</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Paste JSON <code className="rounded bg-wht/10 px-1">{'[{ fieldId, level, question, answer, keyPoints }]'}</code> or
          pipe-separated lines <code className="rounded bg-wht/10 px-1">field|level|question|answer|keyPoints</code>. Saved as drafts.
        </p>
        <textarea
          value={batchText}
          onChange={e => setBatchText(e.target.value)}
          rows={7}
          placeholder={`frontend|senior|How do you handle state at scale?|Keep state as close to the UI as it needs to be…|state management, trade-offs\nbackend|mid|Design a rate limiter|…`}
          className="inp w-full resize-y font-mono text-[12.5px]"
        />
        {batchResult && (
          <div className="mt-2 text-[12.5px]">
            <span className="font-bold text-ok">{batchResult.ok.length} valid</span>
            {batchResult.skipped.length > 0 && (
              <span className="text-warn"> · {batchResult.skipped.length} skipped ({batchResult.skipped.slice(0, 3).map(s => s.reason).join("; ")})</span>
            )}
          </div>
        )}
        <button className={`${btnPrimary + btnSm} mt-3`} onClick={runBatch} disabled={busy || !batchText.trim()}>
          📚 Parse & save as drafts
        </button>
      </div>

      {/* Weekly scraper note */}
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">🕷️ Weekly scraper</h2>
        <p className="text-[12.5px] text-mut">
          Configure sources, the run schedule, and trigger a manual scrape from the dedicated
          <span className="font-bold text-ink"> 🕷️ Scraper tab</span> — no repo edits needed. Everything lands here as a
          DRAFT for review.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product config — feature flags, AI capabilities, quotas             */
/* ------------------------------------------------------------------ */

/* Audit trail for company-frequency publishes — drives the weekly digest.
   Kept in the admin's local storage (no schema change); each publish records
   the diff against the previous snapshot plus the new snapshot. */
const FREQ_AUDIT_KEY = "iq.adminFreqAudit";
interface FreqChange { company: string; problem: string; to: number }
interface FreqAuditEntry { at: number; changes: FreqChange[]; snapshot: Record<string, Partial<Record<string, number>>> }

function getFreqAudit(): FreqAuditEntry[] {
  try { return JSON.parse(localStorage.getItem(FREQ_AUDIT_KEY) || "[]") as FreqAuditEntry[]; } catch { return []; }
}
function saveFreqAudit(a: FreqAuditEntry[]): void {
  localStorage.setItem(FREQ_AUDIT_KEY, JSON.stringify(a));
}

/** Parse the resume-branding JSON editor, dropping malformed entries. */
function parseBrandJson(json: string): Record<string, { accent?: string; fontFamily?: string }> {
  try {
    const v = JSON.parse(json || "{}");
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
    const out: Record<string, { accent?: string; fontFamily?: string }> = {};
    for (const [k, entry] of Object.entries(v)) {
      const e = entry as { accent?: unknown; fontFamily?: unknown };
      out[k] = {
        accent: typeof e.accent === "string" && /^#[0-9a-fA-F]{3,6}$/.test(e.accent) ? e.accent : undefined,
        fontFamily: typeof e.fontFamily === "string" ? e.fontFamily : undefined
      };
    }
    return out;
  } catch {
    return {};
  }
}

function ConfigSection({ config, setConfig, busy, setBusy }: {
  config: RemoteConfig; setConfig: (c: RemoteConfig) => void; busy: boolean; setBusy: (b: boolean) => void;
}) {
  const setFeature = (f: keyof NonNullable<RemoteConfig["features"]>, v: boolean) =>
    setConfig({ ...config, features: { ...config.features, [f]: v } });
  const setAi = (k: keyof NonNullable<RemoteConfig["ai"]>, v: number | string | boolean) =>
    setConfig({ ...config, ai: { ...config.ai, [k]: v } });
  const setLimit = (k: keyof NonNullable<RemoteConfig["limits"]>, v: number) =>
    setConfig({ ...config, limits: { ...config.limits, [k]: v } });
  const setRag = (k: keyof NonNullable<RemoteConfig["rag"]>, v: number) =>
    setConfig({ ...config, rag: { ...config.rag, [k]: v } });
  const setRagDigest = (k: keyof NonNullable<NonNullable<RemoteConfig["rag"]>["digest"]>, v: number | string | boolean) =>
    setConfig({ ...config, rag: { ...config.rag, digest: { ...config.rag?.digest, [k]: v } } });
  /* coach vocabulary JSON editor (families + misconceptions) */
  const [vocabJson, setVocabJson] = useState<string>(() => JSON.stringify(config.coachVocab ?? {}, null, 2));
  /* resume branding (Apply Kit): per-company accent + font for the designed one-pager */
  const [brandJson, setBrandJson] = useState<string>(() => JSON.stringify(config.resumeBranding ?? {}, null, 2));
  const [brandCo, setBrandCo] = useState<string>("_default");
  const [brandAccent, setBrandAccent] = useState<string>(() => config.resumeBranding?._default?.accent ?? "#4f46e5");
  const [brandFont, setBrandFont] = useState<string>(() => config.resumeBranding?._default?.fontFamily ?? "system");
  /* companies seen in the configured job sources (boards), plus _default */
  const brandList = () => [
    "_default",
    ...jobsSources.split(/\n/).map(l => l.trim()).filter(Boolean)
      .map(l => l.split(":").slice(1).join(":").trim())
      .filter(Boolean)
  ].filter((v, i, a) => a.indexOf(v) === i);
  const pickBrand = (co: string) => {
    setBrandCo(co);
    setBrandAccent(config.resumeBranding?.[co]?.accent ?? "#4f46e5");
    setBrandFont(config.resumeBranding?.[co]?.fontFamily ?? "system");
  };
  const setBrandField = (co: string, accent: string, font: string) => {
    const next = { ...(config.resumeBranding ?? {}) };
    const entry: { accent?: string; fontFamily?: string } = { accent, fontFamily: font === "system" ? undefined : font };
    if (accent === "#4f46e5" && !entry.fontFamily) delete next[co];
    else next[co] = entry;
    setConfig({ ...config, resumeBranding: next });
    /* keep the raw-JSON editor in sync so publish never loses a picker edit */
    setBrandJson(JSON.stringify(next, null, 2));
  };
  /* job feed (Apply Kit): auto-refresh interval + ATS sources */
  const [jobsHours, setJobsHours] = useState<number>(() => config.jobs?.refreshHours ?? 24);
  const [jobsSources, setJobsSources] = useState<string>(() =>
    (config.jobs?.sources ?? []).map(s => `${s.provider}:${s.board}`).join("\n")
  );
  /* last refresh report — per-source counts + failures, so a broken board
     surfaces here instead of only in the function logs */
  const [jobsReport, setJobsReport] = useState<JobsFetchReport | null>(null);
  const [jobsReportErr, setJobsReportErr] = useState<string | null>(null);
  const [jobsRefreshing, setJobsRefreshing] = useState(false);
  const loadJobsReport = async () => {
    try {
      setJobsReport(await getLastJobsFetchReport());
      setJobsReportErr(null);
    } catch (e) {
      setJobsReportErr((e as Error).message || "Failed to load refresh report");
    }
  };
  useEffect(() => { void loadJobsReport(); }, []);
  /* self-heal on view — if the feed is older than the auto-refresh interval,
     kick a refresh right here (same rule as the Jobs page), so stale data
     fixes itself instead of waiting for the next scheduled run */
  useEffect(() => {
    if (!jobsReport) return;
    const hours = Math.max(1, Math.round(jobsHours) || 24);
    const stale = Date.now() - new Date(jobsReport.ran_at).getTime() > hours * 3_600_000
      && Date.now() - lastJobsRefresh() > hours * 3_600_000;
    if (stale) void runJobsRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsReport]);
  const runJobsRefresh = async () => {
    if (jobsRefreshing) return;
    setJobsRefreshing(true);
    try {
      const r = await refreshJobs();
      const fails = Object.keys(r.errors);
      toast(fails.length
        ? `🩺 Feed self-healed — ${r.total} jobs (${r.added} new), ⚠️ ${fails.length} source${fails.length > 1 ? "s" : ""} still failing: ${fails.join(", ")}`
        : `🩺 Feed self-healed — ${r.total} jobs (${r.added} new), all sources clean`);
      await loadJobsReport();
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Refresh failed"));
    } finally {
      setJobsRefreshing(false);
    }
  };
  /* compensation enrichment — provider + country for jobs the posting didn't price */
  const [enrProvider, setEnrProvider] = useState<string>(() => config.jobs?.salaryEnrichment?.provider ?? "none");
  const [enrCountry, setEnrCountry] = useState<string>(() => config.jobs?.salaryEnrichment?.country ?? "us");
  const [enrCap, setEnrCap] = useState<number>(() => config.jobs?.salaryEnrichment?.cap ?? 30);
  /* apply digest email — authenticated by the admin session; no local secrets */
  const [digestTesting, setDigestTesting] = useState<null | "dryrun" | "send">(null);
  const [applyPreview, setApplyPreview] = useState<string | null>(null);
  const [applyRecipients, setApplyRecipients] = useState<string[] | null>(null);
  const previewApply = () => setApplyPreview(applyDigest());
  /* recommendations digest — admin-session broadcast, with a dry-run preview */
  const [recsBusy, setRecsBusy] = useState<null | "dryrun" | "send">(null);
  const [recsPreview, setRecsPreview] = useState<string | null>(null);
  const [recsRecipients, setRecsRecipients] = useState<string[] | null>(null);
  /* 🇮🇳 India & startup digest — the same broadcast with kind: "india" */
  const [indiaRecsBusy, setIndiaRecsBusy] = useState<null | "dryrun" | "send">(null);
  const [indiaRecsPreview, setIndiaRecsPreview] = useState<string | null>(null);
  const [indiaRecsRecipients, setIndiaRecsRecipients] = useState<string[] | null>(null);
  const recsHeaders = (): Promise<Record<string, string>> => cloudFnHeaders();
  const previewRecs = () => {
    const p = getCareerProfile();
    const jobs = listJobs();
    if (!p) { toast("No career profile in this browser — upload a resume or save the profile first"); return; }
    if (!jobs.length) { toast("No jobs cached — refresh the feed first"); return; }
    setRecsPreview(recommendationsDigest(p, rankCompanies(p, jobs)));
  };
  const runRecsBroadcast = async (dryRun: boolean) => {
    setRecsBusy(dryRun ? "dryrun" : "send");
    try {
      const res = await fetch(`${CONFIG.supabase.url}/functions/v1/send-recommendations-digest`, {
        method: "POST", headers: await recsHeaders(), body: dryRun ? JSON.stringify({ dryRun: true }) : "{}"
      });
      const body = await res.json().catch(() => ({})) as { sent?: boolean; dryRun?: boolean; wouldEmail?: number; emailsSent?: number; recipients?: string[]; reason?: string };
      if (dryRun && body.dryRun) {
        setRecsRecipients(body.recipients ?? []);
        toast(`📡 Dry run — would email ${body.wouldEmail ?? 0} user${(body.wouldEmail ?? 0) === 1 ? "" : "s"} (nothing sent)`);
      } else if (body.sent) {
        toast(`📬 Recommendations digest sent — ${body.emailsSent ?? 0} email${body.emailsSent === 1 ? "" : "s"}`);
      } else {
        toast("✗ " + (body.reason ?? "Broadcast failed"));
      }
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Broadcast failed"));
    } finally {
      setRecsBusy(null);
    }
  };
  const previewIndiaRecs = () => {
    const p = getCareerProfile();
    const jobs = listJobs();
    if (!p) { toast("No career profile in this browser — upload a resume or save the profile first"); return; }
    if (!jobs.length) { toast("No jobs cached — refresh the feed first"); return; }
    setIndiaRecsPreview(indiaDigest(p, jobs));
  };
  const runIndiaRecsBroadcast = async (dryRun: boolean) => {
    setIndiaRecsBusy(dryRun ? "dryrun" : "send");
    try {
      const res = await fetch(`${CONFIG.supabase.url}/functions/v1/send-recommendations-digest`, {
        method: "POST", headers: await recsHeaders(), body: JSON.stringify({ dryRun, kind: "india" })
      });
      const body = await res.json().catch(() => ({})) as { sent?: boolean; dryRun?: boolean; wouldEmail?: number; emailsSent?: number; recipients?: string[]; reason?: string };
      if (dryRun && body.dryRun) {
        setIndiaRecsRecipients(body.recipients ?? []);
        toast(`📡 Dry run — would email ${body.wouldEmail ?? 0} user${(body.wouldEmail ?? 0) === 1 ? "" : "s"} (nothing sent)`);
      } else if (body.sent) {
        toast(`📬 🇮🇳 India digest sent — ${body.emailsSent ?? 0} email${body.emailsSent === 1 ? "" : "s"}`);
      } else {
        toast("✗ " + (body.reason ?? "Broadcast failed"));
      }
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Broadcast failed"));
    } finally {
      setIndiaRecsBusy(null);
    }
  };
  const runApplyDigest = async (dryRun: boolean) => {
    setDigestTesting(dryRun ? "dryrun" : "send");
    try {
      const headers = await cloudFnHeaders();
      const res = await fetch(`${CONFIG.supabase.url}/functions/v1/send-apply-digest`, {
        method: "POST", headers, body: dryRun ? JSON.stringify({ dryRun: true }) : "{}"
      });
      const body = await res.json().catch(() => ({})) as { sent?: boolean; dryRun?: boolean; wouldEmail?: number; emailsSent?: number; recipients?: string[]; reason?: string };
      if (dryRun && body.dryRun) {
        setApplyRecipients(body.recipients ?? []);
        toast(`📡 Dry run — would email ${body.wouldEmail ?? 0} user${(body.wouldEmail ?? 0) === 1 ? "" : "s"} (nothing sent)`);
      } else if (body.sent) {
        toast(`📬 Digest broadcast OK — ${body.emailsSent ?? 0} email${body.emailsSent === 1 ? "" : "s"} sent`);
      } else {
        toast("✗ " + (body.reason ?? "Broadcast failed"));
      }
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Digest test failed"));
    } finally {
      setDigestTesting(null);
    }
  };
  /* native digest email — authenticated by the admin session; no local secrets */
  /* company question-frequency editor + publish audit (weekly digest) */
  const [freqCo, setFreqCo] = useState<string | null>(null);
  const freqCompanies = COMPANIES.filter(c => c.id !== "general");
  const setFreq = (pid: string, v: number) => {
    if (!freqCo) return;
    const next = { ...(config.companyFreq ?? {}) };
    const co = { ...(next[freqCo] ?? {}) };
    if (v === 0) delete co[pid];
    else co[pid] = v as 1 | 2 | 3;
    next[freqCo] = co;
    setConfig({ ...config, companyFreq: next });
  };
  const [audit, setAudit] = useState<FreqAuditEntry[]>(() => getFreqAudit());
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  useEffect(() => {
    let on = true;
    adminListUsers()
      .then(rows => { if (on) setActiveWeek(rows.filter(r => r.last_seen && Date.now() - new Date(r.last_seen).getTime() < 7 * 86_400_000).length); })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const publish = async () => {
    setBusy(true);
    try {
      await saveRemoteConfig({
        features: config.features, ai: config.ai, limits: config.limits,
        companyFreq: config.companyFreq ?? {},        coachVocab: config.coachVocab, rag: config.rag,
        /* visual picker writes straight into config.resumeBranding; the raw
           JSON textarea is a merge-on-top override for advanced edits */
        resumeBranding: { ...(config.resumeBranding ?? {}), ...parseBrandJson(brandJson) },
        jobs: {
          refreshHours: Math.max(1, Math.round(jobsHours) || 24),
          sources: jobsSources.split(/\n/).map(l => l.trim()).filter(Boolean).map(l => {
            const [provider, ...rest] = l.split(":");
            return { provider: provider.trim(), board: rest.join(":").trim() };
          }),
          salaryEnrichment: {
            provider: enrProvider === "none" ? "none" : (enrProvider as "adzuna" | "adzuna-jobsworth"),
            country: enrCountry || "us",
            cap: Math.max(1, Math.min(200, enrCap || 30))
          }
        }
      });
      /* the enrichment row is server-read by jobs-fetch (client cache only
         holds the RemoteConfig copy) */
      if (enrProvider !== "none") {
        await saveJobSalaryEnrichment({ provider: enrProvider, country: enrCountry || "us", cap: Math.max(1, Math.min(200, enrCap || 30)) });
      }
      /* record what changed since the last publish for the weekly digest */
      const prev = audit[0]?.snapshot ?? {};
      const next = config.companyFreq ?? {};
      const changes: FreqChange[] = [];
      for (const [co, entries] of Object.entries(next)) {
        for (const [pid, raw] of Object.entries(entries)) {
          const to = raw as number;
          if (prev[co]?.[pid] !== to) changes.push({ company: co, problem: pid, to });
        }
      }
      for (const [co, entries] of Object.entries(prev)) {
        for (const pid of Object.keys(entries)) {
          if (!next[co]?.[pid]) changes.push({ company: co, problem: pid, to: 0 });
        }
      }
      const entry: FreqAuditEntry = { at: Date.now(), changes, snapshot: JSON.parse(JSON.stringify(next)) };
      const nextAudit = [entry, ...audit].slice(0, 50);
      saveFreqAudit(nextAudit);
      setAudit(nextAudit);
      toast("🎛️ Config published — clients pick it up on next sync");
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🚩 Feature flags</h2>
        <p className="mb-3 text-[12.5px] text-mut">Turn product areas on/off without shipping code. Clients hide the nav entry when a feature is off.</p>
        <div className="space-y-1">
          {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map(f => (
            <OptRow key={f} title={FEATURE_LABELS[f]} sub={config.features[f as keyof NonNullable<RemoteConfig["features"]>] === false ? "Off" : "On"}>
              <Switch checked={config.features[f as keyof NonNullable<RemoteConfig["features"]>] !== false} onChange={v => setFeature(f as keyof NonNullable<RemoteConfig["features"]>, v)} />
            </OptRow>
          ))}
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">✨ AI capabilities</h2>
        <p className="mb-3 text-[12.5px] text-mut">Server-side defaults the product team controls. Users can still override model/base URL locally.</p>
        <div className="space-y-3">
          <OptRow title="AI coaching enabled" sub="Master switch for generative feedback, hints and the tutor">
            <Switch checked={config.ai.enabled !== false} onChange={v => setAi("enabled", v)} />
          </OptRow>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumField label="Max tokens" value={config.ai.maxTokens ?? 700} onChange={v => setAi("maxTokens", v)} />
            <NumField label="Temperature (0–2)" value={config.ai.temperature ?? 0.6} step={0.1} onChange={v => setAi("temperature", v)} />
            <label className="block">
              <span className="mb-1 block text-[12px] font-bold text-mut">Suggested model</span>
              <input value={config.ai.model ?? ""} onChange={e => setAi("model", e.target.value)} placeholder="gpt-4o-mini" className="inp w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-bold text-mut">Embeddings model (RAG)</span>
              <input value={config.ai.embeddingsModel ?? ""} onChange={e => setAi("embeddingsModel", e.target.value)} placeholder="text-embedding-3-small" className="inp w-full" />
            </label>
          </div>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🎟️ Free quotas</h2>
        <p className="mb-3 text-[12.5px] text-mut">Applied when the paywall is on. Existing sessionsLeft/aiCallsLeft meters read these live.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumField label="Free sessions / month" value={config.limits.sessionsPerMonth ?? 3} onChange={v => setLimit("sessionsPerMonth", v)} />
          <NumField label="Free AI calls / day" value={config.limits.aiPerDay ?? 5} onChange={v => setLimit("aiPerDay", v)} />
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🎨 Resume branding (Apply Kit)</h2>
        <p className="mb-3 text-[12.5px] text-mut">Brand the designed resume per company — accent color + font. <code>_default</code> covers every company without its own entry. Clients apply it on their next sync, no deploy.</p>

        <div className="flex flex-wrap gap-2">
          {brandList().map(co => (
            <button
              key={co}
              onClick={() => pickBrand(co)}
              className={`rounded-full border px-3 py-1 text-[12px] font-extrabold transition-all ${brandCo === co ? "border-acc1/50 bg-acc1/15 text-acctxt" : "border-line/20 bg-deep/40 text-mut hover:text-ink"}`}
            >
              {co === "_default" ? "🌐 Default" : co}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mut">Accent color — {brandCo === "_default" ? "default" : brandCo}</span>
            <div className="flex flex-wrap gap-2">
              {["#4f46e5", "#0ea5e9", "#16a34a", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#111827"].map(hex => (
                <button
                  key={hex}
                  onClick={() => { setBrandAccent(hex); setBrandField(brandCo, hex, brandFont); }}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${brandAccent === hex ? "scale-110 border-ink" : "border-transparent opacity-80 hover:opacity-100"}`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                  aria-label={`Accent ${hex}`}
                />
              ))}
              <label className="relative flex h-8 cursor-pointer items-center gap-1 rounded-full border border-line/25 bg-deep/40 px-2 text-[10.5px] font-bold text-mut" title="Custom color">
                🎨
                <input type="color" className="h-5 w-7 cursor-pointer border-0 bg-transparent p-0" value={/^#[0-9a-f]{6}$/i.test(brandAccent) ? brandAccent : "#4f46e5"}
                  onChange={e => { setBrandAccent(e.target.value); setBrandField(brandCo, e.target.value, brandFont); }} />
              </label>
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mut">Font family</span>
            <select
              className="inp w-full cursor-pointer"
              value={brandFont}
              onChange={e => { setBrandFont(e.target.value); setBrandField(brandCo, brandAccent, e.target.value); }}
            >
              <option value="system">System default</option>
              <option value="Georgia, 'Times New Roman', serif">Serif (classic)</option>
              <option value="'Segoe UI', Arial, sans-serif">Sans (modern)</option>
              <option value="'Courier New', monospace">Mono (technical)</option>
            </select>
            <p className="mt-1 text-[10.5px] text-mut">Applied to the HTML one-pager; the PDF renderer uses its built-in typefaces.</p>
          </div>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-[11.5px] font-bold text-mut hover:text-ink">Raw JSON (advanced)</summary>
          <textarea
            value={brandJson}
            onChange={e => setBrandJson(e.target.value)}
            rows={5}
            placeholder={'{\n  "_default": { "accent": "#4f46e5" },\n  "Airbnb": { "accent": "#ff5a5f" }\n}'}
            className="inp mt-2 w-full font-mono text-[12px]"
          />
        </details>
        <p className="mt-2 text-[11.5px] text-mut">Pick a company above to edit its entry — swatches + font dropdown write back to the same config the publish button sends.</p>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">💼 Job feed (Apply Kit)</h2>
        <p className="mb-3 text-[12.5px] text-mut">How often the app auto-refreshes job postings, and which boards/feeds to pull from (one <code>provider:board</code> per line — greenhouse, ashby, lever, <code>remoteok:remoteok</code> for RemoteOK's official API, or <code>rss:https://…</code> for public job feeds like We Work Remotely or Himalayas).</p>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumField label="Auto-refresh every (hours)" value={jobsHours} onChange={v => setJobsHours(Math.max(1, Math.round(v)))} />
        </div>

        {/* last refresh health — a failing board shows up here, not just in logs */}
        {jobsReport && (
          <div className={`mb-3 rounded-xl border p-3 ${Object.keys(jobsReport.errors).length ? "border-warn/30 bg-warn/[.07]" : "border-ok/25 bg-ok/[.06]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-extrabold">
                {Object.keys(jobsReport.errors).length
                  ? `⚠️ Last refresh (${new Date(jobsReport.ran_at).toLocaleString()}) — ${Object.keys(jobsReport.errors).length} source${Object.keys(jobsReport.errors).length > 1 ? "s" : ""} failed`
                  : `✅ Last refresh (${new Date(jobsReport.ran_at).toLocaleString()}) — ${jobsReport.total} jobs (${jobsReport.added} new, ${jobsReport.updated} updated)`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const ageMs = Date.now() - new Date(jobsReport.ran_at).getTime();
                  const hours = Math.max(1, Math.round(jobsHours) || 24);
                  const stale = ageMs > hours * 3_600_000;
                  const mins = Math.round(ageMs / 60_000);
                  const label = mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
                  return (
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${stale ? "bg-warn/15 text-warn" : "bg-ok/10 text-ok"}`}>
                      {stale ? `⚠️ ${label} (stale)` : `🟢 ${label}`}
                    </span>
                  );
                })()}
                <button className={btnGhost + btnSm} disabled={jobsRefreshing} onClick={() => void runJobsRefresh()} title="Refresh the feed now (self-heal)">
                  {jobsRefreshing ? "Refreshing…" : "🔄 Refresh now"}
                </button>
                <button className={btnGhost + btnSm} onClick={() => void loadJobsReport()} title="Re-read the latest refresh report">↻</button>
              </div>
            </div>
            {Object.keys(jobsReport.errors).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(jobsReport.errors).map(([src, err]) => (
                  <p key={src} className="text-[11.5px] text-warn">
                    <span className="font-mono font-bold">{src}</span> — {err}
                  </p>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(jobsReport.per_source).map(([src, n]) => (
                <span key={src} className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${jobsReport.errors[src] ? "bg-warn/15 text-warn" : "bg-ok/10 text-ok"}`}>
                  {src.replace(/^https?:\/\/[^/]+\//, "")}: {n}
                </span>
              ))}
            </div>
          </div>
        )}
        {jobsReportErr && <p className="mb-2 text-[11.5px] text-warn">⚠️ Couldn't load refresh report — {jobsReportErr}</p>}

        <label className="block">
          <span className="mb-1 block text-[12px] font-bold text-mut">Sources</span>
          <textarea
            value={jobsSources}
            onChange={e => setJobsSources(e.target.value)}
            rows={5}
            placeholder={"greenhouse:lyft\ngreenhouse:airbnb\ngreenhouse:dropbox\nashby:linear\nashby:notion\nrss:https://remotive.com/feed/software-dev\nrss:https://weworkremotely.com/categories/remote-programming-jobs.rss"}
            className="inp w-full font-mono text-[12px]"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { label: "➕ WWR programming", src: "rss:https://weworkremotely.com/categories/remote-programming-jobs.rss" },
            { label: "➕ WWR full-stack", src: "rss:https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss" },
            { label: "➕ 🏔 Himalayas (curated remote)", src: "rss:https://himalayas.app/jobs/rss" },
            { label: "➕ 🚀 RemoteOK (official API)", src: "remoteok:remoteok" },
            { label: "➕ 🇮🇳 fampay (startup)", src: "lever:fampay" },
            { label: "➕ 🇮🇳 cred (startup)", src: "lever:cred" },
            { label: "➕ 🇮🇳 groww (startup)", src: "greenhouse:groww" }
          ].map(o => (
            <button
              key={o.src}
              className="rounded-full border border-line/20 bg-deep/40 px-2.5 py-1 text-[11.5px] font-bold text-mut transition-all hover:text-ink"
              onClick={() => setJobsSources(s => (s.trim() ? s.trim() + "\n" : "") + o.src)}
              title={`Add ${o.src}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-mut">Clients refresh on mount when the feed is older than the interval. The refresh button in the app also re-ingests on demand.</p>
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Salary enrichment</span>
              <select className="inp w-auto cursor-pointer" value={enrProvider} onChange={e => setEnrProvider(e.target.value)}>
                <option value="none">Off — only explicit posting ranges</option>
                <option value="adzuna">Adzuna search (posting data)</option>
                <option value="adzuna-jobsworth">Adzuna Jobsworth (title prediction)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Country code</span>
              <input className="inp w-20" value={enrCountry} onChange={e => setEnrCountry(e.target.value)} placeholder="us" disabled={enrProvider === "none"} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Max jobs / refresh</span>
              <input type="number" min={1} max={200} className="inp w-24" value={enrCap} onChange={e => setEnrCap(Number(e.target.value) || 30)} disabled={enrProvider === "none"} />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-mut">
            Fills salary bands only for postings that didn't state one — explicit ranges are never overwritten, and estimates show
            as “est.” in the app. Provider keys go in the function secrets: <span className="font-mono">ADZUNA_APP_ID</span> + <span className="font-mono">ADZUNA_APP_KEY</span> (Supabase dashboard → Edge Functions → jobs-fetch → Secrets).
          </p>
        </div>
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
          <p className="mt-2 text-[11.5px] text-mut">
            🔒 No secrets are stored in the browser — sends are authenticated by your admin session. The Resend key lives
            only as the function secret <span className="font-mono">RESEND_API_KEY</span> (Supabase → Edge Functions → send-apply-digest → Secrets),
            and the weekly pg_cron broadcast uses <span className="font-mono">APPLY_DIGEST_SECRET</span>.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className={btnGhost + btnSm} onClick={previewApply}>👀 Preview my digest</button>
            <button className={btnGhost + btnSm} disabled={!!digestTesting} onClick={() => void runApplyDigest(true)}>
              {digestTesting === "dryrun" ? "⏳ Counting…" : "📡 Dry-run broadcast"}
            </button>
            <button className={btnPrimary + btnSm} disabled={!!digestTesting} onClick={() => void runApplyDigest(false)}>
              {digestTesting === "send" ? "⏳ Sending…" : "📤 Send broadcast now"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-mut">Dry run counts recipients and shows their emails without sending — the broadcast fires the same empty-body request the pg_cron job sends every Monday.</p>
        </div>
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
          <p className="mt-2 text-[11.5px] text-mut">
            🔒 No secrets in the browser — sends are authenticated by your admin session. The weekly pg_cron broadcast
            uses <span className="font-mono">RECS_DIGEST_SECRET</span> and delivery needs <span className="font-mono">RESEND_API_KEY</span> (function secrets).
            Preview, dry-run, then send the blast here before the cron goes live.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className={btnGhost + btnSm} onClick={previewRecs}>👀 Preview my digest</button>
            <button className={btnGhost + btnSm} disabled={!!recsBusy} onClick={() => void runRecsBroadcast(true)}>
              {recsBusy === "dryrun" ? "⏳ Counting…" : "📡 Dry-run broadcast"}
            </button>
            <button className={btnPrimary + btnSm} disabled={!!recsBusy} onClick={() => void runRecsBroadcast(false)}>
              {recsBusy === "send" ? "⏳ Sending…" : "📤 Send broadcast now"}
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">🇮🇳 India & startup digest — same broadcast, kind: "india"</span>
          <p className="mt-1 text-[11.5px] text-mut">Filters the live feed to the Indian market (India locations, known Indian startups like fampay/cred/groww, and remote roles) and emails each user their top India picks — same secret guard, separate subject line.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className={btnGhost + btnSm} onClick={previewIndiaRecs}>👀 Preview 🇮🇳 digest</button>
            <button className={btnGhost + btnSm} disabled={!!indiaRecsBusy} onClick={() => void runIndiaRecsBroadcast(true)}>
              {indiaRecsBusy === "dryrun" ? "⏳ Counting…" : "📡 Dry-run broadcast"}
            </button>
            <button className={btnPrimary + btnSm} disabled={!!indiaRecsBusy} onClick={() => void runIndiaRecsBroadcast(false)}>
              {indiaRecsBusy === "send" ? "⏳ Sending…" : "📤 Send broadcast now"}
            </button>
          </div>
        </div>
      </div>
      {recsPreview && (
        <Modal onClose={() => setRecsPreview(null)} title="👀 Recommendations digest preview" desc="What this week's email would look like for the profile saved in this browser.">
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">{recsPreview}</pre>
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setRecsPreview(null)}>Close</button>
        </Modal>
      )}
      {indiaRecsPreview && (
        <Modal onClose={() => setIndiaRecsPreview(null)} title="👀 🇮🇳 India & startup digest preview" desc="What the India digest would look like for the profile saved in this browser.">
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">{indiaRecsPreview}</pre>
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setIndiaRecsPreview(null)}>Close</button>
        </Modal>
      )}
      {indiaRecsRecipients && (
        <Modal onClose={() => setIndiaRecsRecipients(null)} title="📡 🇮🇳 India digest — dry-run recipients" desc={`Would email ${indiaRecsRecipients.length} user${indiaRecsRecipients.length === 1 ? "" : "s"} (nothing sent).`}>
          {indiaRecsRecipients.length ? (
            <ul className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
              {indiaRecsRecipients.map((e, i) => <li key={e} className="px-2 py-1.5">{i + 1}. {e}</li>)}
            </ul>
          ) : (
            <p className="text-[12.5px] text-mut">No recipients — nobody has an uploaded resume with a profile yet.</p>
          )}
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setIndiaRecsRecipients(null)}>Close</button>
        </Modal>
      )}
      {applyPreview && (
        <Modal onClose={() => setApplyPreview(null)} title="👀 Apply digest preview" desc="What this week's email would look like for the tracker in this browser.">
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">{applyPreview}</pre>
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setApplyPreview(null)}>Close</button>
        </Modal>
      )}
      {recsRecipients && (
        <Modal onClose={() => setRecsRecipients(null)} title="📡 Recommendations digest — dry-run recipients" desc={`Would email ${recsRecipients.length} user${recsRecipients.length === 1 ? "" : "s"} (nothing sent).`}>
          {recsRecipients.length ? (
            <ul className="max-h-[320px] divide-y divide-line/10 overflow-auto rounded-xl border border-line/15 bg-deep/50 p-2 text-[12.5px] text-fnt">
              {recsRecipients.map((e, i) => <li key={e} className="px-2 py-1.5">{i + 1}. {e}</li>)}
            </ul>
          ) : (
            <p className="rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] text-mut">No one to email yet — users need a synced uploaded resume with a saved profile.</p>
          )}
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setRecsRecipients(null)}>Close</button>
        </Modal>
      )}
      {applyRecipients && (
        <Modal onClose={() => setApplyRecipients(null)} title="📡 Apply digest — dry-run recipients" desc={`Would email ${applyRecipients.length} user${applyRecipients.length === 1 ? "" : "s"} (nothing sent).`}>
          {applyRecipients.length ? (
            <ul className="max-h-[320px] divide-y divide-line/10 overflow-auto rounded-xl border border-line/15 bg-deep/50 p-2 text-[12.5px] text-fnt">
              {applyRecipients.map((e, i) => <li key={e} className="px-2 py-1.5">{i + 1}. {e}</li>)}
            </ul>
          ) : (
            <p className="rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] text-mut">No one to email yet — users need a synced tracker.</p>
          )}
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setApplyRecipients(null)}>Close</button>
        </Modal>
      )}

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">📬 Weekly digest</h2>
        <p className="mb-3 text-[12.5px] text-mut">What changed in the company-frequency rankings over the last 7 days, and how many users are active (they pick up config on their next sync).</p>
        {(() => {
          const week = audit.filter(e => Date.now() - e.at < 7 * 86_400_000);
          const all = week.flatMap(e => e.changes.map(c => ({ ...c, at: e.at })));
          return (
            <div className="text-[12.5px]">
              <div className="mb-2 flex flex-wrap gap-2">
                <Chip tone="co">{all.length} change{all.length === 1 ? "" : "s"} this week</Chip>
                <Chip tone="lvl">👥 {activeWeek ?? "…"} user{activeWeek === 1 ? "" : "s"} active this week</Chip>
              </div>
              {all.length === 0 ? (
                <p className="text-mut">No frequency changes published in the last 7 days.</p>
              ) : (
                <ul className="max-h-[180px] space-y-1 overflow-y-auto pr-1">
                  {all.slice(0, 20).map((c, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-deep/40 px-2.5 py-1">
                      <span className="font-semibold">{companyById(c.company).icon} {companyById(c.company).name} · {c.problem}</span>
                      <span className="text-[11px] font-bold text-acctxt">{c.to === 0 ? "↩ reset to default" : `→ 🔥${c.to}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🔥 Company question frequency</h2>
        <p className="mb-3 text-[12.5px] text-mut">Rank how often each company asks a problem (1 occasional · 2 common · 3 very common). Published overrides merge on top of the baked-in table — no deploy needed, clients pick it up on next sync.</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {freqCompanies.map(c => (
            <button
              key={c.id}
              onClick={() => setFreqCo(freqCo === c.id ? null : c.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${freqCo === c.id ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
        {freqCo && (
          <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
            {problemsForCompany(freqCo).map(p => {
              const base = COMPANY_FREQ[freqCo]?.[p.id] ?? 1;
              const cur = config.companyFreq?.[freqCo]?.[p.id];
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-2.5 py-1.5 text-[12px]">
                  <span className="flex-1 truncate font-semibold">{p.title}</span>
                  <span className={`text-[10px] font-extrabold uppercase ${p.difficulty === 1 ? "text-ok" : p.difficulty === 2 ? "text-warn" : "text-bad"}`}>
                    {["Easy", "Medium", "Hard"][p.difficulty - 1]}
                  </span>
                  <span className="text-[10px] font-bold text-mut">base 🔥{base}</span>
                  <select
                    value={cur ?? 0}
                    onChange={e => setFreq(p.id, Number(e.target.value))}
                    className="rounded-lg border border-line/15 bg-deep px-1.5 py-1 text-[11px] font-bold text-ink outline-none"
                  >
                    <option value={0}>Default ({base})</option>
                    <option value={1}>1 · Occasional</option>
                    <option value={2}>2 · Common</option>
                    <option value={3}>3 · Very common</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RAG retrieval — grounding threshold + candidate pool + hard floor the
          tutor and API coach use; published like the frequency table */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🗄️ RAG retrieval</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          How strictly the tutor/coach ground answers in the knowledge base. A higher similarity cutoff means
          fewer (but safer) citations — answers then come from general knowledge and say so. The candidate pool is
          how many vector hits the hybrid re-ranker considers. The hard floor is the similarity at which a chunk is
          cited even with zero shared concepts — the escape hatch when the concept gate is too strict.
          Clients pick these up on next sync.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumField
            label={`Grounding similarity cutoff (0.30–0.80) — current ${config.rag?.minSim ?? 0.45}`}
            value={config.rag?.minSim ?? 0.45} step={0.01}
            onChange={v => setRag("minSim", Math.max(0.1, Math.min(0.95, v)))}
          />
          <NumField
            label={`Vector candidate pool (4–50) — current ${config.rag?.candidatePool ?? 24}`}
            value={config.rag?.candidatePool ?? 24} step={1}
            onChange={v => setRag("candidatePool", Math.max(2, Math.min(50, Math.round(v))))}
          />
          <NumField
            label={`Hard floor, concept-free cite (0.80–0.95) — current ${config.rag?.hardFloor ?? 0.85}`}
            value={config.rag?.hardFloor ?? 0.85} step={0.01}
            onChange={v => setRag("hardFloor", Math.max(0.7, Math.min(0.99, v)))}
          />
        </div>
        <p className="mt-2 text-[11.5px] text-fnt">
          💡 Preview the effect on real retrieval events in <span className="font-bold">Quality → 🛰️ RAG health</span> before publishing.
        </p>
      </div>

      {/* RAG digest alerts — weekly threshold breaches surface in the Quality RAG
          tab and can be delivered via webhook (Slack / email bridge) once a week */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🔔 RAG digest alerts</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Every week the RAG health tab evaluates the last 7 days against these thresholds. A breach shows an
          in-app alert banner; if a delivery webhook is set (Slack incoming webhook or an email bridge), it is
          also delivered once per week. Published like the rest of the config.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumField
            label={`Alert when grounded rate below (%) — current ${config.rag?.digest?.minGroundedRate ?? 60}`}
            value={config.rag?.digest?.minGroundedRate ?? 60} step={1}
            onChange={v => setRagDigest("minGroundedRate", Math.max(0, Math.min(100, Math.round(v))))}
          />
          <NumField
            label={`Alert when empty-hit rate above (%) — current ${config.rag?.digest?.maxEmptyRate ?? 40}`}
            value={config.rag?.digest?.maxEmptyRate ?? 40} step={1}
            onChange={v => setRagDigest("maxEmptyRate", Math.max(0, Math.min(100, Math.round(v))))}
          />
          <NumField
            label={`Alert when gate rejects above — current ${config.rag?.digest?.maxGateRejects ?? 10}`}
            value={config.rag?.digest?.maxGateRejects ?? 10} step={1}
            onChange={v => setRagDigest("maxGateRejects", Math.max(0, Math.round(v)))}
          />
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-[12px] font-bold text-mut">
            Delivery webhook URL (Slack / email bridge) — {config.rag?.digest?.webhook ? "set" : "not set"}
          </span>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/…"
            value={config.rag?.digest?.webhook ?? ""}
            onChange={e => setRagDigest("webhook", e.target.value)}
            className="inp w-full"
          />
        </label>
        <p className="mt-2 text-[11.5px] text-fnt">
          💡 Leave the webhook empty for in-app alerts only — the banner shows whenever an alert fires.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold">
            <Switch
              checked={config.rag?.digest?.sendWeekly ?? false}
              onChange={v => setRagDigest("sendWeekly", v)}
            />
            Send the full weekly digest (not just breaches) once per week
          </label>
          <span className="text-[11px] text-mut">— delivered to the webhook each Monday with metrics, top queries and top documents.</span>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-[12px] font-bold text-mut">
            Digest recipients (emails the bridge should mail) — {config.rag?.digest?.email ? "set" : "not set"}
          </span>
          <input
            type="text"
            placeholder="ops@company.com, you@company.com"
            value={config.rag?.digest?.email ?? ""}
            onChange={e => setRagDigest("email", e.target.value)}
            className="inp w-full"
          />
        </label>
        <p className="mt-1 text-[11.5px] text-fnt">
          Passed to the bridge as <span className="font-mono">to</span> — point the webhook at an email bridge (e.g. Zapier → Gmail) to receive the digest by mail.
        </p>
        <div className="mt-3 rounded-xl border border-line/10 bg-deep/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold">
              <Switch
                checked={config.rag?.digest?.nativeEmail ?? false}
                onChange={v => setRagDigest("nativeEmail", v)}
              />
              📧 Native email — send via the <span className="font-mono">send-rag-digest</span> Edge Function (no webhook)
            </label>
          </div>
          {config.rag?.digest?.nativeEmail && (
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-bold text-mut">From address — {config.rag?.digest?.from ? "set" : "default InterviewIQ <digest@interviewiq.app>"}</span>
                <input
                  type="text"
                  placeholder="InterviewIQ <digest@interviewiq.app>"
                  value={config.rag?.digest?.from ?? ""}
                  onChange={e => setRagDigest("from", e.target.value)}
                  className="inp w-full"
                />
              </label>
              <p className="text-[11px] text-fnt">
                🔒 No secrets are stored in the browser — this digest is sent with your admin session and the
                <span className="font-mono"> RESEND_API_KEY</span> function secret (Supabase → Edge Functions → send-rag-digest → Secrets).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* coach vocabulary — concept families + misconception corrections the
          offline tutor uses; published to every client like the frequency table */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🧠 Coach vocabulary</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Teach the offline tutor new concepts and misconception corrections without a deploy. JSON:
          <span className="font-mono"> {"{"} families: {"{"} family: ["word", "…"] {"}"}, misconceptions: [{"{"} re: "regex", correction: "…" {"}"}] {"}"} </span>
          Family words make answers match (e.g. <span className="font-mono">micro-frontend</span> ≈ splitting); misconception
          regexes settle debates (e.g. <span className="font-mono">"graphql is always better"</span>). Clients apply these on next sync.
        </p>
        <textarea
          value={vocabJson}
          onChange={e => setVocabJson(e.target.value)}
          rows={8}
          spellCheck={false}
          className="inp w-full resize-y font-mono text-[12px] leading-relaxed"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            className={btnGhost + btnSm}
            onClick={() => {
              try {
                const parsed = JSON.parse(vocabJson || "{}") as Record<string, unknown>;
                if (parsed.families !== undefined && (typeof parsed.families !== "object" || Array.isArray(parsed.families))) throw new Error("families must be an object of arrays");
                if (parsed.misconceptions !== undefined && !Array.isArray(parsed.misconceptions)) throw new Error("misconceptions must be an array");
                setConfig({ ...config, coachVocab: (parsed.families || parsed.misconceptions) ? parsed as RemoteConfig["coachVocab"] : undefined });
                toast("✅ Vocabulary staged — hit “Publish config to all clients” to ship it");
              } catch (e) {
                toast("✗ Invalid JSON: " + ((e as Error).message || "parse error"));
              }
            }}
          >
            💾 Validate & stage
          </button>
          {config.coachVocab && (
            <span className="text-[11.5px] text-fnt">
              Staged: {Object.keys(config.coachVocab.families ?? {}).length} famil{(Object.keys(config.coachVocab.families ?? {}).length === 1 ? "y" : "ies")} · {(config.coachVocab.misconceptions ?? []).length} correction{(config.coachVocab.misconceptions ?? []).length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button className={btnPrimary} onClick={publish} disabled={busy}>
          {busy ? <><span className="spinner" /> Publishing…</> : "🚀 Publish config to all clients"}
        </button>
      </div>
    </div>
  );
}

function NumField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-mut">{label}</span>
      <input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="inp w-full" />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Admin teams — team analytics section                                */
/* ------------------------------------------------------------------ */

function AdminTeams({ teamState }: { teamState: TeamsState }) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  if (!teamState.teams.length) {
    return (
      <div className={`${cardCls} flex flex-col items-center px-6 py-10 text-center`}>
        <div className="text-[36px]">🏢</div>
        <h2 className="mt-2 text-base font-extrabold">No teams yet</h2>
        <p className="mx-auto mt-1 max-w-[400px] text-[13px] text-mut">
          Teams are created from the 🏢 Team view (More menu) by signed-in users — once any exists, their analytics show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {teamState.teams.map(t => (
        <div key={t.teamId} className={`${cardCls} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-3 p-5">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[15.5px] font-extrabold">
                {t.name}
                {t.role === "owner" ? <span className="rounded-full border border-co/40 bg-co/15 px-2 py-0.5 text-[10px] font-bold text-co">OWNER</span> : <span className="text-[12px] text-mut">· {t.role}</span>}
              </div>
              <div className="mt-1 text-[12.5px] text-mut">{t.members}/{t.seats} seats used</div>
            </div>
            <button
              onClick={() => { selectTeam(t.teamId); setExpandedTeam(expandedTeam === t.teamId ? null : t.teamId); }}
              className="rounded-lg border border-line/20 px-3 py-1.5 text-[12.5px] font-bold text-mut hover:bg-wht/10"
            >
              {expandedTeam === t.teamId ? "△ Collapse" : "▽ View members"}
            </button>
          </div>
          {/* seat utilization bar */}
          <div className="border-t border-line/10 bg-wht/[.03] px-5 py-3">
            <div className="flex items-center justify-between text-[12px] text-mut">
              <span>Seat utilization</span>
              <span>{Math.round((t.members / Math.max(1, t.seats)) * 100)}%</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-wht/10">
              <div className={`h-full rounded-full ${t.members === t.seats ? "grad-bg" : "grad-bg-soft"}`}
                style={{ width: `${Math.min(100, (t.members / Math.max(1, t.seats)) * 100)}%` }} />
            </div>
          </div>
          {expandedTeam === t.teamId && (
            <div className="border-t border-line/10 px-5 py-3">
              <h4 className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-mut">Members</h4>
              {teamState.roster.length === 0 && <p className="text-[12px] text-mut">Loading…</p>}
              {teamState.roster.map(m => (
                <div key={m.userId ?? m.invitedEmail ?? m.email} className="flex items-center gap-2 py-1.5 text-[13px]">
                  <span className="h-2 w-2 rounded-full bg-ok" />
                  <span className="flex-1 font-bold">{m.email ?? m.invitedEmail ?? "—"}</span>
                  <span className="text-mut">{m.status}</span>
                  {m.status === "active" && <span className="text-[11px] text-ok">active</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OptRow({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 py-3 last:border-0">
      <div>
        <div className="text-[14px] font-bold">{title}</div>
        <div className="text-[12px] text-fnt">{sub}</div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quality Center — scoreboard, calibration, staleness, feedback       */

const QUALITY_TABS = [
  { value: "scoreboard", label: "📊 Scoreboard" },
  { value: "calibration", label: "🎚️ Calibration" },
  { value: "staleness", label: "⏳ Staleness" },
  { value: "feedback", label: "💬 Feedback" },
  { value: "coding", label: "💻 Coding" },
  { value: "coach", label: "🎯 Coach gaps" },
  { value: "rag", label: "🛰️ RAG health" }
] as const;

function QualityBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-ok" : score >= 60 ? "bg-warn" : "bg-bad";
  return (
    <div className="h-[7px] w-[92px] overflow-hidden rounded-full bg-wht/15" title={`${score}/100`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: Math.max(4, score) + "%" }} />
    </div>
  );
}

/* playground grid — candidate (cutoff, hard floor) pairs to simulate */
const PLAY_MINSIMS = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75];
const PLAY_FLOORS = [0.75, 0.8, 0.85, 0.9, 0.95];

function QualitySection({
  busy, setBusy, onApplyHardFloor, onStageTuning
}: {
  busy: boolean;
  setBusy: (b: boolean) => void;
  /** Stages a suggested hard floor into the Product config draft (auto-tune). */
  onApplyHardFloor: (v: number) => void;
  /** Stages a playground pick (cutoff + hard floor) into the config draft. */
  onStageTuning: (minSim: number, hardFloor: number) => void;
}) {
  const [rows, setRows] = useState<QualityRow[]>([]);
  const [feed, setFeed] = useState<FeedbackFeedRow[]>([]);
  const [coding, setCoding] = useState<CodingQualityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof QUALITY_TABS)[number]["value"]>("scoreboard");
  const [cutoff, setCutoff] = useState(90);
  const [refreshed, setRefreshed] = useState<Set<string>>(new Set());
  const [coachGaps, setCoachGaps] = useState<CoachGapRow[]>([]);
  const [ragRows, setRagRows] = useState<RagHealthRow[]>([]);
  const [ragDigest, setRagDigest] = useState<RagWeeklyDigest | null>(null);
  const [ragDocs, setRagDocs] = useState<RagDocRow[]>([]);
  const [ragDomains, setRagDomains] = useState<RagDomainRow[]>([]);
  const [kbSuggestions, setKbSuggestions] = useState<KbSuggestionRow[]>([]);
  /* weekly digest delivery — which week the full digest was last sent */
  const [digestSentWeek, setDigestSentWeek] = useState<string | null>(() => storageGet<string>(STORAGE_KEYS.ragDigestWeek, "") || null);
  const [kbDocs, setKbDocs] = useState<PdfDocumentRow[]>([]);
  /* threshold explorer — reclassify recent retrievals against any cutoff */
  const [ragThreshold, setRagThreshold] = useState<number>(() => effectiveGroundingMinSim());
  /* clickable histogram — filter the query log to one similarity band */
  const [histSel, setHistSel] = useState<number | null>(null);
  const [reindexBusy, setReindexBusy] = useState(false);
  /* RAG digest alerts — breached thresholds surface as a banner; when a webhook
     (Slack / email bridge) is configured they are delivered once per week */
  const [alertSent, setAlertSent] = useState(false);
  /* coach-gap alerts — topics debated enough to warrant a deep-dive guide */
  const [gapMin, setGapMin] = useState(5);
  const gapAlerts = coachGaps.filter(g => g.discussions >= gapMin);
  const draftGuide = (topic: string) => {
    const t = `Deep-dive guide: ${topic}

Concepts to cover:
- 
- 

Key points interviewers look for:
- 
- 

Common traps:
- 
- 

Practice questions:
- 
`;
    navigator.clipboard.writeText(t).then(() => toast("📋 Guide template copied — paste it into the deep-dive bank"), () => toast("✗ Clipboard blocked — copy manually"));
  };

  const bank = getPublishedQuestions();
  const merged = useMemo(
    () => mergeQuality(rows, bank.map(b => ({ question: b.question, updatedAt: b.updatedAt }))),
    [rows, bank]
  );
  const stale = merged
    .filter(m => m.staleDays != null && m.staleDays > cutoff)
    .sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0));

  const load = () => {
    setLoading(true);
    void Promise.all([adminQuestionQuality(), adminFeedbackFeed(50), adminCodingQuality(), adminCoachGaps(), adminRagHealth(), adminRagDocuments(), adminRagWeeklyDigest(), adminRagDomains(), adminKbSuggestions(), listPdfDocuments()])
      .then(([q, f, c, g, r, d, dig, dom, sug, k]) => { setRows(q); setFeed(f); setCoding(c); setCoachGaps(g); setRagRows(r); setRagDocs(d); setRagDigest(dig); setRagDomains(dom); setKbSuggestions(sug); setKbDocs(k); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const ragAlerts = useMemo(
    () => (ragDigest && ragDigest.total > 0 ? evaluateRagDigest(ragDigest, getRagDigestOpts()).filter(a => a.fired) : []),
    [ragDigest]
  );
  /* tuning playground — the recent log reclassified at every candidate pair */
  const playCells = useMemo(() => simulateTuning(ragRows, PLAY_MINSIMS, PLAY_FLOORS), [ragRows]);
  useEffect(() => {
    if (!ragAlerts.length || alertSent) return;
    const wk = weekKey();
    if (storageGet<string>(STORAGE_KEYS.ragAlertWeek, "") === wk) { setAlertSent(true); return; }
    const opts = getRagDigestOpts();
    if (!opts.webhook) return; /* in-app banner only — nothing to deliver to */
    storageSet(STORAGE_KEYS.ragAlertWeek, wk);
    setAlertSent(true);
    void fetch(opts.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "rag_digest_alert",
        week: wk,
        alerts: ragAlerts.map(a => ({ severity: a.severity, title: a.title, detail: a.detail })),
        digest: {
          total: ragDigest?.total ?? 0,
          groundedRate: ragDigest ? Math.round((ragDigest.grounded / Math.max(1, ragDigest.total)) * 100) : 0,
          emptyRate: ragDigest ? Math.round((ragDigest.empty / Math.max(1, ragDigest.total)) * 100) : 0,
          avgTopSim: ragDigest?.avgTopSim ?? 0,
          gateRejects: ragDigest?.gateRejects ?? 0
        },
        sentAt: new Date().toISOString()
      })
    }).catch(() => { /* webhook delivery is best-effort */ });
  }, [ragAlerts, alertSent]);

  /* Sends the FULL weekly digest (metrics + top queries + top documents) to
     the configured webhook / email bridge. Shared by the scheduled effect
     and the manual “Send now” button. */
  const deliverDigest = async (wk: string) => {
    const opts = getRagDigestOpts();
    const dig = ragDigest;
    if (!dig) return;
    const payload = {
      event: "rag_weekly_digest",
      week: wk,
      to: (opts.email ?? "").split(",").map(s => s.trim()).filter(Boolean),
      digest: {
        total: dig.total,
        grounded: dig.grounded,
        groundedRate: Math.round((dig.grounded / Math.max(1, dig.total)) * 100),
        empty: dig.empty,
        emptyRate: Math.round((dig.empty / Math.max(1, dig.total)) * 100),
        avgTopSim: dig.avgTopSim,
        gateRejects: dig.gateRejects,
        prevTotal: dig.prevTotal,
        prevGrounded: dig.prevGrounded,
        topQueries: dig.topQueries,
        topDocs: dig.topDocs
      },
      sentAt: new Date().toISOString()
    };
    if (opts.nativeEmail) {
      /* native delivery — send-rag-digest Edge Function (no webhook needed) */
      const fnUrl = `${CONFIG.supabase.url}/functions/v1/send-rag-digest`;
      const headers = await cloudFnHeaders();
      void fetch(fnUrl, { method: "POST", headers, body: JSON.stringify({ ...payload, from: opts.from ?? "InterviewIQ <digest@interviewiq.app>" }) })
        .then(async r => {
          const j = await r.json().catch(() => ({}));
          if (j && !j.sent) toast("📧 Native digest: " + (j.reason ?? "delivery failed — check the function"));
        })
        .catch(() => toast("✗ Native digest delivery failed — is the send-rag-digest function deployed?"));
      return;
    }
    if (!opts.webhook) return;
    void fetch(opts.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => { /* delivery is best-effort — the in-app digest stays visible */ });
  };

  /* scheduled weekly digest — once per week when enabled, no repeated sends */
  useEffect(() => {
    if (!ragDigest || ragDigest.total <= 0 || digestSentWeek) return;
    const opts = getRagDigestOpts();
    if (!opts.sendWeekly || !opts.webhook) return;
    const wk = weekKey();
    if (storageGet<string>(STORAGE_KEYS.ragDigestWeek, "") === wk) { setDigestSentWeek(wk); return; }
    storageSet(STORAGE_KEYS.ragDigestWeek, wk);
    setDigestSentWeek(wk);
    deliverDigest(wk);
  }, [ragDigest, digestSentWeek]);

  /* manual digest send — same payload, no weekly gate */
  const sendDigestNow = () => {
    if (!ragDigest || ragDigest.total <= 0) { toast("Nothing to send yet — the digest fills once signed-in users ask the tutor/coach"); return; }
    const opts = getRagDigestOpts();
    if (!opts.webhook) { toast("Set a delivery webhook in Product config → 🔔 RAG digest alerts first"); return; }
    const wk = weekKey();
    storageSet(STORAGE_KEYS.ragDigestWeek, wk);
    setDigestSentWeek(wk);
    deliverDigest(wk);
    toast("📧 Weekly digest queued to the webhook / email bridge");
  };

  const touch = async (question: string) => {
    const q = bank.find(b => b.question === question);
    if (!q) return;
    setBusy(true);
    try {
      await touchQuestion(q.id);
      setRefreshed(s => new Set(s).add(question));
      toast("✓ Marked reviewed — staleness clock restarted");
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  /* re-embed ONE document with the current chunker (used from the RAG tab). */
  const reindexOne = async (doc: PdfDocumentRow) => {
    if (!aiAvailable()) { toast("Add an AI key in Settings — re-indexing needs one"); return; }
    setReindexBusy(true);
    try {
      const oldRows = await listPdfChunks(doc.id);
      if (!oldRows.length) { toast(`⏭️ "${doc.title}" has no chunks to re-index`); return; }
      const text = oldRows.map(c => c.content).join("\n");
      const r = await reindexDocument(doc.id, text, oldRows);
      if (r.changed === 0) { toast(`⏭️ "${doc.title}" already matches the current chunker`); return; }
      await load();
      toast(`♻️ Re-indexed "${doc.title}" — ${r.fresh} fresh embed${r.fresh === 1 ? "" : "s"}, reused ${r.reused}`);
    } catch (e) { toast("✗ " + ((e as Error).message || "Re-index failed")); }
    finally { setReindexBusy(false); }
  };

  /* calibration bands — pass rate 0-20 / 20-40 / … / 80-100 */
  const confident = merged.filter(m => m.attempts >= 5);
  const tooEasy = confident.filter(m => m.passRate > 90);
  const tooHard = confident.filter(m => m.passRate < 30);
  const bins = [0, 20, 40, 60, 80].map(low => {
    const items = merged.filter(m => m.passRate >= low && m.passRate < low + 20);
    return { low, count: items.length };
  });
  const maxBin = Math.max(1, ...bins.map(b => b.count));

  const bandTone = { healthy: "ok", watch: "warn", fix: "bad" } as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">🔎 Content quality center</h2>
          <p className="text-[12.5px] text-mut">
            Every question that real users answered, scored on performance, difficulty, feedback and freshness.
            The composite score (0-100) is: avg score · pass-rate band · 👍/👎/🚩 · days since review.
          </p>
        </div>
        <Seg
          options={QUALITY_TABS.map(t => t.value === "coach" && gapAlerts.length > 0 ? { ...t, label: `${t.label} · ${gapAlerts.length}` } : t)}
          value={tab}
          onChange={v => setTab(v)}
        />
        <button className={btnGhost + btnSm} onClick={load} disabled={busy}>↻ Refresh</button>
      </div>

      {loading && rows.length === 0 && <p className="text-center text-mut"><span className="spinner inline-block" /> Crunching session data…</p>}

      {tab === "scoreboard" && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-line/10 p-5">
            <h3 className="text-[15px] font-extrabold">📊 Scoreboard ({merged.length} questions with data)</h3>
            <p className="text-[12.5px] text-mut">Worst first. Low-attempt rows are low-confidence — check before acting.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
                  <th className="px-5 py-3 font-bold">Question</th>
                  <th className="px-3 py-3 font-bold">Field · level</th>
                  <th className="px-3 py-3 font-bold">Attempts</th>
                  <th className="px-3 py-3 font-bold">Avg</th>
                  <th className="px-3 py-3 font-bold">Miss</th>
                  <th className="px-3 py-3 font-bold">Pass</th>
                  <th className="px-3 py-3 font-bold">Feedback</th>
                  <th className="px-3 py-3 font-bold">Stale</th>
                  <th className="px-3 py-3 font-bold">Quality</th>
                  <th className="px-5 py-3 font-bold" />
                </tr>
              </thead>
              <tbody>
                {merged.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-10 text-center text-mut">No scored sessions yet — complete an interview and come back.</td></tr>
                )}
                {merged.map(m => (
                  <tr key={m.question} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                    <td className="max-w-[300px] px-5 py-3">
                      <div className="truncate font-bold">{m.question}</div>
                      <div className="text-[11.5px] text-fnt">
                        {m.attempts < 5 ? "⚠️ low confidence" : `last ${m.lastSeen ? new Date(m.lastSeen).toLocaleDateString() : "—"}`}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Chip tone="cat">{FIELDS.find(f => f.id === m.fieldId)?.name ?? m.fieldId}</Chip>
                      <span className="ml-1 text-[11.5px] text-fnt">{LEVELS.find(l => l.id === m.level)?.name ?? m.level}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{m.attempts}</td>
                    <td className="px-3 py-3 font-bold tabular-nums">{m.avgScore}/5</td>
                    <td className="px-3 py-3 tabular-nums text-bad">{m.missRate}%</td>
                    <td className="px-3 py-3 tabular-nums text-ok">{m.passRate}%</td>
                    <td className="px-3 py-3 tabular-nums">
                      <span className="text-ok">👍{m.ups}</span> <span className="text-bad">👎{m.downs}</span> <span className="text-warn">🚩{m.flags}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{m.staleDays == null ? "—" : m.staleDays + "d"}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <QualityBar score={m.score} />
                        <Chip tone={bandTone[m.band]}>{m.score}</Chip>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {bank.some(b => b.question === m.question) && !refreshed.has(m.question) ? (
                        <button className={btnGhost + btnSm} onClick={() => touch(m.question)} disabled={busy}>✓ Reviewed</button>
                      ) : bank.some(b => b.question === m.question) ? (
                        <Chip tone="ok">✓ fresh</Chip>
                      ) : (
                        <span className="text-[11.5px] text-fnt" title="Curated question shipped in code — versioned with the app">in code</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "calibration" && (
        <div className="space-y-4">
          <div className={`${cardCls} p-5`}>
            <h3 className="text-[15px] font-extrabold">🎚️ Difficulty calibration ({confident.length} questions with ≥5 attempts)</h3>
            <p className="text-[12.5px] text-mut">
              Pass rate = % of answers scored ≥3/5. The healthy band is 30-90%: under 30% the question is
              too hard or badly worded; over 90% it's too easy to be worth the user's time.
            </p>
            <div className="mt-4 flex h-[140px] items-end gap-3">
              {bins.map(b => (
                <div key={b.low} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="text-[11px] font-bold tabular-nums text-fnt">{b.count}</div>
                  <div
                    className={`w-full max-w-[80px] rounded-t-lg ${b.low === 40 || b.low === 60 ? "bg-ok/70" : b.low === 20 || b.low === 80 ? "bg-warn/60" : "bg-bad/60"}`}
                    style={{ height: Math.max(4, (b.count / maxBin) * 100) + "px" }}
                  />
                  <div className="text-[10.5px] font-bold text-mut">{b.low}–{b.low + 20}%</div>
                </div>
              ))}
            </div>
          </div>
          {tooEasy.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h3 className="mb-2 text-[15px] font-extrabold text-ok">✅ Too easy (&gt;90% pass) — consider leveling up or replacing</h3>
              <ul className="space-y-1.5">
                {tooEasy.map(m => <li key={m.question} className="text-[13px] text-mut">• {m.question} <span className="text-fnt">({m.passRate}% · {m.attempts} attempts)</span></li>)}
              </ul>
            </div>
          )}
          {tooHard.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h3 className="mb-2 text-[15px] font-extrabold text-bad">🔴 Too hard or unclear (&lt;30% pass) — review wording & model answer</h3>
              <ul className="space-y-1.5">
                {tooHard.map(m => <li key={m.question} className="text-[13px] text-mut">• {m.question} <span className="text-fnt">({m.passRate}% · {m.attempts} attempts)</span></li>)}
              </ul>
            </div>
          )}
          {confident.length === 0 && <p className="text-center text-mut">Not enough data yet — outliers appear once questions have ≥5 attempts.</p>}
        </div>
      )}

      {tab === "staleness" && (
        <div className={`${cardCls} p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <h3 className="text-[15px] font-extrabold">⏳ Staleness queue ({stale.length})</h3>
              <p className="text-[12.5px] text-mut">
                Questions not edited or marked reviewed for {cutoff}+ days. Interview topics churn — refresh
                anything the market has moved past. (Curated code questions aren't listed; they ship with the app.)
              </p>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] font-bold text-mut">
              Stale after
              <select value={cutoff} onChange={e => setCutoff(Number(e.target.value))} className="inp w-[90px]">
                {[60, 90, 120, 180, 270, 365].map(d => <option key={d} value={d}>{d}d</option>)}
              </select>
            </label>
          </div>
          <div className="mt-3 space-y-2">
            {stale.length === 0 && <p className="py-6 text-center text-[13px] text-mut">Nothing stale — the bank is healthy. 🎉</p>}
            {stale.map(m => (
              <div key={m.question} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold">{m.question}</div>
                  <div className="text-[11.5px] text-fnt">
                    {m.staleDays}d since last edit · avg {m.avgScore}/5 · {m.attempts} attempts
                  </div>
                </div>
                <Chip tone={(m.staleDays ?? 0) > 270 ? "bad" : (m.staleDays ?? 0) > 180 ? "warn" : "default"}>{(m.staleDays ?? 0)}d</Chip>
                <button className={btnGhost + btnSm} onClick={() => touch(m.question)} disabled={busy || refreshed.has(m.question)}>
                  {refreshed.has(m.question) ? "✓ done" : "✓ Reviewed"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "feedback" && (
        <div className={`${cardCls} p-5`}>
          <h3 className="text-[15px] font-extrabold">💬 Recent answer feedback ({feed.length})</h3>
          <p className="mb-3 text-[12.5px] text-mut">👍/👎/🚩 from every user, signed in or not — the most direct quality signal there is.</p>
          <div className="space-y-2">
            {feed.length === 0 && <p className="py-6 text-center text-[13px] text-mut">No feedback yet — it appears as users rate answers in the app.</p>}
            {feed.map((f, i) => (
              <div key={i} className="flex flex-wrap items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
                <span className="text-[16px]">{f.kind === "up" ? "👍" : f.kind === "down" ? "👎" : "🚩"}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold">{f.question}</div>
                  {f.reason && <div className="mt-0.5 text-[12.5px] text-warn">“{f.reason}”</div>}
                  <div className="mt-0.5 text-[11.5px] text-fnt">
                    {f.fieldId && <>{FIELDS.find(x => x.id === f.fieldId)?.name ?? f.fieldId} · </>}
                    {f.level && <>{LEVELS.find(l => l.id === f.level)?.name ?? f.level} · </>}
                    {new Date(f.createdAt).toLocaleString()}
                  </div>
                </div>
                <Chip tone={f.kind === "up" ? "ok" : f.kind === "down" ? "bad" : "warn"}>{f.kind}</Chip>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "coding" && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-line/10 p-5">
            <h3 className="text-[15px] font-extrabold">💻 Coding scoreboard ({coding.length} problems with attempts)</h3>
            <p className="text-[12.5px] text-mut">
              Pass rate per playground problem from real full-suite runs. Under 30% pass = too hard or broken prompt;
              over 90% = too easy. Problems are versioned with the app — a bad one is fixed in the next release.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
                  <th className="px-5 py-3 font-bold">Problem</th>
                  <th className="px-3 py-3 font-bold">Kind</th>
                  <th className="px-3 py-3 font-bold">Attempts</th>
                  <th className="px-3 py-3 font-bold">Passed</th>
                  <th className="px-3 py-3 font-bold">Pass rate</th>
                  <th className="px-3 py-3 font-bold">Flag</th>
                  <th className="px-5 py-3 font-bold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {coding.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-mut">No coding attempts yet — users solve problems in the 💻 Playground and the scoreboard fills in.</td></tr>
                )}
                {coding
                  .slice()
                  .sort((a, b) => a.passRate - b.passRate || b.attempts - a.attempts)
                  .map(c => {
                    const p = codingProblemById(c.problemId);
                    const label = p ? `${p.kind === "fn" ? "🧩" : p.kind === "ui" ? "🎨" : "⚙️"} ${p.title}` : c.problemId;
                    const tone = c.attempts >= 5 && c.passRate < 30 ? "bad" : c.attempts >= 5 && c.passRate > 90 ? "warn" : "ok";
                    const note = c.attempts >= 5 && c.passRate < 30 ? "too hard / broken" : c.attempts >= 5 && c.passRate > 90 ? "too easy" : "healthy";
                    return (
                      <tr key={c.problemId} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                        <td className="px-5 py-3 font-bold">{label}</td>
                        <td className="px-3 py-3">{p ? (p.kind === "fn" ? "function" : p.kind === "ui" ? "UI component" : "CLI algorithm") : "—"}</td>
                        <td className="px-3 py-3 tabular-nums">{c.attempts}</td>
                        <td className="px-3 py-3 tabular-nums">{c.passes}</td>
                        <td className={`px-3 py-3 font-bold tabular-nums ${c.passRate < 30 ? "text-bad" : c.passRate > 90 ? "text-warn" : "text-ok"}`}>{c.passRate}%</td>
                        <td className="px-3 py-3"><Chip tone={tone}>{note}</Chip></td>
                        <td className="px-5 py-3 text-[12.5px] text-fnt">{c.lastSeen ? new Date(c.lastSeen).toLocaleDateString() : "—"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "coach" && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-line/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[15px] font-extrabold">🎯 Coach gaps ({coachGaps.length} topics debated)</h3>
              <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
                Alert at
                <input
                  type="number" min={1} value={gapMin}
                  onChange={e => setGapMin(Math.max(1, Number(e.target.value) || 5))}
                  className="inp w-16 py-1 text-center"
                />
                discussions
              </label>
            </div>
            <p className="mt-1 text-[12.5px] text-mut">
              Weak coding topics users saved from AI-coach discussions (queued as coach_discussion events).
              Topics at or above the alert threshold get flagged for a deep-dive guide.
            </p>
            {gapAlerts.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[12px] font-extrabold uppercase tracking-wider text-bad">🚨 Guide opportunities ({gapAlerts.length})</div>
                {gapAlerts.map(g => (
                  <div key={g.topic} className="flex flex-wrap items-center gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-[12.5px]">
                    <span className="flex-1 font-bold">{g.topic}</span>
                    <Chip tone="bad">{g.discussions} discussions · {g.users} users</Chip>
                    <button className={btnGhost + btnSm} onClick={() => draftGuide(g.topic)}>✍️ Draft guide</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
                  <th className="px-5 py-3 font-bold">Topic</th>
                  <th className="px-3 py-3 font-bold">Discussions</th>
                  <th className="px-3 py-3 font-bold">Users</th>
                  <th className="px-5 py-3 font-bold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {coachGaps.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-mut">No coach discussions saved yet — users save chats in the 🤖 AI Coach and the gaps fill in.</td></tr>
                )}
                {coachGaps.map(g => (
                  <tr key={g.topic} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                    <td className="px-5 py-3 font-bold">{g.topic}</td>
                    <td className="px-3 py-3 tabular-nums">{g.discussions}</td>
                    <td className="px-3 py-3 tabular-nums">{g.users}</td>
                    <td className="px-5 py-3 text-[12.5px] text-fnt">{g.lastSeen ? new Date(g.lastSeen).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "rag" && (
        <div className={`${cardCls} p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <h3 className="text-[15px] font-extrabold">🛰️ RAG health — is the knowledge base answering?</h3>
              <p className="mt-1 text-[12.5px] text-mut">
                Every tutor/coach retrieval queues a rag_event. A low grounded rate or high empty rate means
                users' questions aren't in the uploaded PDFs — time to add documents or improve chunking.
              </p>
            </div>
            {kbDocs.length > 0 && (
              <button
                className={btnGhost + btnSm}
                disabled={reindexBusy || busy || !aiAvailable()}
                onClick={async () => {
                  if (!aiAvailable()) { toast("Add an AI key in Settings — re-indexing needs one"); return; }
                  setReindexBusy(true);
                  try {
                    let reembedded = 0, skipped = 0, fresh = 0;
                    for (const doc of kbDocs) {
                      const oldRows = await listPdfChunks(doc.id);
                      if (!oldRows.length) { skipped++; continue; }
                      const text = oldRows.map(c => c.content).join("\n");
                      const r = await reindexDocument(doc.id, text, oldRows);
                      if (r.changed === 0) { skipped++; continue; }
                      fresh += r.fresh;
                      reembedded++;
                    }
                    await load();
                    toast(`🧠 Re-indexed ${reembedded} document(s) with the current chunker${fresh ? ` — ${fresh} fresh embed${fresh === 1 ? "" : "s"}, rest reused` : ""} · ${skipped} unchanged`);
                  } catch (e) {
                    toast("✗ " + ((e as Error).message || "Re-index failed"));
                  } finally { setReindexBusy(false); }
                }}
              >
                {reindexBusy ? <><span className="spinner" /> Re-indexing…</> : `♻️ Re-index all (${kbDocs.length})`}
              </button>
            )}
          </div>

          {/* digest alert banner — breached thresholds this week (in-app + webhook) */}
          {ragAlerts.length > 0 && (
            <div className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3">
              <div className="text-[13px] font-extrabold">🔔 RAG health alerts — this week</div>
              <ul className="mt-1 space-y-1 text-[12.5px]">
                {ragAlerts.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`font-black ${a.severity === "bad" ? "text-bad" : "text-warn"}`}>•</span>
                    <span><span className="font-bold">{a.title}:</span> {a.detail}</span>
                  </li>
                ))}
              </ul>
              {getRagDigestOpts().webhook ? (
                <p className="mt-1 text-[11px] text-fnt">Delivered to the configured webhook once this week.</p>
              ) : (
                <p className="mt-1 text-[11px] text-fnt">
                  No delivery webhook configured — set one in <span className="font-bold">Product config → 🔔 RAG digest alerts</span> for Slack / email delivery.
                </p>
              )}
            </div>
          )}

          {/* weekly digest — last-7-days aggregates vs the previous week */}
          {ragDigest && ragDigest.total > 0 && (
            <div className="mt-3 rounded-xl border border-line/10 bg-deep/40 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-extrabold">📅 This week</span>
                <Chip tone="ok">{ragDigest.total} retrieval{ragDigest.total === 1 ? "" : "s"}</Chip>
                <Chip tone={ragDigest.grounded / Math.max(1, ragDigest.total) >= 0.6 ? "ok" : "warn"}>
                  {Math.round((ragDigest.grounded / Math.max(1, ragDigest.total)) * 100)}% grounded
                </Chip>
                <Chip tone={ragDigest.empty / Math.max(1, ragDigest.total) <= 0.2 ? "ok" : "warn"}>
                  {ragDigest.empty} empty
                </Chip>
                <Chip>avg sim {ragDigest.avgTopSim.toFixed(2)}</Chip>
                {ragDigest.gateRejects > 0 && <Chip tone="warn">🚫 {ragDigest.gateRejects} gate rejects</Chip>}
                {ragDigest.prevTotal > 0 && (
                  <Chip tone={ragDigest.total >= ragDigest.prevTotal ? "ok" : "warn"}>
                    {ragDigest.total >= ragDigest.prevTotal ? "▲" : "▼"} {Math.round((Math.abs(ragDigest.total - ragDigest.prevTotal) / ragDigest.prevTotal) * 100)}% vs prior week
                  </Chip>
                )}
                {ragDigest.prevTotal > 0 && (
                  <Chip tone={ragDigest.grounded / Math.max(1, ragDigest.total) >= ragDigest.prevGrounded / Math.max(1, ragDigest.prevTotal) ? "ok" : "warn"}>
                    grounded {(ragDigest.grounded / Math.max(1, ragDigest.total) * 100 - ragDigest.prevGrounded / Math.max(1, ragDigest.prevTotal) * 100) >= 0 ? "▲" : "▼"} {Math.abs((ragDigest.grounded / Math.max(1, ragDigest.total) - ragDigest.prevGrounded / Math.max(1, ragDigest.prevTotal)) * 100).toFixed(0)}pt
                  </Chip>
                )}
              </div>
              {ragDigest.topQueries.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-mut">Top asked:</span>
                  {ragDigest.topQueries.map((t, i) => (
                    <Chip key={i} tone="lvl">{t.q} · {t.n}</Chip>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button className={btnGhost + btnSm} disabled={busy} onClick={sendDigestNow} title="Deliver this week's digest to the configured webhook / email bridge now">
                  📧 Send digest now
                </button>
                {digestSentWeek === weekKey() ? (
                  <Chip tone="ok">sent this week</Chip>
                ) : getRagDigestOpts().sendWeekly ? (
                  <Chip tone="lvl">scheduled — sends once this week</Chip>
                ) : (
                  <Chip>auto-send off (enable in Product config)</Chip>
                )}
                {digestSentWeek && <span className="text-[11px] text-fnt">last sent: week {digestSentWeek}</span>}
              </div>
            </div>
          )}
          {/* threshold explorer — reclassify the recent log against any cutoff */}
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line/10 bg-deep/40 px-4 py-3">
            <span className="text-[12.5px] font-bold">🔍 Explorer cutoff</span>
            <input
              type="range" min={0.3} max={0.8} step={0.01}
              value={ragThreshold}
              onChange={e => setRagThreshold(Number(e.target.value))}
              className="min-w-[180px] flex-1 accent-acc1"
            />
            <input
              type="number" min={0.3} max={0.8} step={0.01}
              value={ragThreshold}
              onChange={e => setRagThreshold(Math.max(0.1, Math.min(0.95, Number(e.target.value) || 0.45)))}
              className="inp w-20 py-1 text-center"
            />
            <Chip tone={ragThreshold === effectiveGroundingMinSim() ? "ok" : "warn"}>
              {ragThreshold === effectiveGroundingMinSim() ? "= live cutoff" : "preview only — not saved"}
            </Chip>
          </div>
          {(() => {
            const live = ragHealthSummary(ragRows);
            const s = ragHealthSummary(ragRows, ragThreshold);
            if (!s.total) {
              return <p className="py-6 text-center text-[13px] text-mut">No retrieval events yet — they appear once signed-in users ask the tutor or API coach anything.</p>;
            }
            /* hoisted so the histogram, its drill-down and the query log share one view */
            const bins = ragHistogram(ragRows, ragThreshold);
            const shown = histSel == null
              ? ragRows
              : ragRows.filter(r => r.topSim >= bins[histSel].min && r.topSim < bins[histSel].max);
            const signal = (label: string, value: string, tone: "ok" | "warn" | "bad") => (
              <div className="rounded-xl border border-line/10 bg-wht/5 p-4 text-center">
                <div className={`text-[24px] font-extrabold tabular-nums ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-bad"}`}>{value}</div>
                <div className="mt-0.5 text-[11.5px] font-bold text-mut">{label}</div>
              </div>
            );
            return (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {signal("Retrievals (window)", String(s.total), "ok")}
                  {signal("Grounded rate", s.groundedRate + "%", s.groundedRate >= 60 ? "ok" : s.groundedRate >= 30 ? "warn" : "bad")}
                  {signal("Empty hits", s.emptyRate + "%", s.emptyRate <= 20 ? "ok" : s.emptyRate <= 40 ? "warn" : "bad")}
                  {signal("Avg top similarity", s.avgTopSim.toFixed(2), s.avgTopSim >= 0.55 ? "ok" : s.avgTopSim >= 0.4 ? "warn" : "bad")}
                  {(() => {
                    const gateRejects = ragRows.reduce((n, r) => n + (r.gateRejects ?? 0), 0);
                    return signal("Gate rejections", String(gateRejects), gateRejects === 0 ? "ok" : "warn");
                  })()}
                </div>
                {/* similarity histogram — where retrieval quality lands vs the cutoff + hard floor */}
                <div className="mt-4">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-mut">
                    <span>📊 Similarity distribution</span>
                    <span className="normal-case font-bold">cutoff {ragThreshold.toFixed(2)}</span>
                    <span className="normal-case font-bold text-bad">hard floor {effectiveHardFloor().toFixed(2)}</span>
                  </div>
                  {(() => {
                    const max = Math.max(1, ...bins.map(b => b.total));
                    const cutoffBin = bins.findIndex(b => ragThreshold >= b.min && ragThreshold < b.max);
                    const floorBin = bins.findIndex(b => effectiveHardFloor() >= b.min && effectiveHardFloor() < b.max);
                    return (
                      <div className="space-y-1.5">
                        {bins.map((b, i) => (
                          <button
                            key={b.label}
                            type="button"
                            onClick={() => setHistSel(histSel === i ? null : i)}
                            title="Click to see the queries in this band"
                            className={`flex items-center gap-2 text-left text-[12px] transition-opacity hover:opacity-100 ${histSel === i ? "opacity-100" : "opacity-80"}`}
                          >
                            <span className={`w-14 shrink-0 font-bold ${i === floorBin ? "text-bad" : "text-fnt"}`}>
                              {b.label}{i === floorBin ? " 🚫" : ""}
                            </span>
                            <span className={`relative h-5 flex-1 overflow-hidden rounded-md bg-wht/5 ${histSel === i ? "ring-1 ring-co/70" : ""}`}>
                              <span
                                className={`absolute inset-y-0 left-0 ${i === floorBin ? "bg-bad/40" : "bg-acc1/40"}`}
                                style={{ width: `${(b.total / max) * 100}%` }}
                              />
                              <span className="absolute inset-y-0 left-0 bg-ok/50" style={{ width: `${(b.grounded / max) * 100}%` }} />
                              {i === cutoffBin && (
                                <span className="absolute inset-y-0 w-px bg-ink/70" style={{ left: `${((ragThreshold - b.min) / (b.max - b.min)) * 100}%` }} />
                              )}
                              <span className="absolute inset-y-0 right-1 flex items-center text-[10px] font-bold text-ink/80">
                                {b.total} {b.grounded > 0 ? `· ${b.grounded} grounded` : ""}{b.gated > 0 ? ` · 🚫 ${b.gated}` : ""}
                              </span>
                            </span>
                          </button>
                        ))}
                        <p className="text-[11px] text-fnt">
                          Bar = queries whose top hit landed in this similarity band (<span className="text-ok">green</span> = grounded at the explorer cutoff, <span className="text-bad">red band</span> = concept-free citations allowed, <span className="text-ink">tick</span> = explorer cutoff). Click a band to drill into its queries.
                        </p>
                        {(() => {
                          const sug = suggestHardFloor(ragRows, effectiveHardFloor(), effectiveGroundingMinSim());
                          return (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {sug.changed ? (
                                <>
                                  <Chip tone="warn">💡 Suggested hard floor: {sug.value.toFixed(2)}</Chip>
                                  <span className="text-[11.5px] text-fnt">{sug.reason}.</span>
                                  <button className={btnGhost + btnSm} onClick={() => onApplyHardFloor(sug.value)}>
                                    🎚️ Apply to Product config
                                  </button>
                                </>
                              ) : (
                                <span className="text-[11.5px] text-fnt">✅ {sug.reason}.</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>
                {ragRows.some(r => (r.gateRejects ?? 0) > 0) && (
                  <p className="mt-1.5 text-[11.5px] text-fnt">
                    🚫 <span className="font-bold">Concept gate:</span> {ragRows.reduce((n, r) => n + (r.gateRejects ?? 0), 0)} high-sim chunk(s) were dropped for sharing no concepts with the query — tune the hard floor in <span className="font-bold">Product config → 🗄️ RAG retrieval</span>.
                  </p>
                )}
                {ragThreshold !== effectiveGroundingMinSim() && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-fnt">
                    <Chip tone="lvl">at the live cutoff ({effectiveGroundingMinSim()}) this window was {live.groundedRate}% grounded</Chip>
                    <span>— publish a new cutoff in <span className="font-bold">Product config → 🗄️ RAG retrieval</span> to apply it.</span>
                  </div>
                )}

                {/* tuning playground — reclassify the week against any cutoff/hard-floor combo */}
                <div className="mt-4">
                  <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wider text-mut">🎚️ Tuning playground — what WOULD the week look like?</div>
                  <p className="mb-2 text-[11.5px] text-fnt">
                    Each cell reclassifies the {ragRows.length} recent retrieval(s) at that cutoff + hard floor.
                    <span className="text-ok"> % </span>= grounded rate, <span className="text-warn">🚫n</span> = concept-gate rejections. Click a cell to stage the pair.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-line/10 bg-deep/40 p-3">
                    <table className="w-full min-w-[620px] text-center text-[12px]">
                      <thead>
                        <tr className="text-[10.5px] uppercase tracking-wider text-mut">
                          <th className="px-2 py-1.5 text-left font-bold">cutoff ↓ / floor →</th>
                          {PLAY_FLOORS.map(f => <th key={f} className="px-1 py-1.5 font-bold tabular-nums">{f.toFixed(2)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {PLAY_MINSIMS.map(ms => {
                          const liveRow = ms === effectiveGroundingMinSim();
                          return (
                            <tr key={ms}>
                              <td className={`px-2 py-1 text-left font-bold tabular-nums ${liveRow ? "text-co" : ""}`}>{ms.toFixed(2)}</td>
                              {PLAY_FLOORS.map(hf => {
                                const cell = playCells.find(c => c.minSim === ms && c.hardFloor === hf);
                                if (!cell) return <td key={hf} />;
                                const live = liveRow && hf === effectiveHardFloor();
                                const tone = cell.groundedRate >= 60 ? "text-ok" : cell.groundedRate >= 30 ? "text-warn" : "text-bad";
                                return (
                                  <td key={hf} className="p-0.5">
                                    <button
                                      type="button"
                                      title={`cutoff ${ms.toFixed(2)} · floor ${hf.toFixed(2)} → ${cell.groundedRate}% grounded${cell.gateRejects ? ` · 🚫${cell.gateRejects}` : ""}`}
                                      onClick={() => onStageTuning(ms, hf)}
                                      className={`w-full rounded-md px-1 py-1.5 font-bold tabular-nums transition-colors ${live ? "bg-co/25 ring-1 ring-co" : "bg-wht/5 hover:bg-wht/10"} ${tone}`}
                                    >
                                      {cell.groundedRate}%{cell.gateRejects > 0 ? <span className="text-warn"> 🚫{cell.gateRejects}</span> : ""}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1.5 text-[11px] text-fnt">
                    <span className="font-bold text-co">Highlighted</span> = today's live pair ({effectiveGroundingMinSim().toFixed(2)} / {effectiveHardFloor().toFixed(2)}).
                    Simulated only — click to stage, then publish from Product config.
                  </p>
                  {(() => {
                    const best = bestTuningCell(playCells, effectiveGroundingMinSim(), effectiveHardFloor());
                    const liveCell = playCells.find(c => c.minSim === effectiveGroundingMinSim() && c.hardFloor === effectiveHardFloor());
                    if (!best) return null;
                    const same = best === liveCell || (liveCell && best.groundedRate === liveCell.groundedRate && best.gateRejects === liveCell.gateRejects);
                    const delta = liveCell ? best.groundedRate - liveCell.groundedRate : 0;
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {same ? (
                          <Chip tone="ok">⭐ Best = live pair — already optimal for this window</Chip>
                        ) : (
                          <>
                            <Chip tone="lvl">⭐ Best: {best.groundedRate}% @ {best.minSim.toFixed(2)} / {best.hardFloor.toFixed(2)}{best.gateRejects ? ` · 🚫${best.gateRejects}` : ""}</Chip>
                            {liveCell && <span className="text-[11.5px] text-fnt">vs {liveCell.groundedRate}% now {delta > 0 ? `(+${delta}pt)` : `(${delta}pt)`}</span>}
                            <button className={btnGhost + btnSm} onClick={() => onStageTuning(best.minSim, best.hardFloor)}>
                              🎚️ Apply best
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* per-domain breakdown — which fields/levels ground best */}
                <div className="mt-4">
                  <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wider text-mut">🌐 Per-field & level</div>
                  <p className="mb-2 text-[11.5px] text-fnt">
                    Retrievals tagged with the goal / interview context they happened in — see where the KB answers well
                    and which domains' questions miss it. Untagged (general) sessions roll up under <span className="font-mono">general</span>.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-line/10">
                    <table className="w-full min-w-[560px] text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-line/10 bg-wht/[.04] text-[11px] uppercase tracking-wider text-mut">
                          <th className="px-3 py-2 font-bold">Dimension</th>
                          <th className="px-3 py-2 font-bold">Domain</th>
                          <th className="px-3 py-2 font-bold">Retrievals</th>
                          <th className="px-3 py-2 font-bold">Grounded</th>
                          <th className="px-3 py-2 font-bold">Empty</th>
                          <th className="px-3 py-2 font-bold">Avg sim</th>
                          <th className="px-3 py-2 font-bold">Gate rejects</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ragDomains.length === 0 && (
                          <tr><td colSpan={7} className="px-3 py-6 text-center text-mut">No domain-tagged retrievals yet — they appear once signed-in users ask the tutor/coach inside a goal or interview.</td></tr>
                        )}
                        {ragDomains.map((d, i) => (
                          <tr key={i} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                            <td className="px-3 py-2.5"><Chip tone={d.dimension === "field" ? "lvl" : "ok"}>{d.dimension === "field" ? "field" : "level"}</Chip></td>
                            <td className="px-3 py-2.5 font-bold">{d.name}</td>
                            <td className="px-3 py-2.5 tabular-nums">{d.retrievals}</td>
                            <td className="px-3 py-2.5">
                              <span className={`font-bold tabular-nums ${d.retrievals ? (d.grounded / d.retrievals >= 0.6 ? "text-ok" : d.grounded / d.retrievals >= 0.3 ? "text-warn" : "text-bad") : ""}`}>
                                {d.retrievals ? Math.round((d.grounded / d.retrievals) * 100) + "%" : "—"}
                              </span>
                              <span className="text-[11px] text-fnt"> ({d.grounded})</span>
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">{d.empty}</td>
                            <td className="px-3 py-2.5 tabular-nums">{d.avgTopSim.toFixed(2)}</td>
                            <td className="px-3 py-2.5">{d.gateRejects > 0 ? <Chip tone="warn">🚫 {d.gateRejects}</Chip> : <span className="text-[12px] text-fnt">0</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* KB suggestions — users asked to add these topics */}
                <div className="mt-4">
                  <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wider text-mut">💡 KB suggestions ({kbSuggestions.length})</div>
                  <p className="mb-2 text-[11.5px] text-fnt">
                    Users hit a question the knowledge base didn't answer and tapped “Suggest adding it”. Most-requested first —
                    these are the gaps to write deep-dives or upload PDFs for.
                  </p>
                  <div className="max-h-[280px] space-y-1.5 overflow-y-auto">
                    {kbSuggestions.length === 0 && (
                      <p className="rounded-lg border border-line/10 bg-deep/40 px-3 py-4 text-center text-[12.5px] text-mut">
                        No suggestions yet — they appear when users tap “💡 Suggest adding to knowledge base” on an ungrounded coach reply.
                      </p>
                    )}
                    {kbSuggestions.map((s, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
                        <span className="min-w-[160px] flex-1 truncate font-bold">{s.topic}</span>
                        <Chip tone={s.requests >= 3 ? "bad" : "warn"}>{s.requests} request{s.requests === 1 ? "" : "s"}</Chip>
                        <Chip tone="lvl">{s.field}</Chip>
                        <Chip>{s.level}</Chip>
                        <span className="text-[11px] text-fnt">last {new Date(s.latest).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* per-document breakdown — which uploaded PDF actually answers */}
                <div className="mt-4">
                  <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wider text-mut">📄 Per-document</div>
                  <div className="overflow-x-auto rounded-xl border border-line/10">
                    <table className="w-full min-w-[560px] text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-line/10 bg-wht/[.04] text-[11px] uppercase tracking-wider text-mut">
                          <th className="px-3 py-2 font-bold">Document</th>
                          <th className="px-3 py-2 font-bold">Retrievals</th>
                          <th className="px-3 py-2 font-bold">Avg sim</th>
                          <th className="px-3 py-2 font-bold">Last cited</th>
                          <th className="px-3 py-2 font-bold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kbDocs.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-6 text-center text-mut">No documents indexed yet — upload PDFs in the Auto-fill section to build the knowledge base.</td></tr>
                        )}
                        {(() => {
                          const stats = new Map(ragDocs.map(d => [d.documentId, d]));
                          const rows = kbDocs
                            .map(k => ({ k, s: stats.get(k.id) }))
                            .sort((a, b) => (b.s?.retrievals ?? 0) - (a.s?.retrievals ?? 0) || a.k.title.localeCompare(b.k.title));
                          return rows.map(({ k, s }) => (
                            <tr key={k.id} className={`border-b border-line/5 last:border-0 hover:bg-wht/5 ${s ? "" : "opacity-70"}`}>
                              <td className="max-w-[300px] px-3 py-2.5">
                                <div className="truncate font-bold">{k.title}</div>
                                <div className="text-[11px] text-fnt">{k.chunk_count} chunk{k.chunk_count === 1 ? "" : "s"}</div>
                              </td>
                              <td className="px-3 py-2.5">
                                {s ? (
                                  <Chip tone={s.retrievals >= 3 ? "ok" : "warn"}>{s.retrievals} retrieval{s.retrievals === 1 ? "" : "s"}</Chip>
                                ) : (
                                  <Chip tone="bad">📭 never retrieved</Chip>
                                )}
                              </td>
                              <td className="px-3 py-2.5 tabular-nums">{s ? s.avgSim.toFixed(2) : "—"}</td>
                              <td className="px-3 py-2.5 text-[12px] text-fnt">{s?.lastSeen ? new Date(s.lastSeen).toLocaleDateString() : "—"}</td>
                              <td className="px-3 py-2.5">
                                <button
                                  className={btnGhost + btnSm}
                                  disabled={reindexBusy || !aiAvailable()}
                                  title="Re-embed this document with the current chunker"
                                  onClick={() => reindexOne(k)}
                                >
                                  ♻️ Re-index
                                </button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  {kbDocs.some(k => !ragDocs.some(d => d.documentId === k.id)) && (
                    <p className="mt-1.5 text-[11.5px] text-fnt">📭 Documents never retrieved aren't answering user questions — either their content misses the queries being asked, or they need re-uploading with better structure.</p>
                  )}
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-mut">
                    <span>🕘 Query log</span>
                    {histSel != null && (
                      <>
                        <span className="normal-case font-bold text-co">
                          showing {bins[histSel].label} ({shown.length} of {ragRows.length})
                        </span>
                        <button type="button" className={btnGhost + btnSm} onClick={() => setHistSel(null)}>✕ clear band filter</button>
                      </>
                    )}
                  </div>
                  <div className="max-h-[360px] space-y-1.5 overflow-y-auto">
                  {shown.map((r, i) => {
                    const wouldBe = r.topSim >= ragThreshold;
                    const flipped = wouldBe !== r.grounded;
                    return (
                      <div key={i} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] ${flipped ? "border-warn/40 bg-warn/10" : "border-line/10 bg-deep/40"}`}>
                        <span className="min-w-[160px] flex-1 truncate font-bold">{r.query}</span>
                        <Chip tone={wouldBe ? "ok" : "default"}>{wouldBe ? "📚 grounded" : "🧠 general"}</Chip>
                        <Chip>{r.hits} hit{r.hits === 1 ? "" : "s"}</Chip>
                        <Chip>sim {r.topSim.toFixed(2)}</Chip>
                        {(r.gateRejects ?? 0) > 0 && <Chip tone="warn">🚫 gate −{r.gateRejects}</Chip>}
                        {flipped && <Chip tone="warn">↻ flips at {ragThreshold.toFixed(2)}</Chip>}
                        <span className="text-[11px] text-fnt">{new Date(r.at).toLocaleString()}</span>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Security — MFA enforcement (owner-only) + admin audit log           */
/* (docs/app-security.md G8/G9 — supabase/security.sql)                */
/* ------------------------------------------------------------------ */

function SecuritySection() {
  const [status, setStatus] = useState<AdminSecurityStatus | null>(null);
  const [audit, setAudit] = useState<AdminAuditRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [showMeta, setShowMeta] = useState<number | null>(null);
  const owner = amOwner();

  const load = async () => {
    setBusy(true);
    try {
      const [s, a] = await Promise.all([adminSecurityStatus(), adminAuditLog(50)]);
      setStatus(s);
      setAudit(a);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load security status"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggle = async (v: boolean) => {
    if (!owner) { toast("Only the owner can change MFA enforcement"); return; }
    setToggleBusy(true);
    try {
      await adminSetMfaEnforced(v);
      toast(v ? "🔐 MFA now required for admin actions" : "🔓 MFA enforcement turned off");
      await load();
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Couldn't update"));
    } finally {
      setToggleBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* MFA enforcement */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold">🔐 Admin MFA enforcement</h2>
            <p className="mt-1 max-w-[640px] text-[12.5px] text-mut">
              When on, sensitive admin actions (granting/revoking admins, config changes) require a session
              authenticated with the account's authenticator app. <span className="font-bold">Owner-only control.</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={status?.enforced ?? false} onChange={toggle} />
            {toggleBusy && <span className="spinner" />}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone={status?.enforced ? "warn" : "ok"}>
            {status?.enforced ? "MFA REQUIRED" : "NOT enforced — password-only sessions OK"}
          </Chip>
          <Chip tone={status?.mfaVerified ? "ok" : "default"}>
            {status?.mfaVerified
              ? "✅ This session is MFA-verified"
              : "⚠️ This session has no TOTP — flip enforcement before signing out"}
          </Chip>
          {(status?.factors?.length ?? 0) > 0 && (
            <Chip>{status!.factors.length} authenticator factor{(status!.factors.length === 1 ? "" : "s")} enrolled</Chip>
          )}
        </div>
        {!status && busy && <p className="mt-3 text-[12px] text-mut"><span className="spinner inline-block" /> Loading…</p>}
        {!status && !busy && (
          <p className="mt-3 text-[12px] text-mut">
            Status unavailable — apply <code className="font-mono">supabase/security.sql</code> (via scripts/setup-security.js) to enable this card.
          </p>
        )}
      </div>

      {/* audit log */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-extrabold">🧾 Admin audit log</h2>
            <p className="mt-0.5 text-[12.5px] text-mut">
              Append-only trail of config, announcement and admin changes, kept by DB triggers.
            </p>
          </div>
          <button className={btnGhost + btnSm} onClick={() => void load()} disabled={busy}>Refresh</button>
        </div>
        {audit.length === 0 ? (
          <p className="px-5 pb-5 text-[12.5px] text-mut">
            No entries yet — they appear after you publish config, post announcements or change admins
            (requires supabase/security.sql).
          </p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-panel text-[11px] uppercase tracking-wider text-fnt">
                <tr>
                  <th className="px-5 py-2">When</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-5 py-2">Meta</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((r, i) => (
                  <tr key={i} className="border-t border-line/10">
                    <td className="whitespace-nowrap px-5 py-2 text-fnt">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{r.actor}</td>
                    <td className="px-3 py-2">
                      <Chip tone={r.action === "delete" ? "warn" : r.action === "create" ? "ok" : "default"}>{r.action}</Chip>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11.5px]">{r.target}</td>
                    <td className="px-5 py-2">
                      <button className="font-bold text-acctxt underline" onClick={() => setShowMeta(showMeta === i ? null : i)}>
                        {showMeta === i ? "hide" : "view"}
                      </button>
                      {showMeta === i && (
                        <pre className="mt-1 max-w-[520px] overflow-auto rounded-lg bg-deep/60 p-2 font-mono text-[10.5px] text-fnt">
                          {JSON.stringify(r.meta, null, 2).slice(0, 2000)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI pipeline provider — the live key/base/model the AI cleaner and the
   AI problem bank use. Stored in the private ai_provider_config table
   (admin-only RLS), editable HERE — no GitHub Actions secret edits. */
/* ------------------------------------------------------------------ */

function AiPipelineCard({ status, onLoad, onToast }: { status: AiProviderStatus | null; onLoad: () => void; onToast: (m: string) => void }) {
  const [key, setKey] = useState("");
  const [base, setBase] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testNote, setTestNote] = useState<string | null>(null);

  useEffect(() => {
    if (status) {
      setBase(status.base || "https://openrouter.ai/api/v1");
      setModel(status.model || "");
    }
  }, [status]);

  const save = async () => {
    /* guard: a model ID (vendor/name, e.g. nvidia/nemotron-3.5-lightning:free)
       is NOT a key — catching this here stops a broken config from silently
       ​​killing every AI run until someone reads the workflow logs */
    const k = key.trim();
    if (/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._:-]+$/.test(k)) {
      onToast("✗ That looks like a MODEL name — paste your API key here (sk-…); the model goes in the Model field");
      return;
    }
    setSaving(true);
    setTestNote(null);
    try {
      await saveAiProviderConfig({ key: k, base, model });
      onToast("🤖 AI pipeline key saved — the next scrape/problem-bank run uses it");
      setKey("");
      await onLoad();
    } catch (e) {
      onToast("✗ " + ((e as Error).message || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestNote(null);
    try {
      const r = await testAiProvider({ key, base });
      setTestNote((r.ok ? "✅ " : "✗ ") + r.note);
    } catch (e) {
      setTestNote("✗ " + ((e as Error).message || "Test failed"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold">🤖 AI pipeline provider</h2>
          <p className="mt-1 max-w-[700px] text-[12.5px] text-mut">
            The <span className="font-bold">live key/model</span> the AI cleaner and AI problem bank use. Saved to your own
            Supabase project (private, admin-only) and read by the workflows — so you change it{" "}
            <span className="font-bold">here</span>, never on the GitHub dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            status.configured ? (
              <Chip tone="ok">✅ Configured · {status.keyHint}{status.model ? ` · ${status.model}` : ""}</Chip>
            ) : (
              <Chip tone="warn">⚠️ Not configured — AI cleaning + problem bank idle</Chip>
            )
          )}
          <button className={btnGhost + btnSm} onClick={onLoad} disabled={saving}>Refresh</button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11.5px] font-bold text-fnt">Base URL</span>
          <input
            type="text"
            value={base}
            onChange={e => setBase(e.target.value)}
            placeholder="https://openrouter.ai/api/v1"
            className="mt-1 w-full rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11.5px] font-bold text-fnt">Model</span>
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="deepseek/deepseek-chat"
            className="mt-1 w-full rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-[11.5px] font-bold text-fnt">API key {status?.configured && <span className="font-normal text-mut">(leave blank to keep the saved one)</span>}</span>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder={status?.configured ? status.keyHint : "sk-or-v1-…"}
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
        />
      </label>

      {testNote && <p className={`mt-2 text-[12px] ${testNote.startsWith("✅") ? "text-ok" : "text-warn"}`}>{testNote}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={btnPrimary + btnSm} onClick={() => void save()} disabled={saving || testing}>
          {saving ? "Saving…" : "💾 Save key"}
        </button>
        <button className={btnGhost + btnSm} onClick={() => void test()} disabled={saving || testing} title="One live call to the provider's /models endpoint with the entered key">
          {testing ? "Testing…" : "🧪 Test key"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App-managed Edge Function secrets — the credentials the admin edits  */
/* day-to-day (Resend, Adzuna, GitHub, Safe Browsing). Stored in the    */
/* private edge_secrets table, editable HERE — no dashboard visits.     */
/* ------------------------------------------------------------------ */

const EDGE_SECRET_LABELS: Record<string, { label: string; placeholder: string; note: string }> = {
  RESEND_API_KEY: { label: "Resend API key", placeholder: "re_…", note: "Emails (digests, recovery backup, refunds). Blank = keep the saved one." },
  ADZUNA_APP_ID: { label: "Adzuna app ID", placeholder: "…", note: "Job salary enrichment (jobs-fetch)." },
  ADZUNA_APP_KEY: { label: "Adzuna app key", placeholder: "…", note: "Job salary enrichment (jobs-fetch)." },
  GITHUB_TOKEN: { label: "GitHub token", placeholder: "ghp_…", note: "Trends release recency — works keyless too." },
  SAFE_BROWSING_API_KEY: { label: "Safe Browsing API key", placeholder: "AIza…", note: "Resource URL reputation — otherwise verdicts stay 'pending'." }
};

function EdgeSecretsCard({ statuses, onLoad, onToast }: { statuses: EdgeSecretStatus[] | null; onLoad: () => void; onToast: (m: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (name: string) => {
    setSaving(name);
    try {
      await saveEdgeSecret(name, values[name] ?? "");
      onToast(`🔑 ${EDGE_SECRET_LABELS[name].label} saved — the next function call uses it`);
      setValues(v => ({ ...v, [name]: "" }));
      await onLoad();
    } catch (e) {
      onToast("✗ " + ((e as Error).message || "Save failed"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold">🔐 App-managed secrets</h2>
          <p className="mt-1 max-w-[700px] text-[12.5px] text-mut">
            The credentials you actually change day-to-day live in your own Supabase project (private, admin-only) —
            save them <span className="font-bold">here</span>, never on the dashboard. The edge functions read this table first and
            fall back to the old dashboard secrets, so saving here is all that's needed.
          </p>
        </div>
        <button className={btnGhost + btnSm} onClick={onLoad} disabled={!!saving}>Refresh</button>
      </div>

      {!statuses ? (
        <p className="mt-3 text-[12px] text-mut"><span className="spinner inline-block" /> Loading…</p>
      ) : (
        <div className="mt-3 space-y-3">
          {APP_MANAGED_SECRETS.map(name => {
            const meta = EDGE_SECRET_LABELS[name];
            const st = statuses.find(s => s.name === name);
            return (
              <div key={name} className="rounded-xl border border-line/15 bg-deep/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-fnt">{meta.label} <code className="font-mono text-mut">{name}</code></span>
                  {st?.configured
                    ? <Chip tone="ok">✅ Set · {st.keyHint}</Chip>
                    : <Chip tone="warn">⚠️ Not set — env fallback only</Chip>}
                </div>
                <p className="mt-1 text-[11.5px] text-mut">{meta.note}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={values[name] ?? ""}
                    onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))}
                    placeholder={st?.configured ? `${st.keyHint} — blank keeps it` : meta.placeholder}
                    autoComplete="off"
                    className="min-w-[220px] flex-1 rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
                  />
                  <button className={btnPrimary + btnSm} onClick={() => void save(name)} disabled={saving === name || !(values[name] ?? "").trim()}>
                    {saving === name ? "Saving…" : "💾 Save"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Secrets — which Edge Function secrets are configured vs missing.    */
/* Backed by the secret-status Edge Function (server-side presence      */
/* check via Deno.env.has — values are never readable or returned).    */
/* ------------------------------------------------------------------ */

function SecretsSection() {
  const [report, setReport] = useState<SecretStatusReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiProviderStatus | null>(null);

  const loadAi = async () => {
    try {
      setAiStatus(await getAiProviderConfig());
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load AI pipeline config"));
    }
  };

  const [edgeSecrets, setEdgeSecrets] = useState<EdgeSecretStatus[] | null>(null);

  const loadEdgeSecrets = async () => {
    try {
      setEdgeSecrets(await getEdgeSecrets());
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load app-managed secrets"));
    }
  };

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await fetchSecretStatus());
    } catch (e) {
      setReport(null);
      setError((e as Error).message || "Failed to load secret status");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); void loadAi(); void loadEdgeSecrets(); }, []);

  /* one-click RESEND_API_KEY validation. Defaults to the admin's own
     inbox; a recipient can be supplied because Resend TEST keys only
     deliver to the key owner's address (e.g. a garudagaura@gmail.com-owned
     key), so testing against that inbox proves the key end-to-end. */
  const test = async () => {
    setTesting(true);
    try {
      const r = await sendTestEmail(testTo.trim() || undefined);
      toast(r.sent ? "📧 " + (r.note ?? "Test email sent — check your inbox") : "✗ " + (r.note ?? "Send failed"));
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Test email failed"));
    } finally {
      setTesting(false);
    }
  };

  /* missing required → missing optional → set → auto-injected (builtin) */
  const rows = useMemo(() => {
    if (!report) return [];
    const order = (s: SecretStatusRow): number =>
      s.builtin ? 3 : s.configured ? 2 : s.required ? 0 : 1;
    return [...report.secrets].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
  }, [report]);

  const statusChip = (s: SecretStatusRow) => {
    if (s.builtin) return <Chip tone="default">🔒 Auto-injected</Chip>;
    if (s.configured) return <Chip tone="ok">✅ Set</Chip>;
    return s.required ? <Chip tone="bad">⚠️ Missing</Chip> : <Chip tone="warn">⚠️ Missing (optional)</Chip>;
  };

  const projectRef = CONFIG.supabase.url.replace("https://", "").replace(".supabase.co", "");

  return (
    <div className="space-y-4">
      <AiPipelineCard status={aiStatus} onLoad={loadAi} onToast={toast} />
      <EdgeSecretsCard statuses={edgeSecrets} onLoad={loadEdgeSecrets} onToast={toast} />
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold">🔑 Edge Function secrets</h2>
            <p className="mt-1 max-w-[700px] text-[12.5px] text-mut">
              Which secrets the Edge Functions need to fully work — <span className="font-bold">configured vs missing</span>, checked
              from the function runtime. Supabase never exposes secret <span className="font-bold">values</span>, so this reports presence only;
              a missing <span className="font-bold">required</span> secret means a feature is silently degraded (emails answer sent:false,
              crons 401, verdicts stay pending).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              placeholder="Send to (defaults to your email)"
              className="w-56 rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
              title="Resend TEST keys only deliver to the key owner's inbox — enter that address to validate the key"
            />
            <button className={btnPrimary + btnSm} onClick={() => void test()} disabled={testing || busy} title="Sends a test email to validate RESEND_API_KEY end-to-end (admin-only recipient choice)">
              {testing ? "Sending…" : "📧 Send test email"}
            </button>
            <button className={btnGhost + btnSm} onClick={() => void load()} disabled={busy}>Refresh</button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-[12.5px] text-warn">
            <span className="font-bold">Couldn't read secret status.</span> {error}
            <div className="mt-1.5 text-mut">
              If the function isn't deployed yet, run{" "}
              <code className="font-mono">supabase functions deploy secret-status --project-ref {projectRef}</code>{" "}
              (or re-run <code className="font-mono">scripts/setup-live.js</code>) and hit Refresh.
            </div>
          </div>
        )}

        {busy && !report && !error && <p className="mt-3 text-[12px] text-mut"><span className="spinner inline-block" /> Checking…</p>}

        {report && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone={report.summary.missingRequired > 0 ? "bad" : "ok"}>
              {report.summary.configured}/{report.summary.total} secrets in place
            </Chip>
            {report.summary.missingRequired > 0 && (
              <Chip tone="bad">{report.summary.missingRequired} required missing — setup isn't finished</Chip>
            )}
            {report.summary.missingRequired === 0 && report.summary.missingOptional > 0 && (
              <Chip tone="warn">{report.summary.missingOptional} optional missing — degraded, not broken</Chip>
            )}
            {report.summary.missingRequired === 0 && report.summary.missingOptional === 0 && (
              <Chip tone="ok">All required secrets configured 🎉</Chip>
            )}
            <Chip tone={report.serviceRoleAvailable ? "ok" : "bad"}>
              {report.serviceRoleAvailable ? "✅ Service-role access available" : "⚠️ No service-role key — admin functions can't reach the DB"}
            </Chip>
          </div>
        )}
      </div>

      {report && rows.length > 0 && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-panel text-[11px] uppercase tracking-wider text-fnt">
                <tr>
                  <th className="px-5 py-2">Secret</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Needed by</th>
                  <th className="px-5 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.name} className={`border-t border-line/10 ${!s.configured && !s.builtin && s.required ? "bg-warn/5" : ""}`}>
                    <td className="px-5 py-2 font-mono text-[11.5px] font-bold text-ink">{s.name}</td>
                    <td className="px-3 py-2">{statusChip(s)}</td>
                    <td className="max-w-[260px] px-3 py-2 text-fnt">{s.functions.join(", ")}</td>
                    <td className="max-w-[280px] px-5 py-2 text-mut">{s.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="px-1 text-[11.5px] text-mut">
        Where to add secrets: Supabase dashboard → Edge Functions → Secrets — secrets are project-wide, so every
        function sees them (one <code className="font-mono">RESEND_API_KEY</code> covers all digest, backup and refund emails).
        Or set them one-command via <code className="font-mono">scripts/setup-live.js</code> with a personal access token.
        Values can't be read back once saved — only replaced.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Resources — the L4 human gate for community submissions             */
/* (docs/resource-safety-guard.md). Pending suggestions show every      */
/* guard layer's verdict; the admin's approve/reject/quarantine is the */
/* recorded decision that lets (or refuses) a link to go app-wide.     */
/* ------------------------------------------------------------------ */

function ResourcesSection() {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async () => {
    setBusy(true);
    try {
      setRows(await pendingCommunityResources());
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load submissions"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const decide = async (r: ResourceRow, decision: "approved" | "rejected" | "quarantined") => {
    setBusy(true);
    try {
      const res = await reviewResource(r.id, decision, note[r.id] ?? "");
      if (!res.ok) { toast("✗ " + (res.error ?? "Couldn't update")); return; }
      toast(decision === "approved" ? "✅ Approved — now in the community library" : decision === "rejected" ? "🚫 Rejected" : "⛔ Quarantined");
      await load();
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Couldn't update"));
    } finally {
      setBusy(false);
    }
  };

  const guardChips = (r: ResourceRow) => {
    const g = r.guard;
    if (!g) return null;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Chip tone={g.status === "ok" ? "ok" : g.status === "pending" ? "warn" : "bad"}>guard: {g.status}</Chip>
        {g.finalUrl && <Chip>final: {g.finalUrl.slice(0, 60)}</Chip>}
        {g.checkedAt && <Chip>checked {new Date(g.checkedAt).toLocaleString()}</Chip>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-extrabold">🔗 Community submissions — human gate</h2>
            <p className="mt-0.5 max-w-[680px] text-[12.5px] text-mut">
              Every link already passed the safety guard (SSRF-safe fetch, Safe Browsing + URLhaus). Your decision is the
              recorded L4 gate: <span className="font-bold">nothing becomes app-wide without it</span>. Requires MFA when admin enforcement is on.
            </p>
          </div>
          <button className={btnGhost + btnSm} onClick={() => void load()} disabled={busy}>Refresh</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-5`}>
          <p className="text-[13px] text-mut">No pending or quarantined submissions right now. (Requires supabase/resources.sql — run scripts/setup-security.js.)</p>
        </div>
      ) : (
        rows.map(r => (
          <div key={r.id} className={`${cardCls} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-bold text-acctxt hover:underline">{r.title}</a>
                  <Chip tone={r.status === "quarantined" ? "bad" : "warn"}>{r.status}</Chip>
                  <Chip>{r.category}</Chip>
                  {r.flags > 0 && <Chip tone="bad">🚩 {r.flags} report{r.flags === 1 ? "" : "s"}</Chip>}
                </div>
                {r.description && <p className="mt-1 text-[12.5px] text-mut">{r.description}</p>}
                <p className="mt-1 truncate text-[11.5px] text-fnt">{r.url}</p>
                <p className="mt-0.5 text-[11.5px] text-fnt">suggested by {r.suggested_by ?? "unknown"} · {new Date(r.created_at).toLocaleString()}</p>
                {guardChips(r)}
              </div>
              <div className="flex flex-none flex-col items-end gap-2">
                <button className={btnGhost + btnSm} onClick={() => setOpen(open === r.id ? null : r.id)}>Guard evidence</button>
                <div className="flex gap-2">
                  <button className={btnOk + btnSm} disabled={busy} onClick={() => void decide(r, "approved")}>✓ Approve</button>
                  <button className={btnDanger + btnSm} disabled={busy} onClick={() => void decide(r, "rejected")}>✕ Reject</button>
                  {r.status === "approved" && (
                    <button className={btnDanger + btnSm} disabled={busy} onClick={() => void decide(r, "quarantined")}>⛔ Quarantine</button>
                  )}
                </div>
              </div>
            </div>
            {open === r.id && (
              <div className="mt-3 rounded-xl border border-line/10 bg-deep/50 p-3">
                <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap font-mono text-[11px] text-fnt">
                  {JSON.stringify(r.guard ?? {}, null, 2)}
                </pre>
                <input
                  value={note[r.id] ?? ""}
                  onChange={e => setNote(n => ({ ...n, [r.id]: e.target.value }))}
                  maxLength={300}
                  placeholder="Note for the audit log (optional)"
                  className="mt-2 w-full rounded-lg border border-line/15 bg-deep/80 px-3 py-1.5 text-[12.5px] text-ink placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
                />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trends — the admin gate for structural catalog proposals            */
/* (docs/skill-counselor.md §4.4). Badges apply automatically;          */
/* structural changes (promote/demote/review) land here for the        */
/* recorded decision.                                                 */
/* ------------------------------------------------------------------ */

function TrendsSection() {
  const [rows, setRows] = useState<UpdateProposalRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      setRows(await adminPendingProposals());
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const decide = async (p: UpdateProposalRow, decision: "accepted" | "ignored") => {
    setBusy(true);
    try {
      const r = await adminDecisionProposal(p.id, decision);
      if (!r.ok) { toast("✗ " + (r.error ?? "Couldn't update")); return; }
      toast(decision === "accepted" ? "✅ Accepted — catalog change recorded" : "🙈 Ignored");
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">📈 Market-trend proposals</h2>
        <p className="mt-0.5 max-w-[680px] text-[12.5px] text-mut">
          Each week the trends-refresh sweep measures skill demand in our job corpus (+ npm/GitHub signals).
          Badges in the Skill Counselor update automatically; structural changes (promote/demote/review) are
          proposed here and need your recorded decision. Requires supabase/trends.sql (scripts/setup-security.js).
        </p>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-5`}>
          <p className="text-[13px] text-mut">No pending proposals right now — the last sweep found no stage crossings, or the trends tables aren't applied yet.</p>
        </div>
      ) : (
        rows.map(p => (
          <div key={p.id} className={`${cardCls} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] font-extrabold">{p.skill_id}</span>
                  <Chip tone={p.kind === "demote" ? "bad" : p.kind === "promote" ? "ok" : "warn"}>{p.kind}</Chip>
                  <Chip>pending</Chip>
                  <span className="text-[11.5px] text-fnt">{new Date(p.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[13px] text-ink">{p.reason}</p>
                <pre className="mt-2 max-h-[160px] overflow-auto whitespace-pre-wrap rounded-lg bg-deep/50 p-2 font-mono text-[10.5px] text-fnt">
                  {JSON.stringify(p.signals, null, 2)}
                </pre>
              </div>
              <div className="flex flex-none gap-2">
                <button className={btnOk + btnSm} disabled={busy} onClick={() => void decide(p, "accepted")}>✓ Accept</button>
                <button className={btnGhost + btnSm} disabled={busy} onClick={() => void decide(p, "ignored")}>Ignore</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
