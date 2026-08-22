/* Cloud service — barrel re-export (zero import changes for consumers) */

export type { OAuthProvider, CloudState } from "./state";
export { getCloudState, subscribeCloud } from "./state";

export { isCloudConfigured, getSupabaseClient, setTestClient, cloudFnHeaders } from "./client";

export { cloudSignIn, cloudSignUp, cloudSignOut, cloudOAuthSignIn, refreshOAuthProviders, oauthProvidersFromSettings } from "./auth";

export type { TotpFactor, EnrolledTotp } from "./mfa";
export { cloudMfaFactors, cloudMfaEnroll, cloudMfaVerify, cloudMfaUnenroll, cloudMfaRecover, cloudSaveRecoveryCodes, cloudRecoveryStatus, cloudEmailRecoveryBackup } from "./mfa";

export { SupabaseRemoteStore } from "./remoteStore";

export { initCloud, startEngine, stopEngine, cloudSyncNow } from "./engine";

export { cloudDownloadMyData, cloudDeleteMyAccount } from "./dataRights";
