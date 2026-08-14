/* Apply Kit Phase 3 — tailored resume + cover letter generator:
   JD-aware builders, per-job persistence, and the AI-tailoring fallback. */

import { afterEach, describe, expect, it } from "vitest";
import type { CareerProfile, JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import { buildCoverLetter, buildResume, getApplyKit, saveApplyKit } from "../services/applyKit";

const PROFILE: CareerProfile = {
  headline: "Senior Frontend Engineer",
  years: 6,
  location: "Bengaluru, India",
  remote: true,
  workAuth: "India citizen",
  targetTitles: ["Frontend Engineer"],
  skills: ["react", "typescript", "css", "node"],
  summary: "Built design systems and performance tooling used by millions.",
  updatedAt: 1
};

const JOB: JobPosting = {
  id: "greenhouse:1",
  source: "greenhouse",
  externalId: "1",
  title: "Senior Frontend Engineer",
  company: "Airbnb",
  location: "Remote - US",
  remote: true,
  description: "React, TypeScript, design systems.",
  url: "https://x/1",
  skills: ["react", "typescript", "accessibility"],
  level: "senior",
  salary: { min: 120000, max: 150000, currency: "USD" },
  companySize: "large",
  postedAt: null
};

const MATCH = {
  score: 72,
  verdict: "good" as const,
  matched: ["react", "typescript"],
  missing: ["accessibility"],
  blockers: [] as string[]
};

afterEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

describe("buildResume", () => {
  it("includes the job title and company so it reads as written-for-this-role", () => {
    const r = buildResume(PROFILE, JOB, MATCH);
    expect(r).toContain("Airbnb");
    expect(r).toContain("Senior Frontend Engineer");
  });

  it("prioritizes matched skills before the rest of the profile", () => {
    const r = buildResume(PROFILE, JOB, MATCH);
    const skillsIdx = r.indexOf("SKILLS");
    const section = r.slice(skillsIdx);
    expect(section.indexOf("react")).toBeLessThan(section.indexOf("css"));
  });

  it("adds an honest growth line for the top missing skill", () => {
    const r = buildResume(PROFILE, JOB, MATCH);
    expect(r).toContain("accessibility");
    expect(r).toContain("GROWTH");
  });

  it("works with no match (neutral context) and no summary", () => {
    const r = buildResume({ ...PROFILE, summary: "" }, JOB, null);
    expect(r).toContain("Airbnb");
    expect(r).toContain("SKILLS");
    expect(r).not.toContain("GROWTH");
  });

  it("handles an empty skills list without breaking", () => {
    const r = buildResume({ ...PROFILE, skills: [] }, JOB, { ...MATCH, matched: [], missing: [] });
    expect(r).toContain("HIGHLIGHTS");
  });
});

describe("buildCoverLetter", () => {
  it("addresses the company and role directly", () => {
    const c = buildCoverLetter(PROFILE, JOB, MATCH);
    expect(c).toContain("Airbnb");
    expect(c).toContain("Senior Frontend Engineer role");
  });

  it("names matched strengths and the honest gap", () => {
    const c = buildCoverLetter(PROFILE, JOB, MATCH);
    expect(c).toContain("react");
    expect(c).toContain("typescript");
    expect(c).toContain("accessibility");
  });

  it("signs off with the candidate headline", () => {
    const c = buildCoverLetter(PROFILE, JOB, MATCH);
    expect(c.trim().endsWith("Senior Frontend Engineer")).toBe(true);
  });

  it("regenerating with a skill added via ＋ mirrors it back into the letter", () => {
    /* the one-click add flow: profile gains the skill, the letter is rebuilt
       from the new profile + match — the keyword must land in the text */
    const next = { ...PROFILE, skills: [...PROFILE.skills, "graphql"] };
    const c = buildCoverLetter(next, JOB, { ...MATCH, matched: [...MATCH.matched, "graphql"], missing: MATCH.missing.filter(s => s !== "graphql") });
    expect(c.toLowerCase()).toContain("graphql");
  });
});

describe("persistence", () => {
  it("round-trips a kit per job id", () => {
    saveApplyKit({
      jobId: JOB.id,
      jobTitle: JOB.title,
      company: JOB.company,
      resume: "resume body",
      coverLetter: "letter body",
      ai: false,
      createdAt: 2
    });
    const kit = getApplyKit(JOB.id);
    expect(kit?.resume).toBe("resume body");
    expect(kit?.coverLetter).toBe("letter body");
    expect(getApplyKit("other:id")).toBeNull();
  });
});
