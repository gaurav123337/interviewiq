/* Tests for the auto-apply engine's PURE layer (apply-engine-lib.js) —
   site rules, question classification, honest answers, matching, reports.
   The Playwright driver (auto-apply-jobs.mjs) is local-only and untestable in
   CI; everything safety-critical (submit gates, fail-closed classification,
   never-invent-answers) lives in the pure lib and is pinned here. */
import { describe, expect, it } from "vitest";
import {
  SITE_RULES, siteFromUrl, classifyQuestion, draftAnswer,
  valueMatchesList, newReport, recordResult, reportLine, buildReportMarkdown, buildApplyReportSql,
  isChallengePage, detectAccountProblem, looksLoggedIn, titleRelevant, looksLikeRefusal,
  canonicalSkill, profileSkillSet, jdSkillMatch, postingRelevant, extraAnswerFor, fitScore, isExternalApplyButton,
  ATS_PACKS, detectAts, normalizeFieldKey, canStoreAnswer, planFormAnswers, formFieldsPreview,
  titleSkills, judgeMessages, parseJudgeReply,
} from "../../scripts/apply-engine-lib.js";

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

  it("recordResult carries the job's fit into the report row", () => {
    const r = newReport("https://x/jobs", "naukri");
    recordResult(r, { title: "T", company: "C", url: "u", __fit: 75 }, "submitted", "ok");
    expect(r.results[0].fit).toBe(75);
    recordResult(r, { title: "T2", company: "C", url: "u2" }, "skipped", "no gate");
    expect(r.results[1].fit).toBeNull();
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
  const profile = { headline: "Staff Frontend Engineer", years: 14, skills: ["React", "TypeScript", "Testing", "Playwright", "Docker", "CI/CD"] };

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

  it("repeated ≥3× in the JD makes a skill critical even when the title omits it", () => {
    const m = postingRelevant({ title: "Platform Engineer", description: "python python python — everything here is python" }, profile);
    expect(m.ok).toBe(false);
    expect(m.reason).toMatch(/core skill missing: python/);
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
