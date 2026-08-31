import { describe, expect, it } from "vitest";
import { RAG_SEED_CORPUS } from "../../supabase/functions/seed-rag/corpus.generated";

/* Drift guard: the committed corpus.generated.ts MUST match content/rag-seed/*.md.
   If a .md is edited without running `npm run gen:rag-corpus`, this fails so a stale
   corpus can't ship. The source .md files are read via Vite's import.meta.glob (?raw)
   rather than node:fs, so the test stays within the project's TS types (no @types/node).
   Both sides LF-normalize, so it passes on Windows and Linux alike. */
const rawByPath = import.meta.glob<string>("../../content/rag-seed/*.md", {
  query: "?raw",
  eager: true,
  import: "default",
});

describe("rag corpus generation", () => {
  // Rebuild what scripts/gen-rag-corpus.mjs would emit: basename + LF-normalized raw,
  // sorted by filename with the same lexicographic order readdirSync().sort() uses.
  const expected = Object.entries(rawByPath)
    .map(([path, raw]) => ({ file: path.split("/").pop() as string, raw: raw.replace(/\r\n/g, "\n") }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

  it("corpus.generated.ts is in sync with content/rag-seed/*.md (run `npm run gen:rag-corpus`)", () => {
    expect(RAG_SEED_CORPUS).toEqual(expected);
  });

  it("every corpus entry has a markdown # title and non-empty body", () => {
    expect(RAG_SEED_CORPUS.length).toBeGreaterThan(0);
    for (const { file, raw } of RAG_SEED_CORPUS) {
      expect(raw.length, `${file} is empty`).toBeGreaterThan(0);
      expect(/^#\s+/m.test(raw), `${file} has no # title`).toBe(true);
    }
  });
});
