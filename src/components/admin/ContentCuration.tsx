/* ContentCuration — Admin dashboard for the content curation pipeline.
   Shows content sources, scraped items with quality scores, review workflow,
   and stats. Integrates with contentScraper + contentQuality services. */

import { useEffect, useState } from "react";
import { FIELDS } from "../../data";
import {
  listContentSources, saveContentSource, toggleContentSource, deleteContentSource,
  listContentItems, reviewContentItem, bulkReviewItems, getContentStats,
  type ContentSourceRow, type ContentItemRow, type ContentStats,
} from "../../services/contentCuration";
import { toast } from "../../toast";
import { btnPrimary, btnSm, btnOk, btnDanger, cardCls, Chip, Switch } from "../ui";

/* ── Quality badge color ────────────────────────────────────────────────── */

function qualityColor(score: number | null): string {
  if (score == null) return "text-mut";
  if (score >= 80) return "text-green";
  if (score >= 60) return "text-acc";
  if (score >= 40) return "text-warn";
  return "text-err";
}

function qualityBand(score: number | null): string {
  if (score == null) return "—";
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export function ContentCuration({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) {
  const [tab, setTab] = useState<"sources" | "items" | "stats">("items");
  const [sources, setSources] = useState<ContentSourceRow[]>([]);
  const [items, setItems] = useState<ContentItemRow[]>([]);
  const [, setTotalItems] = useState(0);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Add source form
  const [showAddSource, setShowAddSource] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("article");
  const [newField, setNewField] = useState("general");

  // Scraper run state
  const [scraping, setScraping] = useState(false);
  const [scrapeReport, setScrapeReport] = useState<{ stored: number; errors: number; results: { sourceId: string; url: string; title: string; success: boolean; error?: string }[] } | null>(null);

  // Expanded item for review
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, { items: i, total }, st] = await Promise.all([
        listContentSources(),
        listContentItems({ status: statusFilter, limit: 50 }),
        getContentStats(),
      ]);
      setSources(s);
      setItems(i);
      setTotalItems(total);
      setStats(st);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [statusFilter]);

  /* ── Source actions ────────────────────────────────────────────────── */

  const addSource = async () => {
    if (!newUrl.trim().startsWith("http")) { toast("Enter a valid URL"); return; }
    setBusy(true);
    try {
      await saveContentSource({ url: newUrl.trim(), name: newName.trim() || new URL(newUrl).hostname, sourceType: newType, fieldId: newField });
      toast("✅ Source added");
      setNewUrl(""); setNewName(""); setShowAddSource(false);
      await load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const toggleSource = async (s: ContentSourceRow, enabled: boolean) => {
    setBusy(true);
    try { await toggleContentSource(s.id, enabled); await load(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const removeSource = async (id: string) => {
    setBusy(true);
    try { await deleteContentSource(id); toast("Source removed"); await load(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  /* ── Item review actions ───────────────────────────────────────────── */

  const approveItem = async (id: string) => {
    setBusy(true);
    try {
      await reviewContentItem(id, "approved");
      toast("✅ Approved");
      // Auto-index to RAG knowledge base in background
      indexContentToRAG(id).catch(() => {});
      await load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const rejectItem = async (id: string) => {
    setBusy(true);
    try { await reviewContentItem(id, "rejected"); toast("❌ Rejected"); await load(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  /* ── RAG indexing ─────────────────────────────────────────────── */
  const [indexing, setIndexing] = useState(false);

  /** Index a single approved content item into the RAG knowledge base */
  const indexContentToRAG = async (contentId: string) => {
    try {
      const client = await import("../../services/cloud").then(m => m.getSupabaseClient());
      if (!client) return;
      const { data: session } = await client.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;
      const config = await import("../../config").then(m => m.CONFIG);
      const edgeUrl = `${config.supabase.url}/functions/v1/content-index`;
      const res = await fetch(edgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.indexed > 0) toast("🧠 Indexed to AI knowledge base");
      }
    } catch { /* silent — background task */ }
  };

  /** Index all approved, un-indexed items */
  const indexAllUnindexed = async () => {
    setIndexing(true);
    try {
      const client = await import("../../services/cloud").then(m => m.getSupabaseClient());
      if (!client) { toast("Cloud not configured"); setIndexing(false); return; }
      const { data: session } = await client.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { toast("Sign in required"); setIndexing(false); return; }
      const config = await import("../../config").then(m => m.CONFIG);
      const edgeUrl = `${config.supabase.url}/functions/v1/content-index`;
      const res = await fetch(edgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.indexed > 0) toast(`🧠 Indexed ${data.indexed} items to AI knowledge base`);
      else toast("All approved items are already indexed");
      await load();
    } catch (e) { toast("Index failed: " + ((e as Error).message || "Unknown")); }
    finally { setIndexing(false); }
  };

  /* ── Batch quality check ──────────────────────────────────────── */
  const [qualityChecking, setQualityChecking] = useState(false);

  const batchQualityCheck = async () => {
    setQualityChecking(true);
    try {
      const { batchScoreContent } = await import("../../services/contentQuality");
      const result = await batchScoreContent();
      toast(`✅ Quality check: ${result.scored} scored, ${result.errors} errors`);
      await load();
    } catch (e) { toast("Quality check failed: " + ((e as Error).message || "Unknown")); }
    finally { setQualityChecking(false); }
  };

  /* ── Batch content refinement ────────────────────────────────── */
  const [refining, setRefining] = useState(false);

  const batchRefine = async () => {
    setRefining(true);
    try {
      const { batchRefineContent } = await import("../../services/contentRefiner");
      const result = await batchRefineContent();
      if (result.refined > 0) {
        toast(`✨ Refined ${result.refined} article(s)`);
      } else if (result.firstError) {
        toast(`⚠️ Refinement failed: ${result.firstError}`);
      } else {
        toast("All approved articles are already refined");
      }
      await load();
    } catch (e) { toast("Refinement failed: " + ((e as Error).message || "Unknown")); }
    finally { setRefining(false); }
  };

  /** Refine a single content item */
  const refineSingle = async (contentId: string) => {
    console.log("[ContentCuration] refineSingle called for", contentId);
    setBusy(true);
    try {
      const { refineAndUpdateContent } = await import("../../services/contentRefiner");
      console.log("[ContentCuration] contentRefiner loaded");
      const result = await refineAndUpdateContent(contentId);
      console.log("[ContentCuration] refine result:", result.success, result.error);
      if (result.success) toast("✨ Content refined into progressive difficulty levels");
      else toast("Refinement failed: " + (result.error || "Unknown"));
      await load();
    } catch (e) {
      console.error("[ContentCuration] refineSingle error:", e);
      toast("Refinement failed: " + ((e as Error).message || "Unknown"));
    } finally { setBusy(false); }
  };

  /* ── Batch article normalization (keywords + code + summary) ── */
  const [normalizing, setNormalizing] = useState(false);

  const batchNormalize = async () => {
    setNormalizing(true);
    try {
      const { batchNormalizeContent } = await import("../../services/articleNormalizer");
      const result = await batchNormalizeContent();
      if (result.normalized > 0) {
        toast(`🧠 Normalized ${result.normalized} article(s) with keywords, code sections, and summaries`);
      } else if (result.firstError) {
        toast(`⚠️ Normalization failed: ${result.firstError}`);
      } else {
        toast("All approved articles are already normalized");
      }
      await load();
    } catch (e) { toast("Normalization failed: " + ((e as Error).message || "Unknown")); }
    finally { setNormalizing(false); }
  };

  /** Normalize a single content item */
  const normalizeSingle = async (contentId: string) => {
    console.log("[ContentCuration] normalizeSingle called for", contentId);
    setBusy(true);
    try {
      const { normalizeAndUpdateContent } = await import("../../services/articleNormalizer");
      console.log("[ContentCuration] articleNormalizer loaded");
      const result = await normalizeAndUpdateContent(contentId);
      console.log("[ContentCuration] normalize result:", result.success, result.error);
      if (result.success) toast("🧠 Article normalized with keywords, code sections, and summary");
      else toast("Normalization failed: " + (result.error || "Unknown"));
      await load();
    } catch (e) {
      console.error("[ContentCuration] normalizeSingle error:", e);
      toast("Normalization failed: " + ((e as Error).message || "Unknown"));
    } finally { setBusy(false); }
  };

  const bulkAction = async (status: "approved" | "rejected") => {
    if (selectedIds.size === 0) { toast("Select items first"); return; }
    setBusy(true);
    try {
      await bulkReviewItems([...selectedIds], status);
      toast(`${selectedIds.size} items ${status}`);
      setSelectedIds(new Set());
      await load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  /* ── Render ────────────────────────────────────────────────────────── */

  /* ── Run scraper ───────────────────────────────────────────────── */

  const runScraper = async () => {
    const enabled = sources.filter(s => s.enabled);
    if (!enabled.length) { toast("Enable at least one source first"); return; }
    setScraping(true); setScrapeReport(null);
    try {
      const client = await import("../../services/cloud").then(m => m.getSupabaseClient());
      if (!client) { toast("Cloud not configured"); setScraping(false); return; }
      const { data: session } = await client.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { toast("Sign in required"); setScraping(false); return; }

      const config = await import("../../config").then(m => m.CONFIG);
      const edgeUrl = `${config.supabase.url}/functions/v1/content-scrape`;

      // Try edge function first
      let res: Response | undefined;
      let networkError = false;
      try {
        res = await fetch(edgeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sources: enabled.map(s => s.id) }),
        });
      } catch {
        // Network error (CORS, DNS, etc.) — fall back to browser-side scraping
        networkError = true;
      }

      if (networkError || (res && !res.ok)) {
        // Network error (CORS, DNS) or HTTP error — try browser-side scraping as fallback
        const errMsg = networkError ? "Edge function unreachable" : `HTTP ${res?.status ?? "unknown"}`;
        toast(`${errMsg} — trying browser-side scraping...`);
        const results: { sourceId: string; url: string; title: string; success: boolean; error?: string }[] = [];
        let stored = 0;
        let errors = 0;

        for (const source of enabled) {
          try {
            const fetchRes = await fetch(source.url, { headers: { "User-Agent": "InterviewIQ-ContentScraper/1.0" } });
            if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
            const html = await fetchRes.text();
            const { title, content, author } = extractArticleFromHtml(html, source.url);
            if (content.length < 100) { results.push({ sourceId: source.id, url: source.url, title, success: false, error: "Content too short" }); errors++; continue; }

            // Store via Supabase client
            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(title + content));
            const contentHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

            const { error: insertErr } = await client.from("content_items").upsert({
              source_id: source.id, source_url: source.url, source_name: source.name,
              domain: source.domain, title, content, author,
              field_id: source.fieldId, content_type: source.sourceType,
              content_hash: contentHash, status: "pending", tags: [],
            }, { onConflict: "content_hash" });
            if (insertErr) throw insertErr;
            results.push({ sourceId: source.id, url: source.url, title, success: true });
            stored++;
          } catch (e) {
            results.push({ sourceId: source.id, url: source.url, title: "", success: false, error: (e as Error).message });
            errors++;
          }
          await new Promise(r => setTimeout(r, 1500));
        }

        setScrapeReport({ results, stored, errors });
        toast(`🕷️ Scraped ${stored} items (${errors} errors) from browser`);
        await load();
        setScraping(false);
        return;
      }

      // Edge function responded — check status
      const data = await res!.json().catch(() => ({}));
      if (!res!.ok) {
        const errMsg = (data as { error?: string }).error || `HTTP ${res!.status}`;
        if (res!.status === 401) {
          throw new Error("Auth failed — make sure you are signed in. If the error persists, the edge function may need to be redeployed.");
        }
        throw new Error(`Edge function error: ${errMsg}`);
      }
      setScrapeReport(data);
      toast(`🕷️ Scraped ${data.stored} items (${data.errors} errors)`);
      await load();
    } catch (e) { toast("Scrape failed: " + ((e as Error).message || "Unknown error")); }
    finally { setScraping(false); }
  };

  /** Simple HTML article extraction for browser-side fallback */
  function extractArticleFromHtml(html: string, url: string) {
    const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const ogTitle = html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i);
    const title = (ogTitle?.[1] ?? titleMatch?.[1] ?? domain).trim();
    const authorMatch = html.match(/<meta[^>]*(?:name|property)\s*=\s*["'](?:author|article:author)["'][^>]*content\s*=\s*["']([^"']*)["']/i);
    const author = authorMatch?.[1]?.trim() ?? null;
    const selectors = ["article", "main", '[role="main"]', ".post-content", ".article-content"];
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
    const content = articleHtml
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .split("\n").map(l => l.trim()).filter(Boolean).join("\n");
    return { title, content, author };
  };

  return (
    <div className="space-y-4">
      {/* Header + tabs */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">📝 Content Curation</h2>
        <div className="flex gap-1">
          {(["items", "sources", "stats"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1 text-[12px] font-bold transition ${
                tab === t ? "bg-acc text-white" : "bg-panel3 text-ink hover:bg-panel2"
              }`}
            >
              {t === "items" ? "📋 Items" : t === "sources" ? "🌐 Sources" : "📊 Stats"}
            </button>
          ))}
        </div>
      </div>

      {/* ─── ITEMS TAB ─────────────────────────────────────────────── */}
      {tab === "items" && (
        <div className="space-y-3">
          {/* Filters + bulk actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {["pending", "approved", "rejected", "all"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setSelectedIds(new Set()); }}
                  className={`rounded-lg px-3 py-1 text-[12px] font-bold transition ${
                    statusFilter === s ? "bg-acc text-white" : "bg-panel3 text-ink hover:bg-panel2"
                  }`}
                >
                  {s === "pending" ? `⏳ Pending` : s === "approved" ? `✅ Approved` : s === "rejected" ? `❌ Rejected` : `📋 All`}
                  {s === "pending" && stats?.pending != null ? ` (${stats.pending})` : ""}
                </button>
              ))}
            </div>
            <div className="flex gap-1 ml-auto">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-[12px] text-mut self-center">{selectedIds.size} selected</span>
                  <button className={`${btnOk} ${btnSm}`} onClick={() => bulkAction("approved")}>✅ Approve all</button>
                  <button className={`${btnDanger} ${btnSm}`} onClick={() => bulkAction("rejected")}>❌ Reject all</button>
                </>
              )}
              {statusFilter === "pending" && (
                <button className={`${btnPrimary} ${btnSm}`} onClick={batchQualityCheck} disabled={qualityChecking}>
                  {qualityChecking ? "🔍 Checking..." : "🔍 Quality Check All"}
                </button>
              )}
              {(statusFilter === "approved" || statusFilter === "all") && (
                <button className={`${btnPrimary} ${btnSm}`} onClick={batchRefine} disabled={refining}>
                  {refining ? "✨ Refining..." : "✨ Refine All Content"}
                </button>
              )}
              {(statusFilter === "approved" || statusFilter === "all") && (
                <button className={`${btnPrimary} ${btnSm}`} onClick={batchNormalize} disabled={normalizing}>
                  {normalizing ? "🧠 Normalizing..." : "🧠 Normalize All (keywords + code)"}
                </button>
              )}
              {statusFilter === "approved" && (
                <button className={`${btnPrimary} ${btnSm}`} onClick={indexAllUnindexed} disabled={indexing}>
                  {indexing ? "🧠 Indexing..." : "🧠 Index All to AI"}
                </button>
              )}
            </div>
          </div>

          {/* Items list */}
          {loading ? (
            <div className="py-10 text-center text-[13px] text-mut"><span className="spinner" /> Loading…</div>
          ) : items.length === 0 ? (
            <div className={`${cardCls} p-8 text-center`}>
              <p className="text-[22px]">📭</p>
              <p className="mt-2 text-[14px] font-bold">No {statusFilter} items</p>
              <p className="text-[12px] text-mut">Add content sources and run the scraper to populate this feed.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className={`${cardCls} p-4`}>
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1 h-4 w-4 accent-acc"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          className="text-left text-[14px] font-extrabold hover:underline"
                        >
                          {item.title}
                        </button>
                        <Chip tone={item.status === "approved" ? "ok" : item.status === "rejected" ? "err" : "default"}>
                          {item.status}
                        </Chip>
                        <Chip tone="cat">{item.contentType}</Chip>
                        {item.qualityScore != null && (
                          <span className={`text-[12px] font-bold ${qualityColor(item.qualityScore)}`}>
                            🎯 {item.qualityScore} · {qualityBand(item.qualityScore)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-mut">
                        <span>🌐 {item.sourceName}</span>
                        <span>·</span>
                        <a href={item.sourceUrl} target="_blank" rel="noopener" className="hover:underline text-acc">
                          {item.domain}
                        </a>
                        {item.author && <><span>·</span><span>✍️ {item.author}</span></>}
                        {item.publishedDate && <><span>·</span><span>📅 {item.publishedDate}</span></>}
                        <span>·</span>
                        <span>{item.content.split(/\s+/).length} words</span>
                      </div>
                      {item.summary && (() => {
                        // Clean JSON-wrapped summaries from broken AI responses
                        let displaySummary = item.summary;
                        if (displaySummary.startsWith("{") && displaySummary.includes('"summary"')) {
                          const match = displaySummary.match(/"summary"\s*:\s*"([^"]+)"/);
                          if (match) displaySummary = match[1];
                        }
                        // Also try parsing as JSON and extracting summary field
                        if (displaySummary.startsWith("{") && displaySummary.length < 1000) {
                          try {
                            const obj = JSON.parse(displaySummary);
                            if (obj && typeof obj.summary === "string") displaySummary = obj.summary;
                          } catch { /* not JSON, use as-is */ }
                        }
                        return (
                          <p className="mt-1.5 text-[12.5px] text-ink leading-relaxed line-clamp-2">{displaySummary}</p>
                        );
                      })()}
                    </div>

                    {/* Quick review buttons */}
                    <div className="flex gap-1">
                      {item.status === "pending" && (
                        <>
                          <button className={`${btnOk} ${btnSm}`} onClick={() => approveItem(item.id)}>✅</button>
                          <button className={`${btnDanger} ${btnSm}`} onClick={() => rejectItem(item.id)}>❌</button>
                        </>
                      )}
                      {item.status === "approved" && (
                        <button
                          className={`${btnPrimary} ${btnSm}`}
                          disabled={busy}
                          onClick={(e) => { e.stopPropagation(); console.log("[ContentCuration] Refine button clicked for", item.id); refineSingle(item.id); }}
                        >✨ Refine</button>
                      )}
                      {item.status === "approved" && (
                        <button
                          className={`${btnPrimary} ${btnSm}`}
                          disabled={busy}
                          onClick={(e) => { e.stopPropagation(); console.log("[ContentCuration] Normalize button clicked for", item.id); normalizeSingle(item.id); }}
                        >🧠 Normalize</button>
                      )}
                      {item.status === "approved" && !(item as any).ragDocumentId && (
                        <button
                          className={`${btnPrimary} ${btnSm}`}
                          disabled={busy}
                          onClick={(e) => { e.stopPropagation(); indexContentToRAG(item.id); }}
                        >🧠 Index</button>
                      )}
                      {item.status === "approved" && (item as any).ragDocumentId && (
                        <span className="text-[11px] text-acc font-bold">🧠 Indexed</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedId === item.id && (
                    <div className="mt-3 space-y-3 border-t border-line/10 pt-3">
                      {/* Quality scores breakdown */}
                      {item.qualityScore != null && (
                        <div className="grid grid-cols-5 gap-2">
                          {[
                            { label: "Accuracy", score: item.accuracyScore },
                            { label: "Relevance", score: item.relevanceScore },
                            { label: "Depth", score: item.depthScore },
                            { label: "Freshness", score: item.freshnessScore },
                            { label: "Credibility", score: item.credibilityScore },
                          ].map((d) => (
                            <div key={d.label} className="rounded-lg bg-panel3 px-2 py-1.5 text-center">
                              <div className={`text-[14px] font-extrabold ${qualityColor(d.score)}`}>{d.score ?? "—"}</div>
                              <div className="text-[10px] text-mut">{d.label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {item.qualityNotes && (
                        <p className="text-[12px] text-mut italic">🤖 {item.qualityNotes}</p>
                      )}

                      {/* Content preview */}
                      <div className="max-h-[300px] overflow-y-auto rounded-lg bg-panel2/50 p-3 text-[12px] text-ink leading-relaxed whitespace-pre-wrap">
                        {item.content.slice(0, 3000)}
                      </div>

                      {/* Review notes */}
                      {item.reviewNotes && (
                        <p className="text-[12px] text-mut">📝 Review: {item.reviewNotes}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── SOURCES TAB ───────────────────────────────────────────── */}
      {tab === "sources" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-mut">{sources.length} content source(s)</p>
            <div className="flex gap-2">
              <button className={`${btnOk} ${btnSm}`} onClick={runScraper} disabled={scraping || busy}>
                {scraping ? <><span className="spinner" /> Scraping...</> : `🕷️ Run Scraper (${sources.filter(s => s.enabled).length})`}
              </button>
              <button className={btnPrimary + btnSm} onClick={() => setShowAddSource(!showAddSource)}>
                {showAddSource ? "Cancel" : "➕ Add source"}
              </button>
            </div>
          </div>

          {/* Add source form */}
          {showAddSource && (
            <div className={`${cardCls} p-4`}>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_150px_130px]">
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="inp"
                />
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Source name"
                  className="inp"
                />
                <select value={newType} onChange={(e) => setNewType(e.target.value)} className="inp">
                  <option value="article">📄 Article</option>
                  <option value="tutorial">📚 Tutorial</option>
                  <option value="docs">📖 Docs</option>
                  <option value="video_transcript">🎬 Video transcript</option>
                </select>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select value={newField} onChange={(e) => setNewField(e.target.value)} className="inp max-w-[200px]">
                  {FIELDS.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <button className={btnPrimary + btnSm} onClick={addSource} disabled={busy}>Add</button>
              </div>
            </div>
          )}

          {/* Scrape report */}
          {scrapeReport && (
            <div className="rounded-xl border border-line/10 bg-panel2/30 p-4">
              <h3 className="mb-2 text-[14px] font-extrabold">🕷️ Scrape Report</h3>
              <div className="flex gap-3 text-[12px]">
                <span className="font-bold text-green">✅ {scrapeReport.stored} stored</span>
                <span className="font-bold text-err">❌ {scrapeReport.errors} errors</span>
              </div>
              <div className="mt-2 space-y-1">
                {scrapeReport.results.map((r) => (
                  <div key={r.sourceId} className="flex items-center gap-2 rounded-lg bg-deep/40 px-3 py-1.5 text-[11.5px]">
                    <span className={r.success ? "text-green" : "text-err"}>{r.success ? "✅" : "❌"}</span>
                    <span className="truncate flex-1 text-ink">{r.title || r.url}</span>
                    {r.error && <span className="text-err">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources list */}
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line/10 bg-panel2/30 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={s.enabled ? "ok" : "default"}>{s.enabled ? "ON" : "OFF"}</Chip>
                  <span className="text-[13px] font-bold">{s.name}</span>
                  <span className="text-[11.5px] text-mut">{s.domain}</span>
                  <span className="text-[11.5px] text-mut">⭐ {s.domainReputation}/10</span>
                  {s.scrapeCount > 0 && <span className="text-[11px] text-mut">{s.scrapeCount} scraped</span>}
                </div>
                <div className="mt-1 truncate text-[12px] text-mut">{s.url}</div>
              </div>
              <div className="flex gap-2">
                <Switch checked={s.enabled} onChange={(v) => toggleSource(s, v)} />
                <button className={btnDanger + btnSm} onClick={() => removeSource(s.id)} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── STATS TAB ─────────────────────────────────────────────── */}
      {tab === "stats" && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Total" value={stats.total} icon="📦" />
            <StatCard label="Pending" value={stats.pending} icon="⏳" />
            <StatCard label="Approved" value={stats.approved} icon="✅" />
            <StatCard label="Rejected" value={stats.rejected} icon="❌" />
            <StatCard label="Avg Quality" value={stats.avgQuality != null ? `${stats.avgQuality}/100` : "—"} icon="🎯" />
          </div>

          {stats.topSources.length > 0 && (
            <div className={`${cardCls} p-4`}>
              <h3 className="mb-3 text-[14px] font-extrabold">🌐 Top Sources</h3>
              <div className="space-y-2">
                {stats.topSources.map((s) => (
                  <div key={s.name} className="flex items-center justify-between rounded-lg bg-panel3 px-3 py-2">
                    <div>
                      <span className="text-[13px] font-bold">{s.name}</span>
                      <span className="ml-2 text-[11px] text-mut">{s.count} items</span>
                    </div>
                    <span className={`text-[12px] font-bold ${qualityColor(s.avgQuality)}`}>
                      {s.avgQuality != null ? `${s.avgQuality}/100` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Stat card ─────────────────────────────────────────────────────────── */

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className={`${cardCls} p-3 text-center`}>
      <div className="text-[18px]">{icon}</div>
      <div className="mt-1 text-[18px] font-extrabold">{value}</div>
      <div className="text-[11px] text-mut">{label}</div>
    </div>
  );
}
