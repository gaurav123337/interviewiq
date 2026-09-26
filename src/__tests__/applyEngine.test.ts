/* Tests for the auto-apply engine's PURE layer (apply-engine-lib.js) —
   site rules, question classification, honest answers, matching, reports.
   The Playwright driver (auto-apply-jobs.mjs) is local-only and untestable in
   CI; everything safety-critical (submit gates, fail-closed classification,
   never-invent-answers) lives in the pure lib and is pinned here. */
import { describe, expect, it } from "vitest";
import {
  SITE_RULES, siteFromUrl, classifyQuestion, draftAnswer,
  valueMatchesList, newReport, recordResult, reportLine, buildReportMarkdown, buildApplyReportSql
} from "../../scripts/apply-engine-lib.js";

describe("siteFromUrl", () => {
  it("routes the owner's three boards to their rules", () => {
    expect(siteFromUrl("https://www.linkedin.com/jobs/")).toBe("linkedin");
    expect(siteFromUrl("https://www.naukri.com/mnjuser/recommendedjobs")).toBe("naukri");
    expect(siteFromUrl("https://www.instahyre.com/candidate/opportunities/?matching=true")).toBe("instahyre");
  });

  it("falls back to generic for unknown boards", () => {
    expect(siteFromUrl("https://jobs.lever.co/acme/123")).toBe("generic");
    expect(siteFromUrl("not a url")).toBe("generic");
  });
});

describe("submit gates (the owner's per-site decision)", () => {
  it("never auto-submits LinkedIn or unknown boards", () => {
    expect(SITE_RULES.linkedin.autoSubmit).toBe(false);
    expect(SITE_RULES.generic.autoSubmit).toBe(false);
  });

  it("auto-submits only Instahyre and Naukri", () => {
    expect(SITE_RULES.instahyre.autoSubmit).toBe(true);
    expect(SITE_RULES.naukri.autoSubmit).toBe(true);
  });
});

describe("classifyQuestion", () => {
  it("answers identity/contact fields confidently", () => {
    expect(classifyQuestion("Email address")).toEqual({ kind: "email", confidence: "answer" });
    expect(classifyQuestion("Phone number")).toEqual({ kind: "phone", confidence: "answer" });
    expect(classifyQuestion("First name")).toEqual({ kind: "firstName", confidence: "answer" });
    expect(classifyQuestion("Total years of experience")).toEqual({ kind: "years", confidence: "answer" });
    expect(classifyQuestion("Notice period")).toEqual({ kind: "notice", confidence: "answer" });
    expect(classifyQuestion("Current CTC")).toEqual({ kind: "salary", confidence: "answer" });
    expect(classifyQuestion("Current city")).toEqual({ kind: "location", confidence: "answer" });
  });

  it("is fail-closed on sensitive required questions (never guessed)", () => {
    expect(classifyQuestion("Are you legally authorized to work in the US?", { required: true }).confidence).toBe("review");
    expect(classifyQuestion("Do you hold any professional certifications?", { required: true }).confidence).toBe("review");
    expect(classifyQuestion("Why are you leaving your current job?", { required: true }).confidence).toBe("review");
  });

  it("treats textareas as the cover-letter slot (the engine answers those)", () => {
    expect(classifyQuestion("Why do you want to join us?", { tag: "textarea" }).kind).toBe("coverLetter");
    expect(classifyQuestion("Additional information", { tag: "textarea", required: true }).kind).toBe("coverLetter");
  });

  it("an unrecognized REQUIRED textarea is fail-closed review (nothing to say)", () => {
    expect(classifyQuestion("Describe your ideal playground", { tag: "textarea", required: true }).confidence).toBe("review");
  });

  it("unknown required text inputs are review, unknown optional ones are blank-safe", () => {
    expect(classifyQuestion("Favorite kirana store?", { required: true }).confidence).toBe("review");
    expect(classifyQuestion("Favorite kirana store?", { required: false }).confidence).toBe("answer");
  });
});

describe("draftAnswer — honest answers only", () => {
  const profile = { name: "Gaurav Gupta", email: "g@x.com", phone: "+91 1", years: 5, locations: ["Bengaluru"], noticePeriod: "30 days", openToRelocate: true, portfolio: "https://gh.you" };
  const job = { title: "Backend Engineer", company: "Acme", location: "Pune", __coverLetter: "Dear team…" };

  it("fills identity fields from the profile verbatim", () => {
    expect(draftAnswer("email", profile, job)).toBe("g@x.com");
    expect(draftAnswer("fullName", profile, job)).toBe("Gaurav Gupta");
    expect(draftAnswer("firstName", profile, job)).toBe("Gaurav");
    expect(draftAnswer("lastName", profile, job)).toBe("Gupta");
    expect(draftAnswer("years", profile, job)).toBe("5");
    expect(draftAnswer("notice", profile, job)).toBe("30 days");
    expect(draftAnswer("location", profile, job)).toBe("Bengaluru");
  });

  it("yes/no kinds answer only from explicit profile flags", () => {
    expect(draftAnswer("relocation", profile, job)).toBe("Yes");
    expect(draftAnswer("relocation", { ...profile, openToRelocate: null }, job)).toBe("");
    expect(draftAnswer("relocation", {}, job)).toBe("");
  });

  it("textareas get the tailored cover letter — never an invented essay", () => {
    expect(draftAnswer("coverLetter", profile, job)).toBe("Dear team…");
    expect(draftAnswer("longText", profile, { ...job, __coverLetter: undefined })).toBe("");
  });

  it("never invents: unknown/sensitive kinds answer empty even with a full profile", () => {
    expect(draftAnswer("workAuth", profile, job)).toBe("");
    expect(draftAnswer("certificate", profile, job)).toBe("");
    expect(draftAnswer("unknown", profile, job)).toBe("");
    expect(draftAnswer("email", {}, job)).toBe("");
  });
});

describe("valueMatchesList (dropdown option matching)", () => {
  it("matches exact, containment, and numeric equality", () => {
    expect(valueMatchesList("30 days", "30 days or less")).toBe(true);
    expect(valueMatchesList("Immediately", "immediately")).toBe(true);
    expect(valueMatchesList("3", "3 years")).toBe(true);
    expect(valueMatchesList("Bengaluru", "Bangalore")).toBe(false);
  });

  it("resists mismatched option lists", () => {
    expect(valueMatchesList("60 days", "30 days or less")).toBe(false);
    expect(valueMatchesList("", "anything")).toBe(false);
  });
});

describe("run reports", () => {
  it("counts results and flags a suspicious run (zero submits + zero reviews)", () => {
    const r = newReport("https://x/jobs", "linkedin");
    recordResult(r, { title: "A", company: "C", url: "u" }, "skipped", "no apply button");
    expect(reportLine(r)).toMatch(/SUSPICIOUS RUN/);
    recordResult(r, { title: "B", company: "C", url: "u" }, "submitted", "ok");
    expect(reportLine(r)).not.toMatch(/SUSPICIOUS/);
    expect(r.counts).toEqual({ submitted: 1, needsReview: 0, skipped: 1, error: 0 });
  });

  it("markdown + SQL report rows carry the site and counts", () => {
    const r = newReport("https://www.instahyre.com/candidate/opportunities/", "instahyre");
    recordResult(r, { title: "Backend", company: "Acme", url: "https://j/1" }, "submitted", "clicked submit; success text not detected");
    recordResult(r, { title: "Frontend", company: "Beta", url: "https://j/2" }, "needsReview", "cannot answer: work authorization");
    const md = buildReportMarkdown(r);
    expect(md).toContain("instahyre");
    expect(md).toContain("| submitted | Acme | Backend |");
    const sql = buildApplyReportSql(r, { totalSeen: 2 });
    expect(sql).toContain("'apply-engine'");
    expect(sql).toContain("submitted 1, review 1");
    expect(sql).toContain("needs authorization".replace("needs ", "")); // detail escaped through
  });
});
