/* Company tags for coding problems — a side-table so the banks stay clean.
   Keys are problem ids (CLI + fn); values are company ids from src/data/companies.ts.
   Tagged problems surface in the Playground when the user has a target company,
   and drive the “For {Company}” filter. UI problems are Pro-gated and untagged
   here on purpose. */

import type { CodingProblem } from "./coding";
import { CODING_PROBLEMS } from "./coding";

export const PROBLEM_COMPANIES: Record<string, string[]> = {
  /* original CLI six */
  "two-sum": ["google", "meta", "amazon", "microsoft", "apple", "uber", "airbnb"],
  "valid-parens": ["google", "meta", "amazon", "microsoft", "apple", "netflix", "spotify"],
  "max-subarray": ["google", "meta", "amazon", "microsoft", "apple"],
  "binary-search": ["google", "meta", "amazon", "microsoft", "uber", "stripe"],
  "buy-sell": ["google", "meta", "amazon", "apple", "stripe"],
  "fizzbuzz": ["microsoft", "google", "amazon", "apple"],
  /* algorithm bank */
  "reverse-string": ["google", "microsoft", "apple"],
  "palindrome": ["google", "meta", "amazon", "apple"],
  "contains-duplicate": ["google", "meta", "amazon", "microsoft", "apple"],
  "valid-anagram": ["google", "meta", "amazon", "spotify"],
  "fibonacci": ["meta", "microsoft", "uber"],
  "merge-sorted": ["google", "meta", "amazon", "microsoft", "apple"],
  "longest-common-prefix": ["google", "amazon", "microsoft", "apple"],
  "first-unique-char": ["google", "amazon", "microsoft", "apple", "netflix"],
  "move-zeroes": ["google", "meta", "microsoft", "apple"],
  "missing-number": ["google", "meta", "amazon", "microsoft", "uber"],
  "majority-element": ["google", "meta", "amazon", "microsoft", "apple"],
  "rotate-array": ["google", "meta", "microsoft", "uber"],
  "climbing-stairs": ["google", "meta", "amazon", "microsoft", "apple", "airbnb"],
  "intersection": ["google", "meta", "amazon", "microsoft", "apple"],
  /* JS function bank */
  "fn-debounce": ["google", "meta", "stripe", "airbnb"],
  "fn-throttle": ["google", "meta", "stripe", "spotify"],
  "fn-deep-clone": ["meta", "stripe", "datadog", "cloudflare"],
  "fn-promise-all": ["google", "meta", "stripe", "datadog"],
  "fn-promise-race": ["google", "stripe", "cloudflare"],
  "fn-event-emitter": ["google", "meta", "netflix", "stripe"],
  "fn-memoize": ["google", "meta", "stripe", "datadog"],
  "fn-once": ["meta", "stripe", "spotify"],
  "fn-flatten": ["google", "meta", "amazon", "microsoft"],
  "fn-uniq": ["google", "meta", "spotify"],
  "fn-chunk": ["google", "meta", "amazon", "microsoft"],
  "fn-group-by": ["google", "meta", "stripe", "datadog"],
  "fn-pipe": ["google", "meta", "stripe"],
  "fn-compose": ["meta", "stripe", "datadog"],
  "fn-curry": ["google", "meta", "stripe", "apple"],
  "fn-sleep": ["stripe", "cloudflare", "datadog"],
  "fn-map-limit": ["google", "stripe", "datadog", "cloudflare"],
  "fn-binary-search": ["google", "meta", "amazon", "microsoft", "uber"],
  "fn-lru-cache": ["google", "meta", "amazon", "microsoft", "apple", "uber", "netflix"],
  "fn-range": ["google", "stripe", "datadog"]
};

/** Every CLI + fn problem should carry at least one company tag so the target
    filter never empties for a real company. UI problems are intentionally untagged
    (they are Pro-gated, not company-specific). */
export function untaggedCodingProblems(problems: CodingProblem[] = CODING_PROBLEMS): CodingProblem[] {
  return problems.filter(p => (p.kind === "cli" || p.kind === "fn") && !(PROBLEM_COMPANIES[p.id] ?? []).length);
}

export function companiesForProblem(id: string): string[] {
  return PROBLEM_COMPANIES[id] ?? [];
}

export function problemsForCompany(companyId: string): CodingProblem[] {
  return CODING_PROBLEMS.filter(p => (PROBLEM_COMPANIES[p.id] ?? []).includes(companyId));
}

/** Problems tagged for the given company, preserving the catalog order. */
export function problemIsForCompany(p: CodingProblem, companyId: string): boolean {
  return (PROBLEM_COMPANIES[p.id] ?? []).includes(companyId);
}

/** Deterministic difficulty-aware practice plan for a company: one easy and one
    medium tagged problem (falls back to hard when no medium exists, and to the
    easiest remaining when a tier is empty). Never returns more than 2. */
export function companyInterviewPlan(companyId: string, problems: CodingProblem[] = CODING_PROBLEMS): CodingProblem[] {
  const tagged = problems.filter(p => problemIsForCompany(p, companyId));
  const byDiff = (d: number) => tagged.filter(p => p.difficulty === d);
  const easy = byDiff(1)[0];
  const medium = byDiff(2)[0] ?? byDiff(3)[0] ?? byDiff(1)[1];
  const out: CodingProblem[] = [];
  if (easy) out.push(easy);
  if (medium && medium.id !== easy?.id) out.push(medium);
  return out;
}
