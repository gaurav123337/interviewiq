/* Lane A — RSS job sources: the exact parser jobs-fetch runs (shared code
   lives in supabase/functions/_shared/rss.ts). */

import { describe, expect, it } from "vitest";
import { companyFromLink, feedTitle, parseRss, splitRssTitle, stripJobNumberPrefix } from "../../supabase/functions/_shared/rss";

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
      <title>Frontend Engineer</title>
      <link>https://acme.com/jobs/2</link>
      <description>React and TypeScript.</description>
      <pubDate>not a date</pubDate>
    </item>
    <item>
      <title>No link here</title>
      <description>skipped — no link</description>
    </item>
  </channel>
</rss>`;

describe("parseRss (shared edge-function parser)", () => {
  it("extracts title, link, decoded description and pubDate", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Senior Go Engineer");
    expect(items[0].link).toBe("https://acme.com/jobs/1");
    expect(items[0].description).toContain("Go, Kubernetes & AWS at scale.");
    expect(items[0].pubDate).toBe("2026-08-13T10:00:00.000Z");
  });

  it("drops items without a link and tolerates bad dates", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items.some(i => i.title === "No link here")).toBe(false);
    expect(items[1].pubDate).toBeNull();
  });

  it("parses Atom feeds via <entry> and the link href attribute", () => {
    const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Acme Atom Jobs</title>
  <entry>
    <title>DevOps Engineer</title>
    <link href="https://acme.com/jobs/9"/>
    <summary>Docker, Terraform, Linux.</summary>
    <updated>2026-08-01T12:00:00Z</updated>
  </entry>
</feed>`;
    const items = parseRss(atom);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("DevOps Engineer");
    expect(items[0].link).toBe("https://acme.com/jobs/9");
    expect(items[0].pubDate).toBe("2026-08-01T12:00:00.000Z");
    expect(feedTitle(atom)).toBe("Acme Atom Jobs");
  });

  it("returns the channel title as the feed title", () => {
    expect(feedTitle(SAMPLE_RSS)).toBe("Acme Jobs");
  });

  it("collects category tags and strips Himalayas' [Job - N] prefix + company slug", () => {
    const himalayas = `<rss><channel><title>Remote jobs from Himalayas</title><item>
      <title><![CDATA[[Job - 30986] Software Master Developer, Brazil]]></title>
      <description><![CDATA[At CI&T, we help large enterprises.]]></description>
      <link>https://himalayas.app/companies/ci-t/jobs/job-30986-software-master-developer-brazil</link>
      <category><![CDATA[Software-Developer]]></category>
      <category><![CDATA[Azure-Developer]]></category>
    </item></channel></rss>`;
    const items = parseRss(himalayas);
    expect(items[0].title).toBe("[Job - 30986] Software Master Developer, Brazil");
    expect(items[0].tags).toEqual(["Software-Developer", "Azure-Developer"]);
    expect(stripJobNumberPrefix(items[0].title)).toBe("Software Master Developer, Brazil");
    expect(companyFromLink(items[0].link)).toBe("CI&T");
    expect(companyFromLink("https://himalayas.app/companies/stripe/jobs/job-9-x")).toBe("Stripe");
    expect(companyFromLink("https://example.com/jobs/1")).toBe("");
    expect(stripJobNumberPrefix("Plain title")).toBe("Plain title");
  });

  it("splitRssTitle pulls the company from board-style item titles (colon only)", () => {
    expect(splitRssTitle("Airtable: Senior Solutions Architect")).toEqual({ company: "Airtable", title: "Senior Solutions Architect" });
    expect(splitRssTitle("Senior Solutions Architect - West Coast").company).toBe(""); /* dash style untouched */
    expect(splitRssTitle("DevOps Engineer (Remote)").company).toBe("");
    expect(splitRssTitle("Acme： 后端工程师").company).toBe("Acme");
  });

  it("degrades gracefully on garbage", () => {
    expect(parseRss("<html>not a feed</html>")).toEqual([]);
    expect(feedTitle("")).toBeNull();
  });
});
