/* submit-resource — the resource-library intake gate (docs/resource-safety-guard.md).
   A signed-in user submits a link they found:
     - mode="personal"   → stored as their own save (owner-scoped). L0/L1 must
                           pass; the L2 reputation verdict is attached and shown
                           as a soft warning in their list (their data, their
                           risk) — per the spec, never silently "clean".
     - mode="community"  → "Suggest to everyone": the FULL guard must pass
                           (L0/L1/L2 verdict "ok"); anything indeterminate goes
                           to "pending" for the L4 admin gate. NOTHING app-wide
                           exists without an admin's recorded decision.
   Fail-closed: any guard error → pending, never approved. No raw HTML ever
   leaves this function (all text is stored plain and rendered escaped).

   Deploy: supabase functions deploy submit-resource (wired into the GitHub
   Pages workflow when SUPABASE_ACCESS_TOKEN is present). */

import { requireUser } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { makeLimiter, clientKey } from "../_shared/ratelimit.ts";
import { cleanText, guardResource, looksInjected, textWithinLimits } from "../_shared/resourceGuard.ts";
import { scanRemote, type ContentScanResult } from "../_shared/contentScan.ts";
import { getSecret } from "../_shared/secrets.ts";
import { makeReputationChecker } from "../_shared/reputation.ts";
import { serviceClient } from "../_shared/serviceClient.ts";

/* best-effort per-client cap: 12 submissions/min */
const limitSubmit = makeLimiter(12, 60_000);

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
    if (!limitSubmit(clientKey(req))) {
      return new Response(JSON.stringify({ ok: false, error: "too many submissions — try again in a minute" }), { status: 429, headers });
    }
    const caller = await requireUser(req);
    if (!caller) {
      return new Response(JSON.stringify({ ok: false, error: "sign in to save resources" }), { status: 401, headers });
    }

    const body = await req.json().catch(() => ({})) as {
      url?: unknown; title?: unknown; description?: unknown; mode?: unknown; category?: unknown;
    };
    const mode = body.mode === "community" ? "community" : "personal";
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const title = cleanText(typeof body.title === "string" ? body.title : "").trim();
    const description = cleanText(typeof body.description === "string" ? body.description : "").trim();
    const category = cleanText(typeof body.category === "string" ? body.category : "general").trim().slice(0, 40) || "general";

    /* L0 intake — the "single line" gate */
    if (!url) return json(headers, 400, { ok: false, error: "A link is required" });
    if (!textWithinLimits(title, 200)) return json(headers, 400, { ok: false, error: "A short title (1–200 chars) is required" });
    if (!textWithinLimits(description, 2000)) return json(headers, 400, { ok: false, error: "Description must be 1–2000 chars" });
    const inj = looksInjected(`${title}. ${description}`);
    if (inj.injected) {
      return json(headers, 400, { ok: false, error: `That text was flagged as a prompt-injection attempt (${inj.reason})` });
    }

    /* L1 + L2 — the guard. Fail-closed: errors land as "pending". The Safe
       Browsing key is app-managed (edge_secrets table) — resolve it once,
       then hand the checker a plain env-like object (sync get). */
    const safeBrowsingKey = await getSecret("SAFE_BROWSING_API_KEY");
    const reputationEnv = { get: (k: string) => (k === "SAFE_BROWSING_API_KEY" ? safeBrowsingKey : Deno.env.get(k)) };
    const verdict = await guardResource(url, { checkReputation: makeReputationChecker(reputationEnv) });

    /* L3 — server-side content scan (static heuristics on the fetched page;
       never executes anything). A scan failure is fail-closed: "pending". */
    let scan: ContentScanResult | null = null;
    let scanError: string | null = null;
    try {
      scan = await scanRemote(url);
    } catch (e) {
      scanError = e instanceof Error ? e.message : "content scan could not complete";
    }
    const effectiveVerdict = scanError
      ? { status: "pending" as const, reasons: [...(verdict.reasons ?? []), `content scan: ${scanError}`] }
      : scan?.blocked
        ? { status: "blocked" as const, reasons: [...(verdict.reasons ?? []), `content scan: ${scan.findings.filter(f => f.severity === "high").map(f => f.label).join("; ")}`] }
        : verdict;

    const service = serviceClient();
    const guardRecord = {
      status: effectiveVerdict.status,
      reasons: effectiveVerdict.reasons ?? [],
      finalUrl: effectiveVerdict.finalUrl ?? null,
      checkedAt: new Date().toISOString(),
      contentScan: scan
        ? { findings: scan.findings, blocked: scan.blocked, title: scan.title ?? null }
        : scanError
          ? { error: scanError }
          : null
    };

    if (mode === "community" && effectiveVerdict.status === "blocked") {
      return json(headers, 400, {
        ok: false,
        error: `That link was blocked by the safety guard: ${(effectiveVerdict.reasons ?? []).join("; ")}`,
        verdict: effectiveVerdict
      });
    }

    /* personal saves land with the verdict attached (soft warning shown);
       community requests always enter the review queue — the L4 admin gate
       is the human check for the guard-ok and indeterminate cases alike */
    const status = mode === "personal" ? "personal" : "pending";
    const { data, error } = await service.from("resources").insert({
      url,
      title,
      description,
      category,
      mode,
      status,
      owner_id: caller.caller.uid,
      guard: guardRecord,
      suggested_by: caller.caller.email
    }).select("id, url, title, description, category, mode, status, guard, flags, created_at").single();

    if (error) return json(headers, 500, { ok: false, error: error.message });
    return json(headers, 200, {
      ok: true,
      resource: data,
      verdict,
      note: mode === "community"
        ? "Sent for admin review — it will appear app-wide only after approval."
        : verdict.status === "ok"
          ? "Saved to your resources."
          : "Saved to your resources with a safety warning attached."
    });
  } catch (e) {
    return json(headers, 500, { ok: false, error: e instanceof Error ? e.message : "Submission failed" });
  }
});

function json(headers: Record<string, string>, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
