/* Deno tests for the Workday CXS feed parser (Phase 4 cloud collectors).
   Pure, CI-run via `deno test supabase/functions/_shared/`. */

import { assertEquals, assert } from "jsr:@std/assert";
import { parseWorkdayRef, parseWorkdayPostings, proseAgeToHours } from "./workdayFeed.ts";

Deno.test("a tenant/site ref names the CXS POST endpoint", () => {
  const ref = parseWorkdayRef("mastercard/CorporateCareers");
  assert(ref !== null);
  assertEquals(ref.apiUrl, "https://mastercard.wd1.myworkdayjobs.com/wday/cxs/mastercard/CorporateCareers/jobs");
});

Deno.test("a ref that already names its data-center host keeps the host, drops the suffix from the cxs path", () => {
  const ref = parseWorkdayRef("kla.wd1/Penang_Semicon");
  assert(ref !== null);
  assertEquals(ref.apiUrl, "https://kla.wd1.myworkdayjobs.com/wday/cxs/kla/Penang_Semicon/jobs");
});

Deno.test("garbage refs stay null (no guessed boards — fail-closed)", () => {
  assertEquals(parseWorkdayRef("mastercard"), null); // no site — unlistable
  assertEquals(parseWorkdayRef("mastercard/Corporate Careers"), null); // space never reaches the feed
  assertEquals(parseWorkdayRef("mastercard/CorporateCareers/extra"), null);
});

Deno.test("prose age stamps become honest hour estimates", () => {
  assertEquals(proseAgeToHours("Posted Today"), 0);
  assertEquals(proseAgeToHours("Posted 3 Hours Ago"), 3);
  assertEquals(proseAgeToHours("Posted 30+ Days Ago"), 30 * 24);
  assertEquals(proseAgeToHours("Posted Yesterday"), 24);
  assertEquals(proseAgeToHours("Posted Someday"), null);
});

Deno.test("postings parse: identity, location, remote, estimated posted_at", () => {
  const now = 1_700_000_000_000;
  const rows = parseWorkdayPostings(
    {
      jobPostings: [
        { title: "Senior Software Engineer", externalId: "R1724210-1", locationsText: "San Francisco, United States", postedOn: "Posted Today", canonicalPostingUrl: "https://x.wd1.myworkdayjobs.com/en-US/External/job/Senior_R1724210-1" },
        { title: "Backend Engineer", externalId: "R1723999", locationsText: "Remote - India", postedOn: "Posted 30+ Days Ago" },
        { title: "No id (skip)", externalId: "" },
      ],
    },
    { now }
  );
  assertEquals(rows.length, 2);
  assertEquals(rows[0].externalId, "R1724210-1");
  assertEquals(rows[0].url, "https://x.wd1.myworkdayjobs.com/en-US/External/job/Senior_R1724210-1");
  assertEquals(rows[0].postedAt, new Date(now).toISOString()); // posted today
  assertEquals(rows[1].remote, true);
  assertEquals(rows[1].postedAt, new Date(now - 30 * 24 * 3_600_000).toISOString());
});

Deno.test("an unparsable payload yields zero rows (scrape fallback upstream)", () => {
  assertEquals(parseWorkdayPostings(null), []);
  assertEquals(parseWorkdayPostings({ total: 5 }), []);
});
