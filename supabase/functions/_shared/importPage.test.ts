/* Deno tests for the shared import-page helpers (the exact code the
   import-job edge function runs). Mirrors the client suite so both ends
   stay in lockstep. Run: deno test supabase/functions/_shared/importPage.test.ts */

import { assertEquals, assert } from "jsr:@std/assert";
import { extractFromJsonLd, parseMeta, robotsAllows, stripHtml } from "./importPage.ts";

Deno.test("stripHtml removes tags/scripts and decodes entities", () => {
  assertEquals(stripHtml("<div>Hello <b>world</b><script>evil()</script></div>"), "Hello world");
  assertEquals(stripHtml("a&amp;b"), "a&b");
  assertEquals(stripHtml("Go and <b>Kubernetes</b>."), "Go and Kubernetes.");
});

Deno.test("parseMeta collects name/property tags", () => {
  const meta = parseMeta('<meta property="og:title" content="Staff Engineer"><meta name="description" content="Go at scale.">');
  assertEquals(meta.get("og:title"), "Staff Engineer");
  assertEquals(meta.get("description"), "Go at scale.");
});

Deno.test("extractFromJsonLd parses a JobPosting block", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Backend Engineer",
    hiringOrganization: { name: "Acme Corp" },
    jobLocation: { address: { addressLocality: "Remote", addressCountry: "US" } },
    description: "<p>Go and <b>Kubernetes</b>.</p>",
    url: "https://acme.com/jobs/9"
  })}</script>`;
  const p = extractFromJsonLd(html);
  assert(p, "expected a parsed page");
  assertEquals(p.title, "Backend Engineer");
  assertEquals(p.company, "Acme Corp");
  assertEquals(p.location, "Remote, US");
  assertEquals(p.description, "Go and Kubernetes.");
  assertEquals(p.applyUrl, "https://acme.com/jobs/9");
});

Deno.test("robotsAllows honors star-group Disallow with prefix semantics", () => {
  assertEquals(robotsAllows("", "/jobs/1"), true);
  assertEquals(robotsAllows("User-agent: *\nDisallow: /jobs/", "/jobs/123"), false);
  assertEquals(robotsAllows("User-agent: *\nDisallow: /jobs/", "/careers"), true);
  assertEquals(robotsAllows("User-agent: *\nDisallow: /job*", "/jobposting/9"), false);
  assertEquals(robotsAllows("User-agent: *\nDisallow: /secret", "/secret"), false);
  assertEquals(robotsAllows("User-agent: googlebot\nDisallow: /everything", "/jobs/1"), true);
});
