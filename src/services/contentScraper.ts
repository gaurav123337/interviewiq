/* Content Scraper — fetches web content with Firecrawl API (primary) or
   native fetch + Readability (fallback). Integrates with the existing
   contentScan security pipeline. Server-side only (edge function).

   Pipeline: URL → fetch → clean Markdown → security scan → content item.
   Firecrawl handles anti-bot, JS rendering, proxy rotation.
   Fallback uses native fetch + CSS selector extraction for simple pages. */

import { getSupabaseClient } from "./cloud";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;          // cleaned markdown
  author: string | null;
  publishedDate: string | null;
  description: string | null;
  domain: string;
  wordCount: number;
  fetchMethod: "firecrawl" | "native";
}

export interface ContentSource {
  id: string;
  url: string;
  domain: string;
  name: string;
  sourceType: string;        // article, tutorial, docs, video_transcript
  fieldId: string;
  enabled: boolean;
  domainReputation: number;  // 1-10
  scrapeConfig: Record<string, unknown>;
  lastScrapedAt: string | null;
}

export interface ScrapeResult {
  source: ContentSource;
  content: ScrapedContent | null;
  error?: string;
  securityBlocked?: boolean;
  securityFindings?: string[];
}

/* ── Domain extraction ─────────────────────────────────────────────────── */

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/* ── Firecrawl API ─────────────────────────────────────────────────────── */

async function fetchViaFirecrawl(
  url: string,
  apiKey: string,
  timeoutMs = 30_000,
): Promise<ScrapedContent | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json() as {
      success?: boolean;
      data?: {
        markdown?: string;
        metadata?: {
          title?: string;
          author?: string;
          date?: string;
          description?: string;
          ogTitle?: string;
        };
      };
    };

    if (!data.success || !data.data?.markdown) return null;
    const meta = data.data.metadata ?? {};
    const content = data.data.markdown;
    const domain = extractDomain(url);

    return {
      url,
      title: meta.title ?? meta.ogTitle ?? domain,
      content,
      author: meta.author ?? null,
      publishedDate: meta.date ?? null,
      description: meta.description ?? null,
      domain,
      wordCount: content.split(/\s+/).length,
      fetchMethod: "firecrawl",
    };
  } catch {
    return null;
  }
}

/* ── Native fetch fallback ─────────────────────────────────────────────── */

/** Minimal readability-like extraction: strips scripts/styles, extracts
    article text from common containers, returns clean markdown. */
function extractArticleText(html: string, url: string): { title: string; content: string; author: string | null } {
  const domain = extractDomain(url);

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const ogTitleMatch = html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i);
  const title = (ogTitleMatch?.[1] ?? titleMatch?.[1] ?? domain).trim();

  // Extract author
  const authorMatch = html.match(/<meta[^>]*(?:name|property)\s*=\s*["'](?:author|article:author)["'][^>]*content\s*=\s*["']([^"']*)["']/i);
  const author = authorMatch?.[1]?.trim() ?? null;

  // Extract date
  const dateMatch = html.match(/<meta[^>]*(?:name|property)\s*=\s*["'](?:article:published_time|date)["'][^>]*content\s*=\s*["']([^"']*)["']/i);

  // Try common article containers
  const articleSelectors = ["article", "main", '[role="main"]', ".post-content", ".article-content", ".entry-content", ".content"];
  let articleHtml = "";
  for (const sel of articleSelectors) {
    const re = new RegExp(`<${sel.replace(/[[\]]/g, "\\$&")}[^>]*>([\\s\\S]*?)<\\/${sel.split(/[[\s]/)[0]}>`, "i");
    const m = html.match(re);
    if (m && m[1].length > articleHtml.length) {
      articleHtml = m[1];
    }
  }

  // Fallback: use body but strip nav/footer/sidebar
  if (!articleHtml || articleHtml.length < 200) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    articleHtml = bodyMatch?.[1] ?? html;
  }

  // Clean HTML to text
  const content = articleHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");

  return { title, content, author };
}

async function fetchViaNative(
  url: string,
  timeoutMs = 15_000,
): Promise<ScrapedContent | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "InterviewIQ-ContentScraper/1.0 (+https://interviewiq.app)",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) return null;

    const html = await res.text();
    const { title, content, author } = extractArticleText(html, url);
    const domain = extractDomain(url);

    if (content.length < 100) return null; // too short to be useful

    return {
      url,
      title,
      content,
      author,
      publishedDate: null,
      description: null,
      domain,
      wordCount: content.split(/\s+/).length,
      fetchMethod: "native",
    };
  } catch {
    return null;
  }
}

/* ── Main scraper ──────────────────────────────────────────────────────── */

/** Fetch content from a URL. Tries Firecrawl first (if API key configured),
    falls back to native fetch. Returns null on failure. */
export async function scrapeUrl(url: string, firecrawlApiKey?: string): Promise<ScrapedContent | null> {
  // Try Firecrawl first
  if (firecrawlApiKey) {
    const result = await fetchViaFirecrawl(url, firecrawlApiKey);
    if (result) return result;
  }

  // Fallback to native fetch
  return fetchViaNative(url);
}

/** Scrape all enabled content sources. Returns per-source results. */
export async function scrapeAllSources(
  sources: ContentSource[],
  firecrawlApiKey?: string,
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  for (const source of sources.filter((s) => s.enabled)) {
    const result: ScrapeResult = { source, content: null };

    try {
      const content = await scrapeUrl(source.url, firecrawlApiKey);
      if (!content) {
        result.error = "Failed to fetch content";
      } else {
        result.content = content;
      }
    } catch (e) {
      result.error = (e as Error).message || "Scrape failed";
    }

    results.push(result);

    // Rate limit: 1-2 seconds between requests
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 500));
  }

  return results;
}

/** Store scraped content as pending items in the content_items table. */
export async function storeScrapedContent(
  results: ScrapeResult[],
): Promise<{ stored: number; errors: number }> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");

  let stored = 0;
  let errors = 0;

  for (const result of results) {
    if (!result.content || result.error) {
      errors++;
      continue;
    }

    try {
      // Compute content hash for dedup
      const contentStr = result.content.title + result.content.content;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(contentStr));
      const contentHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { error } = await client.from("content_items").upsert(
        {
          source_id: result.source.id,
          source_url: result.content.url,
          source_name: result.source.name,
          domain: result.content.domain,
          title: result.content.title,
          content: result.content.content,
          author: result.content.author,
          published_date: result.content.publishedDate,
          field_id: result.source.fieldId,
          content_type: result.source.sourceType,
          content_hash: contentHash,
          status: "pending",
          tags: [],
        },
        { onConflict: "content_hash" },
      );

      if (error) throw error;
      stored++;
    } catch {
      errors++;
    }
  }

  // Update source stats
  for (const result of results) {
    if (result.content && !result.error) {
      Promise.resolve(
        client
          .from("content_sources")
          .update({
            last_scraped_at: new Date().toISOString(),
            scrape_count: (result.source as any).scrapeCount ?? 0 + 1,
          })
          .eq("id", result.source.id)
      ).then(() => {}).catch(() => {});
    }
  }

  return { stored, errors };
}
