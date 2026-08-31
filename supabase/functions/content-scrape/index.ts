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
import { safeFetch, readBodyText } from "../_shared/safeFetch.ts";
import { robotsAllows } from "../_shared/importPage.ts";
import { extractArticle } from "../_shared/articleExtract.ts";

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
        // robots.txt guardrail — honor Disallow before fetching, mirroring
        // import-job. safeFetch is https/http-to-public-hosts only and blocks
        // private/metadata IP ranges + re-validates every redirect hop, so this
        // closes the prior raw-fetch SSRF hole. A reachable robots.txt that
        // disallows the path skips the source; an unreachable one proceeds
        // (the source is admin-curated).
        try {
          const robotsRes = await safeFetch(new URL("/robots.txt", url).toString(), { timeoutMs: 8000, allowHttp: true });
          if (robotsRes.ok) {
            const robotsTxt = await readBodyText(robotsRes, 64_000);
            if (!robotsAllows(robotsTxt, new URL(url).pathname)) {
              results.push({ sourceId: String(source.id), url, title: "", success: false, error: "Blocked by robots.txt" });
              errors++;
              continue;
            }
          }
        } catch { /* robots unreachable — proceed (admin-curated source) */ }

        // Fetch the page through the SSRF guard. allowHttp preserves any http
        // curated sources; safeFetch still blocks private/internal targets over
        // either scheme, and readBodyText caps the body at 2 MB.
        const res = await safeFetch(url, {
          timeoutMs: 15_000,
          allowHttp: true,
          headers: {
            "User-Agent": "InterviewIQ-ContentScraper/1.0 (+https://interviewiq.app)",
            Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await readBodyText(res, 2_000_000);

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

        // Update source last_scraped_at (best-effort — never fail the scrape on it)
        try {
          await client
            .from("content_sources")
            .update({ last_scraped_at: new Date().toISOString() })
            .eq("id", String(source.id));
        } catch { /* ignore timestamp update errors */ }
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
