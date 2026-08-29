/* Articles — Public page showing approved curated content.
   Fetches approved items from content_items table and displays
   them with progressive difficulty levels (Beginner -> Intermediate -> Advanced),
   table of contents, key takeaways, and source attribution.

   Uses safe React text rendering with proper escaping. */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getSupabaseClient } from "../services/cloud";
import { normalizeUserArticle, listUserArticles, deleteUserArticle, estimateTokenCost, type NormalizedArticle } from "../services/articleNormalizer";
import { fire } from "../services/notifications";
import { cardCls, Chip } from "./ui";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface CodeSection {
  language: string;
  code: string;
  description: string;
}

interface RefinedContent {
  beginner: string;
  intermediate: string;
  advanced: string;
  tableOfContents: string[];
  keyTakeaways: string[];
  glossary: { term: string; definition: string }[];
  estimatedReadMinutes: number;
  summary_ai?: string;
  keywords?: string[];
  code_sections?: CodeSection[];
  read_time_beginner?: number;
  read_time_intermediate?: number;
  read_time_advanced?: number;
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
      summary_ai: obj.summary_ai ? String(obj.summary_ai) : undefined,
      keywords: Array.isArray(obj.keywords) ? obj.keywords.map(String).filter(Boolean) : [],
      code_sections: Array.isArray(obj.code_sections)
        ? obj.code_sections.map((s: Record<string, unknown>) => ({
            language: String(s.language || "text"),
            code: String(s.code || ""),
            description: String(s.description || ""),
          }))
        : [],
      read_time_beginner: Number(obj.read_time_beginner) || undefined,
      read_time_intermediate: Number(obj.read_time_intermediate) || undefined,
      read_time_advanced: Number(obj.read_time_advanced) || undefined,
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
          <code key={key++} className="rounded bg-panel3 px-1.5 py-0.5 text-[12px] text-acc font-mono">
            {earliest.match[1]}
          </code>
        );
        break;
      case "bold":
        parts.push(<strong key={key++} className="font-bold text-ink">{earliest.match[1]}</strong>);
        break;
      case "italic":
        parts.push(<em key={key++} className="italic text-ink">{earliest.match[1]}</em>);
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
  // JSON structure tokens
  if (/^[{\[]/.test(trimmed) && /[}\]],?$/.test(trimmed)) return true;
  if (/^"[^"]+"\s*[:=]/.test(trimmed)) return true;
  // Bare string values (e.g. just "error" on a line)
  if (/^"[^"]*"\s*$/.test(trimmed)) return true;
  if (/^'[^']*'\s*$/.test(trimmed)) return true;
  // JSON punctuation tokens (: , } ] [ {)
  if (/^[,:;{}\[\]()\n]+$/i.test(trimmed)) return true;
  // Single punctuation chars
  if (trimmed.length === 1 && /[:,;{}\[\]().]/.test(trimmed)) return true;
  // Programming keywords
  if (/^import\s/.test(trimmed) || /^export\s/.test(trimmed) || /^from\s/.test(trimmed)) return true;
  if (/^const\s|^let\s|^var\s|^function\s|^class\s|^interface\s|^type\s/.test(trimmed)) return true;
  if (/^(if|else|for|while|return|throw|try|catch|switch|case|break)\b/.test(trimmed)) return true;
  // Braces and parens on their own line
  if (/^[}\])\]>]+$/.test(trimmed)) return true;
  if (/^[{\[(<]+$/.test(trimmed)) return true;
  if (/^\)\s*;?$/.test(trimmed)) return true;
  // Function call pattern
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

/** Count code-like lines in an array (skipping empty lines) */
function countCodeLines(lines: string[]): number {
  return lines.filter(l => l.trim() && isCodeLine(l)).length;
}

/** Check if a block of lines looks like a code structure (JSON, JS, etc.) */
function isLikelyCodeBlock(lines: string[]): boolean {
  if (lines.length < 2) return false;
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length < 2) return false;
  const codeCount = countCodeLines(lines);
  return codeCount / nonEmpty.length >= 0.45;
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


/**
 * Pre-scan: identify code regions in the content.
 * Returns a set of line indices that belong to code blocks.
 * Handles the case where JSON tokens are on separate lines with blank lines between them.
 */
function findCodeRegions(lines: string[]): Set<number> {
  const codeLines = new Set<number>();

  // Pass 1: Mark lines that are clearly code
  const isCode: boolean[] = lines.map(l => isCodeLine(l));

  // Pass 2: Find runs of code lines (allowing up to 2 blank lines between code lines)
  let runStart = -1;
  let runEnd = -1;
  let lastCodeIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (isCode[i]) {
      if (runStart === -1) runStart = i;
      runEnd = i;
      lastCodeIdx = i;
    } else if (lines[i].trim() === "") {
      // Blank line — check if there's code within the next 3 lines
      let foundNextCode = false;
      for (let j = i + 1; j < Math.min(i + 7, lines.length); j++) {
        if (isCode[j]) { foundNextCode = true; break; }
      }
      if (foundNextCode && runStart !== -1) {
        runEnd = i; // include the blank line in the run
        lastCodeIdx = i;
      }
    } else {
      // Non-code, non-blank line — flush the run if it's long enough
      if (runStart !== -1 && runEnd - runStart >= 1) {
        const runLines = lines.slice(runStart, runEnd + 1);
        if (isLikelyCodeBlock(runLines)) {
          for (let k = runStart; k <= runEnd; k++) codeLines.add(k);
        }
      }
      runStart = -1;
      runEnd = -1;
    }
  }

  // Flush final run
  if (runStart !== -1 && runEnd - runStart >= 1) {
    const runLines = lines.slice(runStart, runEnd + 1);
    if (isLikelyCodeBlock(runLines)) {
      for (let k = runStart; k <= runEnd; k++) codeLines.add(k);
    }
  }

  // Pass 3: If we found code regions, also merge adjacent blank lines
  const expanded = new Set<number>();
  codeLines.forEach(idx => expanded.add(idx));
  codeLines.forEach(idx => {
    // Expand to include surrounding blank lines
    if (idx > 0 && lines[idx - 1].trim() === "") expanded.add(idx - 1);
    if (idx < lines.length - 1 && lines[idx + 1].trim() === "") expanded.add(idx + 1);
  });

  return expanded;
}

/** Preprocess raw scraped text into markdown when no formatting is detected.
 *  Auto-promotes questions/titles to headings, adds paragraph breaks, etc. */
function preprocessRawText(text: string): string {
  // If the text already has markdown headings, leave it alone
  if (/^#{1,6}\s/m.test(text) || /^```/m.test(text) || /^\s*[-*]\s/m.test(text)) {
    return text;
  }

  const lines = text.split("\n");
  const processed: string[] = [];
  let prevBlank = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (!prevBlank) processed.push("");
      prevBlank = true;
      continue;
    }
    prevBlank = false;

    // Detect questions → headings
    if (/^(How|What|Why|Where|When|Which|Who)\b/.test(trimmed) && trimmed.endsWith("?") && trimmed.length < 120) {
      processed.push("");
      processed.push("### " + trimmed);
      processed.push("");
      continue;
    }

    // Detect short standalone lines that look like section titles (all caps, or Title Case, short)
    if (trimmed.length < 60 && !trimmed.endsWith(".") && !trimmed.endsWith(",") &&
        /^[A-Z]/.test(trimmed) && (trimmed === trimmed.toUpperCase() || /^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/.test(trimmed))) {
      processed.push("");
      processed.push("### " + trimmed);
      processed.push("");
      continue;
    }

    // Detect list-like patterns
    if (/^\d+[.)]\s/.test(trimmed) || /^[-*]\s/.test(trimmed)) {
      processed.push(trimmed);
      continue;
    }

    // Regular text — add as paragraph
    processed.push(trimmed);
  }

  return processed.join("\n");
}

/** Split markdown into blocks and render as safe React elements */
function MarkdownContent({ text }: { text: string }) {
  // Preprocess raw text to add structure
  const preprocessed = preprocessRawText(text);
  const lines = preprocessed.split("\n");
  const elements: ReactNode[] = [];
  let inExplicitCodeBlock = false;
  let explicitCodeLines: string[] = [];
  let listItems: { text: string; ordered: boolean }[] = [];
  let keyCounter = 0;

  // Pre-scan for auto-detected code regions
  const codeRegions = findCodeRegions(lines);

  // If most of the content looks like scattered code tokens, treat the ENTIRE thing as code
  const totalCodeLines = lines.filter(l => isCodeLine(l)).length;
  const totalNonEmpty = lines.filter(l => l.trim()).length;
  const isMostlyCode = totalNonEmpty > 5 && totalCodeLines / totalNonEmpty > 0.35;

  if (isMostlyCode && !text.includes("```")) {
    // The whole content is broken code tokens — render as a single code block
    return <CodeBlock code={text} />;
  }

  const flushList = () => {
    if (listItems.length > 0) {
      const isOrdered = listItems[0].ordered;
      elements.push(
        isOrdered ? (
          <ol key={`ol-${keyCounter++}`} className="ml-5 mb-3 list-decimal space-y-1">
            {listItems.map((li, i) => (
              <li key={i} className="text-[13px] text-ink leading-relaxed">{inlineMarkdown(li.text)}</li>
            ))}
          </ol>
        ) : (
          <ul key={`ul-${keyCounter++}`} className="ml-5 mb-3 list-disc space-y-1">
            {listItems.map((li, i) => (
              <li key={i} className="text-[13px] text-ink leading-relaxed">{inlineMarkdown(li.text)}</li>
            ))}
          </ul>
        )
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Explicit ``` code fences
    if (line.trim().startsWith("```")) {
      if (inExplicitCodeBlock) {
        elements.push(
          <CodeBlock key={`code-${keyCounter++}`} code={explicitCodeLines.join("\n")} />
        );
        inExplicitCodeBlock = false;
        explicitCodeLines = [];
        continue;
      }
      flushList();
      inExplicitCodeBlock = true;
      explicitCodeLines = [];
      continue;
    }

    if (inExplicitCodeBlock) {
      explicitCodeLines.push(line);
      continue;
    }

    // Skip lines that are part of auto-detected code regions
    if (codeRegions.has(i)) {
      flushList();
      // Collect all consecutive code-region lines
      const codeBlockLines: string[] = [];
      while (i < lines.length && codeRegions.has(i)) {
        // Skip explicit ``` fences that might be in the region
        if (lines[i].trim().startsWith("```") && codeBlockLines.length === 0) {
          inExplicitCodeBlock = true;
          break;
        }
        codeBlockLines.push(lines[i]);
        i++;
      }
      i--; // back up one since the for-loop will increment
      if (codeBlockLines.length > 0) {
        // Clean leading/trailing blank lines from the code block
        let start = 0;
        let end = codeBlockLines.length;
        while (start < end && codeBlockLines[start].trim() === "") start++;
        while (end > start && codeBlockLines[end - 1].trim() === "") end--;
        const cleaned = codeBlockLines.slice(start, end);
        if (cleaned.length > 0) {
          elements.push(
            <CodeBlock key={`code-${keyCounter++}`} code={cleaned.join("\n")} />
          );
        }
      }
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
        <h3 key={`h3-${keyCounter++}`} className="mt-5 mb-2 text-[15px] font-extrabold text-fnt">
          {inlineMarkdown(line.slice(4))}
        </h3>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${keyCounter++}`} className="mt-7 mb-3 text-[17px] font-extrabold text-fnt border-b border-line/20 pb-1">
          {inlineMarkdown(line.slice(3))}
        </h2>
      );
      continue;
    }

    // Lists
    if (line.startsWith("- ") || line.startsWith("* ")) {
      listItems.push({ text: line.slice(2), ordered: false });
      continue;
    }

    const orderedMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (orderedMatch) {
      listItems.push({ text: orderedMatch[2], ordered: true });
      continue;
    }

    // Regular text
    flushList();
    elements.push(
      <p key={`p-${keyCounter++}`} className="mb-3 text-[13px] text-ink leading-relaxed">
        {inlineMarkdown(line)}
      </p>
    );
  }

  flushList();

  return <>{elements}</>;
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function SourceBadge({ article }: { article: Article }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-mut">
      <span className="font-bold text-acc">{article.sourceName}</span>
      <span>·</span>
      <a href={article.sourceUrl} target="_blank" rel="noopener" className="hover:underline text-mut">
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
          <li key={i} className="flex gap-2 text-[12.5px] text-ink">
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
            <dd className="ml-3 text-ink">{t.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DifficultySelector({ level, onChange }: { level: DifficultyLevel; onChange: (l: DifficultyLevel) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-panel2 p-1">
      {(["beginner", "intermediate", "advanced"] as DifficultyLevel[]).map((l) => {
        const config = DIFFICULTY_CONFIG[l];
        return (
          <button
            key={l}
            onClick={() => onChange(l)}              className={`flex-1 rounded-md px-3 py-2 text-[12px] font-bold transition ${
              level === l ? "bg-acc text-white shadow-sm" : "text-fnt hover:bg-panel3 hover:text-acc"}`}
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
  const keywords = refined?.keywords || [];
  const codeSections = refined?.code_sections || [];

  const currentContent = hasRefined ? refined![difficulty] : article.content;

  // Use AI summary if available, then DB summary, then auto-generated preview
  // Clean up any JSON-wrapped summaries that slipped through
  const cleanSummary = (s: string | null | undefined): string => {
    if (!s) return "";
    const trimmed = s.trim();
    // If it looks like JSON with a summary field, extract just the summary text
    if (trimmed.startsWith("{") && trimmed.includes('"summary"')) {
      const match = trimmed.match(/"summary"\s*:\s*"([^"]+)"/);
      if (match) return match[1];
    }
    // Also try parsing as JSON and extracting summary field
    if (trimmed.startsWith("{") && trimmed.length < 1000) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj && typeof obj.summary === "string") return obj.summary;
        if (typeof obj === "object") return ""; // Don't show raw JSON objects
      } catch { /* not valid JSON, use as-is */ }
    }
    return trimmed;
  };
  const preview = cleanSummary(refined?.summary_ai) || cleanSummary(article.summary) || (hasRefined
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
            <p className="mt-2 text-[13px] text-ink leading-relaxed line-clamp-2">{preview}</p>
            {/* Keywords from normalization */}
            {keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {keywords.slice(0, 8).map(kw => (
                  <span key={kw} className="rounded-md bg-acc/10 px-2 py-0.5 text-[10px] font-bold text-acc">{kw}</span>
                ))}
                {keywords.length > 8 && (
                  <span className="text-[10px] text-mut">+{keywords.length - 8} more</span>
                )}
              </div>
            )}
            {/* Source tags */}
            {article.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {article.tags.map(tag => <Chip key={tag} tone="cat">{tag}</Chip>)}
              </div>
            )}
            {/* Code sections + read time badges */}
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-mut">
              {codeSections.length > 0 && (
                <span className="rounded-md bg-purple-400/10 px-1.5 py-0.5 font-bold text-purple-400">
                  💻 {codeSections.length} code example{codeSections.length !== 1 ? 's' : ''}
                </span>
              )}
              {refined?.read_time_beginner != null && (
                <span className="text-green">
                  🌱 {refined.read_time_beginner} min
                </span>
              )}
              {refined?.read_time_intermediate != null && (
                <span className="text-acc">
                  🔧 {refined.read_time_intermediate} min
                </span>
              )}
              {refined?.read_time_advanced != null && (
                <span className="text-purple-400">
                  🚀 {refined.read_time_advanced} min
                </span>
              )}
            </div>
          </div>
          <span className="text-[14px] text-mut shrink-0 mt-1">{expanded ? "▾" : "▸"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-line/20 bg-panel2/50 px-5 py-4 space-y-4">
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

          {/* Code Sections from normalization */}
          {codeSections.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[12px] font-extrabold text-ink">💻 Code Examples ({codeSections.length})</h4>
              {codeSections.map((cs, i) => (
                <CodeBlock key={i} code={cs.code} language={cs.language} />
              ))}
            </div>
          )}

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

/* ── User Article Understand Modal ─────────────────────────────────── */

interface UnderstandModalProps {
  open: boolean;
  onClose: () => void;
  onResult: (normalized: NormalizedArticle, title: string) => void;
}

function UnderstandModal({ open, onClose, onResult }: UnderstandModalProps) {
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const contentLength = mode === "url" ? 0 : text.length;
  const tokenEst = estimateTokenCost(contentLength);

  const canSubmit = mode === "url" ? url.trim().length > 10 : text.trim().length > 100;

  const handleSubmit = async () => {
    if (!canSubmit || processing) return;
    setProcessing(true);
    setProgress("Fetching article...");

    try {
      let articleText = text;
      let articleTitle = title || url;

      // If URL, try to fetch content
      if (mode === "url") {
        setProgress("Fetching article from URL...");
        // For now, use the URL as a reference — user can paste text if fetch fails
        articleText = text || url;
        if (!title) articleTitle = new URL(url).hostname;
      }

      setProgress("🤖 AI is analyzing and normalizing the article...");
      const result = await normalizeUserArticle({
        url: mode === "url" ? url : undefined,
        text: articleText,
        title: articleTitle,
      });

      if (result.success && result.normalized) {
        onResult(result.normalized, articleTitle);
        fire("✅ Article normalized", "Your article has been normalized with AI levels, keywords, and code sections.");
        setUrl("");
        setText("");
        setTitle("");
        onClose();
      } else {
        fire("❌ Normalization failed", result.error || "Unknown error");
      }
    } catch (e) {
      fire("❌ Error", (e as Error).message || "Something went wrong");
    } finally {
      setProcessing(false);
      setProgress("");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-line/20 bg-surface shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/10 px-6 py-4">
          <div>
            <h2 className="text-[16px] font-extrabold text-ink">🧠 Understand this article</h2>
            <p className="text-[11px] text-mut">AI will analyze and create structured learning levels</p>
          </div>
          <button onClick={onClose} className="text-[20px] text-mut hover:text-ink transition">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-1 rounded-lg bg-panel2 p-1">
            <button
              onClick={() => setMode("url")}
              className={`flex-1 rounded-md px-3 py-2 text-[12px] font-bold transition ${
                mode === "url" ? "bg-acc text-white" : "text-ink hover:bg-panel3"
              }`}
            >
              🔗 Paste URL
            </button>
            <button
              onClick={() => setMode("text")}
              className={`flex-1 rounded-md px-3 py-2 text-[12px] font-bold transition ${
                mode === "text" ? "bg-acc text-white" : "text-ink hover:bg-panel3"
              }`}
            >
              📄 Paste text
            </button>
          </div>

          {/* Title (optional) */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Article title (optional)"
            className="w-full rounded-lg border border-line/15 bg-panel2/50 px-3 py-2 text-[13px] text-ink placeholder:text-mut focus:border-acc focus:outline-none"
          />

          {/* URL input */}
          {mode === "url" && (
            <div className="space-y-2">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/article..."
                className="w-full rounded-lg border border-line/15 bg-panel2/50 px-3 py-2 text-[13px] text-ink placeholder:text-mut focus:border-acc focus:outline-none"
              />
              <p className="text-[10px] text-mut">Paste the article text below if the URL can't be auto-fetched</p>
              <textarea
                ref={textRef}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Optional: paste the article text here for better results..."
                className="h-32 w-full resize-none rounded-lg border border-line/15 bg-panel2/50 px-3 py-2 text-[12px] text-ink placeholder:text-mut focus:border-acc focus:outline-none"
              />
            </div>
          )}

          {/* Text input */}
          {mode === "text" && (
            <textarea
              ref={textRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste the full article text here..."
              className="h-48 w-full resize-none rounded-lg border border-line/15 bg-panel2/50 px-3 py-2 text-[12px] text-ink placeholder:text-mut focus:border-acc focus:outline-none"
            />
          )}

          {/* Token cost estimate */}
          {contentLength > 0 && (
            <div className="rounded-lg bg-panel2/50 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-mut">📊 Estimated token usage:</span>
                <span className="font-bold text-acc">{tokenEst.estimatedCost}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-mut">
                <span>Input: ~{tokenEst.inputTokens} tokens</span>
                <span>Output: ~{tokenEst.outputTokens} tokens</span>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="rounded-lg border border-warn/20 bg-warn/5 p-3 text-[11px] text-ink">
            <span className="font-bold">⚠️ This will use AI tokens.</span> The normalized article will be saved to your personal collection (private, not shared with other users).
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line/10 px-6 py-3">
          <span className="text-[11px] text-mut">{contentLength > 0 ? `${(contentLength / 1000).toFixed(1)}K chars` : ""}</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-panel3 px-4 py-2 text-[12px] font-bold text-ink hover:bg-panel2 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || processing}
              className={`rounded-lg px-5 py-2 text-[12px] font-bold transition ${
                canSubmit && !processing
                  ? "bg-acc text-white hover:opacity-90"
                  : "cursor-not-allowed bg-panel3 text-mut"
              }`}
            >
              {processing ? progress || "⏳ Processing..." : "🧠 Normalize with AI"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── User Article Card ──────────────────────────────────────────────── */

function UserArticleCard({ article, onDelete }: { article: { id: string; title: string; url: string | null; normalized: NormalizedArticle; createdAt: string }; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("beginner");
  const [showGlossary, setShowGlossary] = useState(false);
  const n = article.normalized;

  const currentContent = n[difficulty];

  return (
    <div className={`${cardCls} overflow-hidden border-acc/20`}>
      <div className="cursor-pointer p-4" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-extrabold leading-tight">🧠 {article.title}</h3>
              <span className="rounded bg-green/15 px-1.5 py-0.5 text-[10px] font-bold text-green">✅ Normalized</span>
            </div>
            <p className="mt-1 text-[12px] text-ink line-clamp-1">{n.summary}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {n.keywords.slice(0, 6).map(kw => (
                <span key={kw} className="rounded bg-acc/10 px-1.5 py-0.5 text-[9px] font-bold text-acc">{kw}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); onDelete(article.id); }}
              className="text-[12px] text-mut hover:text-err transition"
              title="Delete"
            >
              🗑
            </button>
            <span className="text-[12px] text-mut">{expanded ? "▾" : "▸"}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-line/20 bg-panel2/50 px-4 py-3 space-y-3">
          <DifficultySelector level={difficulty} onChange={setDifficulty} />
          <p className="text-[10px] text-mut italic">{DIFFICULTY_CONFIG[difficulty].desc}</p>
          {n.keyTakeaways.length > 0 && <KeyTakeaways takeaways={n.keyTakeaways} />}
          {n.codeSections.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-extrabold text-ink">💻 Code Examples ({n.codeSections.length})</h4>
              {n.codeSections.map((cs, i) => (
                <CodeBlock key={i} code={cs.code} language={cs.language} />
              ))}
            </div>
          )}
          <div className="rounded-lg bg-panel2/50 p-3">
            <MarkdownContent text={currentContent} />
          </div>
          {n.glossary.length > 0 && (
            <div>
              <button onClick={e => { e.stopPropagation(); setShowGlossary(!showGlossary); }}
                className="text-[11px] font-bold text-acc hover:underline">
                {showGlossary ? "▾ Hide" : "▸ Show"} Glossary ({n.glossary.length} terms)
              </button>
              {showGlossary && <Glossary terms={n.glossary} />}
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
  const [keywordFilter, setKeywordFilter] = useState("");
  const [understandOpen, setUnderstandOpen] = useState(false);
  const [userArticles, setUserArticles] = useState<{ id: string; title: string; url: string | null; normalized: NormalizedArticle; createdAt: string }[]>([]);
  const [userArticlesLoading, setUserArticlesLoading] = useState(true);

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

  // Load user-normalized articles
  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      try {
        const items = await listUserArticles();
        if (!cancelled) setUserArticles(items);
      } catch { /* silent */ }
      finally { if (!cancelled) setUserArticlesLoading(false); }
    }
    void loadUser();
    return () => { cancelled = true; };
  }, []);

  const fields = [...new Set(articles.map(a => a.fieldId))];

  // Collect all keywords for filter buttons
  const allKeywords = [...new Set(articles.flatMap(a => a.contentRefined?.keywords || []))];

  const filtered = articles.filter(a => {
    const matchesFilter = filter === "all" || a.fieldId === filter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      a.title.toLowerCase().includes(q) ||
      (a.summary?.toLowerCase().includes(q) ?? false) ||
      a.sourceName.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q)) ||
      (a.contentRefined?.keywords || []).some(k => k.toLowerCase().includes(q));
    const matchesKeyword = !keywordFilter ||
      (a.contentRefined?.keywords || []).some(k => k.toLowerCase().includes(keywordFilter.toLowerCase()));
    return matchesFilter && matchesSearch && matchesKeyword;
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

  const handleDeleteUserArticle = async (id: string) => {
    try {
      await deleteUserArticle(id);
      setUserArticles(prev => prev.filter(a => a.id !== id));
      fire("🗑 Removed", "Article removed from your collection");
    } catch { /* silent */ }
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 pt-6 pb-12">
      {/* Understand Modal */}
      <UnderstandModal
        open={understandOpen}
        onClose={() => setUnderstandOpen(false)}
        onResult={(normalized, title) => {
          setUserArticles(prev => [{
            id: `temp-${Date.now()}`,
            title,
            url: null,
            normalized,
            createdAt: new Date().toISOString(),
          }, ...prev]);
        }}
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
            📰 Curated <span className="grad-text">Articles</span>
          </h1>
          <p className="mt-2 text-[14px] text-mut">
            Quality-checked content from trusted sources — each article is refined into
            progressive difficulty levels for effective learning.
          </p>
        </div>
        <button
          onClick={() => setUnderstandOpen(true)}
          className="shrink-0 rounded-xl bg-acc/15 px-4 py-2.5 text-[13px] font-bold text-acc hover:bg-acc/25 transition"
        >
          🧠 Understand any article
        </button>
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

      {/* Keyword filter */}
      {allKeywords.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[10px] font-bold text-mut uppercase tracking-wide">Filter by keyword</div>
          <div className="flex flex-wrap gap-1">
            {keywordFilter && (
              <button
                onClick={() => setKeywordFilter("")}
                className="rounded-md bg-err/15 px-2 py-0.5 text-[10px] font-bold text-err hover:bg-err/25 transition"
              >
                ✕ Clear
              </button>
            )}
            {allKeywords.slice(0, 15).map(kw => (
              <button
                key={kw}
                onClick={() => setKeywordFilter(kw === keywordFilter ? "" : kw)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
                  kw === keywordFilter
                    ? "bg-acc text-white"
                    : "bg-panel3 text-ink hover:bg-panel2"
                }`}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User's personal articles */}
      {!userArticlesLoading && userArticles.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-[14px] font-extrabold text-ink">🧠 Your Personal Articles ({userArticles.length})</h2>
          <p className="mb-3 text-[11px] text-mut">These are articles you've normalized — private to you.</p>
          <div className="space-y-2">
            {userArticles.map(ua => (
              <UserArticleCard key={ua.id} article={ua} onDelete={handleDeleteUserArticle} />
            ))}
          </div>
        </div>
      )}

      {/* Admin curated articles */}
      <div className="mb-2 text-[14px] font-extrabold text-ink">📰 Curated Articles ({filtered.length})</div>
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
