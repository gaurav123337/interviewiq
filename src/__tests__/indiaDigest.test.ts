/* 🇮🇳 India & startup digest — the filter (isIndiaPosting) and the
   plain-text composer (indiaDigest), mirroring the server-side version. */

import { describe, expect, it } from "vitest";
import type { CareerProfile, JobPosting } from "../types";
import { indiaDigest, isIndiaPosting } from "../services/jobs";
/* the exact composer the edge function runs — same pure code, one copy */
import { composeIndiaDigest, isIndiaJob } from "../../supabase/functions/_shared/recommendationsDigest";

const PROFILE: CareerProfile = {
  headline: "Senior Frontend Engineer",
  years: 6,
  location: "Bengaluru, India",
  remote: true,
  workAuth: "India citizen",
  targetTitles: ["Frontend Engineer"],
  skills: ["react", "typescript", "node", "css", "graphql"],
  summary: "",
  updatedAt: 1
};

const job = (over: Partial<JobPosting> = {}): JobPosting => ({
  id: "greenhouse:1",
  source: "greenhouse",
  externalId: "1",
  title: "Frontend Engineer",
  company: "Airbnb",
  location: "Remote - US",
  remote: true,
  description: "",
  url: "https://careers.example.com/1",
  skills: ["react", "typescript", "graphql"],
  level: "senior",
  salary: null,
  companySize: null,
  postedAt: null,
  ...over
});

describe("isIndiaPosting — the India-market filter", () => {
  it("includes India locations", () => {
    expect(isIndiaPosting(job({ location: "Bengaluru, Karnataka, India" }))).toBe(true);
    expect(isIndiaPosting(job({ location: "Mumbai, Maharashtra" }))).toBe(true);
    expect(isIndiaPosting(job({ location: "Gurugram, Haryana, India" }))).toBe(true);
  });

  it("includes known Indian startups even without a location", () => {
    expect(isIndiaPosting(job({ location: "", company: "FamPay" }))).toBe(true);
    expect(isIndiaPosting(job({ location: "", company: "CRED" }))).toBe(true);
    expect(isIndiaPosting(job({ location: "", company: "Groww" }))).toBe(true);
  });

  it("includes remote roles (reachable from India)", () => {
    expect(isIndiaPosting(job({ location: "Remote - US", remote: true }))).toBe(true);
  });

  it("excludes on-site non-India roles at non-Indian companies", () => {
    expect(isIndiaPosting(job({ location: "New York, NY", remote: false, company: "Acme" }))).toBe(false);
    expect(isIndiaPosting(job({ location: "London, UK", remote: false }))).toBe(false);
  });
});

describe("indiaDigest — the weekly India & startup email", () => {
  it("composes a ranked digest of India-market companies only", () => {
    const d = indiaDigest(PROFILE, [
      job({ company: "Acme", location: "New York, NY", remote: false, skills: ["react", "typescript"] }),
      job({ company: "FamPay", location: "Bengaluru, India", remote: false, skills: ["react", "typescript", "graphql", "node", "kubernetes"] }),
      job({ company: "Groww", location: "Bengaluru, Karnataka, India", remote: false, skills: ["react", "typescript"] }),
      job({ company: "CRED", location: "Mumbai, India", remote: false, skills: ["css", "kubernetes", "aws"] })
    ]);
    expect(d).toContain("🇮🇳 India & startup recommendations");
    expect(d).toContain("Groww");
    expect(d).not.toContain("Acme");
    /* ranked by match % — fullest overlap (Groww 2/2) > partial (FamPay 4/5) > sparse (CRED 1/3) */
    expect(d.indexOf("Groww")).toBeLessThan(d.indexOf("FamPay"));
    expect(d.indexOf("FamPay")).toBeLessThan(d.indexOf("CRED"));
  });

  it("says there's nothing to recommend when no India roles exist", () => {
    const d = indiaDigest(PROFILE, [job({ company: "Acme", location: "New York, NY", remote: false })]);
    expect(d).toContain("no Indian-market companies");
  });
});

describe("composeIndiaDigest — the exact server-side composer", () => {
  const sJob = (over: Partial<{ company: string; location: string; remote: boolean; skills: string[]; title: string }> = {}) => ({
    title: "Frontend Engineer",
    company: "Airbnb",
    location: "Remote - US",
    remote: true,
    skills: ["react", "typescript"],
    ...over
  });

  it("filters to the Indian market and ranks like the client mirror", () => {
    const d = composeIndiaDigest(PROFILE, [
      sJob({ company: "Acme", location: "New York, NY", remote: false }),
      sJob({ company: "FamPay", location: "Bengaluru, India", remote: false }),
      sJob({ company: "Groww", location: "Bengaluru, Karnataka, India", remote: false, skills: ["react", "typescript", "graphql"] })
    ]);
    expect(d).toContain("🇮🇳 India & startup recommendations");
    expect(d).toContain("FamPay");
    expect(d).toContain("Groww");
    expect(d).not.toContain("Acme");
  });

  it("matches the client filter signal-for-signal", () => {
    expect(isIndiaJob({ title: "X", company: "CRED", location: "", remote: false, skills: [] })).toBe(true);
    expect(isIndiaJob({ title: "X", company: "Acme", location: "London, UK", remote: false, skills: [] })).toBe(false);
    expect(isIndiaJob({ title: "X", company: "Acme", location: "Pune, India", remote: false, skills: [] })).toBe(true);
  });
});
