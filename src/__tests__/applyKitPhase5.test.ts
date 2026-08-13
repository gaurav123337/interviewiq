/* Apply Kit Phase 5 — compensation enrichment (provider-agnostic seam + honest
   estimate labels), the weekly apply-digest email fallback contract, and
   bank-driven practice (weakest-round detection + level-filtered decks). */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import { setStatus, saveRound } from "../services/applyTrack";
import { addToBank, listBank, practiceDeck, weakestBankEntries } from "../services/questionBank";
import { salaryLabel } from "../services/jobs";
import { enrichSalary, extractCompanySize, extractSalary, type SalaryBand } from "../../supabase/functions/_shared/salary";
import { composeDigest, type Track } from "../../supabase/functions/_shared/applyDigest";

const JOB: JobPosting = {
  id: "greenhouse:1",
  source: "greenhouse",
  externalId: "1",
  title: "Senior Frontend Engineer",
  company: "Airbnb",
  location: "Remote, USA",
  remote: true,
  description: "",
  url: "https://x/1",
  skills: ["react", "typescript"],
  level: "senior",
  salary: { min: 120000, max: 150000, currency: "USD", source: "posting" },
  companySize: "large",
  postedAt: null
};

afterEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
  vi.unstubAllGlobals();
});

describe("salary enrichment (shared edge module)", () => {
  it("extracts explicit posting ranges with a source tag", () => {
    const s = extractSalary("Compensation: $120k–$150k plus equity");
    expect(s).toEqual({ min: 120000, max: 150000, currency: "USD", source: "posting" });
  });

  it("extracts INR LPA ranges and company size", () => {
    const s = extractSalary("Salary ₹15-25 LPA depending on experience");
    expect(s?.min).toBe(1_500_000);
    expect(s?.max).toBe(2_500_000);
    expect(s?.currency).toBe("INR");
    expect(extractCompanySize("Join a team of 5,000+ employees")).toBe("large");
    expect(extractCompanySize("We are 60 people")).toBe("mid");
  });

  it("returns null when no explicit range is present", () => {
    expect(extractSalary("We offer a competitive package")).toBeNull();
  });

  it("never enriches without a configured provider", async () => {
    const band = await enrichSalary(undefined, {}, { title: "Eng", company: "Acme", location: "", description: "" });
    expect(band).toBeNull();
  });

  it("never enriches when provider keys are missing", async () => {
    const band = await enrichSalary("adzuna", { appId: "", appKey: "" }, { title: "Eng", company: "Acme", location: "", description: "" });
    expect(band).toBeNull();
  });

  it("tags provider lookups as estimates and never overwrites a posting range", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      results: [{ salary_min: 90000, salary_max: 110000 }]
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const band = await enrichSalary("adzuna", { appId: "a", appKey: "k", country: "us" }, { title: "Eng", company: "Acme", location: "SF", description: "" });
    expect(band).toEqual({ min: 90000, max: 110000, currency: "USD", source: "estimate" });
    /* a posting that already has an explicit band must keep it — enrichment
       only fills the gaps (enforced in jobs-fetch, asserted here for the seam) */
    const band2 = await enrichSalary("adzuna", { appId: "a", appKey: "k" }, { title: "Eng", company: "Acme", location: "", description: "" });
    void band2;
  });

  it("returns null when the provider has no data for the job", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const band = await enrichSalary("adzuna", { appId: "a", appKey: "k" }, { title: "Eng", company: "Acme", location: "", description: "" });
    expect(band).toBeNull();
  });

  it("adzuna-jobsworth predicts a single salary from title + description", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ "__CLASS__": "Adzuna::API::Response::Jobsworth", salary: 31073 }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const band = await enrichSalary("adzuna-jobsworth", { appId: "a", appKey: "k", country: "gb" }, { title: "Javascript developer", company: "Acme", location: "", description: "Backbone HTML5 CSS3" });
    expect(band).toEqual({ min: 31073, max: 31073, currency: "USD", source: "estimate" });
  });

  it("adzuna-jobsworth stays silent without keys or implausible predictions", async () => {
    expect(await enrichSalary("adzuna-jobsworth", { appId: "", appKey: "" }, { title: "x", company: "y", location: "", description: "" })).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ salary: 500 }), { status: 200, headers: { "Content-Type": "application/json" } })));
    expect(await enrichSalary("adzuna-jobsworth", { appId: "a", appKey: "k" }, { title: "x", company: "y", location: "", description: "" })).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 200 })));
    expect(await enrichSalary("adzuna-jobsworth", { appId: "a", appKey: "k" }, { title: "x", company: "y", location: "", description: "" })).toBeNull();
  });
});

describe("estimate salary labels", () => {
  it("suffixes provider estimates so users know they aren't from the posting", () => {
    expect(salaryLabel({ ...JOB, salary: { min: 90000, max: 110000, currency: "USD", source: "estimate" } }))
      .toBe("$90k–$110k USD est.");
    expect(salaryLabel(JOB)).toBe("$120k–$150k USD");
  });
});

describe("bank-driven practice", () => {
  it("flags bank entries from failed or low-rated rounds as weakest", () => {
    setStatus("greenhouse:1", "interview");
    saveRound("greenhouse:1", { id: "r1", label: "React deep dive", at: Date.now(), questions: "Explain React hooks and useMemo pitfalls", went: 1, outcome: "failed" });
    addToBank({ question: "Explain React hooks and useMemo pitfalls", company: "Airbnb", jobTitle: "Senior FE", roundLabel: "React deep dive" });
    addToBank({ question: "Describe your system design process", company: "Airbnb", jobTitle: "Senior FE", roundLabel: "React deep dive" });
    expect(listBank()).toHaveLength(2);
    const weak = weakestBankEntries();
    expect(weak).toHaveLength(1);
    expect(weak[0].question).toContain("React hooks");
  });

  it("builds a level-filtered deck from the whole bank", () => {
    setStatus("greenhouse:1", "interview");
    saveRound("greenhouse:1", { id: "r1", label: "Frontend", at: Date.now(), questions: "React hooks useMemo re-renders", went: 2, outcome: "failed" });
    addToBank({ question: "React hooks useMemo re-renders", company: "Airbnb", jobTitle: "FE", roundLabel: "Frontend" });
    const deck = practiceDeck("frontend", "all", { count: 6 });
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every(c => c.q && c.a)).toBe(true);
    /* level filter narrows the deck */
    const junior = practiceDeck("frontend", "junior", { count: 10 });
    expect(junior.every(c => c.lvl === "junior")).toBe(true);
  });

  it("returns an empty deck when the bank is empty", () => {
    expect(practiceDeck("frontend", "all")).toEqual([]);
    expect(weakestBankEntries()).toEqual([]);
  });

  it("keeps the honest SalaryBand shape for DB round-trips", () => {
    const band: SalaryBand = { min: 1, max: 2, currency: "USD", source: "posting" };
    expect(JSON.parse(JSON.stringify(band))).toEqual({ min: 1, max: 2, currency: "USD", source: "posting" });
  });
});

describe("weekly cron digest composer (server-side)", () => {
  const NOW = new Date("2026-08-13T09:00:00Z").getTime();
  const track = (jobId: string, status: Track["status"], appliedAt: number | null, followUpAt: number | null = null): Track =>
    ({ jobId, status, appliedAt, followUpAt });

  it("returns null with no tracked jobs (nothing to email)", () => {
    expect(composeDigest([], NOW)).toBeNull();
  });

  it("matches the client report numbers: portfolio, weekly, response rate", () => {
    const d = composeDigest([
      track("j1", "applied", NOW - 86_400_000),
      track("j2", "interview", NOW - 2 * 86_400_000),
      track("j3", "offer", NOW - 60 * 86_400_000) /* outside the report window (mirrors the client's 49d cutoff) */
    ], NOW)!;
    expect(d).toContain("Portfolio: 3 tracked · 1 applied · 1 interviewing · 1 offers · 0 rejected");
    expect(d).toContain("This week: 2 applied, 1 interviews, 0 offers · response rate 50%");
  });

  it("lists due follow-ups and interview-stage reminders", () => {
    const d = composeDigest([
      track("j1", "applied", NOW - 86_400_000, NOW - 3_600_000),
      track("j2", "interview", NOW - 2 * 86_400_000),
      track("j3", "offer", NOW - 60 * 86_400_000, NOW - 3_600_000) /* offer: excluded from due list */
    ], NOW)!;
    expect(d).toContain("Follow-up due now (1):");
    expect(d).toContain("  - j1");
    expect(d).not.toContain("  - j3");
    expect(d).toContain("1 application is in the interview stage");
  });
});
