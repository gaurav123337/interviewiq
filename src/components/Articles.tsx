/* Articles — Public page showing approved curated content.
   Fetches approved items from content_items table and displays
   them with progressive difficulty levels (Beginner -> Intermediate -> Advanced),
   table of contents, key takeaways, and source attribution.

   Uses safe React text rendering with proper escaping. */

import { useCallback, useEffect, useState, type ReactNode } from "react";
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

/** Decode HTML entities and escaped characters from scraped content */
function decodeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    // Decode literal \n from JSON strings (AI responses)
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

/** Parse content_refined JSONB from Supabase (may be string or object) */
function parseRefined(raw: unknown): RefinedContent | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== "object") return null;
    if (!obj.beginner && !obj.intermediate && !obj.advanced) return null;
    return {
      beginner: decodeText(obj.beginner || ""),
      intermediate: decodeText(obj.intermediate || ""),
      advanced: decodeText(obj.advanced || ""),
      tableOfContents: Array.isArray(obj.tableOfContents) ? obj.tableOfContents.map(String) : [],
      keyTakeaways: Array.isArray(obj.keyTakeaways) ? obj.keyTakeaways.map(String) : [],
      glossary: Array.isArray(obj.glossary)
        ? obj.glossary.map((g: Record<string, unknown>) => ({
            term: String(g.term || ""),
            definition: String(g.definition || ""),
          }))
        : [],
      estimatedReadMinutes: Number(obj.estimatedReadMinutes) || 5,
    };
  } catch {
    return null;
  }
}

/* ── Safe Markdown Renderer ────────────────────────────────────────────── */

/** Render inline markdown (bold, italic, code, links) as safe React elements */
function inlineMarkdown(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

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

    const earliest = matches.reduce((a, b) => (a.match.index! < b.match.index! ? a : b));
    const idx = earliest.match.index!;

    if (idx > 0) parts.push(remaining.slice(0, idx));

    switch (earliest.type) {
      case "code":
        parts.push(
          <code key={key++} className="rounded bg-panel2/80 px-1.5 py-0.5 text-[12px] text-acc">
            {earliest.match[1]}
          </code>
        );
        break;
      case "bold":
        parts.push(<strong key={key++} className="font-bold text-ink">{earliest.match[1]}</strong>);
        break;
      case "italic":
        parts.push(<em key={key++} className="italic text-ink/80">{earliest.match[1]}</em>);
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

/** Detect if a line looks like code (JSON, config, imports, etc.) */
function isCodeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^[{\[]/.test(trimmed) && /[}\]],?$/.test(trimmed)) return true;
  if (/^"[^"]+"\s*[:=]/.test(trimmed)) return true;
  if (/^import\s/.test(trimmed) || /^export\s/.test(trimmed) || /^from\s/.test(trimmed)) return true;
  if (/^const\s|^let\s|^var\s|^function\s|^class\s|^interface\s|^type\s/.test(trimmed)) return true;
  if (/^\s*(if|else|for|while|return|throw|try|catch|switch|case|break)\b/.test(line)) return true;
  if (/^\s*}\s*$/.test(trimmed) || /^\s*\{\s*$/.test(trimmed)) return true;
  if (/^\s*\)\s*;?\s*$/.test(trimmed)) return true;
  if (/^[a-zA-Z_$]+\s*\(/.test(trimmed) && /[)]\s*$/.test(trimmed)) return true;
  return false;
}

/** Detect the language of a code block */
function detectLanguage(lines: string[]): string {
  const joined = lines.join("\n").trim();
  if (/^\s*[{[]/.test(joined) && /[}\]]\s*$/.test(joined)) return "JSON";
  if (/^\s*import\s/.test(joined) || /^\s*export\s.*from\s/.test(joined) || /React\b/.test(joined)) return "JS";
  if (/^\s*(const|let|var|function|class)\b/.test(joined)) return "JS";
  if (/^\s*(def |class |import |from ).*:$/.test(joined) || /^\s*print\(/.test(joined)) return "Python";
  if (/^\s*(fn |let |mut |pub |struct |impl |use )/.test(joined)) return "Rust";
  if (/^\s*(<[a-z]+|<\/[a-z]+|<!DOCTYPE)/i.test(joined)) return "HTML";
  if (/^\s*[.#@][a-zA-Z]/.test(joined) && /[{}]\s*$/.test(joined)) return "CSS";
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(joined)) return "SQL";
  return "";
}

/* ── Syntax Highlighting ───────────────────────────────────────────────── */

/** Tokenize JSON with basic syntax highlighting */
function highlightJSON(code: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  // Match JSON tokens: strings, numbers, booleans, null, keys, punctuation
  const regex = /("(?:[^"\\]|\\.)*")\s*:/g; // key
  const strRegex = /"(?:[^"\\]|\\.)*"/g;
  const numRegex = /\b(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g;
  const boolRegex = /\b(true|false)\b/g;
  const nullRegex = /\b(null)\b/g;

  // Simple approach: split by lines and highlight each
  const lines = code.split("\n");
  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) tokens.push(<span key={`nl-${lineIdx}`}>{"\n"}</span>);

    // Highlight JSON key-value pairs
    let remaining = line;
    let pos = 0;
    const lineTokens: ReactNode[] = [];

    // Find all string positions
    const allStrings: { start: number; end: number; text: string }[] = [];
    const tempRegex = /"(?:[^"\\]|\\.)*"/g;
    let m;
    while ((m = tempRegex.exec(line)) !== null) {
      allStrings.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }

    allStrings.forEach((s, i) => {
      // Text before this string
      if (s.start > pos) {
        lineTokens.push(<span key={`t-${lineIdx}-${i}`}>{line.slice(pos, s.start)}</span>);
      }
      // Is this string followed by a colon? Then it's a key
      const afterStr = line.slice(s.end).trimStart();
      if (afterStr.startsWith(":")) {
        lineTokens.push(
          <span key={`k-${lineIdx}-${i}`} className="text-acc">{s.text}</span>
        );
      } else {
        // It's a string value
        lineTokens.push(
          <span key={`s-${lineIdx}-${i}`} className="text-green">{s.text}</span>
        );
      }
      pos = s.end;
    });

    // Remaining text after last string
    if (pos < line.length) {
      let tail = line.slice(pos);
      // Highlight numbers
      tail = tail.replace(/\b(-?\d+\.?\d*)\b/g, (n) => `NUM:${n}:NUM`);
      // Highlight booleans/null
      tail = tail.replace(/\b(true|false|null)\b/g, (b) => `KW:${b}:KW`);

      const parts = tail.split(/(NUM:[^:]+:[^:]+|KW:[^:]+:[^:]+)/);
      parts.forEach((part, pi) => {
        if (part.startsWith("NUM:")) {
          const val = part.slice(4, -4);
          lineTokens.push(<span key={`n-${lineIdx}-${pi}`} className="text-amber-400">{val}</span>);
        } else if (part.startsWith("KW:")) {
          const val = part.slice(3, -3);
          lineTokens.push(<span key={`kw-${lineIdx}-${pi}`} className="text-purple-400">{val}</span>);
        } else if (part) {
          lineTokens.push(<span key={`x-${lineIdx}-${pi}`}>{part}</span>);
        }
      });
    }

    tokens.push(<>{lineTokens}</>);
  });

  return tokens;
}

/** Highlight JS/TS code with basic keyword coloring */
function highlightJS(code: string): ReactNode[] {
  const keywords = new Set(["import","export","from","const","let","var","function","return","if","else","for","while","class","extends","new","this","async","await","try","catch","throw","switch","case","break","default","typeof","instanceof","interface","type","enum","implements","readonly","private","public","static","super","yield","of","in","as","null","undefined","true","false"]);
  const lines = code.split("\n");
  const tokens: ReactNode[] = [];

  lines.forEach((line, li) => {
    if (li > 0) tokens.push(<span key={`nl-${li}`}>{"\n"}</span>);
    // Simple word-boundary split
    const parts = line.split(/([\s{}().,;:!?<>"'=+\-*/|[\]&%@^~]+)/);
    parts.forEach((part, pi) => {
      if (keywords.has(part)) {
        tokens.push(<span key={`kw-${li}-${pi}`} className="text-purple-400">{part}</span>);
      } else if (/^"|^'|^`/.test(part)) {
        tokens.push(<span key={`s-${li}-${pi}`} className="text-green">{part}</span>);
      } else if (/^\d/.test(part)) {
        tokens.push(<span key={`n-${li}-${pi}`} className="text-amber-400">{part}</span>);
      } else if (/^[A-Z]/.test(part)) {
        tokens.push(<span key={`c-${li}-${pi}`} className="text-cyan-400">{part}</span>);
      } else {
        tokens.push(<span key={`t-${li}-${pi}`}>{part}</span>);
      }
    });
  });
  return tokens;
}

/** Highlight SQL keywords */
function highlightSQL(code: string): ReactNode[] {
  const keywords = new Set(["SELECT","FROM","WHERE","INSERT","INTO","VALUES","UPDATE","SET","DELETE","CREATE","ALTER","DROP","TABLE","INDEX","JOIN","LEFT","RIGHT","INNER","ON","AND","OR","NOT","NULL","IS","IN","LIKE","BETWEEN","AS","ORDER","BY","GROUP","HAVING","LIMIT","OFFSET","DISTINCT","COUNT","SUM","AVG","MAX","MIN","PRIMARY","KEY","FOREIGN","REFERENCES","DEFAULT","CHECK","UNIQUE","CONSTRAINT","ADD","COLUMN","IF","EXISTS","CASCADE","RESTRICT","TRIGGER","FUNCTION","RETURNS","LANGUAGE","BEGIN","END","DECLARE","EXECUTE","USING","WITH","RECURSIVE","UNION","ALL","EXCEPT","INTERSECT","CASE","WHEN","THEN","ELSE","END","TRUE","FALSE","INT","INTEGER","TEXT","BOOLEAN","UUID","TIMESTAMP","JSONB","ARRAY"]);
  const lines = code.split("\n");
  const tokens: ReactNode[] = [];

  lines.forEach((line, li) => {
    if (li > 0) tokens.push(<span key={`nl-${li}`}>{"\n"}</span>);
    const parts = line.split(/([\s()=';,.*+<>!]+)/);
    parts.forEach((part, pi) => {
      if (keywords.has(part.toUpperCase())) {
        tokens.push(<span key={`kw-${li}-${pi}`} className="text-purple-400 font-bold">{part}</span>);
      } else if (/^'/.test(part)) {
        tokens.push(<span key={`s-${li}-${pi}`} className="text-green">{part}</span>);
      } else if (/^\d/.test(part)) {
        tokens.push(<span key={`n-${li}-${pi}`} className="text-amber-400">{part}</span>);
      } else if (/^--/.test(part)) {
        tokens.push(<span key={`c-${li}-${pi}`} className="text-mut italic">{part}</span>);
      } else {
        tokens.push(<span key={`t-${li}-${pi}`}>{part}</span>);
      }
    });
  });
  return tokens;
}

/** Wrapper for code blocks with language label and copy button */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const detected = language || detectLanguage(code.split("\n"));

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [code]);

  // Choose highlighter
  let highlighted: ReactNode;
  if (detected === "JSON") {
    highlighted = <>{highlightJSON(code)}</>;
  } else if (detected === "JS" || detected === "TS") {
    highlighted = <>{highlightJS(code)}</>;
  } else if (detected === "SQL") {
    highlighted = <>{highlightSQL(code)}</>;
  } else {
    highlighted = code;
  }

  return (
    <div className="my-4 rounded-xl border border-line/15 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-panel3/60 px-4 py-1.5">
        <span className="text-[11px] font-bold text-mut uppercase tracking-wide">
          {detected || "Code"}
        </span>
        <button
          onClick={handleCopy}
          className="text-[11px] font-bold text-mut hover:text-acc transition"
        >
          {copied ? "✓ Copied" : "📋 Copy"}
        </button>
      </div>
      {/* Code body */}
      <pre className="overflow-x-auto bg-deep/40 p-4">
        <code className="text-[12.5px] leading-relaxed font-mono text-ink/90">
          {highlighted}
        </code>
      </pre>
    </div>
  );
}

/** Count code lines in a block */
function codeLineRatio(lines: string[]): number {
  if (lines.length === 0) return 0;
  const codeCount = lines.filter(l => isCodeLine(l)).length;
  return codeCount / lines.length;
}

/** Split markdown into blocks and render as safe React elements */
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let listItems: { text: string; ordered: boolean }[] = [];
  let buffer: string[] = []; // accumulate non-list lines for code detection

  const flushList = () => {
    if (listItems.length > 0) {
      const isOrdered = listItems[0].ordered;
      elements.push(
        isOrdered ? (
          <ol key={`ol-${elements.length}`} className="ml-5 mb-3 list-decimal space-y-1">
            {listItems.map((li, i) => (
              <li key={i} className="text-[13px] text-ink/85 leading-relaxed">{inlineMarkdown(li.text)}</li>
            ))}
          </ol>
        ) : (
          <ul key={`ul-${elements.length}`} className="ml-5 mb-3 list-disc space-y-1">
            {listItems.map((li, i) => (
              <li key={i} className="text-[13px] text-ink/85 leading-relaxed">{inlineMarkdown(li.text)}</li>
            ))}
          </ul>
        )
      );
      listItems = [];
    }
  };

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    if (buffer.length >= 2 && codeLineRatio(buffer) >= 0.5) {
      const codeText = buffer.join("\n");
      elements.push(
        <CodeBlock key={`code-${elements.length}`} code={codeText} />
      );
    } else {
      buffer.forEach((line, idx) => {
        if (line.trim() === "") return;
        if (line.startsWith("### ")) {
          elements.push(
            <h3 key={`h3-${elements.length}-${idx}`} className="mt-5 mb-2 text-[15px] font-extrabold text-ink">
              {inlineMarkdown(line.slice(4))}
            </h3>
          );
        } else if (line.startsWith("## ")) {
          elements.push(
            <h2 key={`h2-${elements.length}-${idx}`} className="mt-7 mb-3 text-[17px] font-extrabold text-ink border-b border-line/10 pb-1">
              {inlineMarkdown(line.slice(3))}
            </h2>
          );
        } else {
          elements.push(
            <p key={`p-${elements.length}-${idx}`} className="mb-3 text-[13px] text-ink/85 leading-relaxed">
              {inlineMarkdown(line)}
            </p>
          );
        }
      });
    }
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Explicit ``` code fences
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        const lang = codeLines.length > 0 ? undefined : undefined; // language detected by CodeBlock
        elements.push(
          <CodeBlock key={`code-${elements.length}`} code={codeLines.join("\n")} />
        );
        inCodeBlock = false;
        codeLines = [];
        continue;
      }
      flushList();
      flushBuffer();
      inCodeBlock = true;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Empty line = paragraph break
    if (line.trim() === "") {
      flushList();
      flushBuffer();
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      flushList();
      flushBuffer();
      elements.push(
        <h3 key={`h3-${elements.length}`} className="mt-5 mb-2 text-[15px] font-extrabold text-ink">
          {inlineMarkdown(line.slice(4))}
        </h3>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      flushBuffer();
      elements.push(
        <h2 key={`h2-${elements.length}`} className="mt-7 mb-3 text-[17px] font-extrabold text-ink border-b border-line/10 pb-1">
          {inlineMarkdown(line.slice(3))}
        </h2>
      );
      continue;
    }

    // Lists
    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushBuffer();
      listItems.push({ text: line.slice(2), ordered: false });
      continue;
    }

    const orderedMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (orderedMatch) {
      flushBuffer();
      listItems.push({ text: orderedMatch[2], ordered: true });
      continue;
    }

    // Code-like lines → buffer for batch detection
    if (isCodeLine(line)) {
      flushList();
      buffer.push(line);
      continue;
    }

    // Regular text → flush buffer and add paragraph
    flushList();
    flushBuffer();
    elements.push(
      <p key={`p-${elements.length}`} className="mb-3 text-[13px] text-ink/85 leading-relaxed">
        {inlineMarkdown(line)}
      </p>
    );
  }

  flushList();
  flushBuffer();

  return <>{elements}</>;
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function SourceBadge({ article }: { article: Article }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-mut">
      <span className="font-bold text-acc">{article.sourceName}</span>
      <span>·</span>
      <a href={article.sourceUrl} target="_blank" rel="noopener" className="hover:underline text-ink/60">
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
    <div className="rounded-lg bg-panel2/50 p-3">
      <h4 className="mb-2 text-[12px] font-extrabold text-ink">📑 In this article</h4>
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
          <li key={i} className="flex gap-2 text-[12.5px] text-ink/85">
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
    <div className="rounded-lg bg-panel2/50 p-4">
      <h4 className="mb-2 text-[13px] font-extrabold text-ink">📖 Glossary</h4>
      <dl className="space-y-2">
        {terms.map((t, i) => (
          <div key={i} className="text-[12px]">
            <dt className="font-bold text-acc">{t.term}</dt>
            <dd className="ml-3 text-ink/75">{t.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DifficultySelector({ level, onChange }: { level: DifficultyLevel; onChange: (l: DifficultyLevel) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-panel2/50 p-1">
      {(["beginner", "intermediate", "advanced"] as DifficultyLevel[]).map((l) => {
        const config = DIFFICULTY_CONFIG[l];
        return (
          <button
            key={l}
            onClick={() => onChange(l)}
            className={`flex-1 rounded-md px-3 py-2 text-[12px] font-bold transition ${
              level === l ? "bg-acc text-white shadow-sm" : "text-ink hover:bg-panel3 hover:text-acc"
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
  const hasRefined = Boolean(refined?.beginner);

  const currentContent = hasRefined ? refined![difficulty] : article.content;

  const preview = article.summary || (hasRefined
    ? refined!.beginner.replace(/[#*`[\]]/g, "").slice(0, 200) + "..."
    : article.content.replace(/[#*`[\]]/g, "").slice(0, 200) + "...");

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
              {hasRefined ? (
                <span className="rounded bg-acc/15 px-1.5 py-0.5 text-[10px] font-bold text-acc">✨ AI Refined</span>
              ) : (
                <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-bold text-warn">⏳ Needs refinement</span>
              )}
            </div>
            <SourceBadge article={article} />
            <p className="mt-2 text-[13px] text-ink/80 leading-relaxed line-clamp-2">{preview}</p>
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
        <div className="border-t border-line/10 bg-panel2/50 px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <a href={article.sourceUrl} target="_blank" rel="noopener"
              className="rounded-lg bg-acc px-4 py-1.5 text-[12px] font-bold text-white hover:opacity-90 transition">
              🔗 Read original
            </a>
            <button onClick={() => navigator.clipboard.writeText(article.sourceUrl).catch(() => {})}
              className="rounded-lg bg-panel3 px-4 py-1.5 text-[12px] font-bold text-ink hover:bg-panel2 transition">
              📋 Copy link
            </button>
          </div>

          {hasRefined ? (
            <>
              <DifficultySelector level={difficulty} onChange={setDifficulty} />
              <p className="text-[11px] text-mut italic">{DIFFICULTY_CONFIG[difficulty].desc}</p>
              {refined!.tableOfContents.length > 0 && <TableOfContents items={refined!.tableOfContents} />}
              <div className="rounded-lg bg-panel2/50 p-4">
                <MarkdownContent text={currentContent} />
              </div>
              <KeyTakeaways takeaways={refined!.keyTakeaways} />
              {refined!.glossary.length > 0 && (
                <div>
                  <button onClick={(e) => { e.stopPropagation(); setShowGlossary(!showGlossary); }}
                    className="text-[12px] font-bold text-acc hover:underline">
                    {showGlossary ? "▾ Hide" : "▸ Show"} Glossary ({refined!.glossary.length} terms)
                  </button>
                  {showGlossary && <Glossary terms={refined!.glossary} />}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-warn/20 bg-warn/5 p-3 text-[12px] text-ink">
                <span className="font-bold">⏳ This article needs AI refinement.</span> Admins can click "✨ Refine" in Content Pipeline to generate progressive difficulty levels, key takeaways, and a glossary.
              </div>
              <div className="rounded-lg bg-panel2/50 p-4">
                <MarkdownContent text={currentContent} />
              </div>
              {article.content.length > 3000 && (
                <p className="text-[11px] text-mut">📄 Full article ({(article.content.length / 1000).toFixed(1)}K characters)</p>
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
          content: decodeText(String(r.content)),
          contentRefined: parseRefined(r.content_refined),
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
          <p className="mt-2 text-[14px] text-mut">Curated content will appear here once approved by admins.</p>
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
          Quality-checked content from trusted sources — each article is refined into
          progressive difficulty levels for effective learning.
        </p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search articles..."
          className="w-full rounded-xl border border-line/15 bg-panel2/50 px-4 py-2.5 text-[13px] text-ink placeholder:text-mut focus:border-acc focus:outline-none"
        />
      </div>

      {fields.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1 text-[12px] font-bold transition ${filter === "all" ? "bg-acc text-white" : "bg-panel3 text-ink hover:bg-panel2"}`}>
            All ({articles.length})
          </button>
          {fields.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-[12px] font-bold transition ${filter === f ? "bg-acc text-white" : "bg-panel3 text-ink hover:bg-panel2"}`}>
              {f} ({articles.filter(a => a.fieldId === f).length})
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3 text-[11px] text-mut">
        {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
          <span key={key}>{config.icon} <span className={config.color}>{config.label}</span> — {config.desc}</span>
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
