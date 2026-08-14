/* import-job — Lane B of platform integrations: fetch a PUBLIC job posting
   the user pasted (Naukri, LinkedIn, Indeed, any site) and return the
   normalized fields for the client to turn into a feed JobPosting.

   Guardrails (see docs/phase2-platform-integrations.md):
   - PUBLIC pages only, at the user's direction. No login-gated access,
     no credentials, no submission automation.
   - robots.txt is honored before any fetch.
   - One fetch per request, no retry storms, 403/429 → clean error.

   Deploy: supabase functions deploy import-job
   The client degrades gracefully (open-manually fallback) if absent. */

import { extractSalary, type SalaryBand } from "../_shared/salary.ts";

const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
});

const decodeHtml = (s: string): string =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'");

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RawPage {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  applyUrl?: string;
  salary?: SalaryBand | null;
}

function extractFromJsonLd(html: string): RawPage | null {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const data = JSON.parse(json.trim());
      const items = Array.isArray(data) ? data : (data["@graph"] ?? [data]);
      for (const item of items) {
        if (item?.["@type"] !== "JobPosting" && !(Array.isArray(item?.["@type"]) && item["@type"].includes("JobPosting"))) continue;
        const loc = item.jobLocation;
        const addr = loc?.address ?? loc?.location?.address;
        const city = typeof addr?.addressLocality === "string" ? addr.addressLocality : "";
        const country = typeof addr?.addressCountry === "string" ? addr.addressCountry : (addr?.addressCountry?.name ?? "");
        const desc = typeof item.description === "string" ? stripHtml(item.description) : "";
        return {
          title: typeof item.title === "string" ? item.title : undefined,
          company: typeof item.hiringOrganization === "string"
            ? item.hiringOrganization
            : typeof item.hiringOrganization?.name === "string" ? item.hiringOrganization.name : undefined,
          location: [city, country].filter(Boolean).join(", ") || undefined,
          description: desc || undefined,
          applyUrl: typeof item.url === "string" ? item.url : undefined,
          salary: extractSalary(desc)
        };
      }
    } catch { /* not JSON */ }
  }
  return null;
}

function parseMeta(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const key = (tag.match(/(?:name|property)=["']([^"']+)["']/i)?.[1] ?? "").toLowerCase();
    const val = tag.match(/content=["']([^"']*)["']/i)?.[1];
    if (key && val != null && !out.has(key)) out.set(key, decodeHtml(val));
  }
  return out;
}

function wildcardMatch(pattern: string, path: string): boolean {
  const re = "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
  try { return new RegExp(re).test(path); } catch { return false; }
}

function robotsAllows(robotsTxt: string, path: string): boolean {
  const disallows: string[] = [];
  let inStar = false;
  for (const line of robotsTxt.split(/\r?\n/)) {
    const t = line.replace(/#.*$/, "").trim();
    if (!t) continue;
    const idx = t.indexOf(":");
    if (idx < 0) continue;
    const key = t.slice(0, idx).trim().toLowerCase();
    const val = t.slice(idx + 1).trim();
    if (key === "user-agent") { inStar = val === "*"; continue; }
    if (!inStar) continue;
    if (key === "disallow" && val) disallows.push(val);
  }
  return !disallows.some(pat => wildcardMatch(pat, path));
}

async function fetchText(url: string, signal?: AbortSignal): Promise<Response> {
  return fetch(url, { redirect: "follow", signal });
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
      const robots = await fetchText(new URL("/robots.txt", url).toString());
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
      res = await fetchText(url, controller.signal);
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
    const page: RawPage = {
      title,
      company: ld?.company ?? meta.get("og:site_name") ?? undefined,
      location: ld?.location,
      description,
      applyUrl: ld?.applyUrl,
      salary: ld?.salary
    };
    return new Response(JSON.stringify({ ok: true, job: page }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message ?? "import-job failed" }), { status: 500, headers });
  }
});
