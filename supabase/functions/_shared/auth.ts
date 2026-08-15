/* auth — caller verification for edge functions (docs/app-security.md §5).
   Replaces client-held secrets: on-demand digest sends authenticate with the
   caller's Supabase JWT and are scoped to the caller's own email (admins may
   send to anyone). Broadcasts keep a shared env secret for pg_cron, and
   admins may also trigger them from the dashboard via their JWT. */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Keep in sync with is_owner() in supabase/admin.sql — the SQL is authoritative. */
export const OWNER_EMAIL = "gaurav.123337@gmail.com";

/** Service-role client — never exposed to the client bundle. */
export function serviceClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface Caller {
  uid: string;
  email: string;
}

/** Validates the caller's JWT (Authorization: Bearer) and returns their id + email. */
export async function callerFrom(req: Request): Promise<Caller | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const client = serviceClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { uid: data.user.id, email: (data.user.email ?? "").toLowerCase() };
}

/** Server-side admin check: the owner, or a row in app_admins. */
export async function isAdminUser(email: string): Promise<boolean> {
  const e = (email ?? "").toLowerCase();
  if (!e) return false;
  if (e === OWNER_EMAIL) return true;
  const client = serviceClient();
  if (!client) return false;
  const { data } = await client.from("app_admins").select("email").eq("email", e).maybeSingle();
  return !!data;
}

/** Caller must be a signed-in admin. Null → the function should 401. */
export async function requireAdmin(req: Request): Promise<Caller | null> {
  const c = await callerFrom(req);
  if (!c) return null;
  return (await isAdminUser(c.email)) ? c : null;
}

/** Caller must be signed in. When selfOnly, they may only act on their own
    email unless they're an admin. Returns { caller, admin } or null. */
export async function requireUser(
  req: Request,
  opts: { selfEmailOnly?: boolean } = {}
): Promise<{ caller: Caller; admin: boolean } | null> {
  const c = await callerFrom(req);
  if (!c) return null;
  const admin = await isAdminUser(c.email);
  if (opts.selfEmailOnly && !admin) return { caller: c, admin: false };
  return { caller: c, admin };
}
