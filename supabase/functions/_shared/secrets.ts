/* secrets — app-managed Edge Function secrets loader.
   The credential secrets admins edit day-to-day (RESEND_API_KEY, ADZUNA_*,
   GITHUB_TOKEN, SAFE_BROWSING_API_KEY) live in the PRIVATE edge_secrets
   table (RLS is_admin()), editable from Admin → Secrets — no Supabase
   dashboard visits.  Functions read them HERE: table first, Deno.env as a
   fallback so legacy dashboard secrets keep working until the app row
   exists.

   Self-contained on purpose (only npm: supabase-js — no ../_shared imports)
   so the Management-API deploy path in scripts/setup-live.js and
   scripts/deploy-functions.mjs can inline it alongside auth/cors/email. */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

let client: SupabaseClient | null | undefined;

function serviceClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  client = url && key ? createClient(url, key) : null;
  return client;
}

/** Read a secret: edge_secrets table first (app-managed), then env. Returns
    "" when neither exists — callers treat that as "not configured". */
export async function getSecret(name: string): Promise<string> {
  const c = serviceClient();
  if (c) {
    const { data, error } = await c.from("edge_secrets").select("value").eq("name", name).maybeSingle();
    if (!error && data?.value) return data.value as string;
  }
  return Deno.env.get(name) ?? "";
}

/** True when the secret is present in the app table OR the environment —
    mirrors what getSecret will actually return. Used by secret-status. */
export async function secretConfigured(name: string): Promise<boolean> {
  const c = serviceClient();
  if (c) {
    const { data, error } = await c.from("edge_secrets").select("value").eq("name", name).maybeSingle();
    if (!error && data?.value) return true;
  }
  return Deno.env.has(name);
}
