import { createContext, useContext } from "react";
import type { Config } from "../../types";
import type { ServerEntitlement } from "../../services/entitlement";
import type { MyPayment, MySubscription } from "../../services/billing";
import type { Theme } from "../../services/theme";
import type { EnrolledTotp, TotpFactor } from "../../services/cloud";
import type { OAuthProvider } from "../../services/cloud";

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

export interface CloudSlice {
  user: { email: string; id: string } | null;
  configured: boolean;
  syncing: boolean;
  oauth: OAuthProvider[];
}

export interface PrefsSlice {
  enabled: boolean;
  time: string;
  weekly: boolean;
  digestDay?: number | null;
}

export interface SettingsCtx {
  /* config */
  config: Config;
  updateConfig: (patch: Partial<Config>) => void;
  sessions: unknown[];

  /* Pro */
  pro: boolean;
  setPro: (v: boolean) => void;
  ent: ServerEntitlement | null;
  setEnt: (e: ServerEntitlement | null) => void;
  proKey: string;
  setProKey: (v: string) => void;
  proCode: string;
  setProCode: (v: string) => void;
  redeemBusy: boolean;
  doRedeem: () => Promise<void>;

  /* Subscription */
  sub: MySubscription | null;
  subBusy: boolean;
  confirmCancel: boolean;
  setConfirmCancel: (v: boolean) => void;
  doCancelSub: () => Promise<void>;
  payments: MyPayment[];

  /* Cloud */
  cloud: CloudSlice;
  cloudMode: "in" | "up";
  setCloudMode: (v: "in" | "up") => void;
  cloudEmail: string;
  setCloudEmail: (v: string) => void;
  cloudPass: string;
  setCloudPass: (v: string) => void;
  cloudBusy: boolean;
  doCloudAuth: () => Promise<void>;
  doOAuth: (p: OAuthProvider) => Promise<void>;

  /* MFA — challenge during sign-in */
  mfaStep: "idle" | "challenge";
  setMfaStep: (v: "idle" | "challenge") => void;
  mfaRecoveryMode: boolean;
  setMfaRecoveryMode: (v: boolean) => void;
  mfaRecoveryCode: string;
  setMfaRecoveryCode: (v: string) => void;
  mfaCode: string;
  setMfaCode: (v: string) => void;
  mfaBusy: boolean;
  doMfaVerify: () => Promise<void>;
  doMfaRecover: () => Promise<void>;

  /* MFA — security card */
  mfaFactors: TotpFactor[];
  mfaEnrollInfo: EnrolledTotp | null;
  setMfaEnrollInfo: (v: EnrolledTotp | null) => void;
  mfaVerifyCode: string;
  setMfaVerifyCode: (v: string) => void;
  enrollMfa: () => Promise<void>;
  activateMfa: () => Promise<void>;
  removeMfa: (factorId: string) => Promise<void>;
  recoveryCodes: string[] | null;
  setRecoveryCodes: (v: string[] | null) => void;
  recoveryBusy: boolean;
  saveRecovery: () => Promise<void>;
  emailBackup: () => Promise<void>;
  recoveryStatus: { unused: number; total: number } | null;

  /* AI */
  key: string;
  setKey: (v: string) => void;
  base: string;
  setBase: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  testing: boolean;
  saveKey: () => void;
  testConnection: () => Promise<void>;

  /* Appearance */
  themeState: Theme;
  setThemeState: (v: Theme) => void;

  /* Reminders */
  prefs: PrefsSlice;
  perm: string;
  toggleReminder: (v: boolean) => Promise<void>;
  setReminderTime: (time: string) => void;
  toggleWeekly: (v: boolean) => Promise<void>;
  setDigestDay: (day: string) => void;
  testNotification: () => Promise<void>;
  testWeeklyDigest: () => Promise<void>;

  /* Data */
  clearHistory: () => void;
  resetAll: () => void;
  confirmReset: boolean;
  setConfirmReset: (v: boolean) => void;
}

const SettingsCtxObj = createContext<SettingsCtx | null>(null);

export const SettingsProvider = SettingsCtxObj.Provider;

export function useSettings(): SettingsCtx {
  const ctx = useContext(SettingsCtxObj);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
