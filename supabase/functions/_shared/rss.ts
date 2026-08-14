/* Pure RSS 2.0/Atom feed parser for Lane A (RSS job sources). No Deno
   globals so the client test-suite exercises the exact code jobs-fetch
   runs. Deliberately dependency-free: regex-based extraction of <item> /
   <entry> blocks with HTML-entity decoding. Malformed feeds degrade to
   fewer/zero items instead of throwing. */

export interface RssItem {
  title: string;
  link: string;
  description: string;
  /** ISO string when the feed provides a pubDate/updated, else null. */
  pubDate: string | null;
}

const decodeXml = (s: string): string =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#0?39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const first = (block: string, tag: string): string => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? decodeXml(m[1]) : "";
};

const attr = (block: string, tag: string, name: string): string | null => {
  const m = block.match(new RegExp(`<${tag}[^>]*${name}=["']([^"']*)["']`, "i"));
  return m ? decodeXml(m[1]) : null;
};

const pubDateToIso = (raw: string): string | null => {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** Feed title (channel/feed title) — used as the company label. */
export function feedTitle(xml: string): string | null {
  const channel = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i)?.[1] ?? xml;
  const title = first(channel, "title");
  return title || null;
}

/** Parse RSS 2.0 <item> blocks (and Atom <entry> blocks as a bonus). */
export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<(item|entry)\b[^>]*>([\s\S]*?)<\/(item|entry)>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[2];
    const link = first(block, "link") || attr(block, "link", "href") || "";
    if (!link) continue;
    const title = first(block, "title") || "Untitled role";
    const description = first(block, "description") || first(block, "summary") || "";
    const pubDate = pubDateToIso(first(block, "pubDate") || first(block, "updated") || first(block, "published")) ?? null;
    items.push({ title, link, description: description.slice(0, 6000), pubDate });
  }
  return items;
}
