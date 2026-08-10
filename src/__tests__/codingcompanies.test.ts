import { describe, expect, it } from "vitest";
import { CODING_PROBLEMS } from "../data/coding";
import { COMPANIES } from "../data/companies";
import { PROBLEM_COMPANIES, companiesForProblem, companyInterviewPlan, problemsForCompany, problemIsForCompany, untaggedCodingProblems } from "../data/codingCompanies";

const COMPANY_IDS = new Set(COMPANIES.map(c => c.id));
const PROBLEM_IDS = new Set(CODING_PROBLEMS.map(p => p.id));

describe("company tags", () => {
  it("every tagged problem id exists in the catalog", () => {
    for (const id of Object.keys(PROBLEM_COMPANIES)) {
      expect(PROBLEM_IDS.has(id), `unknown problem id: ${id}`).toBe(true);
    }
  });

  it("every company id is a real company (never 'general')", () => {
    for (const ids of Object.values(PROBLEM_COMPANIES)) {
      for (const c of ids) {
        expect(COMPANY_IDS.has(c), `unknown company id: ${c}`).toBe(true);
        expect(c).not.toBe("general");
      }
    }
  });

  it("surfaces the classic company-tagged problems", () => {
    const google = problemsForCompany("google");
    expect(google.some(p => p.id === "two-sum")).toBe(true);
    expect(google.some(p => p.id === "fn-debounce")).toBe(true);
    expect(google.some(p => p.id === "fn-lru-cache")).toBe(true);

    const meta = problemsForCompany("meta");
    expect(meta.some(p => p.id === "valid-parens")).toBe(true);
    expect(meta.some(p => p.id === "fn-event-emitter")).toBe(true);
  });

  it("companiesForProblem and problemIsForCompany agree", () => {
    for (const p of CODING_PROBLEMS) {
      const companies = companiesForProblem(p.id);
      for (const c of companies) {
        expect(problemIsForCompany(p, c)).toBe(true);
      }
      expect(problemIsForCompany(p, "general")).toBe(false);
    }
  });

  it("every tag maps to a CLI or fn problem (UI bank is Pro-gated, untagged)", () => {
    for (const id of Object.keys(PROBLEM_COMPANIES)) {
      const p = CODING_PROBLEMS.find(x => x.id === id)!;
      expect(["cli", "fn"].includes(p.kind)).toBe(true);
    }
  });

  it("every CLI and fn problem carries at least one company tag", () => {
    const untagged = untaggedCodingProblems();
    expect(untagged.map(p => p.id)).toEqual([]);
  });

  it("builds a difficulty-aware plan: one easy + one medium per company", () => {
    for (const company of ["google", "meta", "amazon", "microsoft", "stripe"]) {
      const plan = companyInterviewPlan(company);
      expect(plan.length).toBeGreaterThanOrEqual(1);
      expect(plan.length).toBeLessThanOrEqual(2);
      expect(plan.every(p => problemIsForCompany(p, company))).toBe(true);
      if (plan.length === 2) {
        expect(plan[0].difficulty).toBe(1);
        expect(plan[1].difficulty).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("the plan is deterministic", () => {
    expect(companyInterviewPlan("google").map(p => p.id)).toEqual(companyInterviewPlan("google").map(p => p.id));
  });
});
