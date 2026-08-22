import { useEffect, useState } from "react";
import type { Config } from "../types";
import { aiAvailable, chat, clearKey, getSettings, saveSettings } from "../ai";
import { activatePro, deactivatePro, getStoredKey } from "../services/license";
import {
  clearServerEntitlement, getCachedEntitlement, redeemGrant, refreshEntitlement, testLicensing, tierSource, type ServerEntitlement
} from "../services/entitlement";
import { cancelSubscription, fmtMinor, getMyPayments, getMySubscription, type MyPayment, type MySubscription } from "../services/billing";
import { getTheme, setTheme, type Theme } from "../services/theme";
import { aiCallsLeft, getTier, sessionsLeft } from "../services/entitlements";
import { digestSummary, fire, getPermission, getPrefs, isSupported, requestPermission, savePrefs } from "../services/notifications";
import { cloudEmailRecoveryBackup, cloudMfaEnroll, cloudMfaFactors, cloudMfaRecover, cloudMfaUnenroll, cloudMfaVerify, cloudOAuthSignIn, cloudRecoveryStatus, cloudSaveRecoveryCodes, cloudSignIn, cloudSignOut, cloudSignUp, cloudSyncNow, getCloudState, isCloudConfigured, refreshOAuthProviders, subscribeCloud, type EnrolledTotp, type TotpFactor } from "../services/cloud";
import { generateRecoveryCodes, hashRecoveryCodeSet } from "../services/recoveryCodes";
import type { OAuthProvider } from "../services/cloud";
import { useApp } from "../store";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip, Seg, Switch } from "./ui";
import { SettingsProvider, type CloudSlice } from "./settings/SettingsContext";
import { CloudSyncSection } from "./settings/CloudSyncSection";
import { SecuritySection } from "./settings/SecuritySection";
import { AISection } from "./settings/AISection";
import { RemindersSection } from "./settings/RemindersSection";
import { DataSection } from "./settings/DataSection";
import { ModuleModelsSection } from "./settings/ModuleModelsSection";
import { OptRow } from "./settings/OptRow";

export function Settings() {
  const { state, updateConfig, clearHistory, resetAll } = useApp();
  const { config, sessions } = state;
  const [key, setKey] = useState(getSettings().key);
  const [base, setBase] = useState(getSettings().base);
  const [model, setModel] = useState(getSettings().model);
  const [testing, setTesting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [proKey, setProKey] = useState("");
  const [pro, setPro] = useState(getTier() === "pro");
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [prefs, setPrefs] = useState(getPrefs());
  const [perm, setPerm] = useState(getPermission());
  const [ent, setEnt] = useState<ServerEntitlement | null>(() => getCachedEntitlement());
  const [proCode, setProCode] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [payments, setPayments] = useState<MyPayment[]>([]);
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cloud, setCloud] = useState(getCloudState());
  const [cloudMode, setCloudMode] = useState<"in" | "up">("in");
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudPass, setCloudPass] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [mfaStep, setMfaStep] = useState<"idle" | "challenge">("idle");
  const [mfaRecoveryMode, setMfaRecoveryMode] = useState(false);
  const [mfaRecoveryCode, setMfaRecoveryCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<{ unused: number; total: number } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<TotpFactor[]>([]);
  const [mfaEnrollInfo, setMfaEnrollInfo] = useState<EnrolledTotp | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");

  useEffect(() => subscribeCloud(setCloud), []);
  useEffect(() => {
    if (isCloudConfigured()) void refreshOAuthProviders();
  }, []);

  const doOAuth = async (p: OAuthProvider) => {
    setCloudBusy(true);
    try {
      const r = await cloudOAuthSignIn(p);
      if (!r.ok) toast("✗ " + (r.error ?? "Sign-in failed"));
    } finally { setCloudBusy(false); }
  };

  const doCloudAuth = async () => {
    if (!cloudEmail || !cloudPass) { toast("Enter your email and password"); return; }
    setCloudBusy(true);
    try {
      const r = cloudMode === "in"
        ? await cloudSignIn(cloudEmail, cloudPass)
        : await cloudSignUp(cloudEmail, cloudPass);
      if (!r.ok) { toast("✗ " + (r.error ?? "Something went wrong")); return; }
      if ("mfaRequired" in r && r.mfaRequired) { setMfaStep("challenge"); toast("🔐 Enter your 6-digit authenticator code"); return; }
      if ("needsConfirmation" in r && r.needsConfirmation) { toast("📬 Check your email to confirm your account"); return; }
      toast("☁️ Cloud sync on — your progress is backed up");
      setCloudEmail(""); setCloudPass("");
    } finally { setCloudBusy(false); }
  };

  useEffect(() => {
    let live = true;
    const loadAll = () => {
      void refreshEntitlement().then(e => { if (live) setEnt(e); });
      if (getCloudState().user) {
        void getMyPayments().then(p => { if (live) setPayments(p); }).catch(() => {});
        void getMySubscription().then(s => { if (live) setSub(s); }).catch(() => {});
      }
    };
    loadAll();
    const un = subscribeCloud(() => { setCloud(getCloudState()); loadAll(); });
    return () => { live = false; un(); };
  }, []);

  const doMfaVerify = async () => {
    if (!mfaCode.trim()) { toast("Enter your 6-digit code"); return; }
    setMfaBusy(true);
    try {
      const r = await cloudMfaVerify(mfaCode);
      if (!r.ok) { toast("✗ " + (r.error ?? "Verification failed")); return; }
      setMfaStep("idle"); setMfaCode("");
      toast("☁️ Signed in — 2-factor verified");
    } finally { setMfaBusy(false); }
  };

  const doMfaRecover = async () => {
    if (!mfaRecoveryCode.trim()) { toast("Enter your recovery code"); return; }
    if (!cloudEmail.trim()) { toast("Enter the account email"); return; }
    setRecoveryBusy(true);
    try {
      const r = await cloudMfaRecover(cloudEmail.trim(), mfaRecoveryCode.trim());
      if (!r.ok) { toast("✗ " + (r.error ?? "Recovery failed")); return; }
      setMfaStep("idle"); setMfaRecoveryMode(false); setMfaRecoveryCode(""); setMfaCode("");
      toast("🔓 Authenticator removed — signing you back in");
      if (cloudEmail && cloudPass) {
        const again = await cloudSignIn(cloudEmail, cloudPass);
        if (again.ok) {
          toast("☁️ Signed in — set up a new authenticator in Settings");
          setCloudEmail(""); setCloudPass("");
        } else { toast("✗ Sign in again to continue"); }
      } else { toast("🔓 Sign in again to continue (OAuth)"); }
    } finally { setRecoveryBusy(false); }
  };

  const saveRecovery = async () => {
    if (!recoveryCodes) return;
    setRecoveryBusy(true);
    try {
      const user = getCloudState().user;
      if (!user?.email) { toast("✗ Not signed in"); return; }
      const hashes = await hashRecoveryCodeSet(user.email, recoveryCodes);
      const r = await cloudSaveRecoveryCodes(hashes);
      if (!r.ok) { toast("✗ " + (r.error ?? "Couldn't save codes")); return; }
      setRecoveryCodes(null);
      await refreshRecoveryStatus();
      toast("🔑 Recovery codes saved — store them somewhere safe");
    } finally { setRecoveryBusy(false); }
  };

  const emailBackup = async () => {
    if (!recoveryCodes) return;
    setRecoveryBusy(true);
    try {
      const r = await cloudEmailRecoveryBackup(recoveryCodes);
      if (!r.ok) { toast("✗ " + (r.error ?? "Email backup failed")); return; }
      toast("📧 Backup emailed — check your inbox");
    } finally { setRecoveryBusy(false); }
  };

  const refreshMfa = async () => {
    const r = await cloudMfaFactors();
    if (r.ok) setMfaFactors(r.factors);
  };

  const refreshRecoveryStatus = async () => {
    const r = await cloudRecoveryStatus();
    if (r.ok) setRecoveryStatus({ unused: r.unused, total: r.total });
  };

  const enrollMfa = async () => {
    setMfaBusy(true);
    try {
      const r = await cloudMfaEnroll();
      if (!r.ok || !r.totp) { toast("✗ " + (r.error ?? "Enrollment failed")); return; }
      setMfaEnrollInfo(r.totp);
      await refreshMfa();
    } finally { setMfaBusy(false); }
  };

  const activateMfa = async () => {
    if (!mfaVerifyCode.trim()) { toast("Enter the 6-digit code from your authenticator"); return; }
    setMfaBusy(true);
    try {
      const r = await cloudMfaVerify(mfaVerifyCode, mfaEnrollInfo?.id);
      if (!r.ok) { toast("✗ " + (r.error ?? "Code didn't match")); return; }
      setMfaEnrollInfo(null); setMfaVerifyCode("");
      await refreshMfa();
      setRecoveryCodes(generateRecoveryCodes(10));
      toast("🔐 2-factor authentication is now active");
    } finally { setMfaBusy(false); }
  };

  const removeMfa = async (factorId: string) => {
    setMfaBusy(true);
    try {
      const r = await cloudMfaUnenroll(factorId);
      if (!r.ok) { toast("✗ " + (r.error ?? "Couldn't remove the factor")); return; }
      setMfaEnrollInfo(null);
      await refreshMfa();
      toast("🗑️ Authenticator removed");
    } finally { setMfaBusy(false); }
  };

  useEffect(() => {
    if (getCloudState().user) { void refreshMfa(); void refreshRecoveryStatus(); }
  }, [cloud.user?.id]);

  const doCancelSub = async () => {
    if (!sub) return;
    setSubBusy(true);
    try {
      const r = await cancelSubscription(sub.providerSubscriptionId);
      setSub({ ...sub, status: "cancelled", currentPeriodEnd: r.currentPeriodEnd });
      setConfirmCancel(false);
      toast(`🔁 Subscription cancelled — you keep Pro until ${r.currentPeriodEnd ? new Date(r.currentPeriodEnd).toLocaleDateString() : "the end of the billing period"}.`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Cancel failed"));
    } finally { setSubBusy(false); }
  };

  const doRedeem = async () => {
    if (!proCode.trim()) return;
    setRedeemBusy(true);
    try {
      const r = await redeemGrant(proCode);
      if (r.ok) {
        setEnt(r.entitlement ?? null);
        setPro(r.entitlement?.active === true);
        setProCode("");
        toast("💎 Code redeemed — Pro is now active on your account 🎉");
      } else {
        toast("✗ " + (r.error ?? "Couldn't redeem that code"));
      }
    } finally { setRedeemBusy(false); }
  };

  const toggleReminder = async (v: boolean) => {
    if (v && getPermission() !== "granted") {
      const p = await requestPermission();
      setPerm(p);
      if (p !== "granted") { toast("🔕 Notifications blocked — allow them in your browser settings"); return; }
    }
    savePrefs({ ...getPrefs(), enabled: v });
    setPrefs(getPrefs());
    toast(v ? "🔔 Daily reminder on" : "Daily reminder off");
  };

  const setReminderTime = (time: string) => {
    savePrefs({ ...getPrefs(), time });
    setPrefs(getPrefs());
  };

  const toggleWeekly = async (v: boolean) => {
    if (v && getPermission() !== "granted") {
      const p = await requestPermission();
      setPerm(p);
      if (p !== "granted") { toast("🔕 Notifications blocked — allow them in your browser settings"); return; }
    }
    savePrefs({ ...getPrefs(), weekly: v });
    setPrefs(getPrefs());
    toast(v ? "📊 Weekly digest on" : "Weekly digest off");
  };

  const testNotification = async () => {
    const ok = await fire("🔔 InterviewIQ", "This is how your practice reminder will look.");
    toast(ok ? "✅ Notification sent" : "🔕 Enable notifications first");
  };

  const setDigestDay = (day: string) => {
    savePrefs({ ...getPrefs(), digestDay: day === "any" ? null : Number(day) });
    setPrefs(getPrefs());
  };

  const testWeeklyDigest = async () => {
    if (getPermission() !== "granted") {
      const p = await requestPermission();
      setPerm(p);
      if (p !== "granted") { toast("🔕 Notifications blocked — allow them in your browser settings"); return; }
    }
    const summ = digestSummary({ sessions });
    if (!summ) { toast("Nothing to summarize yet — complete a session first"); return; }
    const ok = await fire(summ.title, summ.body);
    toast(ok ? "📊 Test digest sent" : "🔕 Enable notifications first");
  };

  const saveKey = () => {
    saveSettings({ key, base, model });
    toast(aiAvailable() ? "✨ AI feedback enabled" : "Key saved — add a key to enable AI coaching");
  };

  const testConnection = async () => {
    saveSettings({ key, base, model });
    setTesting(true);
    try {
      await chat([{ role: "user", content: "Reply with exactly: OK" }], { maxTokens: 10 });
      setTesting(false);
      toast("✅ AI connection works");
    } catch (e) {
      setTesting(false);
      toast("✗ " + ((e as Error).message || "Connection failed"));
    }
  };

  const cloudSlice: CloudSlice = {
    user: cloud.user as CloudSlice["user"],
    configured: cloud.configured,
    syncing: cloud.syncing,
    oauth: cloud.oauth,
  };

  const ctx = {
    config, updateConfig, sessions,
    pro, setPro, ent, setEnt, proKey, setProKey, proCode, setProCode, redeemBusy, doRedeem,
    sub, subBusy, confirmCancel, setConfirmCancel, doCancelSub, payments,
    cloud: cloudSlice, cloudMode, setCloudMode, cloudEmail, setCloudEmail, cloudPass, setCloudPass,
    cloudBusy, doCloudAuth, doOAuth,
    mfaStep, setMfaStep, mfaRecoveryMode, setMfaRecoveryMode, mfaRecoveryCode, setMfaRecoveryCode,
    mfaCode, setMfaCode, mfaBusy, doMfaVerify, doMfaRecover,
    mfaFactors, mfaEnrollInfo, setMfaEnrollInfo, mfaVerifyCode, setMfaVerifyCode,
    enrollMfa, activateMfa, removeMfa,
    recoveryCodes, setRecoveryCodes, recoveryBusy, saveRecovery, emailBackup, recoveryStatus,
    key, setKey, base, setBase, model, setModel, testing, saveKey, testConnection,
    themeState: theme, setThemeState,
    prefs, perm, toggleReminder, setReminderTime, toggleWeekly, setDigestDay, testNotification, testWeeklyDigest,
    clearHistory, resetAll, confirmReset, setConfirmReset,
  };

  return (
    <SettingsProvider value={ctx}>
      <div className="anim-view mx-auto max-w-[760px]">
        <div className="pt-4 text-center">
          <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">⚙️ Settings</span>
          <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Tune your <span className="grad-text">coach</span>.</h1>
          <p className="mx-auto mt-2 max-w-[520px] text-[14.5px] text-mut">Everything works offline out of the box. Add an API key for generative AI feedback.</p>
        </div>

        <div className="mt-7 space-y-5">
          {/* Pro section */}
          <section className={`${cardCls} p-6`}>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-[16px] font-extrabold">✨ InterviewIQ Pro</h2>
              {pro && <Chip tone="ok">ACTIVE</Chip>}
              {ent?.active && <Chip tone="ok">SERVER-VERIFIED</Chip>}
              {!ent?.active && tierSource() === "local" && <Chip tone="warn">🧪 TEST KEY</Chip>}
            </div>
            <p className="mb-4 text-[13px] text-mut">
              {pro
                ? `Pro is active${ent?.active ? " on your account" : ` on this device (${getStoredKey()})`}${ent?.expiresAt ? ` — expires ${new Date(ent.expiresAt).toLocaleDateString()}` : ""}. Unlimited sessions and AI coaching.`
                : `Unlock unlimited sessions, all companies, and unlimited AI coaching. You have ${sessionsLeft()} session${sessionsLeft() === 1 ? "" : "s"} left this month and ${aiCallsLeft()} AI call${aiCallsLeft() === 1 ? "" : "s"} left today.`}
            </p>
            {ent?.active ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fnt">
                  <Chip tone="ok">{ent.plan ?? "pro"}</Chip>
                  <Chip>via {ent.source ?? "account"}</Chip>
                  {ent.expiresAt ? <Chip>until {new Date(ent.expiresAt).toLocaleDateString()}</Chip> : <Chip>never expires</Chip>}
                  {ent.discountPct > 0 && <Chip tone="lvl">−{ent.discountPct}% discount{ent.discountExpiresAt ? ` until ${new Date(ent.discountExpiresAt).toLocaleDateString()}` : ""}</Chip>}
                </div>
                <button className={btnDanger + btnSm} onClick={() => { deactivatePro(); setPro(false); toast("Pro deactivated on this device — it stays active on your account until it expires"); }}>
                  Deactivate on this device
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="mb-1 text-[12px] font-bold text-mut">Redeem a Pro code (server-verified — works on any device after sign-in)</div>
                  <div className="flex flex-wrap gap-2.5">
                    <input value={proCode} onChange={e => setProCode(e.target.value)} placeholder="IQGRANT-…" className="min-w-[240px] flex-1 rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 font-mono text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20" />
                    <button className={btnPrimary + btnSm} disabled={redeemBusy || !proCode.trim()} onClick={doRedeem}>{redeemBusy ? "Redeeming…" : "Redeem"}</button>
                  </div>
                  {!cloud.user && <p className="mt-1.5 text-[11.5px] text-fnt">Sign in to your cloud account first — codes are tied to your account, not the device.</p>}
                </div>
                {testLicensing() ? (
                  <div>
                    <div className="mb-1 text-[12px] font-bold text-mut">🧪 Test key (dev only — forgeable, disabled before launch)</div>
                    <div className="flex flex-wrap gap-2.5">
                      <input value={proKey} onChange={e => setProKey(e.target.value)} placeholder="IQPRO-XXXX-XXXX-XXXX" className="min-w-[240px] flex-1 rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 font-mono text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20" />
                      <button className={btnGhost + btnSm} onClick={() => { const r = activatePro(proKey); if (r.ok) { setPro(true); setProKey(""); toast("🎉 Pro activated (test key)"); } else toast("✗ " + (r.error ?? "Invalid key")); }}>Activate test key</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-mut">Pro comes from your account now — ask your admin for a grant code, or buy via checkout.</p>
                )}
              </div>
            )}
          </section>

          {/* subscription */}
          {cloud.user && sub && (
            <section className={`${cardCls} p-6`}>
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-[16px] font-extrabold">🔁 Subscription</h2>
                {sub.status === "active" ? <Chip tone="ok">ACTIVE</Chip> : <Chip tone="warn">{sub.status.toUpperCase()}</Chip>}
                {sub.status === "cancelled" && <Chip tone="warn">ends {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "at period end"}</Chip>}
              </div>
              <p className="mb-4 text-[13px] text-mut">
                {sub.plan} plan via <span className="font-bold">{sub.provider}</span>
                {sub.currentPeriodEnd && <> · next billing date <span className="font-bold text-ink">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</span></>}
                {sub.status === "cancelled" && <> · no more charges — access continues until the period ends.</>}
              </p>
              {sub.status === "active" ? (
                confirmCancel ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[12.5px] font-bold text-warn">Stop future billing? You keep Pro until {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "period end"}.</span>
                    <button className={btnDanger + btnSm} disabled={subBusy} onClick={() => void doCancelSub()}>{subBusy ? "Cancelling…" : "Yes, cancel subscription"}</button>
                    <button className={btnGhost + btnSm} disabled={subBusy} onClick={() => setConfirmCancel(false)}>Keep it</button>
                  </div>
                ) : (
                  <button className={btnDanger + btnSm} onClick={() => setConfirmCancel(true)}>Cancel subscription</button>
                )
              ) : (
                <p className="text-[12.5px] text-fnt">Cancelled — your access ends on {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "the billing period end"}. You can re-subscribe from the Pro modal anytime.</p>
              )}
            </section>
          )}

          {/* purchase history */}
          {cloud.user && (
            <section className={`${cardCls} p-6`}>
              <h2 className="mb-1 text-[16px] font-extrabold">🧾 Purchase history</h2>
              <p className="mb-3 text-[13px] text-mut">Confirmed payments on your account — renewals extend your Pro expiry automatically.</p>
              {payments.length === 0 ? (
                <p className="text-[12.5px] text-fnt">No purchases yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {payments.map((p, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
                      <span className="min-w-[110px] flex-1 font-bold capitalize">{p.plan}</span>
                      <Chip tone={p.status === "paid" ? "ok" : "warn"}>{p.status === "refunded" ? "💸 " : ""}{p.status}</Chip>
                      {p.kind === "subscription" && <Chip tone="lvl">🔁 subscription</Chip>}
                      <Chip>{p.provider}</Chip>
                      <span className="font-bold tabular-nums">{fmtMinor(p.amountMinor, p.currency)}</span>
                      {p.discountPct > 0 && <Chip tone="lvl">−{p.discountPct}%</Chip>}
                      <span className="text-[11px] text-fnt">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Cloud sync */}
          <CloudSyncSection />

          {/* Security (MFA) */}
          {cloud.user && <SecuritySection />}

          {/* AI section */}
          <AISection />

          {/* AI models per feature */}
          <ModuleModelsSection />

          {/* appearance */}
          <section className={`${cardCls} p-6`}>
            <h2 className="mb-1 text-[16px] font-extrabold">🎨 Appearance</h2>
            <p className="mb-3 text-[13px] text-mut">Pick a look — saved on this device and applied instantly.</p>
            <OptRow title="Theme" sub={theme === "light" ? "Light mode" : "Dark mode"}>
              <Seg options={[{ value: "dark", label: "🌙 Dark" }, { value: "light", label: "☀️ Light" }]} value={theme} onChange={v => { setTheme(v); setThemeState(v); }} />
            </OptRow>
          </section>

          {/* reminders */}
          <RemindersSection />

          {/* defaults */}
          <section className={`${cardCls} p-6`}>
            <h2 className="mb-1 text-[16px] font-extrabold">🎛️ Interview defaults</h2>
            <p className="mb-3 text-[13px] text-mut">Applied to every new session (you can still tweak them in the setup modal).</p>
            <OptRow title="Questions per session" sub="More questions = deeper assessment">
              <Seg options={[5, 8, 10, 15].map(c => ({ value: String(c), label: String(c) }))} value={String(config.count)} onChange={v => updateConfig({ count: Number(v) })} />
            </OptRow>
            <OptRow title="Mode" sub="Journey ramps from junior to your level">
              <Seg<Config["mode"]> options={[{ value: "standard", label: "Standard" }, { value: "journey", label: "Journey" }]} value={config.mode} onChange={v => updateConfig({ mode: v })} />
            </OptRow>
            <OptRow title="Timer" sub="Real interview pressure">
              <Seg<Config["timing"]> options={[{ value: "none", label: "Off" }, { value: "relaxed", label: "3 min" }, { value: "strict", label: "90 s" }]} value={config.timing} onChange={v => updateConfig({ timing: v })} />
            </OptRow>
            <OptRow title="Voice answers" sub="Dictate with your microphone">
              <Switch checked={config.voice} onChange={v => updateConfig({ voice: v })} />
            </OptRow>
          </section>

          {/* data */}
          <DataSection />
        </div>
      </div>
    </SettingsProvider>
  );
}
