/* content-scrape — Server-side content scraping edge function.
   Fetches URLs, extracts article content, stores in content_items table.
   Runs server-side to avoid CORS restrictions.

   POST /content-scrape
   Body: { sources?: string[] }  — specific source IDs to scrape
          OR {} to scrape all enabled sources

   Returns: { results: ScrapeResult[], stored: number, errors: number } */

import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/serviceClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (!isAllowedOrigin(req)) return new Response("Forbidden", { status: 403 });

  try {
    const admin = await requireAdmin(req);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Admin access required — sign in with an admin account" }), {
        status: 403,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const client = serviceClient();
    if (!client) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetSourceIds: string[] | undefined = body.sources;

    // Fetch enabled sources
    let query = client.from("content_sources").select("*").eq("enabled", true);
    if (targetSourceIds?.length) {
      query = query.in("id", targetSourceIds);
    }
    const { data: sources, error: srcError } = await query;
    if (srcError) throw srcError;
    if (!sources?.length) {
      return new Response(JSON.stringify({ results: [], stored: 0, errors: 0, message: "No enabled sources" }), {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const results: Array<{ sourceId: string; url: string; title: string; success: boolean; error?: string }> = [];
    let stored = 0;
    let errors = 0;

    for (const source of sources) {
      const url = String(source.url);
      const domain = String(source.domain);
      const sourceName = String(source.name);
      const fieldId = String(source.field_id);
      const sourceType = String(source.source_type);

      try {
        // Fetch the page
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "InterviewIQ-ContentScraper/1.0 (+https://interviewiq.app)",
            Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          },
          redirect: "follow",
        });
        clearTimeout(timer);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();

        // Extract article content
        const { title, content, author } = extractArticle(html, url);

        if (content.length < 100) {
          results.push({ sourceId: String(source.id), url, title, success: false, error: "Content too short" });
          errors++;
          continue;
        }

        // Compute content hash for dedup
        const contentStr = title + content;
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(contentStr));
        const contentHash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Store in content_items (dedup by content_hash)
        const { data: existing } = await client
          .from("content_items")
          .select("id")
          .eq("content_hash", contentHash)
          .maybeSingle();

        if (existing) {
          // Already have this content — skip
          results.push({ sourceId: String(source.id), url, title, success: true });
          stored++;
        } else {
          const { error: insertError } = await client.from("content_items").insert({
            source_id: String(source.id),
            source_url: url,
            source_name: sourceName,
            domain,
            title,
            content,
            author,
            field_id: fieldId,
            content_type: sourceType,
            content_hash: contentHash,
            status: "pending",
            tags: [],
          });
          if (insertError) throw insertError;
          results.push({ sourceId: String(source.id), url, title, success: true });
          stored++;
        }

        // Update source last_scraped_at
        await client
          .from("content_sources")
          .update({ last_scraped_at: new Date().toISOString() })
          .eq("id", String(source.id))
          .then(() => {})
          .catch(() => {});
      } catch (e) {
        results.push({ sourceId: String(source.id), url, title: "", success: false, error: (e as Error).message });
        errors++;
      }

      // Rate limit: 1-2 seconds between requests
      await new Promise((r) => setTimeout(r, 1500));
    }

    return new Response(JSON.stringify({ results, stored, errors }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

/* ── Article extraction (server-side, no DOM) ────────────────────────── */

function extractArticle(html: string, url: string): { title: string; content: string; author: string | null } {
  const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })();

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const ogTitleMatch = html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i);
  const title = (ogTitleMatch?.[1] ?? titleMatch?.[1] ?? domain).trim();

  // Author
  const authorMatch = html.match(/<meta[^>]*(?:name|property)\s*=\s*["'](?:author|article:author)["'][^>]*content\s*=\s*["']([^"']*)["']/i);
  const author = authorMatch?.[1]?.trim() ?? null;

  // Try common article containers
  const selectors = ["article", "main", '[role="main"]', ".post-content", ".article-content", ".entry-content", ".content"];
  let articleHtml = "";
  for (const sel of selectors) {
    const tag = sel.split(/[[\s]/)[0];
    const re = new RegExp(`<${tag.replace(/[[\]]/g, "\\$&")}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const m = html.match(re);
    if (m && m[1].length > articleHtml.length) articleHtml = m[1];
  }

  if (!articleHtml || articleHtml.length < 200) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    articleHtml = bodyMatch?.[1] ?? html;
  }

  // Clean to text
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
