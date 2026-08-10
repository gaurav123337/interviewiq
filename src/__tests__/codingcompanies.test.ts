import { describe, expect, it } from "vitest";
import { CODING_PROBLEMS } from "../data/coding";
import { COMPANIES } from "../data/companies";
import {
  CLI_TOPICS,
  COMPANY_FREQ,
  PROBLEM_COMPANIES,
  codingTopicFor,
  companiesForProblem,
  companyFrequency,
  companyInterviewPlan,
  freqForProblem,
  problemsForCompany,
  problemIsForCompany,
  untaggedCodingProblems
} from "../data/codingCompanies";

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

describe("company frequency", () => {
  it("every frequency entry is a real company and a real problem tagged for it", () => {
    for (const [company, entries] of Object.entries(COMPANY_FREQ)) {
      expect(COMPANY_IDS.has(company), `unknown company id: ${company}`).toBe(true);
      for (const [pid, fRaw] of Object.entries(entries)) {
        const f = fRaw as number;
        expect(PROBLEM_IDS.has(pid), `unknown problem id: ${pid}`).toBe(true);
        expect([1, 2, 3].includes(f)).toBe(true);
        expect(problemIsForCompany(CODING_PROBLEMS.find(p => p.id === pid)!, company), `${pid} not tagged ${company}`).toBe(true);
      }
    }
  });

  it("untagged problems default to frequency 1 and tags never reference 'general'", () => {
    for (const p of CODING_PROBLEMS) {
      expect(freqForProblem("general", p.id)).toBe(1);
    }
    for (const company of COMPANIES) {
      expect(freqForProblem(company.id, "two-sum")).toBeGreaterThanOrEqual(1);
      expect(freqForProblem(company.id, "two-sum")).toBeLessThanOrEqual(3);
    }
  });

  it("aggregation totals match the tagged set and difficulty counts sum to total", () => {
    for (const company of ["google", "meta", "amazon", "microsoft", "stripe", "netflix"]) {
      const f = companyFrequency(company);
      expect(f.total).toBe(problemsForCompany(company).length);
      expect(f.byDifficulty[1].count + f.byDifficulty[2].count + f.byDifficulty[3].count).toBe(f.total);
      const heatSum = f.byDifficulty[1].heat + f.byDifficulty[2].heat + f.byDifficulty[3].heat;
      expect(f.heat).toBe(heatSum);
    }
  });

  it("topics are sorted by heat desc and each bucket's counts sum to the total", () => {
    const f = companyFrequency("google");
    const topicTotal = f.byTopic.reduce((s, t) => s + t.count, 0);
    expect(topicTotal).toBe(f.total);
    for (let i = 1; i < f.byTopic.length; i++) {
      expect(f.byTopic[i - 1].heat).toBeGreaterThanOrEqual(f.byTopic[i].heat);
    }
    for (const t of f.byTopic) {
      expect(t.hottest).not.toBeNull();
      expect(codingTopicFor(t.hottest!) ).toBe(t.topic);
    }
  });

  it("every CLI problem maps to a curated topic bucket", () => {
    for (const p of CODING_PROBLEMS.filter(x => x.kind === "cli")) {
      expect(CLI_TOPICS[p.id], `missing CLI topic for ${p.id}`).toBeDefined();
      expect(CLI_TOPICS[p.id]).toBe(codingTopicFor(p));
    }
    /* every CLI_TOPICS key is a real CLI problem */
    for (const id of Object.keys(CLI_TOPICS)) {
      const p = CODING_PROBLEMS.find(x => x.id === id)!;
      expect(p.kind).toBe("cli");
    }
  });

  it("the plan leads with the highest-frequency easy problem", () => {
    /* two-sum is the curated 3 (very common) easy for these companies */
    for (const company of ["google", "meta", "amazon", "microsoft"]) {
      const plan = companyInterviewPlan(company);
      expect(plan[0].id).toBe("two-sum");
      expect(freqForProblem(company, plan[0].id)).toBe(3);
    }
    /* stripe has no curated-3 easy; the plan still picks its easy first, then
       its hottest medium/hard (fn-deep-clone, freq 3) as the focus pick */
    const stripe = companyInterviewPlan("stripe");
    expect(stripe[0].id).toBe("binary-search");
    expect(stripe[1].id).toBe("fn-deep-clone");
    expect(freqForProblem("stripe", stripe[1].id)).toBe(3);
  });

  it("frequency model is deterministic", () => {
    const a = companyFrequency("google");
    const b = companyFrequency("google");
    expect(a).toEqual(b);
    expect(a.byTopic.map(t => t.topic)).toEqual(b.byTopic.map(t => t.topic));
  });
});
