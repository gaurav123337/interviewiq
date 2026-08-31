#!/usr/bin/env node
/* seed-rag — seeds the RAG knowledge base with the original starter corpus in
   content/rag-seed/*.md (D6). Each markdown file becomes one pdf_documents row
   (source='seed') plus its embedded pdf_chunks, stamped with the embedding
   provider host + model so match_pdf_chunks' p_model filter can find them.

   NOTE: the chunk/token logic here is mirrored in
   supabase/functions/_shared/ragSeed.ts, which the Admin-UI seed (the seed-rag
   edge function) runs. Prefer the Admin UI (Quality → RAG health → Seed) — it uses
   the shared, server-configured embeddings key and needs no service-role key in
   your shell. Keep this CLI as a break-glass/offline tool, and keep the two chunk
   implementations in sync.

   Idempotent: every run first deletes the existing source='seed' documents
   (chunks cascade) and re-inserts from disk, so editing a doc and re-running
   converges — it never double-seeds.

   PREREQUISITE: apply supabase/migrations/20260831_rag_corpus.sql first. It adds
   pdf_chunks.embedding_provider / embedding_model — the columns this script
   stamps. Without them the chunk insert fails (and unstamped chunks would be
   invisible to model-scoped retrieval anyway, defeating the seed).

   Usage:
     SUPABASE_URL=https://<ref>.supabase.co \        # or SUPABASE_PROJECT_REF=<ref>
     SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
     OPENAI_API_KEY=sk-... \                          # embeddings key
     EMBEDDINGS_API_BASE=https://api.openai.com/v1 \  # optional (this is the default)
     EMBEDDINGS_MODEL=text-embedding-3-small \        # optional (this is the default; must be 1536-dim)
     node scripts/seed-rag.mjs

     node scripts/seed-rag.mjs --dry-run   # parse + chunk + report only; no API, no DB, no env needed

   Exit 0 on success, 1 on failure. */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const EMBED_DIM = 1536;
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";
const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "rag-seed");

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[90m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

const dryRun = process.argv.includes("--dry-run");

/** Host of the embeddings base URL, e.g. "api.openai.com". Mirrors content-index's
    hostOf so seeded chunks stamp embedding_provider the same way server indexing does. */
function hostOf(base) {
  try { return new URL(base).host; } catch { return base; }
}

/** Rough token estimate (chars / 4), matching the client's estimateTokens. */
function estimateTokens(text) {
  return Math.ceil(text.replace(/\s+/g, " ").length / 4);
}

/** Section-aware chunking: split at markdown H2 (`## `) headings, keeping each
    heading with its body, then split any oversized section at a sentence
    boundary near maxChars. Seed docs are short, so most yield a single chunk. */
function chunkDoc(body, maxChars = 1500) {
  const norm = body.replace(/\r\n/g, "\n").trim();
  if (!norm) return [];
  const sections = norm.split(/\n(?=## )/g).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
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

/** Reads content/rag-seed/*.md → [{ file, title, body, chunks }]. The first
    `# Heading` line is the title; everything else is the body to chunk+embed. */
function loadCorpus() {
  let files;
  try {
    files = readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".md")).sort();
  } catch {
    throw new Error(`Corpus directory not found: ${CORPUS_DIR}`);
  }
  if (!files.length) throw new Error(`No .md files in ${CORPUS_DIR}`);
  return files.map((file) => {
    const raw = readFileSync(join(CORPUS_DIR, file), "utf8");
    const lines = raw.split("\n");
    const titleIdx = lines.findIndex((l) => /^#\s+/.test(l));
    const title = titleIdx >= 0 ? lines[titleIdx].replace(/^#\s+/, "").trim() : file.replace(/\.md$/, "");
    const body = (titleIdx >= 0 ? lines.slice(titleIdx + 1) : lines).join("\n").trim();
    const chunks = chunkDoc(body);
    return { file, title, body, chunks };
  });
}

/** Embeds a batch via the OpenAI-compatible /embeddings endpoint. Throws on any
    failure or a non-1536-dim vector — a wrong-dimension vector must never reach
    the vector(1536) column (same contract as the server's embedTexts). */
async function embedBatch(base, key, model, input) {
  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) {
    let msg = `Embeddings request failed (HTTP ${res.status})`;
    try { const j = await res.json(); if (j?.error?.message) msg = j.error.message; } catch { /* keep status */ }
    throw new Error(msg);
  }
  const j = await res.json();
  const out = ((j?.data ?? [])).map((d) => d.embedding ?? []);
  if (out.length !== input.length) throw new Error(`Embeddings count mismatch: got ${out.length}, expected ${input.length}`);
  for (const v of out) {
    if (v.length !== EMBED_DIM) {
      throw new Error(`Embeddings must be ${EMBED_DIM}-dim (got ${v.length}) — configure a ${EMBED_DIM}-dim model such as ${DEFAULT_EMBED_MODEL}.`);
    }
  }
  return out;
}

async function main() {
  const corpus = loadCorpus();
  const totalChunks = corpus.reduce((n, d) => n + d.chunks.length, 0);

  console.log(`RAG seed corpus — ${cyan(corpus.length)} docs, ${cyan(totalChunks)} chunks ${dim(`(${CORPUS_DIR})`)}\n`);
  for (const d of corpus) {
    console.log(`  ${d.title.padEnd(34)} ${dim(`${d.chunks.length} chunk(s) · ${d.body.length} chars · ${d.file}`)}`);
  }
  console.log("");

  if (dryRun) {
    console.log(dim("--dry-run: parsed and chunked only. No embeddings, no database writes."));
    return;
  }

  const url = process.env.SUPABASE_URL
    || (process.env.SUPABASE_PROJECT_REF ? `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co` : "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const embedKey = process.env.OPENAI_API_KEY;
  const base = (process.env.EMBEDDINGS_API_BASE || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.EMBEDDINGS_MODEL || DEFAULT_EMBED_MODEL;

  const missing = [];
  if (!url) missing.push("SUPABASE_URL (or SUPABASE_PROJECT_REF)");
  if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!embedKey) missing.push("OPENAI_API_KEY");
  if (missing.length) {
    console.error(red(`Missing env: ${missing.join(", ")}`));
    console.error(dim("  (or run with --dry-run to preview chunking without seeding)"));
    process.exit(1);
  }

  const provider = hostOf(base);
  console.log(dim(`Embedding via ${provider} · model ${model} · target ${new URL(url).host}\n`));

  const client = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Idempotent reset: drop prior seed docs (chunks cascade on the FK).
  const { error: delError } = await client.from("pdf_documents").delete().eq("source", "seed");
  if (delError) throw new Error(`Failed clearing prior seed docs: ${delError.message}`);

  let docCount = 0;
  let chunkCount = 0;
  for (const d of corpus) {
    if (!d.chunks.length) { console.log(dim(`  skip ${d.title} — no content`)); continue; }

    const vectors = await embedBatch(base, embedKey, model, d.chunks);

    const { data: doc, error: docError } = await client.from("pdf_documents")
      .insert({ title: d.title, source: "seed", char_count: d.body.length, chunk_count: 0 })
      .select("id").single();
    if (docError) throw new Error(`Insert doc "${d.title}" failed: ${docError.message}`);
    const docId = doc.id;

    const { error: chunkError } = await client.from("pdf_chunks").insert(
      d.chunks.map((content, i) => ({
        document_id: docId,
        chunk_index: i,
        content,
        token_count: estimateTokens(content),
        // Stringify so PostgREST hands pgvector its `[..]` text literal (a raw
        // array binds as a Postgres `{..}` and fails the vector cast).
        embedding: JSON.stringify(vectors[i]),
        embedding_provider: provider,
        embedding_model: model,
      })),
    );
    if (chunkError) throw new Error(`Insert chunks for "${d.title}" failed: ${chunkError.message}`);

    await client.from("pdf_documents").update({ chunk_count: d.chunks.length }).eq("id", docId);

    docCount++;
    chunkCount += d.chunks.length;
    console.log(`  ${green("✓")} ${d.title.padEnd(34)} ${dim(`${d.chunks.length} chunk(s)`)}`);
  }

  console.log(`\n${green(`✓ Seeded ${docCount} documents, ${chunkCount} chunks.`)}`);
}

main().catch((e) => {
  console.error(`\n${red("✗ Seed failed:")} ${e.message || e}`);
  if (/column .* does not exist|embedding_provider|embedding_model/i.test(String(e.message || e))) {
    console.error(dim("  Apply supabase/migrations/20260831_rag_corpus.sql first (adds the chunk provenance columns)."));
  }
  process.exit(1);
});
