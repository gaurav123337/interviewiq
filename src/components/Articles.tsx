/* Articles — Public page showing approved curated content.
   Fetches approved items from content_items table and displays
   them with progressive difficulty levels (Beginner → Intermediate → Advanced),
   table of contents, key takeaways, and source attribution. */

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../services/cloud";
import { cardCls, Chip } from "./ui";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface RefinedContent {
  beginner: string;
  intermediate: string;
  advanced: string;
  tableOfContents: string[];
  keyTakeaways: string[];
  glossary: { term: string; definition: string }[];
  estimatedReadMinutes: number;
}

interface Article {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  contentRefined: RefinedContent | null;
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

type DifficultyLevel = "beginner" | "intermediate" | "advanced";

const DIFFICULTY_CONFIG: Record<DifficultyLevel, { label: string; icon: string; color: string; desc: string }> = {
  beginner: { label: "Beginner", icon: "🌱", color: "text-green", desc: "Simple explanation — what it is and why it matters" },
  intermediate: { label: "Intermediate", icon: "🔧", color: "text-acc", desc: "How it works — patterns, code examples, common practices" },
  advanced: { label: "Advanced", icon: "🚀", color: "text-purple-400", desc: "Deep dive — internals, edge cases, interview angles" },
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

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

/** Simple markdown to HTML converter (handles headings, code, lists, bold, links) */
function renderMarkdown(md: string): string {
  return md
    // Code blocks (preserve first)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="rounded-lg bg-deep/80 p-3 my-3 text-[12px] overflow-x-auto"><code class="text-fnt/90">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="rounded bg-deep/60 px-1.5 py-0.5 text-[12px] text-acc">$1</code>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="mt-5 mb-2 text-[15px] font-extrabold text-fnt">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="mt-7 mb-3 text-[17px] font-extrabold text-fnt border-b border-line/10 pb-1">$1</h2>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-fnt">$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em class="italic text-fnt/80">$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1 text-[13px] text-fnt/90 list-disc">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 mb-1 text-[13px] text-fnt/90 list-decimal">$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-acc hover:underline">$1</a>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p class="mb-3 text-[13px] text-fnt/85 leading-relaxed">')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br/>')
    // Wrap in paragraph
    .replace(/^/, '<p class="mb-3 text-[13px] text-fnt/85 leading-relaxed">')
    .replace(/$/, '</p>');
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function SourceBadge({ article }: { article: Article }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-mut">
      <span className="font-bold text-acc">{article.sourceName}</span>
      <span>·</span>
      <a
        href={article.sourceUrl}
        target="_blank"
        rel="noopener"
        className="hover:underline text-fnt/60"
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
      {article.contentRefined?.estimatedReadMinutes && (
        <>
          <span>·</span>
          <span>📖 {article.contentRefined.estimatedReadMinutes} min read</span>
        </>
      )}
    </div>
  );
}

function TableOfContents({ items, onSelect }: { items: string[]; onSelect?: (idx: number) => void }) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg bg-deep/40 p-3">
      <h4 className="mb-2 text-[12px] font-extrabold text-fnt">📑 In this article</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i}>
            <button
              onClick={() => onSelect?.(i)}
              className="text-left text-[12px] text-acc hover:underline"
            >
              {i + 1}. {item}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeyTakeaways({ takeaways }: { takeaways: string[] }) {
  if (!takeaways.length) return null;
  return (
    <div className="rounded-lg border border-acc/20 bg-acc/5 p-4">
      <h4 className="mb-2 text-[13px] font-extrabold text-acc">💡 Key Takeaways</h4>
      <ol className="space-y-1.5">
        {takeaways.map((t, i) => (
          <li key={i} className="flex gap-2 text-[12.5px] text-fnt/85">
            <span className="shrink-0 font-bold text-acc">{i + 1}.</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Glossary({ terms }: { terms: { term: string; definition: string }[] }) {
  if (!terms.length) return null;
  return (
    <div className="rounded-lg bg-deep/40 p-4">
      <h4 className="mb-2 text-[13px] font-extrabold text-fnt">📖 Glossary</h4>
      <dl className="space-y-2">
        {terms.map((t, i) => (
          <div key={i} className="text-[12px]">
            <dt className="font-bold text-acc">{t.term}</dt>
            <dd className="ml-3 text-fnt/75">{t.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DifficultySelector({ level, onChange }: { level: DifficultyLevel; onChange: (l: DifficultyLevel) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-deep/40 p-1">
      {(["beginner", "intermediate", "advanced"] as DifficultyLevel[]).map((l) => {
        const config = DIFFICULTY_CONFIG[l];
        return (
          <button
            key={l}
            onClick={() => onChange(l)}
            className={`flex-1 rounded-md px-3 py-2 text-[12px] font-bold transition ${
              level === l
                ? "bg-acc text-white shadow-sm"
                : "text-mut hover:bg-wht5 hover:text-fnt"
            }`}
          >
            <span className="mr-1">{config.icon}</span>
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const [expanded, setExpanded] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("beginner");
  const [showGlossary, setShowGlossary] = useState(false);

  const refined = article.contentRefined;
  const hasRefined = refined && refined.beginner;

  const currentContent = hasRefined
    ? refined[difficulty]
    : article.content.slice(0, 5000);

  const preview = article.summary || (hasRefined
    ? refined.beginner.replace(/[#*`\[\]]/g, "").slice(0, 200) + "..."
    : article.content.replace(/[#*`\[\]]/g, "").slice(0, 200) + "...");

  return (
    <div className={`${cardCls} overflow-hidden transition-all`}>
      {/* Card header — always visible */}
      <div
        className="cursor-pointer p-5"
        onClick={() => setExpanded(!expanded)}
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
              {hasRefined && (
                <span className="rounded bg-acc/15 px-1.5 py-0.5 text-[10px] font-bold text-acc">✨ AI Refined</span>
              )}
            </div>
            <SourceBadge article={article} />
            <p className="mt-2 text-[13px] text-fnt/80 leading-relaxed line-clamp-2">{preview}</p>
            {article.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {article.tags.map(tag => (
                  <Chip key={tag} tone="cat">{tag}</Chip>
                ))}
              </div>
            )}
          </div>
          <span className="text-[14px] text-mut shrink-0 mt-1">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-line/10 bg-deep/20 px-5 py-4 space-y-4">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener"
              className="rounded-lg bg-acc px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90 transition"
            >
              🔗 Read original
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(article.sourceUrl).catch(() => {})}
              className="rounded-lg bg-wht5 px-4 py-1.5 text-[12px] font-bold text-mut hover:bg-wht8 transition"
            >
              📋 Copy link
            </button>
          </div>

          {hasRefined ? (
            <>
              {/* Difficulty selector */}
              <DifficultySelector level={difficulty} onChange={setDifficulty} />
              <p className="text-[11px] text-mut italic">{DIFFICULTY_CONFIG[difficulty].desc}</p>

              {/* Table of contents */}
              {refined.tableOfContents.length > 0 && (
                <TableOfContents items={refined.tableOfContents} />
              )}

              {/* Main content — rendered markdown */}
              <div
                className="rounded-lg bg-deep/40 p-4"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(currentContent) }}
              />

              {/* Key takeaways */}
              <KeyTakeaways takeaways={refined.keyTakeaways} />

              {/* Glossary toggle */}
              {refined.glossary.length > 0 && (
                <div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowGlossary(!showGlossary); }}
                    className="text-[12px] font-bold text-acc hover:underline"
                  >
                    {showGlossary ? "▾ Hide" : "▸ Show"} Glossary ({refined.glossary.length} terms)
                  </button>
                  {showGlossary && <Glossary terms={refined.glossary} />}
                </div>
              )}
            </>
          ) : (
            /* Fallback: raw content for unrefined articles */
            <div className="max-h-[500px] overflow-y-auto rounded-lg bg-deep/50 p-4 text-[13px] text-fnt leading-relaxed whitespace-pre-wrap">
              {article.content.slice(0, 5000)}
              {article.content.length > 5000 && (
                <div className="mt-2 text-[12px] text-mut">
                  ... ({article.content.length.toLocaleString()} characters total)
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */

export function Articles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const client = await getSupabaseClient();
        if (!client) { setLoading(false); return; }

        const { data, error } = await client
          .from("content_items")
          .select("id, title, summary, content, content_refined, source_name, source_url, domain, author, published_date, quality_score, content_type, field_id, tags, created_at")
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
          contentRefined: r.content_refined as RefinedContent | null ?? null,
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

  const fields = [...new Set(articles.map(a => a.fieldId))];
  const filtered = articles.filter(a => {
    const matchesFilter = filter === "all" || a.fieldId === filter;
    const matchesSearch = !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      a.sourceName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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
          Quality-checked content from trusted sources — each article is refined into
          progressive difficulty levels for effective learning.
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search articles..."
          className="w-full rounded-xl border border-line/15 bg-wht/5 px-4 py-2.5 text-[13px] text-fnt placeholder:text-mut focus:border-acc focus:outline-none"
        />
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

      {/* Difficulty legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-[11px] text-mut">
        {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
          <span key={key}>
            {config.icon} <span className={config.color}>{config.label}</span> — {config.desc}
          </span>
        ))}
      </div>

      {/* Articles list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className={`${cardCls} p-8 text-center`}>
            <p className="text-[14px] text-mut">No articles match your search.</p>
          </div>
        ) : (
          filtered.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))
        )}
      </div>
    </div>
  );
}
