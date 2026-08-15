/* import-job — Lane B of platform integrations: fetch a PUBLIC job posting
   the user pasted (Naukri, LinkedIn, Indeed, any site) and return the
   normalized fields for the client to turn into a feed JobPosting.

   Guardrails (see docs/phase2-platform-integrations.md + docs/app-security.md):
   - PUBLIC pages only, at the user's direction. No login-gated access,
     no credentials, no submission automation.
   - robots.txt is honored before any fetch (RFC 9309 prefix semantics).
   - One fetch per request, no retry storms, 403/429 → clean error.
   - SSRF-safe: every fetch goes through safeFetch (https-only, private-IP
     and metadata ranges blocked, redirect hops re-validated, size/timeout
     caps) — an arbitrary pasted URL can never probe internal addresses.
   - CORS allow-list + per-client rate limit (see _shared/cors.ts, ratelimit.ts).

   Pure extraction lives in ../_shared/importPage.ts so the client test
   suite exercises the exact same code. Deploy: supabase functions deploy
   import-job (also wired into the GitHub Pages workflow when the
   SUPABASE_ACCESS_TOKEN secret is present). The client degrades
   gracefully (open-manually fallback) if this function is absent. */

import { safeFetch, readBodyText } from "../_shared/safeFetch.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { makeLimiter, clientKey } from "../_shared/ratelimit.ts";
import { extractSalary, type SalaryBand } from "../_shared/salary.ts";
import { extractFromJsonLd, parseMeta, robotsAllows, stripHtml, type RawJobPage } from "../_shared/importPage.ts";

/* best-effort per-client cap: 15 imports/min */
const limitImport = makeLimiter(15, 60_000);

interface ImportedJob extends RawJobPage {
  salary?: SalaryBand | null;
}

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
    if (!limitImport(clientKey(req))) {
      return new Response(JSON.stringify({ ok: false, error: "too many imports — try again in a minute" }), { status: 429, headers });
    }
    const { url } = await req.json().catch(() => ({})) as { url?: string };
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
      return new Response(JSON.stringify({ ok: false, error: "A valid job URL is required" }), { status: 400, headers });
    }

    /* robots.txt guardrail — blocks before any page fetch (safeFetch: https,
       public hosts only; a blocked robots URL is treated as unreachable) */
    try {
      const robotsRes = await safeFetch(new URL("/robots.txt", url).toString(), { timeoutMs: 8000 });
      if (robotsRes.ok) {
        const robots = await readBodyText(robotsRes, 64_000);
        if (!robotsAllows(robots, new URL(url).pathname)) {
          return new Response(JSON.stringify({
            ok: false,
            error: "robots.txt doesn't allow fetching this page — open it manually",
            blocked: true
          }), { status: 403, headers });
        }
      }
    } catch { /* robots unreachable — proceed (public page still user-directed) */ }

    let res: Response;
    try {
      res = await safeFetch(url, { timeoutMs: 15_000 });
    } catch (e) {
      return new Response(JSON.stringify({
        ok: false,
        error: e instanceof Error ? `Couldn't fetch the page safely — ${e.message}` : "Couldn't reach the page — open it manually"
      }), { status: 502, headers });
    }
    if (!res.ok) {
      const msg = res.status === 403 || res.status === 429
        ? "The site blocked the request — open it manually instead"
        : `The page returned HTTP ${res.status} — open it manually`;
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: 502, headers });
    }
    const html = await readBodyText(res, 2_000_000);
    const ld = extractFromJsonLd(html);
    const meta = parseMeta(html);
    const title = ld?.title ?? meta.get("og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
    const description = ld?.description ?? meta.get("og:description") ?? meta.get("description") ?? stripHtml(html).slice(0, 2000);
    const job: ImportedJob = {
      title,
      company: ld?.company ?? meta.get("og:site_name") ?? undefined,
      location: ld?.location,
      description,
      applyUrl: ld?.applyUrl,
      salary: extractSalary(description ?? "")
    };
    return new Response(JSON.stringify({ ok: true, job }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message ?? "import-job failed" }), { status: 500, headers });
  }
});
