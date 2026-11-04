import { describe, expect, it } from "vitest";
import { ATS_PACKS, SITE_RULES, atsApiCollectPlan, classifyJobLink } from "../../scripts/apply-engine-lib.js";
import { parseWorkdayJobs } from "../../scripts/apply-engine-lib.js";

describe("Workday pack (Phase 5: site-rule pack for myworkdayjobs tenants)", () => {
  it("derives a CXS POST plan from a tenant careers URL with /<locale>/<site> (site casing preserved)", () => {
    const plan = atsApiCollectPlan("https://stripe.wd1.myworkdayjobs.com/en-US/External?q=engineer");
    expect(plan).toMatchObject({
      provider: "workday",
      board: "External",
      apiUrl: "https://stripe.wd1.myworkdayjobs.com/wday/cxs/stripe/External/jobs",
    });
    expect(plan?.workday?.detailBase).toBe("https://stripe.wd1.myworkdayjobs.com/en-US/External");
  });

  it("honestly stays null without a site segment (tenant alone cannot fetch a listing)", () => {
    expect(atsApiCollectPlan("https://stripe.wd1.myworkdayjobs.com")).toBeNull();
    expect(atsApiCollectPlan("https://jobs.lever.co/stripeco")).toMatchObject({ provider: "lever" }); // other providers untouched
  });

  it("parses the jobPostings payload: prose age stamps, detail URLs built from externalPath", () => {
    const base = "https://stripe.wd1.myworkdayjobs.com/en-US/External";
    const rows = parseWorkdayJobs(
      {
        total: 2,
        jobPostings: [
          { title: "Senior Software Engineer", externalId: "R1724210-1", externalPath: "/job/Senior-Software-Engineer_R1724210-1", postedOn: "Posted Today", locationsText: "San Francisco, United States" },
          { title: "Backend Engineer", externalId: "R1723999", externalPath: "/job/Backend-Engineer_R1723999", postedOn: "Posted 30+ Days Ago" },
          { title: "No URL (skip)", externalId: "R1723998" },
        ],
      },
      { detailBase: base, company: "Stripe" }
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      url: "https://stripe.wd1.myworkdayjobs.com/en-US/External/job/Senior-Software-Engineer_R1724210-1",
      title: "Senior Software Engineer",
      company: "Stripe",
      __ageText: "just posted",
      __viaApi: true,
    });
    expect(rows[1].__ageText).toBe("30+ days ago"); // the freshness pipeline parses this shape unchanged
  });

  it("classifies workday /job/ anchors as postings, section routes as never-a-posting", () => {
    const posting = classifyJobLink({ href: "https://stripe.wd1.myworkdayjobs.com/en-US/External/job/Senior-Software-Engineer_R1724210-1", text: "Senior Software Engineer", host: "" });
    expect(posting).toMatchObject({ kind: "posting", id: "R1724210-1" });
    /* the /job/ discriminator's only job: /en-US/<site>/ section routes must
       NOT be scraped as postings — unknown is fine, the caller decides */
    expect(classifyJobLink({ href: "https://stripe.wd1.myworkdayjobs.com/en-US/Careers", text: "Careers" }).kind).not.toBe("posting");
  });

  it("both registries fail closed: no auto-submit until rehearsed on a live tenant", () => {
    const siteRule = (SITE_RULES as Record<string, { label: string; autoSubmit: boolean; listSelectorHints: string[] }>).workday;
    const atsPack = (ATS_PACKS as Record<string, { label: string; hostHints: string[] }>).workday;
    expect(siteRule.autoSubmit).toBe(false);
    expect(siteRule.listSelectorHints[0]).toContain("/job/");
    expect(atsPack.hostHints).toContain("myworkdayjobs.com");
  });
});
