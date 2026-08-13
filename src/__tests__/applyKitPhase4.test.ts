/* Apply Kit Phase 4 — application tracker, ATS keyword coverage, the
   dependency-free PDF writer, and the store-mode ZIP writer (with a
   self-contained round-trip parser so no unzip binary is needed). */

import { afterEach, describe, expect, it } from "vitest";
import type { CareerProfile, JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import {
  dueFollowUps, followUpDraft, getTrack, listTracks, markFollowUpNotified, setFollowUp, setStatus, trackSummary, weeklyReport
} from "../services/applyTrack";
import { atsCoverage } from "../services/applyKit";
import { buildResumeHtml } from "../services/resumeHtml";
import { crc32, zipFiles, type ZipEntry } from "../services/zip";

const JOB: JobPosting = {
  id: "greenhouse:1",
  source: "greenhouse",
  externalId: "1",
  title: "Senior Frontend Engineer",
  company: "Airbnb",
  location: "Remote",
  remote: true,
  description: "",
  url: "https://x/1",
  skills: ["react", "typescript", "accessibility"],
  level: "senior",
  postedAt: null
};

afterEach(() => {
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

describe("apply tracker", () => {
  it("creates a track on first status set and persists it", () => {
    setStatus(JOB.id, "applied");
    const t = getTrack(JOB.id);
    expect(t?.status).toBe("applied");
    expect(t?.appliedAt).not.toBeNull();
    expect(listTracks()).toHaveLength(1);
  });

  it("advances through the pipeline without losing the applied date", () => {
    setStatus(JOB.id, "applied");
    const appliedAt = getTrack(JOB.id)!.appliedAt;
    setStatus(JOB.id, "interview");
    expect(getTrack(JOB.id)?.status).toBe("interview");
    expect(getTrack(JOB.id)?.appliedAt).toBe(appliedAt);
  });

  it("tracks follow-up dates and surfaces only un-notified due items", () => {
    setStatus(JOB.id, "applied");
    setFollowUp(JOB.id, Date.now() - 1000);
    const due = dueFollowUps();
    expect(due).toHaveLength(1);
    markFollowUpNotified(JOB.id);
    expect(dueFollowUps()).toHaveLength(0);
  });

  it("excludes offers and rejections from due reminders", () => {
    setStatus(JOB.id, "offer");
    setFollowUp(JOB.id, Date.now() - 1000);
    expect(dueFollowUps()).toHaveLength(0);
  });

  it("summarizes counts by status", () => {
    setStatus("a", "applied");
    setStatus("b", "interview");
    setStatus("c", "rejected");
    const s = trackSummary();
    expect(s.applied).toBe(1);
    expect(s.interview).toBe(1);
    expect(s.rejected).toBe(1);
    expect(s.saved).toBe(0);
  });
});

describe("atsCoverage", () => {
  it("scores full coverage when every required skill is present", () => {
    const r = atsCoverage("I know react and typescript and care deeply about accessibility.", JOB);
    expect(r.score).toBe(100);
    expect(r.found).toHaveLength(3);
    expect(r.missing).toHaveLength(0);
  });

  it("reports missing skills with a proportional score", () => {
    const r = atsCoverage("I know react.", JOB);
    expect(r.score).toBe(33);
    expect(r.missing).toEqual(["typescript", "accessibility"]);
  });

  it("scores zero when nothing matches", () => {
    expect(atsCoverage("hello world", JOB).score).toBe(0);
  });

  it("is safe with empty skill lists", () => {
    expect(atsCoverage("anything", { ...JOB, skills: [] }).score).toBe(0);
  });
});

const PROFILE: CareerProfile = {
  headline: "Senior Frontend Engineer",
  years: 6,
  location: "Bengaluru, India",
  remote: true,
  workAuth: "India citizen",
  targetTitles: ["Frontend Engineer"],
  skills: ["react", "typescript", "css"],
  summary: "Built design systems used by millions.",
  updatedAt: 1
};

const MATCH = { score: 72, verdict: "good" as const, matched: ["react"], missing: ["accessibility"], blockers: [] as string[] };

describe("weekly report", () => {
  it("computes response rate and follow-up completion over the window", () => {
    const now = Date.now();
    setStatus("a", "applied"); /* applied in window, no movement */
    setFollowUp("a", now - 1000);
    setStatus("b", "applied");
    setFollowUp("b", now - 1000);
    setStatus("b", "interview"); /* actioned the follow-up */
    const r = weeklyReport(now);
    expect(r.applied).toBe(2);
    expect(r.interviews).toBe(1);
    expect(r.responseRate).toBe(50);
    expect(r.followUpsDue).toBe(1);
    expect(r.followUpsDone).toBe(1);
    expect(r.byWeek).toHaveLength(4);
  });

  it("is safe with no tracked jobs", () => {
    const r = weeklyReport();
    expect(r.applied).toBe(0);
    expect(r.responseRate).toBe(0);
  });
});

describe("follow-up drafts", () => {
  it("writes a polite applied-stage nudge mentioning role + company", () => {
    const d = followUpDraft("applied", "Senior Frontend Engineer", "Airbnb", 10);
    expect(d).toContain("Senior Frontend Engineer at Airbnb");
    expect(d).toContain("check in");
  });

  it("writes a post-interview thank-you", () => {
    const d = followUpDraft("interview", "Engineer", "Lyft", 3);
    expect(d).toContain("interview");
    expect(d).toContain("Lyft");
  });

  it("writes an offer-stage acknowledgement", () => {
    const d = followUpDraft("offer", "Engineer", "Dropbox", 1);
    expect(d).toContain("offer");
    expect(d).toContain("Dropbox");
  });
});

describe("designed resume HTML", () => {
  it("renders sections with the accent color and print hook", () => {
    const html = buildResumeHtml(PROFILE, JOB, MATCH);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("window.print");
    expect(html).toContain("#4f46e5"); /* default accent */
    expect(html).toContain("SUMMARY");
    expect(html).toContain("Airbnb");
    expect(html).toContain("Senior Frontend Engineer");
  });

  it("honors a brand accent override and escapes HTML", () => {
    const html = buildResumeHtml(PROFILE, { ...JOB, company: "A&B Corp" }, MATCH, { accent: "#16a34a" });
    expect(html).toContain("#16a34a");
    expect(html).not.toContain("A&B Corp");
    expect(html).toContain("A&amp;B Corp");
  });
});

describe("zip writer", () => {
  it("computes CRC32 correctly for a known string", () => {
    /* crc32("123456789") == 0xCBF43926 — the canonical check value */
    const bytes = new TextEncoder().encode("123456789");
    expect(crc32(bytes)).toBe(0xcbf43926);
  });

  it("round-trips entries through a self-contained ZIP parser", async () => {
    const entries: ZipEntry[] = [
      { name: "airbnb/senior-frontend-resume.txt", content: "resume body" },
      { name: "airbnb/senior-frontend-cover-letter.txt", content: "cover body" }
    ];
    const blob = zipFiles(entries);
    const buf = new Uint8Array(await blob.arrayBuffer());

    /* minimal parser: walk local headers (PK\x03\x04) for name + data */
    const name1 = new TextEncoder().encode(entries[0].name);
    const name2 = new TextEncoder().encode(entries[1].name);
    expect(buf[0]).toBe(0x50); /* P */
    expect(buf[1]).toBe(0x4b); /* K */
    expect(buf[2]).toBe(0x03); /* local header sig */

    /* entry 1: header(30) + name + data */
    let p = 30;
    expect([...buf.slice(p, p + name1.length)]).toEqual([...name1]);
    p += name1.length;
    const d1 = new TextDecoder().decode(buf.slice(p, p + 11));
    expect(d1).toBe("resume body");
    p += 11;

    /* entry 2 */
    expect(buf[p]).toBe(0x50);
    expect(buf[p + 2]).toBe(0x03);
    p += 30;
    expect([...buf.slice(p, p + name2.length)]).toEqual([...name2]);
    p += name2.length;
    expect(new TextDecoder().decode(buf.slice(p, p + 10))).toBe("cover body");

    /* central directory present (PK\x01\x02) with EOCD after */
    const all = new TextDecoder().decode(buf);
    expect(all).toContain("PK\u0001\u0002");
    expect(all).toContain("PK\u0005\u0006");
  });
});
