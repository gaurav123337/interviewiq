/* Client-safe helpers for detecting listing/search pages and extracting
   individual job links. Mirror of the edge function logic but without
   Deno dependencies so esbuild can bundle it. */

/** Detect whether a URL points to a search/listing page (multiple jobs)
    rather than an individual job posting. */
export function isListingPage(url: string): boolean {
  const u = new URL(url);
  const p = u.pathname.toLowerCase();
  const q = u.search.toLowerCase();
  if (/linkedin\.com$/.test(u.hostname)) {
    return /\/jobs\b/.test(p) && !/\/jobs\/view\//.test(p);
  }
  if (/naukri\.com$/.test(u.hostname)) {
    return /\/jobs?\b/.test(p) && /\/\d+/.test(p) === false;
  }
  if (/indeed\.com$/.test(u.hostname)) {
    return /\/jobs\b/.test(p) && !/\/viewjob/.test(p);
  }
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

    if (/linkedin\.com$/.test(host) && /\/jobs\/view\//.test(p)) {
      links.add(full.toString());
      continue;
    }
    if (/naukri\.com$/.test(host) && /\/job\//.test(p) && /\d{5,}/.test(p)) {
      links.add(full.toString());
      continue;
    }
    if (/indeed\.com$/.test(host) && /\/viewjob/.test(p)) {
      links.add(full.toString());
      continue;
    }
    if (/\/(job|position|role|opening|vacancy)\//.test(p) && /\d{4,}/.test(p)) {
      links.add(full.toString());
    }
  }

  return [...links].slice(0, 12);
}
