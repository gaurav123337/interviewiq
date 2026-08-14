/* import-job — Lane B of platform integrations: fetch a PUBLIC job posting
   the user pasted (Naukri, LinkedIn, Indeed, any site) and return the
   normalized fields for the client to turn into a feed JobPosting.

   Guardrails (see docs/phase2-platform-integrations.md):
   - PUBLIC pages only, at the user's direction. No login-gated access,
     no credentials, no submission automation.
   - robots.txt is honored before any fetch (RFC 9309 prefix semantics).
   - One fetch per request, no retry storms, 403/429 → clean error.

   Pure extraction lives in ../_shared/importPage.ts so the client test
   suite exercises the exact same code. Deploy: supabase functions deploy
   import-job (also wired into the GitHub Pages workflow when the
   SUPABASE_ACCESS_TOKEN secret is present). The client degrades
   gracefully (open-manually fallback) if this function is absent. */

import { extractSalary, type SalaryBand } from "../_shared/salary.ts";
import { extractFromJsonLd, parseMeta, robotsAllows, stripHtml, type RawJobPage } from "../_shared/importPage.ts";

const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
});

interface ImportedJob extends RawJobPage {
  salary?: SalaryBand | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const headers = { ...cors(req), "Content-Type": "application/json" };
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405, headers });
    }
    const { url } = await req.json().catch(() => ({})) as { url?: string };
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
      return new Response(JSON.stringify({ ok: false, error: "A valid job URL is required" }), { status: 400, headers });
    }
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return new Response(JSON.stringify({ ok: false, error: "A valid job URL is required" }), { status: 400, headers });
    }

    /* robots.txt guardrail — blocks before any page fetch */
    try {
      const robots = await fetch(new URL("/robots.txt", url).toString());
      if (robots.ok && !robotsAllows(await robots.text(), parsed.pathname)) {
        return new Response(JSON.stringify({
          ok: false,
          error: "robots.txt doesn't allow fetching this page — open it manually",
          blocked: true
        }), { status: 403, headers });
      }
    } catch { /* robots unreachable — proceed (public page still user-directed) */ }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(url, { redirect: "follow", signal: controller.signal });
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Couldn't reach the page — open it manually" }), { status: 502, headers });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const msg = res.status === 403 || res.status === 429
        ? "The site blocked the request — open it manually instead"
        : `The page returned HTTP ${res.status} — open it manually`;
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: 502, headers });
    }
    const html = await res.text();
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
