import { assert, assertEquals } from "jsr:@std/assert";
import { buildSeedDocs, chunkDoc, estimateTokens, hostOf, parseSeedDoc } from "./ragSeed.ts";

Deno.test("chunkDoc keeps a short single-section doc as one chunk", () => {
  const chunks = chunkDoc("Just a short paragraph with no headings.");
  assertEquals(chunks.length, 1);
  assertEquals(chunks[0], "Just a short paragraph with no headings.");
});

Deno.test("chunkDoc splits at H2 headings, one chunk per section", () => {
  const body = "Intro paragraph.\n\n## First\nAlpha body.\n\n## Second\nBeta body.";
  const chunks = chunkDoc(body);
  assertEquals(chunks.length, 3);
  assert(chunks[0].startsWith("Intro"));
  assert(chunks[1].startsWith("## First"));
  assert(chunks[2].startsWith("## Second"));
});

Deno.test("chunkDoc splits an oversized section at a sentence boundary", () => {
  // One H2 section well over maxChars, made of sentence units so a "." boundary exists.
  const sentence = "This is a sentence of some length. ";
  const big = "## Big\n" + sentence.repeat(80); // ~2800 chars
  const chunks = chunkDoc(big, 1500);
  assert(chunks.length >= 2, `expected a split, got ${chunks.length}`);
  // First piece ends at a sentence boundary (".") rather than mid-word.
  assert(
    chunks[0].trim().endsWith("."),
    `expected sentence-boundary end, got: ${chunks[0].slice(-30)}`,
  );
  // No piece exceeds the cap.
  for (const c of chunks) assert(c.length <= 1500, `piece too long: ${c.length}`);
});

Deno.test("chunkDoc returns [] for empty / whitespace-only input", () => {
  assertEquals(chunkDoc(""), []);
  assertEquals(chunkDoc("   \n  "), []);
});

Deno.test("parseSeedDoc extracts the # title and the body after it", () => {
  const d = parseSeedDoc({ file: "x.md", raw: "# Hello World\n\nBody line one.\nBody line two." });
  assertEquals(d.title, "Hello World");
  assertEquals(d.body, "Body line one.\nBody line two.");
});

Deno.test("parseSeedDoc falls back to the filename when there is no # heading", () => {
  const d = parseSeedDoc({ file: "no-title.md", raw: "Just body, no heading.\nSecond line." });
  assertEquals(d.title, "no-title");
  assertEquals(d.body, "Just body, no heading.\nSecond line.");
});

Deno.test("parseSeedDoc normalizes CRLF line endings", () => {
  const d = parseSeedDoc({ file: "x.md", raw: "# Title\r\n\r\nBody.\r\n" });
  assertEquals(d.title, "Title");
  assertEquals(d.body, "Body.");
});

Deno.test("estimateTokens approximates whitespace-collapsed chars / 4", () => {
  assertEquals(estimateTokens(""), 0);
  assertEquals(estimateTokens("abcd"), 1);
  assertEquals(estimateTokens("a b c d"), 2);
});

Deno.test("hostOf returns the URL host, else the raw string", () => {
  assertEquals(hostOf("https://api.openai.com/v1"), "api.openai.com");
  assertEquals(hostOf("https://api.orcarouter.ai/v1"), "api.orcarouter.ai");
  assertEquals(hostOf("not a url"), "not a url");
});

Deno.test("buildSeedDocs parses and chunks every entry", () => {
  const docs = buildSeedDocs([
    { file: "a.md", raw: "# A\n\nAlpha." },
    { file: "b.md", raw: "# B\n\n## One\nx\n\n## Two\ny" },
  ]);
  assertEquals(docs.length, 2);
  assertEquals(docs[0].title, "A");
  assertEquals(docs[0].chunks.length, 1);
  assertEquals(docs[1].title, "B");
  assertEquals(docs[1].chunks.length, 2);
});
