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
  /** Category/tag strings (RSS <category> / Atom <category term>). */
  tags: string[];
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

/** Board-style item titles put the company first ("Airtable: Senior
    Solutions Architect" — We Work Remotely's format). Split on a colon
    only, so dash-style "Title - Company" titles stay untouched. */
export function splitRssTitle(raw: string): { company: string; title: string } {
  const m = raw.match(/^(.{2,40}?)\s*[:：]\s+(.+)$/);
  if (m) {
    const company = m[1].trim();
    const title = m[2].trim();
    if (company && title) return { company, title };
  }
  return { company: "", title: raw.trim() };
}

/** Himalayas posts items titled "[Job - 12345] Role Name" — strip the
    internal ID prefix so titles read as a human would. */
export function stripJobNumberPrefix(raw: string): string {
  return raw.replace(/^\s*\[Job\s*-\s*\d+\]\s*/i, "").trim() || raw.trim();
}

/** Himalayas puts the company in the item URL: /companies/<slug>/jobs/….
    Extracts the slug and humanizes it ("ci-t" → "CI&T" via a small
    stylized map, otherwise Title Case). Returns "" when the link has no
    company slug. */
export function companyFromLink(link: string): string {
  const m = link.match(/\/companies\/([a-z0-9-]{1,60})\/jobs\//i);
  if (!m) return "";
  const slug = m[1].toLowerCase();
  const stylized: Record<string, string> = { "ci-t": "CI&T" };
  if (stylized[slug]) return stylized[slug];
  return slug.split("-").map(p => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join(" ");
}

/** Feed title (channel/feed title) — used as the company label. */
export function feedTitle(xml: string): string | null {
  const channel = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i)?.[1] ?? xml;
  const title = first(channel, "title");
  return title || null;
}

/** All <category> values in a block (RSS 2.0) or <category term=…> (Atom). */
function categories(block: string): string[] {
  const out: string[] = [];
  const re = /<category\b([^>]*)>([\s\S]*?)<\/category>|<category\b([^>]*)\/>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    if (m[3] !== undefined) {
      const term = m[3].match(/\bterm\s*=\s*["']([^"']*)["']/i);
      if (term) out.push(decodeXml(term[1]));
    } else if (m[2] !== undefined) {
      out.push(decodeXml(m[2]));
    }
  }
  return out;
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
    items.push({ title, link, description: description.slice(0, 6000), pubDate, tags: categories(block) });
  }
  return items;
}
