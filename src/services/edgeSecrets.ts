/* App-managed Edge Function secrets — the credential secrets the admin edits
   day-to-day (Resend, Adzuna, GitHub, Safe Browsing). Stored in the PRIVATE
   public.edge_secrets table (RLS is_admin()), editable HERE from Admin →
   Secrets — no Supabase dashboard visits.  The edge functions read the same
   table through ../_shared/secrets.ts (table-first, env fallback), so saving
   here is all that's needed; the legacy dashboard secrets become a fallback.

   Values are write-only from the client: reads return only a configured
   flag + a masked hint, never the stored value. */

import { getCloudState, getSupabaseClient } from "./cloud";

export interface EdgeSecretStatus {
  name: string;
  configured: boolean;
  keyHint: string;
  updatedAt: number | null;
}

function hint(value: string): string {
  if (!value) return "";
  return value.length <= 12 ? "••••" + value.slice(-4) : value.slice(0, 8) + "…" + value.slice(-4);
}

/** The app-managed secret names (kept in sync with secret-status EXPECTED). */
export const APP_MANAGED_SECRETS = [
  "RESEND_API_KEY",
  "ADZUNA_APP_ID",
  "ADZUNA_APP_KEY",
  "GITHUB_TOKEN",
  "SAFE_BROWSING_API_KEY"
] as const;

/** Reads the app-managed secrets: which are configured (a row exists) plus a
    masked hint for each. Never returns the stored value. */
export async function getEdgeSecrets(): Promise<EdgeSecretStatus[]> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const { data, error } = await client.from("edge_secrets").select("name, value, updated_at");
  if (error) throw new Error(error.message);
  const rows = new Map((data ?? []).map((r) => [r.name as string, r]));
  return APP_MANAGED_SECRETS.map((name) => {
    const row = rows.get(name);
    const value = (row?.value as string | undefined) ?? "";
    return {
      name,
      configured: !!value,
      keyHint: hint(value),
      updatedAt: typeof row?.updated_at === "number" ? row.updated_at : null
    };
  });
}

/** Saves one app-managed secret. Empty value deletes the row (falls back to
    the env secret if one exists). RLS enforces is_admin() server-side. */
export async function saveEdgeSecret(name: string, value: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client || !getCloudState().user) throw new Error("Sign in to your cloud account first.");
  const trimmed = value.trim();
  if (!(APP_MANAGED_SECRETS as readonly string[]).includes(name)) throw new Error(`Unknown secret: ${name}`);
  if (trimmed) {
    const { error } = await client.from("edge_secrets").upsert(
      { name, value: trimmed, updated_at: Date.now() },
      { onConflict: "name" }
    );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("edge_secrets").delete().eq("name", name);
    if (error) throw new Error(error.message);
  }
}
