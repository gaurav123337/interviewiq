/* Deno tests for the shared RSS parser (the exact code jobs-fetch runs).
   Mirrors the client suite. Run: deno test supabase/functions/_shared/ */

import { assertEquals } from "jsr:@std/assert";
import { feedTitle, parseRss } from "./rss.ts";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Acme Jobs</title>
    <item>
      <title>Senior Go Engineer</title>
      <link>https://acme.com/jobs/1</link>
      <description><![CDATA[<p>Go, Kubernetes &amp; AWS at scale.</p>]]></description>
      <pubDate>Wed, 13 Aug 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>No link here</title>
      <description>skipped — no link</description>
    </item>
  </channel>
</rss>`;

Deno.test("parseRss extracts items and decodes CDATA/entities", () => {
  const items = parseRss(SAMPLE_RSS);
  assertEquals(items.length, 1);
  assertEquals(items[0].title, "Senior Go Engineer");
  assertEquals(items[0].link, "https://acme.com/jobs/1");
  assertEquals(items[0].description, "Go, Kubernetes & AWS at scale.");
  assertEquals(items[0].pubDate, "2026-08-13T10:00:00.000Z");
});

Deno.test("feedTitle returns the channel title", () => {
  assertEquals(feedTitle(SAMPLE_RSS), "Acme Jobs");
  assertEquals(feedTitle(""), null);
});

Deno.test("parseRss handles Atom entries and garbage", () => {
  const atom = `<feed><title>Atom Jobs</title><entry><title>DevOps</title><link href="https://a.com/9"/><updated>2026-08-01T12:00:00Z</updated></entry></feed>`;
  const items = parseRss(atom);
  assertEquals(items.length, 1);
  assertEquals(items[0].link, "https://a.com/9");
  assertEquals(parseRss("<html>not a feed</html>").length, 0);
});
