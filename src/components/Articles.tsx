/* Articles — Public page showing approved curated content.
   Fetches approved items from content_items table and displays
   them with progressive difficulty levels (Beginner -> Intermediate -> Advanced),
   table of contents, key takeaways, and source attribution.

   Uses safe React text rendering with proper escaping. */

import { useEffect, useState, type ReactNode } from "react";
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
  beginner: { label: "Beginner", icon: "🌱", color: "text-green", desc: "Simple explanation -- what it is and why it matters" },
  intermediate: { label: "Intermediate", icon: "🔧", color: "text-acc", desc: "How it works -- patterns, code examples, common practices" },
  advanced: { label: "Advanced", icon: "🚀", color: "text-purple-400", desc: "Deep dive -- internals, edge cases, interview angles" },
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

/* ── Safe Markdown Renderer ────────────────────────────────────────────── */

/** Split markdown into blocks and render as safe React elements */
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let listItems: { text: string; ordered: boolean; num: number }[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      const isOrdered = listItems[0].ordered;
      elements.push(
        isOrdered ? (
          <ol key={`ol-${elements.length}`} className="ml-5 mb-3 list-decimal space-y-1">
            {listItems.map((li, i) => <li key={i} className="text-[13px] text-fnt/85 leading-relaxed">{inlineMarkdown(li.text)}</li>)}
          </ol>
        ) : (
          <ul key={`ul-${elements.length}`} className="ml-5 mb-3 list-disc space-y-1">
            {listItems.map((li, i) => <li key={i} className="text-[13px] text-fnt/85 leading-relaxed">{inlineMarkdown(li.text)}</li>)}
          </ul>
        )
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${elements.length}`} className="rounded-lg bg-deep/80 p-3 my-3 overflow-x-auto">
            <code className="text-[12px] text-fnt/90">{codeLines.join("\n")}</code>
          </pre>
        );
        inCodeBlock = false;
        codeLines = [];
        codeLang = "";
        continue;
      }
      flushList();
      inCodeBlock = true;
      codeLang = line.slice(3).trim();
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      flushList();
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${elements.length}`} className="mt-5 mb-2 text-[15px] font-extrabold text-fnt">
          {inlineMarkdown(line.slice(4))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${elements.length}`} className="mt-7 mb-3 text-[17px] font-extrabold text-fnt border-b border-line/10 pb-1">
          {inlineMarkdown(line.slice(3))}
        </h2>
      );
      continue;
    }

    // Unordered list
    if (line.startsWith("- ")) {
      listItems.push({ text: line.slice(2), ordered: false, num: 0 });
      continue;
    }

    // Ordered list
    const orderedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (orderedMatch) {
      listItems.push({ text: orderedMatch[2], ordered: true, num: parseInt(orderedMatch[1]) });
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${elements.length}`} className="mb-3 text-[13px] text-fnt/85 leading-relaxed">
        {inlineMarkdown(line)}
      </p>
    );
  }

  flushList();

  return <>{elements}</>;
}

/** Render inline markdown (bold, italic, code, links) as safe React elements */
function inlineMarkdown(text: string): ReactNode {
  // Split on patterns and render as React elements
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code (highest priority)
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Bold
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // Italic
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
    // Link
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    // Find earliest match
    const matches = [
      codeMatch && { type: "code" as const, match: codeMatch },
      boldMatch && { type: "bold" as const, match: boldMatch },
      italicMatch && { type: "italic" as const, match: italicMatch },
      linkMatch && { type: "link" as const, match: linkMatch },
    ].filter(Boolean) as { type: string; match: RegExpMatchArray }[];

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    // Pick the one with the earliest index
    const earliest = matches.reduce((a, b) => (a.match.index! < b.match.index! ? a : b));
    const idx = earliest.match.index!;

    // Text before the match
    if (idx > 0) parts.push(remaining.slice(0, idx));

    switch (earliest.type) {
      case "code":
        parts.push(
          <code key={key++} className="rounded bg-deep/60 px-1.5 py-0.5 text-[12px] text-acc">
            {earliest.match[1]}
          </code>
        );
        break;
      case "bold":
        parts.push(
          <strong key={key++} className="font-bold text-fnt">{earliest.match[1]}</strong>
        );
        break;
      case "italic":
        parts.push(
          <em key={key++} className="italic text-fnt/80">{earliest.match[1]}</em>
        );
        break;
      case "link":
        parts.push(
          <a key={key++} href={earliest.match[2]} target="_blank" rel="noopener" className="text-acc hover:underline">
            {earliest.match[1]}
          </a>
        );
        break;
    }

    remaining = remaining.slice(idx + earliest.match[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function SourceBadge({ article }: { article: Article }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-mut">
      <span className="font-bold text-acc">{article.sourceName}</span>
      <span>·</span>
      <a href={article.sourceUrl} target="_blank" rel="noopener" className="hover:underline text-fnt/60">
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

function TableOfContents({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg bg-deep/40 p-3">
      <h4 className="mb-2 text-[12px] font-extrabold text-fnt">📑 In this article</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[12px] text-acc">{i + 1}. {item}</li>
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
              level === l ? "bg-acc text-white shadow-sm" : "text-mut hover:bg-wht5 hover:text-fnt"
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

  const currentContent = hasRefined ? refined[difficulty] : article.content.slice(0, 5000);

  const preview = article.summary || (hasRefined
    ? refined.beginner.replace(/[#*`\[\]]/g, "").slice(0, 200) + "..."
    : article.content.replace(/[#*`\[\]]/g, "").slice(0, 200) + "...");

  return (
    <div className={`${cardCls} overflow-hidden transition-all`}>
      <div className="cursor-pointer p-5" onClick={() => setExpanded(!expanded)}>
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
                {article.tags.map(tag => <Chip key={tag} tone="cat">{tag}</Chip>)}
              </div>
            )}
          </div>
          <span className="text-[14px] text-mut shrink-0 mt-1">{expanded ? "▾" : "▸"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-line/10 bg-deep/20 px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <a href={article.sourceUrl} target="_blank" rel="noopener"
              className="rounded-lg bg-acc px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90 transition">
              🔗 Read original
            </a>
            <button onClick={() => navigator.clipboard.writeText(article.sourceUrl).catch(() => {})}
              className="rounded-lg bg-wht5 px-4 py-1.5 text-[12px] font-bold text-mut hover:bg-wht8 transition">
              📋 Copy link
            </button>
          </div>

          {hasRefined ? (
            <>
              <DifficultySelector level={difficulty} onChange={setDifficulty} />
              <p className="text-[11px] text-mut italic">{DIFFICULTY_CONFIG[difficulty].desc}</p>
              {refined.tableOfContents.length > 0 && <TableOfContents items={refined.tableOfContents} />}
              <div className="rounded-lg bg-deep/40 p-4">
                <MarkdownContent text={currentContent} />
              </div>
              <KeyTakeaways takeaways={refined.keyTakeaways} />
              {refined.glossary.length > 0 && (
                <div>
                  <button onClick={(e) => { e.stopPropagation(); setShowGlossary(!showGlossary); }}
                    className="text-[12px] font-bold text-acc hover:underline">
                    {showGlossary ? "▾ Hide" : "▸ Show"} Glossary ({refined.glossary.length} terms)
                  </button>
                  {showGlossary && <Glossary terms={refined.glossary} />}
                </div>
              )}
            </>
          ) : (
            <div className="max-h-[500px] overflow-y-auto rounded-lg bg-deep/50 p-4">
              <MarkdownContent text={article.content.slice(0, 5000)} />
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
      <div className="mb-6">
        <h1 className="text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
          📰 Curated <span className="grad-text">Articles</span>
        </h1>
        <p className="mt-2 text-[14px] text-mut">
          Quality-checked content from trusted sources -- each article is refined into
          progressive difficulty levels for effective learning.
        </p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search articles..."
          className="w-full rounded-xl border border-line/15 bg-wht/5 px-4 py-2.5 text-[13px] text-fnt placeholder:text-mut focus:border-acc focus:outline-none"
        />
      </div>

      {fields.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1 text-[12px] font-bold transition ${filter === "all" ? "bg-acc text-white" : "bg-wht5 text-mut hover:bg-wht8"}`}>
            All ({articles.length})
          </button>
          {fields.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-[12px] font-bold transition ${filter === f ? "bg-acc text-white" : "bg-wht5 text-mut hover:bg-wht8"}`}>
              {f} ({articles.filter(a => a.fieldId === f).length})
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3 text-[11px] text-mut">
        {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
          <span key={key}>{config.icon} <span className={config.color}>{config.label}</span> -- {config.desc}</span>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className={`${cardCls} p-8 text-center`}>
            <p className="text-[14px] text-mut">No articles match your search.</p>
          </div>
        ) : (
          filtered.map(article => <ArticleCard key={article.id} article={article} />)
        )}
      </div>
    </div>
  );
}
