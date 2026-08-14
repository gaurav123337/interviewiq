/* Parity — the weekly-digest cron runs the Deno-free composer in
   supabase/functions/_shared/recommendationsDigest.ts. It must agree with
   the client's engine (services/jobs.ts) so the emailed digest shows the
   exact same companies, scores, and learnable gap the app displays. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerProfile, JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import { rankCompanies as clientRanks, recommendationsDigest as clientDigest } from "../services/jobs";
import {
  composeRecommendationsDigest, rankCompanies as serverRanks, recommendationsDigest as serverDigest,
  type Profile as ServerProfile, type Job as ServerJob
} from "../../supabase/functions/_shared/recommendationsDigest";

vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  isCloudConfigured: () => true,
  getSupabaseClient: vi.fn().mockResolvedValue({ from: vi.fn(), rpc: vi.fn() })
}));

const PROFILE: CareerProfile = {
  headline: "Senior Backend Engineer",
  years: 9,
  location: "India",
  remote: true,
  workAuth: "",
  targetTitles: ["Backend Engineer"],
  skills: ["go", "kubernetes", "postgresql", "docker", "terraform"],
  summary: "",
  updatedAt: 1
};

const SERVER_PROFILE: ServerProfile = {
  headline: "Senior Backend Engineer",
  years: 9,
  location: "India",
  remote: true,
  targetTitles: ["Backend Engineer"],
  skills: ["go", "kubernetes", "postgresql", "docker", "terraform"],
  summary: ""
};

const job = (over: Partial<JobPosting> = {}): JobPosting => ({
  id: "greenhouse:1",
  source: "greenhouse",
  externalId: "1",
  title: "Senior Backend Engineer",
  company: "Stripe",
  location: "Remote - US",
  remote: true,
  description: "",
  url: "https://careers.example.com/1",
  skills: ["go", "kubernetes"],
  level: "senior",
  salary: { min: 120000, max: 150000, currency: "USD" },
  companySize: null,
  postedAt: null,
  ...over
});

const toServer = (j: JobPosting): ServerJob => ({
  title: j.title,
  company: j.company,
  location: j.location ?? "",
  remote: j.remote,
  level: j.level ?? null,
  skills: j.skills
});

const JOBS: JobPosting[] = [
  job({ id: "a1", company: "Stripe", title: "Senior Backend Engineer", skills: ["go", "kubernetes", "postgresql", "docker", "terraform", "aws"] }),
  job({ id: "b1", company: "Lyft", title: "Frontend Engineer", remote: false, skills: ["react", "css"], level: "mid" }),
  job({ id: "c1", company: "Dropbox", title: "Site Reliability Engineer", skills: ["kubernetes", "terraform", "aws"], level: "senior" })
];

beforeEach(() => { Object.values(STORAGE_KEYS).forEach(k => storageRemove(k)); });
afterEach(() => { Object.values(STORAGE_KEYS).forEach(k => storageRemove(k)); });

describe("parity: server composer vs client engine", () => {
  it("ranks companies identically (same order, scores, gaps)", () => {
    const client = clientRanks(PROFILE, JOBS);
    const server = serverRanks(SERVER_PROFILE, JOBS.map(toServer));
    expect(server.map(r => r.company)).toEqual(client.map(r => r.company));
    for (let i = 0; i < client.length; i++) {
      expect(server[i].score).toBe(client[i].score);
      expect(server[i].verdict).toBe(client[i].verdict);
      expect(server[i].openings).toBe(client[i].openings);
      expect(server[i].missing).toEqual(client[i].missing);
    }
  });

  it("composes the identical digest text", () => {
    const client = clientDigest(PROFILE, clientRanks(PROFILE, JOBS));
    const server = serverDigest(SERVER_PROFILE, serverRanks(SERVER_PROFILE, JOBS.map(toServer)));
    expect(server).toBe(client);
    expect(server).toContain("1. Stripe");
    expect(server).toContain("weekly company recommendations");
  });

  it("composeRecommendationsDigest returns null without a profile or jobs", () => {
    expect(composeRecommendationsDigest(null, JOBS.map(toServer))).toBeNull();
    expect(composeRecommendationsDigest(SERVER_PROFILE, [])).toBeNull();
    expect(composeRecommendationsDigest({ ...SERVER_PROFILE, skills: [] }, JOBS.map(toServer))).toBeNull();
  });

  it("flags the learnable gap the same way (learn X → Y%)", () => {
    /* Dropbox's best role needs aws, which the profile lacks */
    const client = clientDigest(PROFILE, clientRanks(PROFILE, JOBS));
    const server = serverDigest(SERVER_PROFILE, serverRanks(SERVER_PROFILE, JOBS.map(toServer)));
    expect(client).toMatch(/learn (aws|terraform)/);
    expect(server).toBe(client);
  });
});
