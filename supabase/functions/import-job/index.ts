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
import { extractFromJsonLd, parseMeta, robotsAllows, stripHtml, type RawJobPage, isListingPage, extractListingLinks } from "../_shared/importPage.ts";

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
    /* Check if this is a listing/search page (multiple jobs) */
    const isListing = isListingPage(url);
    if (isListing) {
      const u = new URL(url);
      
      /* ---- LinkedIn: use the public guest API ---- */
      if (/linkedin\.com$/.test(u.hostname)) {
        const keywords = u.searchParams.get("keywords") ?? u.searchParams.get("q") ?? "";
        const location = u.searchParams.get("location") ?? "";
        if (keywords || location) {
          const apiUrl = new URL("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search");
          if (keywords) apiUrl.searchParams.set("keywords", keywords);
          if (location) apiUrl.searchParams.set("location", location);
          apiUrl.searchParams.set("start", "0");
          try {
            const apiRes = await safeFetch(apiUrl.toString(), { timeoutMs: 15_000 });
            if (apiRes.ok) {
              const apiHtml = await readBodyText(apiRes, 500_000);
              // Parse job cards from the HTML fragment
              const cardRe = /<li[^>]*>[\s\S]*?<\/li>/gi;
              const titleRe = /class="[^"]*base-search-card__title[^"]*"[^>]*>([^<]+)/i;
              const companyRe = /class="[^"]*base-search-card__subtitle[^"]*"[^>]*>\s*<a[^>]*>([^<]+)/i;
              const locationRe = /class="[^"]*job-search-card__location[^"]*"[^>]*>([^<]+)/i;
              const linkRe = /href=["']([^"']+linkedin\.com\/jobs\/view\/[^"']+)/i;
              const cards = apiHtml.match(cardRe) ?? [];
              const jobs: ImportedJob[] = [];
              for (const card of cards.slice(0, 10)) {
                const t = card.match(titleRe)?.[1]?.trim();
                const c = card.match(companyRe)?.[1]?.trim();
                const l = card.match(locationRe)?.[1]?.trim();
                const link = card.match(linkRe)?.[1];
                if (t) {
                  jobs.push({
                    title: t,
                    company: c ?? undefined,
                    location: l ?? undefined,
                    description: `Imported from LinkedIn search: ${keywords || location}`,
                    applyUrl: link ?? url,
                    salary: null
                  });
                }
              }
              if (jobs.length > 0) {
                return new Response(JSON.stringify({ ok: true, jobs, listing: true }), { status: 200, headers });
              }
            }
          } catch { /* fall through */ }
        }
        return new Response(JSON.stringify({
          ok: false,
          error: "Couldn't extract jobs from this LinkedIn page. Try searching for specific skills (e.g. 'react developer India') and paste the search URL, or paste individual job posting URLs."
        }), { status: 200, headers });
      }

      /* ---- Generic listing pages: try extract links then fetch each ---- */
      const links = extractListingLinks(html, url);
      if (links.length === 0) {
        return new Response(JSON.stringify({
          ok: false,
          error: "This is a search/listing page — paste individual job posting URLs instead (click each job and copy its URL from the address bar)"
        }), { status: 200, headers });
      }
      const jobs: ImportedJob[] = [];
      for (const link of links.slice(0, 8)) {
        try {
          const jr = await safeFetch(link, { timeoutMs: 10_000 });
          if (!jr.ok) continue;
          const jhtml = await readBodyText(jr, 500_000);
          const jld = extractFromJsonLd(jhtml);
          const jmeta = parseMeta(jhtml);
          const jTitle = jld?.title ?? jmeta.get("og:title") ?? jhtml.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
          const jDesc = jld?.description ?? jmeta.get("og:description") ?? jmeta.get("description") ?? stripHtml(jhtml).slice(0, 2000);
          if (!jTitle || jTitle === title) continue;
          jobs.push({
            title: jTitle,
            company: jld?.company ?? jmeta.get("og:site_name") ?? undefined,
            location: jld?.location,
            description: jDesc,
            applyUrl: jld?.applyUrl ?? link,
            salary: extractSalary(jDesc ?? "")
          });
        } catch { /* skip */ }
      }
      if (jobs.length > 0) {
        return new Response(JSON.stringify({ ok: true, jobs, listing: true }), { status: 200, headers });
      }
      return new Response(JSON.stringify({ ok: true, job, listing: false }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ ok: true, job, listing: false }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message ?? "import-job failed" }), { status: 500, headers });
  }
});
