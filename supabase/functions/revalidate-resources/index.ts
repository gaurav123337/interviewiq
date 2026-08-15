/* revalidate-resources — L5 post-approval re-check (docs/resource-safety-guard.md).
   A clean site can go bad later. On a weekly cron this function re-runs the
   full guard (L1 + L2 reputation) over APPROVED community resources and:
     - blocked   → status='quarantined' (auto, audit-logged by the trigger)
     - ok        → guard.checkedAt refreshed
     - pending   → left as-is (guard note updated; nothing approved on doubt)
   Triggered by pg_cron (supabase/revalidate-resources-cron.sql) with the
   REVALIDATE_RESOURCES_SECRET header, or by an admin from the dashboard via
   their JWT (requireAdmin). */

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { makeLimiter, clientKey } from "../_shared/ratelimit.ts";
import { guardResource } from "../_shared/resourceGuard.ts";
import { makeReputationChecker } from "../_shared/reputation.ts";

/* one sweep per minute is plenty for a weekly job */
const limitSweep = makeLimiter(1, 60_000);
const MAX_SWEEP = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ ok: false, error: "origin not allowed" }), { status: 403, headers });
  }
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405, headers });
    }
    const secret = Deno.env.get("REVALIDATE_RESOURCES_SECRET") ?? "";
    const sent = (req.headers.get("x-revalidate-secret") ?? "").trim();
    const admin = await requireAdmin(req);
    const authorized = (secret !== "" && sent === secret) || !!admin;
    if (!authorized) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden — cron secret or admin session required" }), { status: 401, headers });
    }
    if (!limitSweep(clientKey(req))) {
      return new Response(JSON.stringify({ ok: false, error: "sweep already running" }), { status: 429, headers });
    }

    const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: rows, error } = await service.from("resources")
      .select("id, url")
      .eq("mode", "community")
      .eq("status", "approved")
      .limit(MAX_SWEEP);
    if (error) return json(headers, 500, { ok: false, error: error.message });

    const checker = makeReputationChecker(Deno.env);
    const results = { checked: 0, quarantined: 0, unchanged: 0, pending: 0, errors: 0 };
    const detail: { id: string; status: string }[] = [];

    for (const row of rows as { id: string; url: string }[]) {
      try {
        const verdict = await guardResource(row.url, { checkReputation: checker });
        const guardRecord = {
          status: verdict.status,
          reasons: verdict.reasons ?? [],
          finalUrl: verdict.finalUrl ?? null,
          checkedAt: new Date().toISOString(),
          revalidatedAt: new Date().toISOString()
        };
        results.checked++;
        if (verdict.status === "blocked") {
          await service.from("resources").update({
            status: "quarantined",
            guard: guardRecord,
            reviewed_by: "system (auto-revalidation)",
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq("id", row.id);
          results.quarantined++;
          detail.push({ id: row.id, status: "quarantined" });
        } else {
          await service.from("resources").update({ guard: guardRecord, updated_at: new Date().toISOString() }).eq("id", row.id);
          if (verdict.status === "ok") results.unchanged++;
          else results.pending++;
          detail.push({ id: row.id, status: verdict.status });
        }
      } catch {
        /* a sweep-level transport failure for one resource — leave as-is */
        results.errors++;
      }
    }

    return json(headers, 200, { ok: true, results, detail });
  } catch (e) {
    return json(headers, 500, { ok: false, error: e instanceof Error ? e.message : "revalidation failed" });
  }
});

function json(headers: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
