/* Resume-vs-JD scan (services/jobs/jdScan) — paste a job description, score the
   career profile against it. Pure composition of analyzeJd + normalizeResume +
   matchJob, so it's tested without a UI or network. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerProfile } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import {
  deleteJdScan, extractJobTitle, jdToJob, listJdScans, mapLevel, matchScan,
  saveJdScan, scanResumeAgainstJd
} from "../services/jobs";

/* The services/jobs barrel pulls in feed/profile, which load cloud at module
   scope — stub it exactly as the resume-match suite does. */
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  isCloudConfigured: () => true,
  getSupabaseClient: vi.fn().mockResolvedValue({ from: vi.fn(), rpc: vi.fn(), auth: { getSession: vi.fn() } })
}));

const mkProfile = (over: Partial<CareerProfile> = {}): CareerProfile => ({
  headline: "Senior Frontend Engineer",
  years: 6,
  location: "",
  remote: true,
  workAuth: "",
  targetTitles: ["Frontend Engineer"],
  skills: ["React", "TypeScript"],
  summary: "",
  updatedAt: 1,
  ...over
});

const JUNIOR_JD = "Junior Frontend Developer\nWe are hiring a junior engineer. React and TypeScript required. Entry-level role.";
const STAFF_JD = "Staff Frontend Engineer\nWe need a staff engineer. React and TypeScript required. 8+ years.";
const SENIOR_JD = "Senior Frontend Engineer\nBuild with React and TypeScript. Kubernetes experience a plus. 6+ years.";

beforeEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});
afterEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

describe("mapLevel", () => {
  it("passes IC levels through and collapses exec/staff to the matcher's ceiling", () => {
    expect(mapLevel("junior")).toBe("junior");
    expect(mapLevel("mid")).toBe("mid");
    expect(mapLevel("senior")).toBe("senior");
    /* staff/principal/cto/ceo → "principal": the matcher only ranks
       junior<mid<senior<lead<principal, and these are all at-or-above any IC. */
    expect(mapLevel("staff")).toBe("principal");
    expect(mapLevel("principal")).toBe("principal");
    expect(mapLevel("cto")).toBe("principal");
    expect(mapLevel("ceo")).toBe("principal");
  });
});

describe("extractJobTitle", () => {
  it("picks the first short role-looking line", () => {
    expect(extractJobTitle("Senior Backend Engineer\nGreat opportunity to join.", "fallback"))
      .toBe("Senior Backend Engineer");
  });
  it("strips a trailing company/location clause and an 'at Company' suffix", () => {
    expect(extractJobTitle("Senior Frontend Engineer — Acme, Remote\n…", "fb")).toBe("Senior Frontend Engineer");
    expect(extractJobTitle("Backend Engineer at Stripe\n…", "fb")).toBe("Backend Engineer");
  });
  it("skips long prose lines and falls back", () => {
    const prose = "We are looking for a talented individual to join our growing engineering organisation.\nApply today";
    expect(extractJobTitle(prose, "Senior Frontend")).toBe("Senior Frontend");
  });
});

describe("jdToJob (synthetic posting)", () => {
  it("mines JD skills in the resume's vocabulary and shapes a scan-sourced posting", () => {
    const { job, detected } = jdToJob(SENIOR_JD, "scan:abc");
    expect(job.id).toBe("scan:abc");
    expect(job.source).toBe("scan");
    expect(job.externalId).toBe("abc");
    expect(job.title).toBe("Senior Frontend Engineer");
    expect(job.skills).toEqual(expect.arrayContaining(["React", "TypeScript", "Kubernetes"]));
    expect(job.level).toBe("senior");
    expect(detected.levelId).toBe("senior");
  });

  it("assumes remote unless the JD explicitly says otherwise (no false on-site blocker)", () => {
    expect(jdToJob("Frontend Engineer\nReact, TypeScript.", "scan:1").job.remote).toBe(true);
    expect(jdToJob("Frontend Engineer\nHybrid, 3 days in office.", "scan:2").job.remote).toBe(false);
    expect(jdToJob("Frontend Engineer\nThis is an on-site role in NYC.", "scan:3").job.remote).toBe(false);
  });
});

describe("matchScan — seniority direction (the corrected level-fit)", () => {
  it("flags a below-seniority role: a principal-level candidate scanning a junior JD", () => {
    const scan = scanResumeAgainstJd(JUNIOR_JD, 1000);
    const m = matchScan(mkProfile({ years: 9 }), scan); /* years ≥ 8 → principal */
    expect(m.blockers.some(b => /below your seniority/i.test(b))).toBe(true);
  });

  it("does NOT flag seniority when the role is above the candidate: junior scanning a staff JD", () => {
    const scan = scanResumeAgainstJd(STAFF_JD, 1000);
    const m = matchScan(mkProfile({ years: 1 }), scan); /* years < 2 → junior */
    expect(m.blockers.some(b => /below your seniority/i.test(b))).toBe(false);
  });
});

describe("matchScan — skills + live recompute", () => {
  it("splits JD skills into matched vs missing against the profile", () => {
    const scan = scanResumeAgainstJd(SENIOR_JD, 1000);
    const m = matchScan(mkProfile(), scan);
    expect(m.matched).toEqual(expect.arrayContaining(["React", "TypeScript"]));
    expect(m.missing).toContain("Kubernetes");
  });

  it("recomputes live — adding the missing skill moves it from missing to matched", () => {
    const scan = scanResumeAgainstJd(SENIOR_JD, 1000);
    const after = matchScan(mkProfile({ skills: ["React", "TypeScript", "Kubernetes"] }), scan);
    expect(after.missing).not.toContain("Kubernetes");
    expect(after.matched).toEqual(expect.arrayContaining(["React", "TypeScript", "Kubernetes"]));
  });

  it("without a profile → 'no' verdict, JD skills all missing", () => {
    const scan = scanResumeAgainstJd(SENIOR_JD, 1000);
    const m = matchScan(null, scan);
    expect(m.verdict).toBe("no");
    expect(m.missing).toEqual(scan.job.skills);
    expect(m.blockers[0]).toMatch(/complete your career profile/i);
  });
});

describe("scanResumeAgainstJd — deterministic id + persistence", () => {
  it("derives a stable id from the JD text alone (independent of the timestamp)", () => {
    const a = scanResumeAgainstJd(SENIOR_JD, 1000);
    const b = scanResumeAgainstJd(SENIOR_JD, 9999);
    expect(a.id).toBe(b.id);
    expect(a.id.startsWith("scan:")).toBe(true);
  });

  it("re-scanning the same JD replaces it — createdAt preserved, updatedAt bumped", () => {
    const first = scanResumeAgainstJd(SENIOR_JD, 1000);
    saveJdScan(first);
    const again = scanResumeAgainstJd(SENIOR_JD, 2000);
    const list = saveJdScan(again);
    expect(list).toHaveLength(1);
    expect(list[0].createdAt).toBe(1000);
    expect(list[0].updatedAt).toBe(2000);
  });

  it("keeps scans newest-first and deletes by id", () => {
    const s1 = scanResumeAgainstJd(SENIOR_JD, 1000);
    const s2 = scanResumeAgainstJd(JUNIOR_JD, 3000);
    saveJdScan(s1);
    saveJdScan(s2);
    expect(listJdScans().map(s => s.id)).toEqual([s2.id, s1.id]);
    deleteJdScan(s2.id);
    expect(listJdScans().map(s => s.id)).toEqual([s1.id]);
  });

  it("caps stored scans at 20, keeping the most recent", () => {
    for (let i = 0; i < 25; i++) {
      saveJdScan(scanResumeAgainstJd(`Backend Engineer opening ${i} needing Go and Kubernetes.`, 1000 + i));
    }
    const list = listJdScans();
    expect(list).toHaveLength(20);
    expect(list[0].updatedAt).toBe(1024); /* the newest survives */
    expect(list.every(s => s.updatedAt >= 1005)).toBe(true); /* the 5 oldest were dropped */
  });
});
