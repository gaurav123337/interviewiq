/* articleExtract — shared server-side article extraction (no DOM). Pulls a
   readable title/author/body out of raw HTML with regex only, preserving
   <pre>/<code> as markdown fences. No Deno globals, so the client vitest
   corpus imports this exact file (same dual-runtime pattern as safeFetch.ts /
   importPage.ts). Used by content-scrape (admin-curated sources) today; the
   upcoming article-fetch function (user-pasted URLs) will share this same
   hardened parser. */

export function extractArticle(html: string, url: string): { title: string; content: string; author: string | null } {
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

  // Clean to text — preserve code blocks before stripping tags
  // First, wrap <pre> and <code> content in markers so they survive tag stripping
  const preserved = articleHtml
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, inner: string) => {
      // Decode HTML entities inside code blocks
      const decoded = inner
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, "/")
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean)
        .join("\n");
      return `\nCODE_BLOCK_START\n${decoded}\nCODE_BLOCK_END\n`;
    })
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner: string) => {
      // Inline code — keep on one line, wrapped in a single backtick pair
      const decoded = inner
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
      return `\`${decoded}\``;
    })
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
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean)
    .join("\n");

  // Now restore CODE_BLOCK markers as proper markdown code fences
  const content = preserved
    .replace(/CODE_BLOCK_START\n([\s\S]*?)\nCODE_BLOCK_END/g, (_m: string, code: string) => {
      // Detect language from content
      let lang = "";
      const sample = code.slice(0, 200).trim();
      if (/^[{[]/.test(sample) && /[}\]]\s*$/.test(sample.slice(-50))) lang = "json";
      else if (/^(import|export|const|let|function|class)\b/.test(sample)) lang = "js";
      else if (/^(SELECT|INSERT|CREATE|ALTER|DROP)\b/i.test(sample)) lang = "sql";
      else if (/^(def |class |import )/.test(sample)) lang = "python";
      else if (/^(fn |let mut |pub |struct )/.test(sample)) lang = "rust";
      return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    });

  return { title, content, author };
}
