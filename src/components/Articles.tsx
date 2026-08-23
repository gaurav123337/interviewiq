/* Articles — Public page showing approved curated content.
   Fetches approved items from content_items table and displays
   them with source attribution, quality scores, and summaries. */

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../services/cloud";
import { cardCls, Chip } from "./ui";

interface Article {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  sourceName: string;
  sourceUrl: string;
  domain: string;
  author: string | null;
  publishedDate: string | null;
  qualityScore: number | null;
  contentType: string;
  fieldId: string;
  tags: string[];
  createdAt: string;
}

function qualityColor(score: number | null): string {
  if (score == null) return "text-mut";
  if (score >= 80) return "text-green";
  if (score >= 60) return "text-acc";
  if (score >= 40) return "text-warn";
  return "text-err";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function Articles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const client = await getSupabaseClient();
        if (!client) { setLoading(false); return; }

        const { data, error } = await client
          .from("content_items")
          .select("id, title, summary, content, source_name, source_url, domain, author, published_date, quality_score, content_type, field_id, tags, created_at")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(50);

        if (cancelled) return;
        if (error) { setLoading(false); return; }

        setArticles((data ?? []).map(r => ({
          id: String(r.id),
          title: String(r.title),
          summary: r.summary ?? null,
          content: String(r.content),
          sourceName: String(r.source_name),
          sourceUrl: String(r.source_url),
          domain: String(r.domain),
          author: r.author ?? null,
          publishedDate: r.published_date ?? null,
          qualityScore: r.quality_score != null ? Number(r.quality_score) : null,
          contentType: String(r.content_type),
          fieldId: String(r.field_id),
          tags: Array.isArray(r.tags) ? r.tags : [],
          createdAt: String(r.created_at),
        })));
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const filtered = filter === "all" ? articles : articles.filter(a => a.fieldId === filter);
  const fields = [...new Set(articles.map(a => a.fieldId))];

  if (loading) {
    return (
      <div className="mx-auto max-w-[900px] px-4 pt-10">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mb-3 text-[28px] animate-pulse">⏳</div>
            <p className="text-[13px] text-mut">Loading articles...</p>
          </div>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="mx-auto max-w-[900px] px-4 pt-10">
        <div className={`${cardCls} p-10 text-center`}>
          <p className="text-[32px]">📰</p>
          <h2 className="mt-3 text-xl font-extrabold">No articles yet</h2>
          <p className="mt-2 text-[14px] text-mut">
            Curated content will appear here once approved by admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 pt-6 pb-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
          📰 Curated <span className="grad-text">Articles</span>
        </h1>
        <p className="mt-2 text-[14px] text-mut">
          Quality-checked content from trusted sources — articles, tutorials, and guides to help you prepare.
        </p>
      </div>

      {/* Filters */}
      {fields.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1 text-[12px] font-bold transition ${
              filter === "all" ? "bg-acc text-white" : "bg-wht5 text-mut hover:bg-wht8"
            }`}
          >
            All ({articles.length})
          </button>
          {fields.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-[12px] font-bold transition ${
                filter === f ? "bg-acc text-white" : "bg-wht5 text-mut hover:bg-wht8"
              }`}
            >
              {f} ({articles.filter(a => a.fieldId === f).length})
            </button>
          ))}
        </div>
      )}

      {/* Articles list */}
      <div className="space-y-3">
        {filtered.map(article => {
          const expanded = expandedId === article.id;
          const preview = article.summary || article.content.slice(0, 200) + "...";

          return (
            <div key={article.id} className={`${cardCls} overflow-hidden transition-all`}>
              {/* Article header */}
              <div
                className="cursor-pointer p-5"
                onClick={() => setExpandedId(expanded ? null : article.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-extrabold leading-tight">{article.title}</h3>
                      {article.qualityScore != null && (
                        <span className={`text-[11px] font-bold ${qualityColor(article.qualityScore)}`}>
                          🎯 {article.qualityScore}
                        </span>
                      )}
                    </div>

                    {/* Source attribution */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-mut">
                      <span className="font-bold text-acc">{article.sourceName}</span>
                      <span>·</span>
                      <a
                        href={article.sourceUrl}
                        target="_blank"
                        rel="noopener"
                        className="hover:underline text-fnt/60"
                        onClick={e => e.stopPropagation()}
                      >
                        {article.domain}
                      </a>
                      {article.author && (
                        <>
                          <span>·</span>
                          <span>✍️ {article.author}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{timeAgo(article.createdAt)}</span>
                    </div>

                    {/* Summary / preview */}
                    <p className="mt-2 text-[13px] text-fnt/80 leading-relaxed line-clamp-3">
                      {preview}
                    </p>

                    {/* Tags */}
                    {article.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {article.tags.map(tag => (
                          <Chip key={tag} tone="cat">{tag}</Chip>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expand indicator */}
                  <span className="text-[14px] text-mut shrink-0">
                    {expanded ? "▾" : "▸"}
                  </span>
                </div>
              </div>

              {/* Expanded content */}
              {expanded && (
                <div className="border-t border-line/10 bg-deep/30 px-5 py-4">
                  {/* Action buttons */}
                  <div className="mb-3 flex gap-2">
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener"
                      className="rounded-lg bg-acc px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90 transition"
                    >
                      🔗 Read original
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(article.sourceUrl).catch(() => {});
                      }}
                      className="rounded-lg bg-wht5 px-4 py-1.5 text-[12px] font-bold text-mut hover:bg-wht8 transition"
                    >
                      📋 Copy link
                    </button>
                  </div>

                  {/* Full content */}
                  <div className="max-h-[500px] overflow-y-auto rounded-lg bg-deep/50 p-4 text-[13px] text-fnt leading-relaxed whitespace-pre-wrap">
                    {article.content.slice(0, 5000)}
                    {article.content.length > 5000 && (
                      <div className="mt-2 text-[12px] text-mut">
                        ... ({article.content.length.toLocaleString()} characters total)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
