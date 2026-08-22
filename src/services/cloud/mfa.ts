/* MFA (TOTP) — enroll/verify/unenroll + recovery codes */

import { CONFIG } from "../../config";
import { resolveClient, cloudFnHeaders } from "./client";

export interface TotpFactor {
  id: string;
  status: string; /* "verified" | "unverified" */
}

export async function cloudMfaFactors(): Promise<{ ok: boolean; factors: TotpFactor[]; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, factors: [], error: "Cloud sync isn't configured" };
  try {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) return { ok: false, factors: [], error: error.message };
    return { ok: true, factors: (data?.totp ?? []).map(f => ({ id: f.id, status: f.status })) };
  } catch (e) {
    return { ok: false, factors: [], error: (e as Error).message };
  }
}

export interface EnrolledTotp {
  id: string;
  qrCode: string; /* data: URL for the QR image */
  secret: string;
}

export async function cloudMfaEnroll(): Promise<{ ok: boolean; totp?: EnrolledTotp; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  try {
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) return { ok: false, error: error?.message ?? "enroll failed" };
    return { ok: true, totp: { id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Verifies a TOTP code against a factor. When `factorId` is given (a freshly
    enrolled factor), it is used directly — no factor re-list, which is more
    robust right after enrollment. Otherwise (MFA-challenged sign-in) the
    verified/first TOTP factor is looked up. */
export async function cloudMfaVerify(code: string, factorId?: string): Promise<{ ok: boolean; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  try {
    let fid = factorId?.trim();
    if (!fid) {
      const { data: factors, error: listErr } = await client.auth.mfa.listFactors();
      if (listErr) return { ok: false, error: listErr.message };
      const totp = factors?.totp ?? [];
      fid = totp.find(f => f.status === "verified")?.id ?? totp[0]?.id;
      if (!fid) return { ok: false, error: "no TOTP factor found — set one up first" };
    }
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: fid, code: (code ?? "").trim() });
    if (error) return { ok: false, error: error.message };
    /* sign-in or re-auth completed — the session is live now */
    const { startEngine } = await import("./engine");
    await startEngine(client).catch(err => {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cloudMfaUnenroll(factorId: string): Promise<{ ok: boolean; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  try {
    const { error } = await client.auth.mfa.unenroll({ factorId });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Redeems a one-time recovery code via the mfa-recovery edge function. */
export async function cloudMfaRecover(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${CONFIG.supabase.url}/functions/v1/mfa-recovery`, {
      method: "POST",
      headers: await cloudFnHeaders(),
      body: JSON.stringify({ email, code })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) return { ok: false, error: body.error ?? `recovery failed (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Stores (replaces) the signed-in user's recovery-code hashes. */
export async function cloudSaveRecoveryCodes(hashes: string[]): Promise<{ ok: boolean; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, error: "Cloud sync isn't configured" };
  try {
    const { error } = await client.rpc("save_recovery_codes", { p_hashes: hashes });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Unused recovery codes remaining. */
export async function cloudRecoveryStatus(): Promise<{ ok: boolean; unused: number; total: number; error?: string }> {
  const client = await resolveClient();
  if (!client) return { ok: false, unused: 0, total: 0, error: "Cloud sync isn't configured" };
  try {
    const [unused, total] = await Promise.all([
      client.from("recovery_codes").select("id", { count: "exact", head: true }).is("used_at", null).is("revoked_at", null),
      client.from("recovery_codes").select("id", { count: "exact", head: true })
    ]);
    const err = unused.error?.message ?? total.error?.message;
    if (err) return { ok: false, unused: 0, total: 0, error: err };
    return { ok: true, unused: unused.count ?? 0, total: total.count ?? 0 };
  } catch (e) {
    return { ok: false, unused: 0, total: 0, error: (e as Error).message };
  }
}

/** Emails a backup copy of the given recovery codes to the signed-in user. */
export async function cloudEmailRecoveryBackup(codes: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${CONFIG.supabase.url}/functions/v1/recovery-backup`, {
      method: "POST",
      headers: await cloudFnHeaders(),
      body: JSON.stringify({ codes })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) return { ok: false, error: body.error ?? `backup failed (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
