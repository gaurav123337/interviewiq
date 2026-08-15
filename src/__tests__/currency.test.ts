/* Display currency — FX conversion, location defaults, persistence, and
   how the feed labels/filters + leaderboard min-salary behave in one
   currency. */

import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import {
  defaultCurrencyFor, getDisplayCurrency, salaryInCurrency, setDisplayCurrency, toCurrency
} from "../services/currency";
import { filterJobs, filterRanks, salaryLabel } from "../services/jobs";
import { EMPTY_RANK_FILTERS } from "../services/jobs";
import type { JobPosting } from "../types";

const job = (over: Partial<JobPosting> = {}): JobPosting => ({
  id: "greenhouse:1",
  source: "greenhouse",
  externalId: "1",
  title: "Senior Frontend Engineer",
  company: "Airbnb",
  location: "Remote - US",
  remote: true,
  description: "",
  url: "https://careers.example.com/1",
  skills: ["react", "typescript"],
  level: "senior",
  salary: { min: 120000, max: 150000, currency: "USD" },
  companySize: null,
  postedAt: null,
  ...over
});

beforeEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

describe("toCurrency + FX", () => {
  it("converts between currencies via USD at the app's FX table", () => {
    expect(toCurrency(120000, "USD", "INR")).toBe(9960000); /* ×83 */
    expect(toCurrency(9960000, "INR", "USD")).toBe(120000);
    expect(toCurrency(1000, "USD", "GBP")).toBe(780);
    expect(toCurrency(1000, "GBP", "USD")).toBe(1282);
  });

  it("is identity for the same currency and safe on unknowns/zero", () => {
    expect(toCurrency(5000, "USD", "USD")).toBe(5000);
    expect(toCurrency(5000, "XXX", "INR")).toBe(415000); /* unknown = USD */
    expect(toCurrency(0, "USD", "INR")).toBe(0);
    expect(toCurrency(Number.NaN, "USD", "INR")).toBe(0);
  });
});

describe("defaultCurrencyFor + persistence", () => {
  it("defaults to INR for Indian locations and USD elsewhere", () => {
    expect(defaultCurrencyFor("Bengaluru, Karnataka, India")).toBe("INR");
    expect(defaultCurrencyFor("Mumbai, Maharashtra")).toBe("INR");
    expect(defaultCurrencyFor("New York, NY")).toBe("USD");
    expect(defaultCurrencyFor("")).toBe("USD");
    expect(defaultCurrencyFor(undefined)).toBe("USD");
  });

  it("persists an explicit choice over the location default", () => {
    setDisplayCurrency("USD");
    expect(getDisplayCurrency("Bengaluru, India")).toBe("USD");
    setDisplayCurrency("INR");
    expect(getDisplayCurrency("New York, NY")).toBe("INR");
  });
});

describe("salaryInCurrency", () => {
  it("converts a whole band", () => {
    expect(salaryInCurrency({ min: 120000, max: 150000, currency: "USD" }, "INR"))
      .toEqual({ min: 9960000, max: 12450000, currency: "INR" });
  });
});

describe("salaryLabel — one currency in the feed", () => {
  it("converts a USD band to the display currency with ₹-style formatting", () => {
    expect(salaryLabel(job({ salary: { min: 100000, max: 150000, currency: "USD" } }), "INR")).toBe("₹83L–₹1.2Cr INR");
  });

  it("keeps the posting's own currency when no display currency is given", () => {
    expect(salaryLabel(job())).toBe("$120k–$150k USD");
  });

  it("returns null without a salary", () => {
    expect(salaryLabel(job({ salary: null }), "INR")).toBeNull();
  });
});

describe("filterJobs — salary min/max in the display currency", () => {
  const usd = job({ id: "usd", salary: { min: 120000, max: 150000, currency: "USD" } });
  const inr = job({ id: "inr", salary: { min: 2000000, max: 3000000, currency: "INR" } });

  it("compares mixed-currency postings fairly in the chosen currency", () => {
    /* the USD posting (~$120k–$150k ≈ ₹1Cr–₹1.25Cr) is CONVERTED to INR for
       the comparison instead of being excluded for being USD — the old
       behavior would have silently dropped it from an INR filter */
    const out = filterJobs([usd, inr], {
      query: "", remote: null, companySize: null,
      salaryMin: 0, salaryMax: 15000000, currency: "INR", source: null
    });
    expect(out.map(j => j.id)).toEqual(["usd", "inr"]);
  });

  it("drops postings below the min in the chosen currency", () => {
    const out = filterJobs([usd, inr], {
      query: "", remote: null, companySize: null,
      salaryMin: 5000000, salaryMax: null, currency: "INR", source: null
    });
    expect(out.map(j => j.id)).toEqual(["usd"]);
  });

  it("keeps historical behavior without a currency", () => {
    /* raw comparison against each posting's own currency when none chosen */
    const out = filterJobs([usd, inr], {
      query: "", remote: null, companySize: null,
      salaryMin: 100000, salaryMax: null, currency: null, source: null
    });
    expect(out.map(j => j.id)).toEqual(["usd", "inr"]);
  });
});

describe("filterRanks — minSalary in the display currency", () => {
  const rank = (id: string, salary: JobPosting["salary"]) => ({
    company: id, score: 70, verdict: "good" as const, openings: 1,
    best: job({ id, salary }), matched: [], missing: [], blockers: []
  });

  it("converts the best-role band before comparing to minSalary", () => {
    const ranks = [rank("A", { min: 120000, max: 150000, currency: "USD" })];
    /* $150k max ≈ ₹1.25Cr — a ₹2Cr minimum excludes it only after conversion */
    expect(filterRanks(ranks, { ...EMPTY_RANK_FILTERS, minSalary: 20000000 }, new Set(), "INR")).toHaveLength(0);
    expect(filterRanks(ranks, { ...EMPTY_RANK_FILTERS, minSalary: 100000 }, new Set(), "INR")).toHaveLength(1);
    /* no display currency → the band's own currency (historical behavior) */
    expect(filterRanks(ranks, { ...EMPTY_RANK_FILTERS, minSalary: 100000 }, new Set())).toHaveLength(1);
  });
});
