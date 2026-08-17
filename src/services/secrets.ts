/* Edge Function secret status — "which secrets are configured and which are
   missing", straight from the secret-status Edge Function. The server only
   reports presence (Deno.env.has), never values: Supabase masks secret
   values anyway, so the admin dashboard can only ever see configured/missing.
   The function enforces the admin gate server-side (app_admins + MFA). */

import { CONFIG } from "../config";
import { getCloudState, getSupabaseClient } from "./cloud";

export interface SecretStatusRow {
  name: string;
  configured: boolean;
  required: boolean;
  builtin?: boolean;
  functions: string[];
  note?: string;
}

export interface SecretStatusSummary {
  total: number;
  configured: number;
  missing: number;
  missingRequired: number;
  missingOptional: number;
  missingRequiredNames: string[];
  missingOptionalNames: string[];
}

export interface SecretStatusReport {
  ok: boolean;
  checkedAt: string;
  serviceRoleAvailable: boolean;
  secrets: SecretStatusRow[];
  summary: SecretStatusSummary;
}

/** GET the secret-status Edge Function as the signed-in admin. Throws with
    the server's message when the caller isn't an admin or the function
    isn't deployed. */
export async function fetchSecretStatus(): Promise<SecretStatusReport> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data: session } = await client.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("You're signed out — sign in again.");

  const res = await fetch(`${CONFIG.supabase.url}/functions/v1/secret-status`, {
    method: "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  });
  const body = (await res.json().catch(() => ({}))) as Partial<SecretStatusReport> & { error?: string };
  if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as SecretStatusReport;
}
