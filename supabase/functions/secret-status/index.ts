/* secret-status — admin dashboard health check for Edge Function secrets.
   Answers "is the project wired up?" in one call, so setup is never
   guesswork (docs/app-security.md G3/G6 + scripts/setup-live.js).

   How it works: Supabase injects EVERY project secret into every Edge
   Function, so this function can check presence with Deno.env.has() and
   report booleans. Values are never readable or returned — Supabase masks
   them server-side anyway; the client only learns "configured | missing".

   Security: GET only, caller must be a signed-in ADMIN (Supabase JWT
   verified server-side against app_admins / the owner, plus the MFA
   enforcement gate). CORS restricted to the app's origins. */

import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";

interface ExpectedSecret {
  name: string;
  required: boolean;
  builtin?: boolean;
  functions: string[];
  note?: string;
}

/* Source of truth: keep in sync with scripts/setup-live.js and the
   Deno.env.get() calls inside each function. `builtin` = auto-injected by
   Supabase (no setup needed). `required` missing = a feature is silently
   degraded; `optional` missing = feature works with reduced fidelity. */
const EXPECTED: ExpectedSecret[] = [
  /* email — every digest + the backup/refund mail path */
  {
    name: "RESEND_API_KEY",
    required: true,
    functions: ["send-apply-digest", "send-rag-digest", "send-recommendations-digest", "send-security-digest", "recovery-backup", "pay-refund"],
    note: "Resend API key (re_...) — without it every email path answers sent:false."
  },
  /* cron/shared secrets — gate pg_cron broadcasts and admin runs */
  { name: "RECS_DIGEST_SECRET", required: true, functions: ["send-recommendations-digest"], note: "Shared secret for the recommendations-digest cron." },
  { name: "APPLY_DIGEST_SECRET", required: true, functions: ["send-apply-digest"], note: "Shared secret for the apply-digest cron." },
  { name: "SECURITY_DIGEST_SECRET", required: true, functions: ["send-security-digest"], note: "Shared secret for the security-digest cron." },
  { name: "REVALIDATE_RESOURCES_SECRET", required: true, functions: ["revalidate-resources"], note: "Shared secret for the resource re-validation cron." },
  { name: "TRENDS_REFRESH_SECRET", required: true, functions: ["trends-refresh"], note: "Shared secret for the trends-refresh cron." },
  { name: "JOBS_FETCH_SECRET", required: true, functions: ["jobs-fetch"], note: "Lets jobs-fetch run via cron/manual without a signed-in session." },
  /* optional — feature works, reduced fidelity without them */
  { name: "GITHUB_TOKEN", required: false, functions: ["trends-refresh"], note: "GitHub release recency — works keyless (fewer signals)." },
  { name: "SAFE_BROWSING_API_KEY", required: false, functions: ["submit-resource"], note: "URL reputation lookups — otherwise verdicts stay 'pending'." },
  { name: "ADZUNA_APP_ID", required: false, functions: ["jobs-fetch"], note: "Adzuna salary enrichment — without it salaries are 'est.'." },
  { name: "ADZUNA_APP_KEY", required: false, functions: ["jobs-fetch"], note: "Adzuna salary enrichment — without it salaries are 'est.'." },
  /* builtins — auto-injected by Supabase, no action needed */
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, builtin: true, functions: ["every service-role function"], note: "Legacy default — auto-injected unless the project uses SUPABASE_SECRET_KEYS." },
  { name: "SUPABASE_SECRET_KEYS", required: true, builtin: true, functions: ["every service-role function"], note: "Modern default (JSON of sb_secret_... keys) — auto-injected on new projects." }
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ ok: false, error: "origin not allowed" }), { status: 403, headers });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "GET only" }), { status: 405, headers });
  }
  try {
    const admin = await requireAdmin(req);
    if (!admin) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden — admin session required" }), { status: 401, headers });
    }

    const secrets = EXPECTED.map(s => ({
      name: s.name,
      configured: Deno.env.has(s.name),
      required: s.required,
      builtin: !!s.builtin,
      functions: s.functions,
      note: s.note
    }));

    const serviceRoleAvailable =
      Deno.env.has("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.has("SERVICE_ROLE_KEY") || Deno.env.has("SUPABASE_SECRET_KEYS");

    const missing = secrets.filter(s => !s.configured && !s.builtin);
    const missingRequired = missing.filter(s => s.required);
    const missingOptional = missing.filter(s => !s.required);

    return new Response(JSON.stringify({
      ok: true,
      checkedAt: new Date().toISOString(),
      serviceRoleAvailable,
      secrets,
      summary: {
        total: secrets.length,
        configured: secrets.filter(s => s.configured || s.builtin).length,
        missing: missing.length,
        missingRequired: missingRequired.length,
        missingOptional: missingOptional.length,
        missingRequiredNames: missingRequired.map(s => s.name),
        missingOptionalNames: missingOptional.map(s => s.name)
      }
    }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "error: " + String(e) }), { status: 500, headers });
  }
});
