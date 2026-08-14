/* Resume → profile → company ranking — the resume-upload match pipeline.
   Pure functions: resumeToProfile (services/resume) and rankCompanies
   (services/jobs) are tested without a UI or network. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerProfile, JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import { analyzeResume, resumeToProfile } from "../services/resume";
import { rankCompanies } from "../services/jobs";

vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  isCloudConfigured: () => true,
  getSupabaseClient: vi.fn().mockResolvedValue({ from: vi.fn(), rpc: vi.fn(), auth: { getSession: vi.fn() } })
}));

const FRONTEND_RESUME = `John Doe
Senior Frontend Engineer
Bengaluru, India · john@example.com · linkedin.com/in/john

SUMMARY
Senior frontend engineer with 7+ years building React and TypeScript
applications at scale. Strong in CSS, accessibility and performance.

EXPERIENCE
Senior Frontend Engineer — Acme Corp (2019 – Present)
- Led the migration to React 18 + TypeScript, cutting bundle size 40%
- Built the design system with Tailwind CSS and Storybook

Frontend Engineer — Beta Inc (2016 – 2019)
- Shipped GraphQL-powered dashboards with a Node.js backend

SKILLS
React, TypeScript, JavaScript, CSS, GraphQL, Node.js, Tailwind CSS, Docker`;

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
  skills: ["react", "typescript", "graphql", "kubernetes"],
  level: "senior",
  salary: null,
  companySize: null,
  postedAt: null,
  ...over
});

beforeEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

afterEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

describe("resumeToProfile", () => {
  it("extracts skills, years, headline and target titles from resume text", () => {
    const p = resumeToProfile(FRONTEND_RESUME);
    expect(p.headline).toBe("Senior Frontend Engineer");
    expect(p.years).toBe(7);
    expect(p.skills).toEqual(expect.arrayContaining([
      "JavaScript / TypeScript", "React · Vue · Angular", "CSS & accessibility"
    ]));
    expect(p.skills).toEqual(expect.arrayContaining(["GraphQL", "Node.js", "Tailwind CSS", "Docker"]));
    expect(p.targetTitles).toContain("Senior Frontend Engineer");
    expect(p.targetTitles).toContain("Frontend Engineer");
    expect(p.summary.length).toBeGreaterThan(0);
  });

  it("falls back to seniority-based years when none are stated", () => {
    const p = resumeToProfile("Principal Software Architect\nLed platform strategy at scale. React, TypeScript, AWS, Kafka.");
    expect(p.years).toBe(12);
    expect(p.skills.length).toBeGreaterThan(0);
  });

  it("strips the owner's name from header title lines", () => {
    const p = resumeToProfile(
      "Gaurav Gupta\nCTO Frontend Engineer\nGaurav Gupta  Frontend Architect\n12+ years building web products. React, TypeScript, AWS, Kubernetes."
    );
    expect(p.headline).toBe("CTO Frontend Engineer");
    expect(p.targetTitles).toContain("Frontend Architect");
    expect(p.targetTitles).not.toContain("Gaurav Gupta  Frontend Architect");
    expect(p.targetTitles.every(t => !t.includes("Gaurav Gupta"))).toBe(true);
  });

  it("only treats a standalone executive title as the level, never a prose mention", () => {
    const prose = analyzeResume("Senior Frontend Engineer\nWorked closely with the CTO on platform strategy. React, TypeScript, AWS.");
    expect(prose.levelId).not.toBe("cto");
    expect(prose.levelId).toBe("senior");
    const exec = analyzeResume("Gaurav Gupta\nCTO\nReact, TypeScript, AWS, Kubernetes.");
    expect(exec.levelId).toBe("cto");
  });

  it("keeps the owner's name+title header out of the extracted summary", () => {
    const p = resumeToProfile(
      "Gaurav Gupta\nGaurav Gupta  Frontend Architect\n12+ years building web products with React, TypeScript and AWS at scale.\nBengaluru, India"
    );
    expect(p.summary).not.toContain("Gaurav");
    expect(p.summary).toContain("building web products");
  });

  it("never treats a name pair as a title", () => {
    const p = resumeToProfile(
      "Gaurav Gupta\nBengaluru, India\nSenior Frontend Engineer at Acme\nReact, TypeScript, CSS."
    );
    expect(p.targetTitles).toContain("Senior Frontend Engineer");
    expect(p.targetTitles.some(t => t.toLowerCase().startsWith("gaurav"))).toBe(false);
    expect(p.targetTitles.some(t => t.toLowerCase().startsWith("bengaluru"))).toBe(false);
  });

  it("never fabricates skills from prose", () => {
    const p = resumeToProfile("I ride bicycles and enjoy cooking. Team player with great communication.");
    expect(p.skills).toEqual([]);
  });

  it("keeps the profile shape the matcher expects", () => {
    const p = resumeToProfile(FRONTEND_RESUME);
    expect(p.remote).toBe(true);
    expect(Array.isArray(p.skills)).toBe(true);
    expect(p.updatedAt).toBeGreaterThan(0);
  });
});

describe("rankCompanies", () => {
  const PROFILE: CareerProfile = {
    headline: "Senior Frontend Engineer",
    years: 7,
    location: "",
    remote: true,
    workAuth: "",
    targetTitles: ["Frontend Engineer"],
    skills: ["react", "typescript", "graphql", "css"],
    summary: "",
    updatedAt: 1
  };

  it("sorts companies by match % descending, best role wins", () => {
    const ranks = rankCompanies(PROFILE, [
      job({ id: "a1", company: "Stripe", title: "Senior Frontend Engineer", skills: ["react", "typescript", "kubernetes"] }),
      job({ id: "a2", company: "Stripe", title: "Security Engineer", skills: ["security", "oauth"] }),
      job({ id: "b1", company: "Lyft", title: "Frontend Engineer", skills: ["react", "typescript", "graphql"] }),
      job({ id: "c1", company: "Dropbox", title: "Sales Director", skills: [], level: "lead" })
    ]);
    expect(ranks.map(r => r.company)).toEqual(["Lyft", "Stripe", "Dropbox"]);
    /* Stripe's best role (Frontend) drives its score, not the Security one */
    const stripe = ranks.find(r => r.company === "Stripe")!;
    expect(stripe.best.title).toBe("Senior Frontend Engineer");
    expect(stripe.openings).toBe(2);
    /* a domain-mismatched company can never top the list */
    expect(ranks[2].score).toBeLessThanOrEqual(20);
  });

  it("ties break on more openings, then name", () => {
    const ranks = rankCompanies(PROFILE, [
      job({ id: "a1", company: "Stripe", title: "Frontend Engineer", skills: ["react"] }),
      job({ id: "b1", company: "Lyft", title: "Frontend Engineer", skills: ["react"] }),
      job({ id: "b2", company: "Lyft", title: "Frontend Engineer II", skills: ["react"] })
    ]);
    expect(ranks[0].company).toBe("Lyft");
    expect(ranks[0].score).toBe(ranks[1].score);
    expect(ranks[0].openings).toBe(2);
  });

  it("empty feed yields an empty ranking", () => {
    expect(rankCompanies(PROFILE, [])).toEqual([]);
  });

  it("works without a profile — scores are 0, verdicts 'no'", () => {
    const ranks = rankCompanies(null, [job()]);
    expect(ranks).toHaveLength(1);
    expect(ranks[0].score).toBe(0);
    expect(ranks[0].verdict).toBe("no");
  });
});
