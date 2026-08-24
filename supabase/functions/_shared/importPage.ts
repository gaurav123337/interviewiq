/* Shared pure helpers for Lane B (platform job import) — public posting
   page extraction. No Deno globals so the CLIENT test-suite exercises the
   exact code the import-job edge function runs (same pattern as salary.ts).
   Guardrails live here too: robots.txt parsing honors the `User-agent: *`
   group with RFC 9309 prefix semantics. */

export interface RawJobPage {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  applyUrl?: string;
}

const decodeHtml = (s: string): string =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'");

/** Strip tags/scripts/styles to readable text (whitespace collapsed, HTML
    entities decoded, stray spaces before punctuation removed). */
export function stripHtml(html: string): string {
  return decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim())
    .replace(/\s+([.,;:!?)])/g, "$1");
}

/** All <meta> tags keyed by lowercased name/property (first wins). */
export function parseMeta(html: string): Map<string, string> {
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

/** Pull a JobPosting from the page's schema.org JSON-LD, if present. */
export function extractFromJsonLd(html: string): RawJobPage | null {
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
        return {
          title: typeof item.title === "string" ? item.title : undefined,
          company: typeof item.hiringOrganization === "string"
            ? item.hiringOrganization
            : typeof item.hiringOrganization?.name === "string" ? item.hiringOrganization.name : undefined,
          location: [city, country].filter(Boolean).join(", ") || undefined,
          description: typeof item.description === "string" ? stripHtml(item.description) : undefined,
          applyUrl: typeof item.url === "string" ? item.url : undefined
        };
      }
    } catch { /* not JSON — skip this block */ }
  }
  return null;
}

/* robots.txt patterns are PREFIX matches (RFC 9309): "Disallow: /jobs/"
   blocks /jobs/123 too. "*" is a wildcard; "$" anchors the end. */
function wildcardMatch(pattern: string, path: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const anchored = /\*|\$$/.test(pattern) ? escaped : `${escaped}.*`;
  try { return new RegExp(`^${anchored}$`).test(path); } catch { return false; }
}

/** Detect whether a URL points to a search/listing page (multiple jobs) */
export function isListingPage(url: string): boolean {
  const u = new URL(url);
  const p = u.pathname.toLowerCase();
  const q = u.search.toLowerCase();
  if (/linkedin\.com$/.test(u.hostname)) return /\/jobs\b/.test(p) && !/\/jobs\/view\//.test(p);
  if (/naukri\.com$/.test(u.hostname)) return /\/jobs?\b/.test(p) && !/\/\d{5,}/.test(p);
  if (/indeed\.com$/.test(u.hostname)) return /\/jobs\b/.test(p) && !/\/viewjob/.test(p);
  return /[?&](q|query|search|keywords|find)=/i.test(q);
}

/** Extract individual job posting links from a listing/search page HTML. */
export function extractListingLinks(html: string, base: string): string[] {
  const baseUrl = new URL(base);
  const host = baseUrl.hostname;
  const links = new Set<string>();
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    const href = m[1];
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    let full: URL;
    try { full = new URL(href, base); } catch { continue; }
    if (full.hostname !== host) continue;
    const p = full.pathname.toLowerCase();
    if (/linkedin\.com$/.test(host) && /\/jobs\/view\//.test(p)) { links.add(full.toString()); continue; }
    if (/naukri\.com$/.test(host) && /\/job\//.test(p) && /\d{5,}/.test(p)) { links.add(full.toString()); continue; }
    if (/indeed\.com$/.test(host) && /\/viewjob/.test(p)) { links.add(full.toString()); continue; }
    if (/\/(job|position|role|opening|vacancy)\//.test(p) && /\d{4,}/.test(p)) links.add(full.toString());
  }
  return [...links].slice(0, 8);
}

/** Honor the `User-agent: *` group's Disallow rules (default: allow). */
export function robotsAllows(robotsTxt: string, path: string): boolean {
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
