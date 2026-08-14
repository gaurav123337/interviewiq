/* Leaderboard filters + company shortlist — pure functions over the
   ranked companies (services/jobs.ts). */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerProfile, JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import { EMPTY_RANK_FILTERS, filterRanks, listShortlist, rankCompanies, toggleShortlist } from "../services/jobs";

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
