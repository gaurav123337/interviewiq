/* Jobs feature (Phase 1) — verdict matcher, career profile persistence,
   feed mapping, and the refresh trigger. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerProfile, JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove, storageSet } from "../services/storage";

const from = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());

vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  isCloudConfigured: () => true,
  getSupabaseClient: vi.fn().mockResolvedValue({
    from,
    rpc,
    auth: { getSession }
  })
}));

const PROFILE: CareerProfile = {
  headline: "Senior Frontend Engineer",
  years: 6,
  location: "Bengaluru, India",
  remote: true,
  workAuth: "India citizen",
  targetTitles: ["Frontend Engineer", "Full Stack Developer"],
  skills: ["react", "typescript", "node", "css", "graphql"],
  summary: "",
  updatedAt: 1
};

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
  from.mockReset();
  rpc.mockReset();
  getSession.mockReset();
  /* default chain so best-effort cloud writes never throw unhandled */
  from.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) });
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

afterEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

describe("matchJob verdicts", () => {
  it("strong match: most skills covered, title + seniority + remote all align", async () => {
    const { matchJob } = await import("../services/jobs");
    const m = matchJob(PROFILE, job());
    expect(m.verdict).toBe("strong");
    expect(m.score).toBeGreaterThanOrEqual(75);
    expect(m.matched).toEqual(expect.arrayContaining(["react", "typescript", "graphql"]));
    expect(m.missing).toContain("kubernetes");
    expect(m.blockers).toEqual([]);
  });

  it("stretch: few skills overlap and the role is on-site while the profile prefers remote", async () => {
    const { matchJob } = await import("../services/jobs");
    const m = matchJob(PROFILE, job({ title: "Backend Engineer (Go)", skills: ["golang", "terraform", "aws"], remote: false, location: "Warsaw" }));
    expect(["stretch", "moderate", "no"]).toContain(m.verdict);
    expect(m.missing).toEqual(expect.arrayContaining(["golang", "terraform"]));
    expect(m.blockers.some(b => /remote/i.test(b))).toBe(true);
    expect(m.score).toBeLessThan(60);
  });

  it("not recommended without a profile — with a clear blocker", async () => {
    const { matchJob } = await import("../services/jobs");
    const m = matchJob(null, job());
    expect(m.verdict).toBe("no");
    expect(m.score).toBe(0);
    expect(m.blockers[0]).toMatch(/Complete your career profile/i);
  });

  it("no extracted skills on the job → neutral skills score, verdict still computable", async () => {
    const { matchJob } = await import("../services/jobs");
    const m = matchJob(PROFILE, job({ skills: [] }));
    expect(["strong", "good", "moderate"]).toContain(m.verdict);
    expect(m.matched).toEqual([]);
    expect(m.missing).toEqual([]);
  });

  it("junior job for a senior profile is a stretch, not a blocker", async () => {
    const { matchJob } = await import("../services/jobs");
    const m = matchJob(PROFILE, job({ title: "Junior Developer", level: "junior" }));
    expect(m.score).toBeLessThan(75);
  });

  it("domain gate: a Sales role can never be a Good fit for an engineer", async () => {
    const { matchJob } = await import("../services/jobs");
    const m = matchJob(PROFILE, job({ title: "Director, Sales Compensation", company: "Dropbox", level: "lead", skills: [] }));
    expect(m.verdict).toBe("no");
    expect(m.score).toBeLessThanOrEqual(20);
    expect(m.blockers.some(b => /Outside your field/i.test(b))).toBe(true);
  });

  it("domain gate: a Legal role with prose-looking skills gets no skill credit", async () => {
    const { matchJob } = await import("../services/jobs");
    const m = matchJob(PROFILE, job({ title: "Senior Counsel, Litigation", level: "senior", skills: ["express", "rust"] }));
    expect(m.verdict).toBe("no");
    expect(m.matched).toEqual([]);
    expect(m.blockers.some(b => /Outside your field/i.test(b))).toBe(true);
  });

  it("compound profile labels match raw job tokens (JavaScript / TypeScript ↔ typescript)", async () => {
    const { matchJob } = await import("../services/jobs");
    const m = matchJob({ ...PROFILE, skills: ["JavaScript / TypeScript", "React · Vue · Angular", "CSS & accessibility"] }, job({ skills: ["typescript", "react", "css"] }));
    expect(m.matched.sort()).toEqual(["css", "react", "typescript"]);
    expect(m.missing).toEqual([]);
  });

  it("seniority words never count as a title match", async () => {
    const { matchJob } = await import("../services/jobs");
    const m = matchJob(PROFILE, job({ title: "Senior Account Manager", skills: [], level: "lead" }));
    expect(m.matched).toEqual([]);
    /* the "Senior" word in the title gives no points — domain mismatch caps it */
    expect(m.verdict).toBe("no");
  });
});

describe("inferDomain", () => {
  it("classifies engineering, data, design and sales titles", async () => {
    const { inferDomain } = await import("../services/jobs");
    expect(inferDomain("Senior Frontend Engineer")).toBe("software");
    expect(inferDomain("Staff Data Scientist")).toBe("data");
    expect(inferDomain("Product Designer")).toBe("design");
    expect(inferDomain("Account Executive")).toBe("sales");
    expect(inferDomain("Tax Manager")).toBe("finance");
    expect(inferDomain("Recruiter")).toBe("hr");
  });
});

describe("career profile persistence", () => {
  it("save then get round-trips through storage", async () => {
    const { getCareerProfile, saveCareerProfile } = await import("../services/jobs");
    saveCareerProfile(PROFILE);
    const got = getCareerProfile();
    expect(got?.headline).toBe("Senior Frontend Engineer");
    expect(got?.skills).toEqual(PROFILE.skills);
    expect(got?.updatedAt).toBeGreaterThan(0);
  });

  it("defaultCareerProfile prefills skills from the diagnostic skill profile", async () => {
    storageSet(STORAGE_KEYS.skills, { goal: {}, skills: [{ skill: "react", self: 4 }, { skill: "kubernetes", self: 1 }] });
    const { defaultCareerProfile } = await import("../services/jobs");
    const p = defaultCareerProfile();
    expect(p.skills).toContain("react");
    expect(p.skills).not.toContain("kubernetes");
    expect(p.remote).toBe(true);
  });
});

describe("feed services", () => {
  it("loadJobsFromCloud maps DB rows to postings and caches them", async () => {
    const order = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [
      { source: "greenhouse", external_id: "9", title: "Staff Engineer", company: "Lyft", location: "San Francisco", remote: false, description: "x", url: "u", skills: ["python"], level: "staff", posted_at: "2026-01-01T00:00:00Z" }
    ], error: null }) });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ order }) });
    const { loadJobsFromCloud, listJobs } = await import("../services/jobs");
    const jobs = await loadJobsFromCloud();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: "greenhouse:9", title: "Staff Engineer", company: "Lyft" });
    expect(listJobs()).toHaveLength(1);
    expect(from).toHaveBeenCalledWith("jobs");
  });

  it("refreshJobs posts to jobs-fetch with the auth token and reloads the feed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ added: 3, updated: 1, total: 12 }) });
    vi.stubGlobal("fetch", fetchMock);
    getSession.mockResolvedValue({ data: { session: { access_token: "tok-jobs" } } });
    const order = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ order }) });
    const { refreshJobs } = await import("../services/jobs");
    const r = await refreshJobs();
    expect(r).toEqual({ added: 3, updated: 1, total: 12 });
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/jobs-fetch");
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer tok-jobs");
    vi.unstubAllGlobals();
  });

  it("refreshJobs surfaces a server rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Sign in to refresh the job feed" }) }));
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    const { refreshJobs } = await import("../services/jobs");
    await expect(refreshJobs()).rejects.toThrow(/Sign in/);
    vi.unstubAllGlobals();
  });
});

describe("dedupeJobs (cross-source collapse)", () => {
  const j = (over: Partial<JobPosting>): JobPosting => ({
    id: "x", source: "greenhouse", externalId: "1", title: "Senior Frontend Engineer", company: "Acme",
    location: "Remote", remote: true, description: "React + TypeScript at scale.", url: "https://a.com/1",
    skills: ["react", "typescript"], level: "senior", salary: null, companySize: null, postedAt: null, ...over
  });

  it("collapses the same role across sources and keeps the richer posting", async () => {
    const { dedupeJobs } = await import("../services/jobs");
    const ats = j({ id: "gh:1", source: "greenhouse", skills: ["react", "typescript"], salary: { min: 100000, max: 130000, currency: "USD" } });
    const rss = j({ id: "rss:1", source: "rss", skills: [], salary: null, url: "https://rss.example.com/1" });
    const out = dedupeJobs([rss, ats]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("gh:1"); /* the ATS posting wins over RSS */
    expect(out[0].alsoSources).toEqual(["RSS"]);
  });

  it("keeps genuinely different roles separate", async () => {
    const { dedupeJobs } = await import("../services/jobs");
    const a = j({ id: "1", title: "Senior Frontend Engineer" });
    const b = j({ id: "2", title: "Backend Engineer" });
    expect(dedupeJobs([a, b])).toHaveLength(2);
  });

  it("leaves a solo posting without an alsoSources tag", async () => {
    const { dedupeJobs } = await import("../services/jobs");
    expect(dedupeJobs([j({})])[0].alsoSources).toBeUndefined();
  });
});
