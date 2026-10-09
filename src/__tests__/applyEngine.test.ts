/* Tests for the auto-apply engine's PURE layer (apply-engine-lib.js) —
   site rules, question classification, honest answers, matching, reports.
   The Playwright driver (auto-apply-jobs.mjs) is local-only and untestable in
   CI; everything safety-critical (submit gates, fail-closed classification,
   never-invent-answers) lives in the pure lib and is pinned here. */
import { describe, expect, it } from "vitest";
import {
  SITE_RULES, siteFromUrl, classifyQuestion, draftAnswer,
  valueMatchesList, newReport, recordResult, reportLine, buildReportMarkdown, buildApplyReportSql,
  isChallengePage, detectAccountProblem, looksLoggedIn, titleRelevant, titleFieldMismatch, looksLikeRefusal,
  canonicalSkill, profileSkillSet, jdSkillMatch, postingRelevant, extraAnswerFor, fitScore, isExternalApplyButton,
  ATS_PACKS, detectAts, normalizeFieldKey, canStoreAnswer, planFormAnswers, formFieldsPreview,
  titleSkills, judgeMessages, parseJudgeReply, ownerExemplarFor, classifyJobLink,
  extractFeedbackSkills, strikesWithDecay, skillIsBuzzOnly,
  parsePostedAge, isFreshPosted, sortByFreshness, FRESH_MAX_HOURS,
  classifyOutcome, outcomePrior, outcomeRowShouldRecord, trackerRowLinkRe, outcomeDigestLines,
  matchSiteRow, cardAgeText, POSTED_AGE_TEXT_RE,
  spendCount, budgetGate, isQuietHours, jobPassesFilters, parseSalary, seniorityOf,
  boardSuspensionRule, suspensionDigestLines, SENIORITY_LADDER, DEFAULT_DAILY_CAP, DEFAULT_WEEKLY_CAP,
} from "../../scripts/apply-engine-lib.js";

describe("classifyJobLink — posting vs site chrome (Phase 1)", () => {
  it("keeps real posting detail links (id-bearing routes)", () => {
    expect(classifyJobLink({ href: "https://www.linkedin.com/jobs/view/4471345244/", host: "linkedin.com" }).kind).toBe("posting");
    expect(classifyJobLink({ href: "https://www.linkedin.com/jobs/view/4471345244/", host: "linkedin.com" }).id).toBe("4471345244");
    expect(classifyJobLink({ href: "https://www.linkedin.com/jobs/search/?currentJobId=4471345244", host: "linkedin.com" }).kind).toBe("posting");
    expect(classifyJobLink({ href: "https://www.naukri.com/job-listings-senior-frontend-engineer-1234567", host: "naukri.com" }).kind).toBe("posting");
    expect(classifyJobLink({ href: "https://www.instahyre.com/candidate/opportunities/12345/", host: "instahyre.com" }).kind).toBe("posting");
    expect(classifyJobLink({ href: "https://www.builtin.com/job/staff-frontend-engineer/9876543", host: "builtin.com" }).kind).toBe("posting");
    expect(classifyJobLink({ href: "https://boards.greenhouse.io/acme/jobs/4567890", host: "boards.greenhouse.io" }).kind).toBe("posting");
    expect(classifyJobLink({ href: "https://indeed.com/viewjob?jk=abcdef123456", host: "indeed.com" }).kind).toBe("posting");
  });

  it("drops the exact nav/category tiles that polluted YC + Built In runs", () => {
    const yc = "https://www.ycombinator.com/jobs";
    expect(classifyJobLink({ href: yc, text: "Startup Jobs", host: "ycombinator.com" }).kind).toBe("nav");
    expect(classifyJobLink({ href: "https://www.builtin.com/jobs/design", text: "Design & UI/UX", host: "builtin.com" }).kind).toBe("nav");
    expect(classifyJobLink({ href: "https://www.builtin.com/jobs/engineering", text: "Engineering", host: "builtin.com" }).kind).toBe("nav");
    expect(classifyJobLink({ href: "https://www.naukri.com/jobs", text: "All Jobs", host: "naukri.com" }).kind).toBe("nav");
    expect(classifyJobLink({ href: "https://www.linkedin.com/jobs/engineering-jobs-bengaluru", text: "Engineering", host: "linkedin.com" }).kind).toBe("nav");
    expect(classifyJobLink({ href: "https://www.ycombinator.com/companies", text: "Recruiting & HR", host: "ycombinator.com" }).kind).toBe("nav");
  });

  it("treats a bare /jobs listing route as nav, a /jobs/<id-or-slug> as a posting", () => {
    expect(classifyJobLink({ href: "https://www.workatastartup.com/jobs", text: "Jobs", host: "workatastartup.com" }).kind).toBe("nav");
    expect(classifyJobLink({ href: "https://www.workatastartup.com/jobs/12345-senior-frontend", text: "Senior Frontend Engineer", host: "workatastartup.com" }).kind).toBe("posting");
    expect(classifyJobLink({ href: "https://acme.com/careers/12345", text: "Senior Frontend Engineer", host: "acme.com" }).kind).toBe("posting");
    expect(classifyJobLink({ href: "https://acme.com/careers/engineering", text: "Engineering", host: "acme.com" }).kind).toBe("nav");
  });

  it("is null-safe and does not throw on junk hrefs", () => {
    expect(classifyJobLink({}).kind).toBe("unknown");
    expect(classifyJobLink({ href: "", text: "" }).kind).toBe("unknown");
    expect(classifyJobLink({ href: "#main-content", text: "Skip to main content" }).kind).toBe("unknown");
  });

  it("routes the newly-supported boards to their rules", () => {
    expect(siteFromUrl("https://www.workatastartup.com/jobs")).toBe("workatastartup");
    expect(siteFromUrl("https://www.builtin.com/jobs")).toBe("builtin");
    expect(siteFromUrl("https://wellfound.com/jobs")).toBe("wellfound");
  });

  it("never auto-submits the newly-added unknown-ATS boards (review gate)", () => {
    expect(SITE_RULES.workatastartup.autoSubmit).toBe(false);
    expect(SITE_RULES.builtin.autoSubmit).toBe(false);
    expect(SITE_RULES.wellfound.autoSubmit).toBe(false);
  });
});

describe("external apply buttons (company-website ATS)", () => {
  it("detects the company-website mode (the button text is the mode selector)", () => {
    expect(isExternalApplyButton("Apply on company website")).toBe(true);
    expect(isExternalApplyButton("Apply to company site")).toBe(true);
    expect(isExternalApplyButton("Easy Apply")).toBe(false);
    expect(isExternalApplyButton("")).toBe(false);
  });

  it("LinkedIn rules now match both Easy Apply and company-website buttons", () => {
    expect(SITE_RULES.linkedin.applyButtonText.test("Easy Apply")).toBe(true);
    expect(SITE_RULES.linkedin.applyButtonText.test("Apply on company website")).toBe(true);
    expect(SITE_RULES.linkedin.applyButtonText.test("Save")).toBe(false);
  });
});

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

  it("routes the phone country code to its own kind (not the phone number)", () => {
    expect(classifyQuestion("Phone country code*").kind).toBe("phoneCountryCode");
    expect(classifyQuestion("Phone number").kind).toBe("phone");
    expect(classifyQuestion("Dialing code").kind).toBe("phoneCountryCode");
    expect(draftAnswer("phoneCountryCode", { extraAnswers: { phoneCountryCode: "+91" } }, {})).toBe("+91");
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

describe("page-state guards", () => {
  it("flags Cloudflare-style challenges (title or body) and passes normal pages", () => {
    expect(isChallengePage("Just a moment...", "Performing security verification")).toBe(true);
    expect(isChallengePage("Opportunities — Instahyre", "Senior React Engineer at Flipkart Apply")).toBe(false);
    expect(isChallengePage("", "Please verify you are a human to continue")).toBe(true);
    expect(isChallengePage(null, null)).toBe(false);
  });

  it("detects account-level blockers and ignores healthy lists", () => {
    expect(detectAccountProblem("Automatic account disablement — your account has been disabled due to inactivity.")).toMatch(/disabled/);
    expect(detectAccountProblem("Your account is suspended. Contact support.")).toMatch(/disabled|suspended/);
    expect(detectAccountProblem("Senior Frontend Engineer at Razorpay · 12-25 LPA · Apply")).toBeNull();
    expect(detectAccountProblem("")).toBeNull();
  });

  it("looksLoggedIn is false on login URLs, challenges, and missing hints", () => {
    const base = { loggedInHint: "/candidate/opportunities", loginPathHints: ["/login/"] };
    expect(looksLoggedIn({ ...base, url: "https://instahyre.com/login/?next=/candidate/opportunities/" })).toBe(false);
    expect(looksLoggedIn({ ...base, url: "https://instahyre.com/candidate/opportunities/", title: "Just a moment...", bodyText: "Performing security verification" })).toBe(false);
    expect(looksLoggedIn({ ...base, url: "https://instahyre.com/candidate/opportunities/", title: "Opportunities", bodyText: "Senior Engineer · Apply" })).toBe(true);
    expect(looksLoggedIn({ ...base, url: "https://instahyre.com/somewhere-else/" })).toBe(false);
  });
});

describe("relevance + refusal guards", () => {
  const fe = { headline: "Staff Frontend Engineer", skills: ["React", "TypeScript", "Next.js"] };
  const be = { headline: "Backend Engineer — Python & Java", skills: ["Python", "Java", "Spring Boot", "PostgreSQL", "Kubernetes"] };
  const devops = { headline: "DevOps Engineer", skills: ["Terraform", "AWS", "Kubernetes", "Docker"] };

  it("titleFieldMismatch catches core-incompatible fields (DevOps vs Frontend)", () => {
    expect(titleFieldMismatch("DevOps Engineer", "Staff Frontend Engineer")).toBe(true);
    expect(titleFieldMismatch("SRE — Infrastructure", "Staff Frontend Engineer")).toBe(true);
    expect(titleFieldMismatch("QA Automation — SDET", "Staff Frontend Engineer")).toBe(true);
    expect(titleFieldMismatch("Data Engineer", "Staff Frontend Engineer")).toBe(true);
    expect(titleFieldMismatch("Machine Learning Engineer", "Staff Frontend Engineer")).toBe(true);
  });

  it("titleFieldMismatch allows Frontend-to-Backend field incompatibility (different stack, same domain)", () => {
    expect(titleFieldMismatch("Backend Engineer", "Staff Frontend Engineer")).toBe(false);
    expect(titleFieldMismatch("Senior Python Developer", "Staff Frontend Engineer")).toBe(false);
    expect(titleFieldMismatch("UI/UX Designer", "Backend Engineer — Python & Java")).toBe(true);
    expect(titleFieldMismatch("Product Manager", "Backend Engineer — Python & Java")).toBe(true);
  });

  it("titleFieldMismatch allows Full Stack to apply to any engineering role", () => {
    expect(titleFieldMismatch("DevOps Engineer", "Full Stack Engineer")).toBe(false);
    expect(titleFieldMismatch("Backend Engineer", "Full Stack Engineer")).toBe(false);
    expect(titleFieldMismatch("Frontend Engineer", "Full Stack Engineer")).toBe(false);
  });

  it("titleFieldMismatch passes generic engineering titles (no field conflict)", () => {
    expect(titleFieldMismatch("Senior Software Engineer", "Staff Frontend Engineer")).toBe(false);
    expect(titleFieldMismatch("Engineer — Platform", "Staff Frontend Engineer")).toBe(false);
    expect(titleFieldMismatch("SDE III", "Staff Frontend Engineer")).toBe(false);
  });

  it("titleFieldMismatch is null-safe", () => {
    expect(titleFieldMismatch("", "Staff Frontend Engineer")).toBe(false);
    expect(titleFieldMismatch("DevOps Engineer", "")).toBe(false);
    expect(titleFieldMismatch(null, "Staff Frontend Engineer")).toBe(false);
    expect(titleFieldMismatch("DevOps Engineer", null)).toBe(false);
  });

  it("titleRelevant passes engineering roles and skill-matched titles", () => {
    expect(titleRelevant("Senior Frontend Engineer", fe)).toBe(true);
    expect(titleRelevant("SDE II — Backend", fe)).toBe(true);
    expect(titleRelevant("React Developer at Razorpay", fe)).toBe(true);
    expect(titleRelevant("Lead Engineer, Web Platform", fe)).toBe(true);
  });

  it("titleRelevant rejects alien fields and junk", () => {
    expect(titleRelevant("Sr. Data Scientist", fe)).toBe(false);
    expect(titleRelevant("Product Manager — Healthcare", fe)).toBe(false);
    expect(titleRelevant("Store Executive", fe)).toBe(false);
    expect(titleRelevant("", fe)).toBe(false);
  });

  it("looksLikeRefusal catches AI refusal text but not resumes", () => {
    expect(looksLikeRefusal("I can't help with this. The resume you've provided…")).toBe(true);
    expect(looksLikeRefusal("Sorry, but I cannot invent ML experience.")).toBe(true);
    expect(looksLikeRefusal("I am unable to fabricate credentials.")).toBe(true);
    expect(looksLikeRefusal("__SKIP__")).toBe(true);
    expect(looksLikeRefusal("I need to flag something: this resume is missing employment history. It lists skills…")).toBe(true);
    expect(looksLikeRefusal("This resume is missing employment history.")).toBe(true);
    expect(looksLikeRefusal("Gaurav Gupta\nStaff Frontend Engineer\n14 years of React…")).toBe(false);
    expect(looksLikeRefusal("I led the migration to Next.js — I can't stress its impact enough.")).toBe(false);
    expect(looksLikeRefusal("")).toBe(false);
  });
});

describe("JD skill gate — the resume must back the posting's skills", () => {
  const fe = {
    headline: "Staff Frontend Engineer",
    skills: ["React", "Next.js", "TypeScript", "JavaScript", "CSS", "Redux", "Webpack", "Vite", "Tailwind CSS", "Testing", "Accessibility", "Performance", "Design Systems", "Micro Frontends", "PWA", "SSR", "Azure", "Docker", "CI/CD"],
  };
  const feJD = "About the role: We are looking for a Senior Frontend Engineer. Responsibilities: build user interfaces with React and TypeScript, state management with Redux, styling with Tailwind CSS, performance optimization and accessibility. Requirements: 5+ years experience with React, Next.js, TypeScript.";
  const beJD = "About the role: Backend Engineer. Design and build REST APIs and microservices with Node.js, Python, PostgreSQL, Kafka and AWS. Requirements: strong system design, distributed systems, Kubernetes.";

  it("normalizes skill spellings and families", () => {
    expect(canonicalSkill("Node.js")).toBe("node");
    expect(canonicalSkill("C++")).toBe("cpp");
    expect(canonicalSkill("Next.js")).toBe("react"); // same family — a React dev answers a Next.js ask
    expect(canonicalSkill("PostgreSQL")).toBe("sql");
    expect(canonicalSkill("Team Player")).toBeNull(); // not a skill
    expect(profileSkillSet(fe).has("react")).toBe(true);
  });

  it("PASSES a frontend posting for a frontend resume", () => {
    const m = postingRelevant({ title: "Senior Frontend Engineer", description: feJD }, fe);
    expect(m.ok).toBe(true);
    expect(m.matched).toEqual(expect.arrayContaining(["react", "typescript"]));
  });

  it("REJECTS a backend posting for a frontend resume (the reported bug)", () => {
    const m = postingRelevant({ title: "Backend Engineer", description: beJD }, fe);
    expect(m.ok).toBe(false);
    expect(m.reason).toMatch(/not on the resume/);
    expect(m.missing).toEqual(expect.arrayContaining(["node", "python", "sql"]));
  });

  it("still fails alien fields at the title gate", () => {
    expect(postingRelevant({ title: "Data Scientist", description: feJD }, fe).ok).toBe(false);
  });

  it("a JD with no specific skills needs profile pull (skill-ghost postings)", () => {
    const ghost = "Great opportunity! Join our dynamic team. Competitive salary. Apply now.";
    expect(jdSkillMatch(ghost, fe).ok).toBe(false); // nothing in the JD pulls the profile in
  });

  it("a JD with no specific skills passes when the profile's top skills appear anyway", () => {
    const soft = "We value craft: build interfaces with React and TypeScript for our design platform.";
    expect(jdSkillMatch(soft, fe).ok).toBe(true);
  });

  it("family transfer: React skills cover a Next.js ask, NOT a Node/Python ask", () => {
    const next = "Build marketing sites in Next.js with Tailwind CSS and SSR.";
    expect(jdSkillMatch(next, fe).ok).toBe(true);
    expect(jdSkillMatch("Automate pipelines with Python and Django.", fe).ok).toBe(false);
  });

  it("tolerates empty JD text and skill-less profiles (title gate only)", () => {
    expect(jdSkillMatch("", fe).ok).toBe(false); // nothing known about the job → no pull
    expect(jdSkillMatch(feJD, { skills: [] }).ok).toBe(true); // profile silent → don't block on skills
    expect(postingRelevant({ title: "Frontend Engineer", description: "" }, fe).ok).toBe(false);
  });
});

describe("extraAnswers — owner-declared hard answers", () => {
  it("fills kinds the profile lacks a first-class field for", () => {
    expect(extraAnswerFor({ extraAnswers: { phoneCountryCode: "+91" } }, "phoneCountryCode")).toBe("+91");
    expect(draftAnswer("phoneCountryCode", { extraAnswers: { phoneCountryCode: "+91" } }, {})).toBe("+91");
  });

  it("never invents: absent or blank extras answer empty (fail-closed as before)", () => {
    expect(extraAnswerFor({}, "phoneCountryCode")).toBe("");
    expect(draftAnswer("phoneCountryCode", {}, {})).toBe("");
    expect(draftAnswer("phoneCountryCode", { extraAnswers: { phoneCountryCode: "   " } }, {})).toBe("");
    expect(draftAnswer("workAuth", { extraAnswers: { workAuth: "" } }, {})).toBe("");
  });
});

describe("fitScore — re-rank the review queue by skill fit", () => {
  it("scores matched share 0-100 and nulls the no-opinion case", () => {
    expect(fitScore(["react", "typescript", "css", "performance"], [])).toBe(100);
    expect(fitScore(["react"], ["node", "python", "sql"])).toBe(25);
    expect(fitScore([], [])).toBeNull();
    expect(fitScore(undefined, undefined)).toBeNull();
  });

  it("penalizes the judge's core-missing skills (#164 honesty): Java-core JD cannot show fit 60 on a frontend resume", () => {
    expect(fitScore(["cloud", "testing", "performance"], ["java", "aws"], ["java"])).toBe(48); // 60 - 12
    expect(fitScore(["cloud"], ["java", "spring", "kafka", "aws"], ["java", "spring boot"])).toBe(0); // 20 - 24 floors at 0
    expect(fitScore(["react"], ["node", "python", "sql"], [])).toBe(25); // no core-missing → raw overlap
  });

  it("recordResult carries the job's fit into the report row", () => {
    const r = newReport("https://x/jobs", "naukri");
    recordResult(r, { title: "T", company: "C", url: "u", __fit: 75 }, "submitted", "ok");
    expect(r.results[0].fit).toBe(75);
    recordResult(r, { title: "T2", company: "C", url: "u2" }, "skipped", "no gate");
    expect(r.results[1].fit).toBeNull();
  });

  it("recordResult appends the judge note (__fitNote) to the app's detail line (#164)", () => {
    const r = newReport("https://x/jobs", "instahyre");
    recordResult(r, { title: "T", company: "C", url: "u", __fitNote: "judge (apply): owner-confirmed relevant (exemplar)" }, "submitted", "submitted (auto)");
    expect(r.results[0].detail).toMatch(/judge \(apply\)/);
    const r2 = newReport("https://x/jobs", "instahyre");
    recordResult(r2, { title: "T2", company: "C", url: "u2" }, "submitted", "submitted (auto)");
    expect(r2.results[0].detail).toBe("submitted (auto)"); // no note → detail unchanged
  });
});

describe("per-ATS selector packs", () => {
  it("routes known ATS hosts to their pack", () => {
    expect(detectAts("https://boards.greenhouse.io/acme/jobs/123")).toBe(ATS_PACKS.greenhouse);
    expect(detectAts("https://jobs.lever.co/acme/abc")).toBe(ATS_PACKS.lever);
    expect(detectAts("https://apply.workable.com/acme/j/123")).toBe(ATS_PACKS.workable);
    expect(detectAts("https://careers.something-else.io/x")).toBe(ATS_PACKS.generic);
    expect(detectAts("not a url")).toBe(ATS_PACKS.generic);
  });

  it("packs scope field extraction and pin submit/success text", () => {
    for (const key of ["greenhouse", "lever", "workable"] as const) {
      expect(ATS_PACKS[key].fieldSelectorHints.length).toBeGreaterThan(0);
      expect(ATS_PACKS[key].submitButtonText).toBeInstanceOf(RegExp);
      expect(ATS_PACKS[key].successText).toBeInstanceOf(RegExp);
    }
    expect(ATS_PACKS.greenhouse.fieldSelectorHints.some((h) => h.includes("#application_form"))).toBe(true);
    expect(ATS_PACKS.lever.fieldSelectorHints.every((h) => h.includes("form ") || h.startsWith("form"))).toBe(true);
  });
});

describe("critical-skill gate — title-named skills are not ratio-forgiven", () => {
  const profile = { headline: "Staff Frontend Engineer", years: 14, skills: ["React", "TypeScript", "JavaScript", "Testing", "Playwright", "Docker", "CI/CD"] };

  it("extracts skills named in the posting title", () => {
    expect(titleSkills("Senior Python Full Stack Developer With React")).toContain("python");
    expect(titleSkills("Senior Python Full Stack Developer With React")).toContain("react");
    expect(titleSkills("Next.js Staff Engineer")).toContain("react"); // next.js → react family
    expect(titleSkills("Go deep with your career")).not.toContain("go"); // prose, not a skill
  });

  it("rejects DataArt-style JDs even though the coverage ratio would pass", () => {
    // react+ts+docker+ci match, python missing → 4/5 = 80% ≥ 60% — old gate PASSED this
    const m = postingRelevant({ title: "Senior Python Full Stack Developer With React", description: "Python backend with FastAPI. React frontend. Docker, CI/CD, TypeScript." }, profile);
    expect(m.ok).toBe(false);
    expect(m.reason).toMatch(/core skill missing: python/);
  });

  it("still passes a genuinely matching posting (no false strictness)", () => {
    const m = postingRelevant({ title: "Staff Frontend Engineer", description: "React, Next.js, TypeScript, design systems, performance. Docker and CI/CD a plus." }, profile);
    expect(m.ok).toBe(true);
  });

  it("a python-only JD still fails for a frontend profile — not title-mismatch, just skill ratio", () => {
    const m = postingRelevant({ title: "Senior Software Engineer", description: "python python python — everything here is python" }, profile);
    expect(m.ok).toBe(false);
    expect(m.reason).toMatch(/python/);
  });

  it("stack keywords repeated in Key Technologies are NOT critical (Ferguson GraphQL/REST case)", () => {
    // a React role whose JD lists GraphQL/REST 2-3× is not a GraphQL job:
    // title/JD core (react/ts) matches → ratio passes → the AI judge owns the borderline
    const m = postingRelevant({ title: "Senior Software Engineer Frontend", description: "React.js and TypeScript everywhere. Integrate with REST and GraphQL APIs. Key Technologies: React.js, JavaScript, TypeScript, GraphQL, REST APIs, HTML5, CSS3." }, profile);
    expect(m.ok).toBe(true);
    expect(m.reason).not.toMatch(/core skill missing/);
  });

  it("mission-statement ai boilerplate is not a required skill", () => {
    // LinkedIn JDs say "AI" 3+ times in prose; bare ai/ml are excluded from the alias map
    const m = postingRelevant({ title: "Senior Software Engineer Frontend", description: "Join our AI-first mission. We use AI to transform hiring. Our AI platform needs a strong frontend engineer with React, TypeScript and testing chops." }, profile);
    expect(m.ok).toBe(true);
  });
});

describe("AI judge — reading comprehension over regex gates", () => {
  const profile = { headline: "Staff Frontend Engineer", years: 14, skills: ["React", "TypeScript", "Testing", "Playwright"] };

  it("the judge prompt encodes the SDET/preference-vs-role guard", () => {
    const { system } = judgeMessages({ title: "SDET at HackerRank", description: "Playwright, TS, automation frameworks" }, profile);
    expect(system).toMatch(/SDET/);
    expect(system).toMatch(/"verdict":"apply\|skip"/);
    expect(system).toMatch(/missingCore/);
  });

  it("the judge prompt does not reject overqualified-but-relevant candidates", () => {
    const { system } = judgeMessages({ title: "Senior Frontend Developer", description: "React, TypeScript" }, profile);
    expect(system).toMatch(/MORE senior than the posting is NOT a rejection/);
  });

  it("ownerExemplarFor matches by job id, then by title tokens, never weakly", () => {
    const ex = { positive: ["Senior Frontend Developer Indiacharts 4471345244: owner-confirmed relevant"], negative: [] };
    expect(ownerExemplarFor({ url: "https://www.linkedin.com/jobs/view/4471345244/", title: "Senior Frontend Developer" }, ex)).toMatch(/4471345244/);
    expect(ownerExemplarFor({ url: "https://www.linkedin.com/jobs/view/999/", title: "Senior Frontend Developer" }, ex)).toMatch(/4471345244/);
    expect(ownerExemplarFor({ url: "https://www.linkedin.com/jobs/view/999/", title: "Python Backend Engineer" }, ex)).toBe("");
    expect(ownerExemplarFor({ title: "x" }, null)).toBe("");
  });

  it("ownerExemplarFor ignores GENERIC title words (#164): 'software'/'engineer' cannot inherit a React exemplar's verdict", () => {
    // this exact shape caused the low-match Instahyre applies: SDET/Amazon/BigAssets titles
    // shared only generic words with frontend exemplars → "owner-confirmed" bypassed the judge
    const ex = { positive: ["Senior Frontend Developer at BigCo — React, TypeScript, design systems"], negative: [] };
    expect(ownerExemplarFor({ title: "Software Development Engineer in Test" }, ex)).toBe("");
    expect(ownerExemplarFor({ title: "Product Software Engineer - 1047 - 1059" }, ex)).toBe("");
    expect(ownerExemplarFor({ title: "Fullstack Developer" }, ex)).toBe("");
    expect(ownerExemplarFor({ title: "React Engineer - payments" }, ex)).not.toBe("");
  });

  it("ownerExemplarFor keeps the ≥3 raw-token fallback for all-generic titles (no single-word strong match)", () => {
    const ex = { positive: ["Senior Frontend Developer at BigCo — React, TypeScript, design systems"], negative: [] };
    expect(ownerExemplarFor({ title: "Senior Frontend Developer" }, ex)).not.toBe(""); // senior+frontend+developer = 3 raw tokens
    expect(ownerExemplarFor({ title: "Frontend Developer" }, ex)).toBe(""); // only 2 raw tokens
  });

  it("parses a well-formed verdict and clamps/preserves fields", () => {
    const v = parseJudgeReply('{"verdict":"skip","confidence":0.9,"reason":"QA automation role, not frontend","missingCore":["qa","selenium"]}');
    expect(v.verdict).toBe("skip");
    expect(v.confidence).toBe(0.9);
    expect(v.missingCore).toEqual(["qa", "selenium"]);
  });

  it("any prose/refusal/junk degrades to unknown (fail-open), never to a verdict", () => {
    expect(parseJudgeReply("I cannot do that").verdict).toBe("unknown");
    expect(parseJudgeReply("{verdict: skip}").verdict).toBe("unknown"); // not valid JSON
    expect(parseJudgeReply('{"verdict":"maybe","reason":"x"}').verdict).toBe("unknown");
    expect(parseJudgeReply("").verdict).toBe("unknown");
    expect(parseJudgeReply(null).verdict).toBe("unknown");
  });
});

describe("form-answer memory — store and reuse what was filled", () => {
  it("normalizes field labels into stable keys", () => {
    expect(normalizeFieldKey("First Name *")).toBe("first name");
    expect(normalizeFieldKey("  Phone (Mobile):  ")).toBe("phone mobile");
    expect(normalizeFieldKey("")).toBe("");
    expect(normalizeFieldKey(null)).toBe("");
  });

  it("never stores/reuses job-specific or review-gate kinds", () => {
    expect(canStoreAnswer("coverLetter")).toBe(false);
    expect(canStoreAnswer("longText")).toBe(false);
    expect(canStoreAnswer("unknown")).toBe(false);
    expect(canStoreAnswer("workAuth")).toBe(false);
    expect(canStoreAnswer("certificate")).toBe(false);
    expect(canStoreAnswer("email")).toBe(true);
    expect(canStoreAnswer("phone")).toBe(true);
    expect(canStoreAnswer("notice")).toBe(true);
    expect(canStoreAnswer("phoneCountryCode")).toBe(true);
  });

  it("reuses a stored answer when the profile has none (and profile still wins)", () => {
    const fields = [
      { label: "Email", tag: "input", required: true },
      { label: "notice period", tag: "input", required: true },
      { label: "LinkedIn profile", tag: "input", required: false },
    ];
    const profile = { email: "me@x.com" }; // no noticePeriod, no portfolio
    const stored = { "notice period": "30 days", "linkedin profile": "https://linkedin.com/in/me" };
    const plan = planFormAnswers(fields, profile, {}, stored);
    expect(plan[0].answer).toBe("me@x.com");       // profile wins
    expect(plan[1].answer).toBe("30 days");        // memory fills the gap
    expect(plan[1].key).toBe("notice period");
    expect(plan[2].answer).toBe("https://linkedin.com/in/me"); // memory-only field
  });

  it("still leaves blanks blank when neither profile nor memory has an answer", () => {
    const plan = planFormAnswers([{ label: "Expected CTC", tag: "input", required: true }], {}, {}, { "phone": "+91 98765 43210" });
    expect(plan[0].answer).toBe("");
  });

  it("builds the review-queue preview: label, kind, required, answered", () => {
    const fields = [
      { label: "Email *", tag: "input", required: true },
      { label: "Why this role?", tag: "textarea", required: true },
    ];
    const plan = planFormAnswers(fields, { email: "me@x.com" }, { __coverLetter: "Dear team" }, {});
    const preview = formFieldsPreview(fields, plan);
    expect(preview).toHaveLength(2);
    expect(preview[0]).toEqual({ label: "Email *", kind: "email", required: true, answered: true });
    expect(preview[1].kind).toBe("coverLetter");
    expect(preview[1].answered).toBe(true); // letter drafted — shown, never stored
  });

  it("preview handles missing plan entries and caps at 24 fields", () => {
    const fields = Array.from({ length: 30 }, (_, i) => ({ label: `Q${i}`, tag: "input", required: false }));
    const preview = formFieldsPreview(fields, null);
    expect(preview).toHaveLength(24);
    expect(preview[0].kind).toBe("unknown");
    expect(preview[0].answered).toBe(false);
  });
});

describe("feedback learning loop — extract skills from detail lines", () => {
  it("parses the coverage-gate format (the most common skip)", () => {
    expect(extractFeedbackSkills("JD requires java, sql, aws — not on the resume")).toEqual(["java", "sql", "aws"]);
    expect(extractFeedbackSkills("JD requires node — not on the resume")).toEqual(["node"]);
  });

  it("parses the critical-gate format", () => {
    expect(extractFeedbackSkills("core skill missing: python — required by title/JD")).toEqual(["python"]);
    expect(extractFeedbackSkills("core skill missing: java, kotlin — required by title/JD")).toEqual(["java", "kotlin"]);
  });

  it("returns [] honestly for skill-less formats (title gate, judge skips)", () => {
    expect(extractFeedbackSkills("not relevant to profile (Staff Frontend Engineer)")).toEqual([]);
    expect(extractFeedbackSkills("AI judge: backend-core JD for a frontend resume")).toEqual([]);
    expect(extractFeedbackSkills("")).toEqual([]);
    expect(extractFeedbackSkills(null)).toEqual([]);
  });

  it("tolerates punctuation noise and caps the list", () => {
    expect(extractFeedbackSkills("JD requires C++, Node.js, Go, Rust, Kotlin, Swift, Ruby — not on the resume").length).toBeLessThanOrEqual(6);
  });
});

describe("strike decay — stale hard-rejects stop rejecting", () => {
  const DAY = 24 * 3600_000;
  const now = 1_800_000_000_000;

  it("keeps fresh strikes untouched", () => {
    const rows = [{ skill: "python", strikes: 2, updated_at: new Date(now - 5 * DAY).toISOString() }];
    expect(strikesWithDecay(rows, now)).toEqual(rows);
  });

  it("decays strikes older than 30 days to zero and drops them", () => {
    const rows = [
      { skill: "python", strikes: 3, updated_at: new Date(now - 45 * DAY).toISOString() },
      { skill: "java", strikes: 2, updated_at: new Date(now - 29 * DAY).toISOString() },
    ];
    const out = strikesWithDecay(rows, now);
    expect(out.map((r) => r.skill)).toEqual(["java"]);
  });

  it("treats rows without updated_at as fresh (legacy rows never silently vanish)", () => {
    expect(strikesWithDecay([{ skill: "go", strikes: 2 }], now)).toEqual([{ skill: "go", strikes: 2 }]);
  });

  it("filters zero-strike rows", () => {
    expect(strikesWithDecay([{ skill: "rust", strikes: 0, updated_at: new Date(now).toISOString() }], now)).toEqual([]);
  });
});

describe("buzz-only gating — 'we work with AI' is not 'experience with AI'", () => {
  it("flags a skill that only ever appears in buzz context", () => {
    const jd = "join our ai-first mission. we build with ai to transform hiring. our ai product team is growing fast";
    expect(skillIsBuzzOnly(jd, "ai")).toBe(true);
  });

  it("keeps a skill that appears in a requirement context", () => {
    const jd = "we are an ai-first company. requirements: 3+ years experience with ai integrations and react";
    expect(skillIsBuzzOnly(jd, "ai")).toBe(false);
  });

  it("conservative defaults: empty skill or empty JD never gate", () => {
    expect(skillIsBuzzOnly("some jd text", "")).toBe(false);
    expect(skillIsBuzzOnly("", "python")).toBe(false);
  });

  it("a learned strike on a buzz-only mention no longer rejects (FurtherAI case)", () => {
    const profile = { headline: "Staff Frontend Engineer", skills: ["React", "TypeScript", "Testing"] };
    const jd = "FurtherAI is an ai company building the future of hiring. we work with ai daily. react, typescript, testing, graphql required";
    // with the strike active, the old gate rejected this React-fit posting when 'ai' counted as required-and-missing
    const withStrike = postingRelevant({ title: "Staff Software Engineer, Frontend", description: jd }, profile, { learnedCritical: ["ai"] });
    expect(withStrike.ok).toBe(true); // buzz-only 'ai' must not hard-reject
  });
});

describe("posted-age parsing + freshness-first collection order", () => {
  it("parses every board's real stamp dialect into hours", () => {
    expect(parsePostedAge("3 hours ago")).toBe(3);
    expect(parsePostedAge("45 minutes ago")).toBe(0.75);
    expect(parsePostedAge("2 days ago")).toBe(48);
    expect(parsePostedAge("30+ Days Ago")).toBe(720);
    expect(parsePostedAge("Posted 5 days ago")).toBe(120);
    expect(parsePostedAge("1 week ago")).toBe(168);
    expect(parsePostedAge("2 months ago")).toBe(1440);
    expect(parsePostedAge("2h ago")).toBe(2);
    expect(parsePostedAge("Just posted")).toBe(0);
    expect(parsePostedAge("today")).toBe(0);
    expect(parsePostedAge("yesterday")).toBe(24);
    expect(parsePostedAge("few days ago")).toBe(24);
    expect(parsePostedAge("Apply today!")).toBe(null); // a CTA is never an age
    expect(parsePostedAge("")).toBe(null);
    expect(parsePostedAge("senior react developer")).toBe(null);
  });

  it("pins the fresh-boundary and compact-dialect edges", () => {
    expect(parsePostedAge("0 minutes ago")).toBe(0); // brand new
    expect(parsePostedAge("23 hours ago")).toBe(23); // fresh edge
    expect(parsePostedAge("1 day ago")).toBe(24); // exactly 24h = NO LONGER fresh
    expect(parsePostedAge("12 months ago")).toBe(8640);
    expect(parsePostedAge("posted today")).toBe(0);
    expect(parsePostedAge("a few hours")).toBe(0); // insta-style stamp
    expect(parsePostedAge("   3   HOURS   ago  ")).toBe(3); // whitespace/case noise
    expect(parsePostedAge("2 weeks ago")).toBe(336);
    expect(parsePostedAge("10+ days ago")).toBe(240); // naukri's plus-form
  });

  it("fresh = parseable and under 24h; unknown ages are never fresh", () => {
    expect(isFreshPosted(0)).toBe(true);
    expect(isFreshPosted(23.9)).toBe(true);
    expect(isFreshPosted(FRESH_MAX_HOURS)).toBe(false);
    expect(isFreshPosted(null)).toBe(false);
    expect(isFreshPosted(-1)).toBe(false);
  });

  it("puts <24h postings first (freshest first) and keeps board order behind them", () => {
    const jobs = [
      { url: "a", __ageText: "5 days ago" },
      { url: "b", __ageText: "3 hours ago" },
      { url: "c", __ageText: "1 day ago" },
      { url: "d", __ageText: "Just posted" },
      { url: "e" }, // unknown age
    ];
    const ordered = sortByFreshness(jobs);
    expect(ordered.map((j) => j.url)).toEqual(["d", "b", "a", "c", "e"]);
    expect(ordered[0].__fresh).toBe(true);
    expect(ordered[0].__ageH).toBe(0);
    expect(ordered[2].__fresh).toBe(false);
    expect(ordered[4].__ageH).toBe(null);
  });

  it("is stable when ages tie (board order preserved within a group)", () => {
    const jobs = [
      { url: "x", __ageText: "2 hours ago" },
      { url: "y", __ageText: "2 hours ago" },
    ];
    expect(sortByFreshness(jobs).map((j) => j.url)).toEqual(["x", "y"]);
  });

  it("degenerates safely: empty, all-unknown, all-fresh, and never mutates the input", () => {
    expect(sortByFreshness([])).toEqual([]);
    expect(sortByFreshness(null)).toEqual([]);
    expect(sortByFreshness(undefined)).toEqual([]);
    const allUnknown = [{ url: "a", __ageText: "" }, { url: "b", __ageText: "" }];
    expect(sortByFreshness(allUnknown).map((j) => j.url)).toEqual(["a", "b"]); // board order stands
    const allFresh = [{ url: "late", __ageText: "5 hours ago" }, { url: "early", __ageText: "1 hour ago" }];
    expect(sortByFreshness(allFresh).map((j) => j.url)).toEqual(["early", "late"]); // freshest of the fresh first
    const input = [{ url: "a", __ageText: "2 days ago" }];
    const out = sortByFreshness(input);
    expect(Object.prototype.hasOwnProperty.call(input[0], "__fresh")).toBe(false); // the input array is untouched
    expect(out[0].__fresh).toBe(false); // the copy carries the flags
  });

  it("routes the first-class ATS boards and keeps them honest", () => {
    expect(siteFromUrl("https://boards.greenhouse.io/lyft")).toBe("greenhouse");
    expect(siteFromUrl("https://job-boards.greenhouse.io/acme/jobs/4567890")).toBe("greenhouse");
    expect(siteFromUrl("https://jobs.ashbyhq.com/linear")).toBe("ashby");
    // first-class = trusted with auto-submit (known ATS, pinned success text,
    // and trySubmit's fail-closed required-field pre-check still guards it)
    expect(SITE_RULES.greenhouse.autoSubmit).toBe(true);
    expect(SITE_RULES.ashby.autoSubmit).toBe(true);
    // public boards: no session needed, no login-wall false positives
    expect(SITE_RULES.greenhouse.loginPathHints).toEqual([]);
    // ATS boards have no candidate tracker — the outcome scraper must skip them
    expect(SITE_RULES.greenhouse.outcomes).toBeUndefined();
    expect(SITE_RULES.linkedin.outcomes?.url).toContain("cardType=APPLIED");
    expect(SITE_RULES.naukri.outcomes?.url).toContain("myapply");
  });
});

describe("employer-behavior learning — outcome classification + judge prior", () => {
  it("maps tracker status text to milestones (rejection outranks view words)", () => {
    expect(classifyOutcome("Application viewed")).toEqual({ viewed: true, responseKind: null });
    expect(classifyOutcome("Viewed · Not selected")).toEqual({ viewed: true, responseKind: "rejected" });
    expect(classifyOutcome("Your application was not selected for this role")).toEqual({ viewed: true, responseKind: "rejected" });
    expect(classifyOutcome("Shortlisted by the hiring team")).toEqual({ viewed: true, responseKind: "interview" });
    expect(classifyOutcome("Message from the recruiter")).toEqual({ viewed: true, responseKind: "reply" });
    expect(classifyOutcome("Offer received")).toEqual({ viewed: true, responseKind: "offer" });
    expect(classifyOutcome("Applied 3 days ago")).toEqual({ viewed: false, responseKind: null });
    expect(classifyOutcome("")).toEqual({ viewed: false, responseKind: null });
  });

  it("pins the milestone priority chain: offer > interview > rejected > reply > viewed", () => {
    // a row carrying several signals must classify as the STRONGEST milestone
    expect(classifyOutcome("Viewed · Shortlisted").responseKind).toBe("interview");
    expect(classifyOutcome("Interview scheduled — offer made").responseKind).toBe("offer");
    expect(classifyOutcome("Viewed · replied to by the recruiter · not selected").responseKind).toBe("rejected");
    expect(classifyOutcome("Viewed · message from recruiter").responseKind).toBe("reply");
    // intermediate states count as a view, never as a response
    expect(classifyOutcome("Your application is under review")).toEqual({ viewed: true, responseKind: null });
    // case-insensitive (tracker rows vary)
    expect(classifyOutcome("APPLICATION VIEWED").viewed).toBe(true);
    expect(classifyOutcome("Not Selected").responseKind).toBe("rejected");
    // null-safety
    expect(classifyOutcome(null)).toEqual({ viewed: false, responseKind: null });
    expect(classifyOutcome(undefined)).toEqual({ viewed: false, responseKind: null });
  });

  it("only speaks when a band has real evidence (5+ applications)", () => {
    const stats = [
      { fit_band: "85+", applications: 6, responded: 2, response_rate: 0.333 },
      { fit_band: "50-69", applications: 12, responded: 0, response_rate: 0 },
      { fit_band: "70-84", applications: 3, responded: 1, response_rate: 0.333 },
    ];
    const prior = outcomePrior(stats);
    expect(prior).toContain("fit 85+: 2/6");
    expect(prior).toContain("fit 50-69: 0/12");
    expect(prior).not.toContain("70-84"); // 3 applications = not enough evidence
    expect(outcomePrior([])).toBe("");
    expect(outcomePrior(null)).toBe("");
  });

  it("folds the prior into the judge prompt when present, leaves it out otherwise", () => {
    const job = { title: "Frontend Engineer", description: "react" };
    const profile = { headline: "Frontend Engineer", skills: ["React"] };
    const without = judgeMessages(job, profile, null, "");
    expect(without.user).not.toContain("Employer-response history");
    const withPrior = judgeMessages(job, profile, null, "Employer-response history for this candidate's past applications (90d — favor fit bands that actually convert):\n- fit 85+: 2/6 applications got an employer response (33%)");
    expect(withPrior.user).toContain("fit 85+: 2/6");
  });

  it("only records tracker rows that carry a milestone AND belong to the candidate", () => {
    const viewed = "Application viewed";
    // engine-applied URL → recorded even though the row text says nothing new
    expect(outcomeRowShouldRecord(viewed, "https://x", () => true)).toEqual({ viewed: true, responseKind: null });
    // row itself says submitted (manual application) → recorded
    expect(outcomeRowShouldRecord("Submitted · Application viewed", "https://x", () => false)).toEqual({ viewed: true, responseKind: null });
    // milestone but neither engine-applied nor an applied stamp → skip honestly
    expect(outcomeRowShouldRecord("Just saved", "https://x", () => false)).toBeNull();
    // no classifiable milestone → skip even for an applied URL
    expect(outcomeRowShouldRecord("Applied 3 days ago", "https://x", () => true)).toBeNull();
    // predicate form vs boolean form agree
    expect(outcomeRowShouldRecord(viewed, "https://x", true)).toEqual({ viewed: true, responseKind: null });
    expect(outcomeRowShouldRecord(viewed, "https://x", false)).toBeNull();
  });

  it("matches each tracker's own link shape and falls back generically", () => {
    expect(trackerRowLinkRe("linkedin").test("https://www.linkedin.com/jobs/view/4471345244/")).toBe(true);
    expect(trackerRowLinkRe("naukri").test("https://www.naukri.com/job-listings-senior-react-1234567")).toBe(true);
    expect(trackerRowLinkRe("instahyre").test("https://www.instahyre.com/candidate/opportunities/12345/")).toBe(true);
    expect(trackerRowLinkRe("workatastartup").test("https://www.workatastartup.com/jobs/12345-senior-frontend")).toBe(true);
    // unknown site → generic posting-link shape
    expect(trackerRowLinkRe("cutshort").test("https://x.com/jobs/1234-abc")).toBe(true);
    // a site's pattern must not swallow another site's rows
    expect(trackerRowLinkRe("linkedin").test("https://www.naukri.com/job-listings-x-123")).toBe(false);
  });

  it("renders the digest's employer-behavior section, honest when empty", () => {
    // no data ≠ silence
    expect(outcomeDigestLines([], [])).toContain("no tracked applications");
    expect(outcomeDigestLines(null, undefined)).toContain("no tracked applications");
    const rows = [
      { site_host: "linkedin.com", fit_band: "70-84", applications: 8, viewed: 3, responded: 1, interviews: 0, rejected: 2 },
      { site_host: "naukri.com", fit_band: "50-69", applications: 5, viewed: 0, responded: 0, interviews: 0, rejected: 0 },
    ];
    const text = outcomeDigestLines(rows, []);
    expect(text).toContain("• linkedin.com · fit 70-84: 8 applied · 3 viewed · 1 responded (2 rejected)");
    expect(text).toContain("• naukri.com · fit 50-69: 5 applied · 0 viewed · 0 responded");
    expect(text).toContain("needs 5+ per band"); // no qualifying stats → honest learning line
    // best-converting band with real evidence
    const withStats = outcomeDigestLines(rows, [
      { fit_band: "85+", applications: 6, responded: 2, response_rate: 0.333 },
      { fit_band: "50-69", applications: 12, responded: 0, response_rate: 0 },
    ]);
    expect(withStats).toContain("fit 85+ converts best (2/6 responded)");
    // a band under the evidence threshold never wins the learning line
    const underThreshold = outcomeDigestLines(rows, [{ fit_band: "70-84", applications: 3, responded: 3, response_rate: 1 }]);
    expect(underThreshold).toContain("needs 5+ per band");
  });

  it("resolves the registry row for a run URL: full jobs_url first, bare host second", () => {
    const rows = [
      { host: "boards.greenhouse.io/lyft", jobs_url: "https://boards.greenhouse.io/lyft" },
      { host: "boards.greenhouse.io/airbnb", jobs_url: "https://boards.greenhouse.io/airbnb" },
      { host: "linkedin.com", jobs_url: "https://www.linkedin.com/jobs/" },
    ];
    // path-qualified boards never bleed into each other
    expect(matchSiteRow(rows, "https://boards.greenhouse.io/lyft")?.host).toBe("boards.greenhouse.io/lyft");
    expect(matchSiteRow(rows, "https://boards.greenhouse.io/airbnb/")?.host).toBe("boards.greenhouse.io/airbnb");
    // trailing-slash tolerant on both sides
    expect(matchSiteRow(rows, "https://www.linkedin.com/jobs")?.host).toBe("linkedin.com");
    // bare-host fallback (legacy registry rows)
    expect(matchSiteRow([{ host: "instahyre.com", jobs_url: null }], "https://www.instahyre.com/candidate/opportunities/")?.host).toBe("instahyre.com");
    // no match → undefined (RUN_HOST falls back to the bare hostname)
    expect(matchSiteRow(rows, "https://cutshort.io/jobs")).toBeUndefined();
    expect(matchSiteRow([], "https://boards.greenhouse.io/lyft")).toBeUndefined();
    expect(matchSiteRow(undefined, "https://x.com")).toBeUndefined();
  });

  it("extracts exactly the age stamp the DOM collector captures", () => {
    expect(cardAgeText("Senior React Dev\n3 hours ago\nBengaluru")).toBe("3 hours ago");
    expect(cardAgeText("Staff Engineer · 30+ Days Ago · Naukri")).toBe("30+ Days Ago");
    expect(cardAgeText("Just posted\nAcme")).toBe("Just posted");
    expect(cardAgeText("Apply today! Great team")).toBe(""); // CTA is not an age
    expect(cardAgeText("")).toBe("");
    // the regex is exported for the in-page collector — same source object
    expect(POSTED_AGE_TEXT_RE.test("Apply today! Great team")).toBe(false); // CTA never captured
    expect(POSTED_AGE_TEXT_RE.test("posted 5 days ago")).toBe(true); // embedded stamp captured
    expect(cardAgeText("posted 5 days ago")).toBe("5 days ago");
  });
});

/* ═══════════ Phase 0 — cross-run governance (budget + money-rules) ═══════════ */

describe("Phase 0 — spendCount (spend from the owner's own results)", () => {
  const DAY = 24 * 3600_000;
  it("counts only submitted rows (needsReview never spent a click)", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    const rows = [
      { created_at: new Date(now.getTime() - 2 * 3600_000).toISOString(), result: "submitted" },
      { created_at: new Date(now.getTime() - 3 * 3600_000).toISOString(), result: "needs_review" },
      { created_at: new Date(now.getTime() - 3 * 3600_000).toISOString(), result: "submitted" },
    ];
    expect(spendCount(rows, ["submitted"], now).day).toBe(2);
  });

  it("splits day vs week on real calendar boundaries", () => {
    const now = new Date("2026-10-07T10:00:00Z"); // Wednesday
    const rows = [
      { created_at: "2026-10-07T08:00:00Z", result: "submitted" },  // today
      { created_at: "2026-10-05T08:00:00Z", result: "submitted" },  // Monday — this week, not today
      { created_at: "2026-09-30T08:00:00Z", result: "submitted" },  // last week (Wed)
    ];
    const s = spendCount(rows, ["submitted"], now);
    expect(s.day).toBe(1);
    expect(s.week).toBe(2);
  });

  it("is null/empty safe", () => {
    expect(spendCount(null).day).toBe(0);
    expect(spendCount([]).week).toBe(0);
  });
});

describe("Phase 0 — budgetGate (the cross-run ceiling)", () => {
  it("caps at the agreed defaults conceptually 20/day 80/week", () => {
    expect(DEFAULT_DAILY_CAP).toBe(20);
    expect(DEFAULT_WEEKLY_CAP).toBe(80);
  });

  it("passes under the cap", () => {
    expect(budgetGate({ day: 3, week: 10 }, { dailyCap: 20, weeklyCap: 80 }).ok).toBe(true);
    expect(budgetGate({ day: 3, week: 10 }, {}).verdict).toBe("ok");
  });

  it("stops at the daily cap with an owner-readable reason", () => {
    const g = budgetGate({ day: 20, week: 30 }, { dailyCap: 20, weeklyCap: 80 });
    expect(g.ok).toBe(false);
    expect(g.verdict).toBe("budget_capped");
    expect(g.reason).toContain("20");
  });

  it("stops at the weekly cap even mid-day", () => {
    const g = budgetGate({ day: 5, week: 80 }, { dailyCap: 20, weeklyCap: 80 });
    expect(g.verdict).toBe("budget_capped");
    expect(g.reason).toContain("weekly");
  });

  it("null caps mean no cap (owners who never set policy keep today's behavior)", () => {
    expect(budgetGate({ day: 999, week: 9999 }, { dailyCap: null, weeklyCap: null }).ok).toBe(true);
  });
});

describe("Phase 0 — isQuietHours (submits pause, collection continues)", () => {
  it("crosses midnight (22:00–06:00)", () => {
    expect(isQuietHours(new Date("2026-10-07T23:00:00"), "22:00", "06:00")).toBe(true);
    expect(isQuietHours(new Date("2026-10-07T03:00:00"), "22:00", "06:00")).toBe(true);
    expect(isQuietHours(new Date("2026-10-07T12:00:00"), "22:00", "06:00")).toBe(false);
  });

  it("handles a same-day window", () => {
    expect(isQuietHours(new Date("2026-10-07T13:00:00"), "12:00", "14:00")).toBe(true);
    expect(isQuietHours(new Date("2026-10-07T15:00:00"), "12:00", "14:00")).toBe(false);
  });

  it("never false-positives: unset window, junk time, zero-length", () => {
    expect(isQuietHours(new Date(), null, null)).toBe(false);
    expect(isQuietHours(new Date(), "", "")).toBe(false);
    expect(isQuietHours(new Date("2026-10-07T13:00:00"), "22:00", "22:00")).toBe(false);
    expect(isQuietHours("not a date", "22:00", "06:00")).toBe(false);
  });
});

describe("Phase 0 — money-rule job filters (checked BEFORE the AI judge)", () => {
  it("parses the real salary dialects boards post", () => {
    expect(parseSalary("12-18 LPA")).toBe(1800000);
    expect(parseSalary("$120k - $150k")).toBe(150000);
    expect(parseSalary("₹12,00,000 per annum")).toBe(1200000);
    expect(parseSalary("")).toBeNull();
    expect(parseSalary("competitive")).toBeNull();
  });

  it("salary floor below → filtered; unparseable salary → job survives (never auto-reject)", () => {
    const job = { title: "Frontend Engineer", company: "Acme", salaryText: "10-14 LPA" };
    expect(jobPassesFilters(job, { salaryMin: 1500000 }).pass).toBe("filtered");
    expect(jobPassesFilters({ ...job, salaryText: "market standard" }, { salaryMin: 1500000 }).pass).toBe("pass");
    expect(jobPassesFilters({ ...job, salaryText: "18-24 LPA" }, { salaryMin: 1500000 }).pass).toBe("pass");
  });

  it("excludes companies by brand substring", () => {
    expect(jobPassesFilters({ title: "Dev", company: "Tata Consultancy Services Ltd" }, { excludeCompanies: ["tata consultancy"] }).reason).toContain("excluded");
    expect(jobPassesFilters({ title: "Dev", company: "Acme Labs" }, { excludeCompanies: ["tata consultancy"] }).pass).toBe("pass");
  });

  it("seniority band via the ladder", () => {
    expect(SENIORITY_LADDER.indexOf("senior")).toBeGreaterThan(SENIORITY_LADDER.indexOf("junior"));
    expect(seniorityOf("Senior Frontend Engineer")).toBe("senior");
    expect(seniorityOf("Engineering Intern")).toBe("intern");
    expect(jobPassesFilters({ title: "Junior React Developer", company: "A" }, { seniorityMin: "mid" }).pass).toBe("filtered");
    expect(jobPassesFilters({ title: "Senior Frontend Engineer", company: "A" }, { seniorityMin: "mid" }).pass).toBe("pass");
  });

  it("empty prefs are a no-op (default behavior unchanged)", () => {
    expect(jobPassesFilters({ title: "anything", company: "anyone" }, {}).pass).toBe("pass");
    expect(jobPassesFilters(null, null).pass).toBe("pass");
  });
});

/* ═══════════ Phase 3 — outcome-driven board suspension ═══════════ */

describe("Phase 3 — boardSuspensionRule (dead boards go back on probation)", () => {
  const rows = (apps: number, viewed: number, responded: number) => [{ site_host: "x.com", applications: apps, viewed, responded }];

  it("suspends: 10+ applications, ZERO views — postings never even read", () => {
    const [d] = boardSuspensionRule(rows(15, 0, 0), { minApplications: 10 });
    expect(d.verdict).toBe("suspend");
    expect(d.reason).toContain("15 applications");
  });

  it("keeps: not enough evidence yet (under the threshold)", () => {
    expect(boardSuspensionRule(rows(5, 0, 0), { minApplications: 10 })[0].verdict).toBe("keep");
  });

  it("watches: some views but under the rate floor", () => {
    // 1/30 ≈ 3.3% — clearly below the 5% floor. (1/20 sits exactly AT the
    // floor and correctly keeps: the boundary belongs to the board.)
    const [d] = boardSuspensionRule(rows(30, 1, 0), { minApplications: 10, minViewRate: 0.05 });
    expect(d.verdict).toBe("watch");
    // the exact-floor boundary keeps
    expect(boardSuspensionRule(rows(20, 1, 0), { minApplications: 10, minViewRate: 0.05 })[0].verdict).toBe("keep");
  });

  it("keeps: converting fine", () => {
    expect(boardSuspensionRule(rows(20, 12, 3), { minApplications: 10 })[0].verdict).toBe("keep");
  });

  it("null/empty rows are a no-op", () => {
    expect(boardSuspensionRule(null)).toEqual([]);
    expect(boardSuspensionRule([])).toEqual([]);
  });

  it("digest lines are honest when empty and name hosts when not", () => {
    expect(suspensionDigestLines([])).toBe("");
    expect(suspensionDigestLines(null)).toBe("");
    const s = suspensionDigestLines([{ site_host: "dead.example", reason: "15 applications, zero views" }]);
    expect(s).toContain("dead.example");
    expect(s).toContain("15 applications");
  });
});
