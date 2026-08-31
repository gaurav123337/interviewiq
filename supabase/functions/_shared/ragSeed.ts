/* ragSeed — pure parsing + chunking for the RAG starter corpus, shared by the
   seed-rag edge function and its Deno tests. Mirrors scripts/seed-rag.mjs's
   chunkDoc / estimateTokens so a UI-triggered seed produces the SAME chunks the
   CLI does.

   NO IO and NO Deno APIs: it takes the raw corpus text as input (never reads
   disk), so the permissionless `deno test supabase/functions/_shared/` CI gate
   can exercise every path. The raw markdown itself is baked into
   ../seed-rag/corpus.generated.ts by scripts/gen-rag-corpus.mjs. */

export interface SeedCorpusEntry {
  /** Source filename, e.g. "big-o-notation.md" — used for error reporting. */
  file: string;
  /** Raw markdown text of the file. */
  raw: string;
}

export interface SeedDoc {
  file: string;
  title: string;
  body: string;
  chunks: string[];
}

/** Host of the embeddings base URL, e.g. "api.openai.com" — mirrors content-index's
    hostOf so seeded chunks stamp embedding_provider the same way server indexing
    does. Falls back to the raw string when it isn't a parseable URL. */
export function hostOf(base: string): string {
  try { return new URL(base).host; } catch { return base; }
}

/** Rough token estimate (whitespace-collapsed chars / 4) — matches the client's
    estimateTokens and the CLI seeder, so token_count is consistent across paths. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.replace(/\s+/g, " ").length / 4);
}

/** Section-aware chunking: split at markdown H2 (`## `) headings, keeping each
    heading with its body, then split any oversized section at a sentence boundary
    near maxChars. Seed docs are short, so most yield a single chunk. Ported
    verbatim from scripts/seed-rag.mjs. */
export function chunkDoc(body: string, maxChars = 1500): string[] {
  const norm = body.replace(/\r\n/g, "\n").trim();
  if (!norm) return [];
  const sections = norm.split(/\n(?=## )/g).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const sec of sections) {
    if (sec.length <= maxChars) { chunks.push(sec); continue; }
    let start = 0;
    while (start < sec.length) {
      let end = Math.min(start + maxChars, sec.length);
      if (end < sec.length) {
        const from = Math.max(start, end - 200);
        const window = sec.slice(from, end);
        const b = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"));
        if (b > 0) end = from + b + 1;
      }
      const piece = sec.slice(start, end).trim();
      if (piece) chunks.push(piece);
      start = end;
    }
  }
  return chunks;
}

/** Parses one corpus entry: the first `# Heading` line is the title, everything
    after it is the body to chunk+embed. A file with no `# ` heading falls back to
    its filename (sans .md) as the title and treats the whole text as body. CRLF is
    normalized so parsing is identical on any platform. Mirrors the CLI's loadCorpus. */
export function parseSeedDoc(entry: SeedCorpusEntry): Omit<SeedDoc, "chunks"> {
  const raw = entry.raw.replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const titleIdx = lines.findIndex((l) => /^#\s+/.test(l));
  const title = titleIdx >= 0
    ? lines[titleIdx].replace(/^#\s+/, "").trim()
    : entry.file.replace(/\.md$/, "");
  const body = (titleIdx >= 0 ? lines.slice(titleIdx + 1) : lines).join("\n").trim();
  return { file: entry.file, title, body };
}

/** Corpus -> [{ file, title, body, chunks }]. Pure over the supplied entries. */
export function buildSeedDocs(corpus: SeedCorpusEntry[], maxChars = 1500): SeedDoc[] {
  return corpus.map((entry) => {
    const { file, title, body } = parseSeedDoc(entry);
    return { file, title, body, chunks: chunkDoc(body, maxChars) };
  });
}
