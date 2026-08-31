/* articleExtract — the shared server-side HTML→article extractor, moved out of
   content-scrape so the now-SSRF-guarded content-scrape uses it today and the
   upcoming article-fetch function can share the same hardened parser. Pure
   regex/string work with no Deno globals, so it runs in this client vitest gate
   (same dual-runtime pattern as safeFetch.test.ts / the importPage helpers). */

import { describe, expect, it } from "vitest";
import { extractArticle } from "../../supabase/functions/_shared/articleExtract";

const wrap = (head: string, body: string) =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const filler = "<p>filler sentence long enough to clear the length threshold.</p>".repeat(8);

describe("extractArticle", () => {
  it("prefers og:title over <title>", () => {
    const html = wrap(
      `<title>Fallback</title><meta property="og:title" content="OG Wins">`,
      `<article><p>body</p>${filler}</article>`
    );
    expect(extractArticle(html, "https://example.com/post").title).toBe("OG Wins");
  });

  it("falls back to <title>, then to the bare domain", () => {
    const withTitle = wrap(`<title>Just Title</title>`, `<article><p>b</p>${filler}</article>`);
    expect(extractArticle(withTitle, "https://example.com/x").title).toBe("Just Title");

    const noTitle = wrap(``, `<article><p>b</p>${filler}</article>`);
    expect(extractArticle(noTitle, "https://www.example.com/x").title).toBe("example.com");
  });

  it("extracts the author from meta, else null", () => {
    const withAuthor = wrap(`<meta name="author" content="Ada Lovelace">`, `<article><p>b</p>${filler}</article>`);
    expect(extractArticle(withAuthor, "https://example.com/x").author).toBe("Ada Lovelace");

    const noAuthor = wrap(`<title>T</title>`, `<article><p>b</p>${filler}</article>`);
    expect(extractArticle(noAuthor, "https://example.com/x").author).toBeNull();
  });

  it("keeps article prose but strips script/style/nav/footer noise inside the container", () => {
    const body = `<article>
      <nav>HOME ABOUT NAVNOISE</nav>
      <p>The event loop drains microtasks before the next macrotask.</p>
      <script>window.t='SCRIPTNOISE'</script>
      <style>.x{color:red}/*STYLENOISE*/</style>
      <footer>FOOTERNOISE 2026</footer>
      ${filler}
    </article>`;
    const { content } = extractArticle(wrap(`<title>T</title>`, body), "https://example.com/x");
    expect(content).toContain("event loop drains microtasks");
    expect(content).not.toContain("SCRIPTNOISE");
    expect(content).not.toContain("STYLENOISE");
    expect(content).not.toContain("NAVNOISE");
    expect(content).not.toContain("FOOTERNOISE");
  });

  it("decodes HTML entities in body text", () => {
    const body = `<article><p>Cats &amp; dogs, 3 &lt; 4 &gt; 2.</p>${filler}</article>`;
    const { content } = extractArticle(wrap(`<title>T</title>`, body), "https://example.com/x");
    expect(content).toContain("Cats & dogs");
    expect(content).toContain("3 < 4 > 2");
  });

  it("preserves <pre> code inside a balanced triple-backtick fence", () => {
    const body = `<article><p>Example:</p><pre>const answer = 42;\nconsole.log(answer);</pre>${filler}</article>`;
    const { content } = extractArticle(wrap(`<title>T</title>`, body), "https://example.com/x");
    expect(content).toContain("const answer = 42;");
    expect(content).toContain("console.log(answer)");
    // Lock the fence itself, not just the code text: a matched ```lang open and
    // a standalone ``` close. A regression to the old 2-backtick close (which
    // renders as an unterminated fence) would keep the two lines above passing
    // but fail this one.
    expect(content).toMatch(/```js\nconst answer = 42;\nconsole\.log\(answer\);\n```/);
  });

  it("wraps inline <code> in a single backtick pair", () => {
    const body = `<article><p>Run <code>npm install</code> to begin.</p>${filler}</article>`;
    const { content } = extractArticle(wrap(`<title>T</title>`, body), "https://example.com/x");
    expect(content).toContain("`npm install`");
  });
});
