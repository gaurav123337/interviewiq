/* Shared service-role client.

   New Supabase projects no longer populate the deprecated
   SUPABASE_SERVICE_ROLE_KEY default — instead they inject
   SUPABASE_SECRET_KEYS (a JSON dict of modern sb_secret_... keys) as a
   default secret on every function. Prefer the explicitly-set legacy key
   (backward compatible with existing deployments), else fall back to the
   first modern secret key, else return an unauthenticated client (callers
   fail closed on their own checks). */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  let key = legacy;
  if (!key) {
    const json = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}";
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      const first = Object.values(parsed)[0];
      if (typeof first === "string" && first.length > 0) key = first;
    } catch {
      /* unparseable — leave key empty; the caller's request will 401/500 */
    }
  }
  return createClient(url, key);
}
