/* Leaderboard filters + company shortlist — pure functions over the
   ranked companies (services/jobs.ts). */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerProfile, JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import { EMPTY_RANK_FILTERS, filterRanks, listShortlist, rankCompanies, recommendationsDigest, skillImpact, sortJobsByMatch, toggleShortlist } from "../services/jobs";

vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  isCloudConfigured: () => true,
  getSupabaseClient: vi.fn().mockResolvedValue({ from: vi.fn(), rpc: vi.fn() })
}));

const PROFILE: CareerProfile = {
  headline: "Senior Frontend Engineer",
  years: 6,
  location: "",
  remote: true,
  workAuth: "",
  targetTitles: ["Frontend Engineer"],
  skills: ["react", "typescript", "css"],
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
  skills: ["react", "typescript"],
  level: "senior",
  salary: { min: 120000, max: 150000, currency: "USD" },
  companySize: null,
  postedAt: null,
  ...over
});

beforeEach(() => { Object.values(STORAGE_KEYS).forEach(k => storageRemove(k)); });
afterEach(() => { Object.values(STORAGE_KEYS).forEach(k => storageRemove(k)); });

const mkRanks = () => rankCompanies(PROFILE, [
  job({ id: "a1", company: "Stripe", title: "Senior Frontend Engineer", remote: true }),
  job({ id: "a2", company: "Stripe", title: "Frontend Engineer", remote: true }),
  job({ id: "b1", company: "Lyft", title: "Frontend Engineer", remote: false, salary: null }),
  job({ id: "c1", company: "Dropbox", title: "Frontend Engineer", remote: true, salary: { min: 80000, max: 95000, currency: "USD" } })
]);

describe("filterRanks", () => {
  it("remote-only keeps companies whose best role is remote", () => {
    const ranks = mkRanks();
    const out = filterRanks(ranks, { ...EMPTY_RANK_FILTERS, remoteOnly: true }, new Set());
    expect(out.map(r => r.company)).toEqual(["Stripe", "Dropbox"]);
  });

  it("minScore filters by match %", () => {
    const ranks = mkRanks();
    /* Stripe: 3/3 skills + title + seniority + remote → high; Lyft on-site loses remote points */
    const out = filterRanks(ranks, { ...EMPTY_RANK_FILTERS, minScore: 60 }, new Set());
    expect(out.length).toBeGreaterThan(0);
    expect(out.every(r => r.score >= 60)).toBe(true);
  });

  it("minSalary drops companies whose best role lacks a high-enough band", () => {
    const ranks = mkRanks();
    const out = filterRanks(ranks, { ...EMPTY_RANK_FILTERS, minSalary: 100000 }, new Set());
    /* only Stripe's best role carries a band ≥ $100k */
    expect(out.map(r => r.company)).toEqual(["Stripe"]);
  });

  it("preserves the descending score order after filtering", () => {
    const ranks = mkRanks();
    const out = filterRanks(ranks, { ...EMPTY_RANK_FILTERS, remoteOnly: true }, new Set());
    expect(out.length).toBe(2);
    const scores = out.map(r => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("shortlistOnly keeps starred companies (set is lowercased, as persisted)", () => {
    const ranks = mkRanks();
    const out = filterRanks(ranks, { ...EMPTY_RANK_FILTERS, shortlistOnly: true }, new Set(["lyft"]));
    expect(out.map(r => r.company)).toEqual(["Lyft"]);
  });

  it("empty filters return everything unchanged", () => {
    const ranks = mkRanks();
    expect(filterRanks(ranks, EMPTY_RANK_FILTERS, new Set())).toEqual(ranks);
  });
});

describe("sortJobsByMatch", () => {
  const jobs3 = [
    job({ id: "j1", company: "A", title: "Low match" }),
    job({ id: "j2", company: "B", title: "High match" }),
    job({ id: "j3", company: "C", title: "Mid match" })
  ];

  it("sorts the feed by match % descending (best first)", () => {
    const out = sortJobsByMatch(jobs3, id => ({ j1: 20, j2: 90, j3: 55 })[id] ?? 0);
    expect(out.map(j => j.id)).toEqual(["j2", "j3", "j1"]);
  });

  it("is stable — equal scores keep the original order", () => {
    const out = sortJobsByMatch(jobs3, id => ({ j1: 40, j2: 40, j3: 40 })[id] ?? 0);
    expect(out.map(j => j.id)).toEqual(["j1", "j2", "j3"]);
  });

  it("unknown ids (no match computed) sort to the bottom, still stable", () => {
    const out = sortJobsByMatch(jobs3, id => (id === "j2" ? 80 : 0));
    expect(out.map(j => j.id)).toEqual(["j2", "j1", "j3"]);
  });

  it("never mutates the input array", () => {
    const before = jobs3.map(j => j.id);
    sortJobsByMatch(jobs3, id => ({ j1: 20, j2: 90, j3: 55 })[id] ?? 0);
    expect(jobs3.map(j => j.id)).toEqual(before);
  });
});

describe("recommendationsDigest — the weekly email body", () => {
  it("lists the top companies with scores and best-fit roles", () => {
    const d = recommendationsDigest(PROFILE, mkRanks(), 3);
    expect(d).toContain("weekly company recommendations");
    expect(d).toContain("1. Stripe");
    expect(d).toContain("2. Dropbox");
    expect(d).toContain("3. Lyft");
    expect(d).toContain("% match");
    expect(d).toContain("best fit: Senior Frontend Engineer");
  });

  it("calls out the biggest learnable gain when one exists", () => {
    /* a job with a skill the profile lacks → missing[0] boosts the score */
    const ranks = rankCompanies(PROFILE, [job({ id: "d1", title: "Fullstack Engineer", skills: ["react", "typescript", "python"] })]);
    const d = recommendationsDigest(PROFILE, ranks);
    expect(d).toMatch(/learn python and .* jumps from \d+% → \d+%/);
  });

  it("is safe with no profile and no ranks", () => {
    expect(recommendationsDigest(null, [])).toContain("no companies to recommend");
    expect(recommendationsDigest(null, mkRanks())).toContain("weekly company recommendations");
  });
});

describe("skillImpact — the “learn X → Y%” recommendation", () => {
  it("returns the boosted score when the top missing skill is learnable", () => {
    const ranks = rankCompanies(PROFILE, [
      job({ id: "g1", title: "Fullstack Engineer", skills: ["react", "typescript", "python"] })
    ]);
    const top = ranks[0];
    const impact = skillImpact(PROFILE, top);
    expect(impact).not.toBeNull();
    expect(impact!.skill).toBe("python");
    expect(impact!.from).toBe(top.score);
    expect(impact!.to).toBeGreaterThan(impact!.from);
  });

  it("returns null when the profile already covers every required skill", () => {
    const ranks = rankCompanies(PROFILE, [job({ id: "g2", title: "Frontend Engineer", skills: ["react", "typescript"] })]);
    expect(skillImpact(PROFILE, ranks[0])).toBeNull();
  });

  it("returns null without a profile", () => {
    const ranks = rankCompanies(PROFILE, [job({ id: "g3", title: "Fullstack Engineer", skills: ["react", "typescript", "python"] })]);
    expect(skillImpact(null, ranks[0])).toBeNull();
  });
});

describe("company shortlist", () => {
  it("toggle adds then removes, persisted lowercased", () => {
    expect(listShortlist()).toEqual([]);
    toggleShortlist("Airbnb");
    toggleShortlist("  Lyft  ");
    expect(listShortlist()).toEqual(["airbnb", "lyft"]);
    toggleShortlist("AIRBNB");
    expect(listShortlist()).toEqual(["lyft"]);
  });

  it("ignores empty names", () => {
    toggleShortlist("");
    expect(listShortlist()).toEqual([]);
  });
});
