/* article-fetch — safely fetch a USER-pasted article URL and return the
   extracted article for the client to normalize. Any SIGNED-IN user may call
   (not admin-only); the "Understand this article" flow posts a URL here
   instead of fetching cross-origin from the browser.

   Guardrails (docs/app-security.md G1/G5/G6), mirroring import-job:
   - SSRF-safe: the pasted URL is fetched ONLY through safeFetch — https-only
     (no allowHttp here, unlike the admin content-scraper), IP-literal /
     private / loopback / metadata ranges blocked, every redirect hop
     re-validated, 15s timeout + 2 MB body cap. An arbitrary pasted URL can
     never probe internal addresses.
   - robots.txt is honored before the page fetch (RFC 9309 prefix semantics);
     an unreachable robots.txt proceeds (the page is user-directed).
   - CORS allow-list + per-client rate limit, checked BEFORE auth so an
     anonymous flood can't force a getUser() round-trip on every request.
   - Signed-in gate via requireUser (401 when absent). The HTML→article parse
     is the exact hardened extractArticle content-scrape already uses.

   Returns { ok:true, article:{ title, content, author, url } }. The client
   runs the AI normalize (articleNormalizer) as it already does for pasted
   text — we persist NOTHING server-side. Deploy with --no-verify-jwt (the
   gateway forwards, we verify the caller here). The client degrades to the
   paste-text fallback if this function is absent or a fetch fails. */

import { requireUser } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { safeFetch, readBodyText } from "../_shared/safeFetch.ts";
import { robotsAllows } from "../_shared/importPage.ts";
import { extractArticle } from "../_shared/articleExtract.ts";
import { makeLimiter, clientKey } from "../_shared/ratelimit.ts";

/* best-effort per-client cap: 15 fetches/min (mirrors import-job) */
const limitFetch = makeLimiter(15, 60_000);

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
    /* Rate-limit BEFORE auth so an anonymous flood can't force a getUser()
       round-trip on every request. */
    if (!limitFetch(clientKey(req))) {
      return new Response(JSON.stringify({ ok: false, error: "too many requests — try again in a minute" }), { status: 429, headers });
    }
    /* Signed-in gate — any authenticated user, not admin-only. */
    const auth = await requireUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ ok: false, error: "Sign in to fetch articles by URL" }), { status: 401, headers });
    }

    const { url } = await req.json().catch(() => ({})) as { url?: string };
    /* https-only DEFAULT for user-pasted URLs (stricter than import-job's
       https?): validate the scheme here so an http URL gets a clean 400
       rather than a confusing 502 from safeFetch's "http is not allowed". */
    if (typeof url !== "string" || !/^https:\/\//i.test(url)) {
      return new Response(JSON.stringify({ ok: false, error: "A valid https article URL is required" }), { status: 400, headers });
    }

    /* robots.txt guardrail — blocks before any page fetch (safeFetch: https,
       public hosts only; an unreachable/blocked robots URL is treated as
       unreachable → proceed, since the page is user-directed). */
    try {
      const robotsRes = await safeFetch(new URL("/robots.txt", url).toString(), { timeoutMs: 8000 });
      if (robotsRes.ok) {
        const robots = await readBodyText(robotsRes, 64_000);
        if (!robotsAllows(robots, new URL(url).pathname)) {
          return new Response(JSON.stringify({
            ok: false,
            blocked: true,
            error: "robots.txt doesn't allow fetching this page — paste the article text instead"
          }), { status: 403, headers });
        }
      }
    } catch { /* robots unreachable — proceed (page is user-directed) */ }

    let res: Response;
    try {
      res = await safeFetch(url, { timeoutMs: 15_000 }); // NO allowHttp ⇒ https-only via checkUrl
    } catch (e) {
      return new Response(JSON.stringify({
        ok: false,
        error: e instanceof Error ? `Couldn't fetch the page safely — ${e.message}` : "Couldn't reach the page — paste the text instead"
      }), { status: 502, headers });
    }
    if (!res.ok) {
      const msg = res.status === 403 || res.status === 429
        ? "The site blocked the request — paste the article text instead"
        : `The page returned HTTP ${res.status} — paste the text instead`;
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: 502, headers });
    }

    const html = await readBodyText(res, 2_000_000);
    const { title, content, author } = extractArticle(html, url);
    if (content.length < 100) {
      /* 200 + ok:false: the fetch worked but extraction was too thin (paywall,
         SPA shell, PDF, etc.). The client falls back to any pasted text. */
      return new Response(JSON.stringify({
        ok: false,
        error: "Couldn't extract readable article text — paste it instead"
      }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ ok: true, article: { title, content, author, url } }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message ?? "article-fetch failed" }), { status: 500, headers });
  }
});
