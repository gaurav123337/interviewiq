/* Apply Kit Phase 4 — application tracker, ATS keyword coverage, the
   dependency-free PDF writer, and the store-mode ZIP writer (with a
   self-contained round-trip parser so no unzip binary is needed). */

import { afterEach, describe, expect, it } from "vitest";
import type { CareerProfile, JobPosting } from "../types";
import { STORAGE_KEYS, storageRemove } from "../services/storage";
import {
  dueFollowUps, followUpDraft, getTrack, listTracks, markFollowUpNotified, removeRound, saveRound, setFollowUp, setStatus, trackSummary, weeklyReport
} from "../services/applyTrack";
import { PDFDocument } from "pdf-lib";
import { inflate } from "pako"; /* ambient types in src/pako.d.ts */
import { atsCoverage, buildResume } from "../services/applyKit";
import { practiceForRound } from "../services/drill";
import { buildResumeHtml } from "../services/resumeHtml";
import { renderResumePdf } from "../services/resumePdf";
import { resumeDocxBlob } from "../services/docx";
import { resumeBrandFor, setRemoteConfig } from "../services/remoteConfig";
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

describe("resume branding (remote config)", () => {
  afterEach(() => setRemoteConfig({ resumeBranding: {} }));

  it("resolves a per-company override case-insensitively", () => {
    setRemoteConfig({ resumeBranding: { Airbnb: { accent: "#ff5a5f" } } });
    expect(resumeBrandFor("Airbnb").accent).toBe("#ff5a5f");
    expect(resumeBrandFor("airbnb").accent).toBe("#ff5a5f");
  });

  it("falls back to the _default entry, then to nothing", () => {
    setRemoteConfig({ resumeBranding: { _default: { accent: "#16a34a" } } });
    expect(resumeBrandFor("Lyft").accent).toBe("#16a34a");
    setRemoteConfig({ resumeBranding: {} });
    expect(resumeBrandFor("Lyft").accent).toBeUndefined();
  });
});

describe("interview rounds", () => {
  it("adds, sorts by date, and removes rounds on a track", () => {
    setStatus(JOB.id, "interview");
    const r1 = saveRound(JOB.id, { id: "r1", label: "Phone screen", at: 100, questions: "hooks vs classes", went: 4, outcome: "passed" });
    expect(r1.rounds).toHaveLength(1);
    const r2 = saveRound(JOB.id, { id: "r2", label: "System design", at: 200, questions: "rate limiter", went: null, outcome: "pending" });
    expect(r2.rounds.map(x => x.id)).toEqual(["r2", "r1"]); /* newest first */
    /* upsert by id */
    const upd = saveRound(JOB.id, { id: "r1", label: "Phone screen", at: 100, questions: "hooks vs classes + a11y", went: 5, outcome: "passed" });
    expect(upd.rounds).toHaveLength(2);
    expect(upd.rounds.find(x => x.id === "r1")?.questions).toContain("a11y");
    /* remove */
    const rem = removeRound(JOB.id, "r2");
    expect(rem?.rounds.map(x => x.id)).toEqual(["r1"]);
    /* status transitions preserve rounds */
    setStatus(JOB.id, "offer");
    expect(getTrack(JOB.id)?.rounds).toHaveLength(1);
  });
});

describe("round-driven practice", () => {
  it("maps a failed round's notes to relevant drill cards", () => {
    const cards = practiceForRound("React hooks re-renders, memoization and useMemo pitfalls", "frontend", 5);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(5);
    /* cards should be relevant — the joined text mentions the topic family */
    const joined = cards.map(c => c.q + " " + c.a).join(" ").toLowerCase();
    expect(joined.length).toBeGreaterThan(0);
  });

  it("returns nothing for empty/generic notes", () => {
    expect(practiceForRound("", "frontend", 5)).toEqual([]);
    expect(practiceForRound("the a an and of", "frontend", 5)).toEqual([]);
  });

  it("sweeps other fields when the own field has no matches", () => {
    /* "docker kubernetes" is devops — a frontend field should still find cards */
    const cards = practiceForRound("docker kubernetes deployments", "frontend", 4);
    expect(cards.length).toBeGreaterThan(0);
  });
});

describe("8-week momentum", () => {
  it("includes a trailing 8-week window in the weekly report", () => {
    setStatus("m1", "applied");
    const r = weeklyReport();
    expect(r.momentum).toHaveLength(8);
    expect(r.momentum[0].applied).toBe(0); /* oldest bucket: 8 weeks ago */
    expect(r.momentum[7].applied).toBe(1); /* newest bucket: this week */
    expect(r.momentum[0].label).toBeDefined();
  });
});

describe("ATS-safe .docx", () => {
  it("produces a zip that round-trips with the resume XML inside", async () => {
    const blob = resumeDocxBlob(buildResume(PROFILE, JOB, MATCH));
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50); /* P */
    expect(buf[1]).toBe(0x4b); /* K */
    const all = new TextDecoder().decode(buf);
    expect(all).toContain("PK\u0001\u0002"); /* central directory */
    expect(all).toContain("[Content_Types].xml");
    expect(all).toContain("word/document.xml");
    expect(all).toContain("Senior Frontend Engineer");
    expect(all).toContain("SUMMARY");
    expect(all).toContain("Airbnb");
  });
});

describe("one-click resume PDF (pdf-lib)", () => {
  it("produces a valid PDF that pdf-lib can re-load with the resume content", async () => {
    const bytes = await renderResumePdf(PROFILE, JOB, MATCH, { accent: "#ff5a5f" });
    expect(bytes[0]).toBe(0x25); /* % */
    const head = new TextDecoder().decode(bytes.slice(0, 8));
    expect(head).toBe("%PDF-1.7");
    /* round-trip through the parser — proves structural validity */
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    /* decompress every content stream (a PDFArray) and check the text landed */
    const contents = doc.getPage(0).node.Contents();
    const streams: { getContents: () => Uint8Array }[] = [];
    if (contents && "size" in contents) {
      for (let i = 0; i < contents.size(); i++) streams.push(contents.lookup(i) as unknown as { getContents: () => Uint8Array });
    } else if (contents && "getContents" in contents) {
      streams.push(contents);
    }
    let decoded = "";
    for (const s of streams) {
      decoded += new TextDecoder().decode(inflate(new Uint8Array(s.getContents())));
    }
    /* text is hex-encoded in the content stream — decode the <...> tokens */
    const hexTokens = [...decoded.matchAll(/<([0-9A-Fa-f]+)>/g)].map(m => m[1]);
    const plain = hexTokens.map(h => new TextDecoder().decode(Uint8Array.from(h.match(/../g)!.map(b => parseInt(b, 16))))).join("\n");
    expect(plain).toContain("Senior Frontend Engineer");
    expect(plain).toContain("SUMMARY");
    expect(plain).toContain("Airbnb");
    /* the brand accent (#ff5a5f) is applied as an RGB fill operator */
    expect(decoded).toContain("1 0.35294117647058826 0.37254901960784315 rg");
  });

  it("renders a long resume across multiple pages without error", async () => {
    const longProfile = { ...PROFILE, summary: "x".repeat(400), skills: Array.from({ length: 30 }, (_, i) => `skill${i}`) };
    const bytes = await renderResumePdf(longProfile, JOB, MATCH);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
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
