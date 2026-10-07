/* Deno tests for the first-class auto-apply board identity (jobs-fetch →
   job_sites registry). Pure, CI-run via `deno test supabase/functions/_shared/`. */

import { assertEquals, assert } from "jsr:@std/assert";
import { applyBoardIdentity } from "./applyBoards.ts";

Deno.test("greenhouse boards get a path-qualified host and board URL", () => {
  const id = applyBoardIdentity("greenhouse", "lyft", "Lyft");
  assert(id !== null);
  assertEquals(id.host, "boards.greenhouse.io/lyft");
  assertEquals(id.jobsUrl, "https://boards.greenhouse.io/lyft");
  assertEquals(id.label, "Lyft · Greenhouse");
  assertEquals(id.provider, "greenhouse");
});

Deno.test("two boards on one ATS hostname stay distinct registry rows", () => {
  const a = applyBoardIdentity("greenhouse", "lyft", "Lyft");
  const b = applyBoardIdentity("greenhouse", "airbnb", "Airbnb");
  assert(a !== null && b !== null);
  assert(a.host !== b.host); // the whole point of path-qualified hosts
});

Deno.test("ashby boards follow the same convention", () => {
  const id = applyBoardIdentity("ashby", "linear", "Linear");
  assert(id !== null);
  assertEquals(id.host, "jobs.ashbyhq.com/linear");
  assertEquals(id.jobsUrl, "https://jobs.ashbyhq.com/linear");
  assertEquals(id.label, "Linear · Ashby");
});

Deno.test("missing company falls back to the board token in the label", () => {
  const id = applyBoardIdentity("greenhouse", "groww", null);
  assert(id !== null);
  assertEquals(id.label, "groww · Greenhouse");
});

Deno.test("labels are capped at 80 chars (registry column safety)", () => {
  const long = "X".repeat(200);
  const id = applyBoardIdentity("ashby", "acme", long);
  assert(id !== null);
  assertEquals(id.label.length, 80);
});

Deno.test("non-ATS providers are not auto-apply boards (null identity)", () => {
  assertEquals(applyBoardIdentity("lever", "fampay", "Fampay"), null);
  assertEquals(applyBoardIdentity("rss", "https://example.com/feed", null), null);
  assertEquals(applyBoardIdentity("remoteok", "remoteok", "RemoteOK"), null);
});

Deno.test("junk input is rejected, not thrown", () => {
  assertEquals(applyBoardIdentity("greenhouse", "", null), null);
  assertEquals(applyBoardIdentity("greenhouse", "   ", null), null);
});
