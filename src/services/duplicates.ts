/* Near-duplicate detection for the question bank. Used in the review inbox
   to flag drafts that already exist (scraped banks produce dupes) so admins
   don't bloat the bank or skew harvest analytics. Pure functions — no deps. */

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(t: string): Set<string> {
  return new Set(normalizeText(t).split(" ").filter(Boolean));
}

/** Token Jaccard similarity, 0 (unrelated) to 1 (identical). */
export function tokenJaccard(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface DuplicateMatch {
  text: string;
  sim: number;
}

/** Pre-computed token set for efficient batch similarity checks. */
interface BankEntry { text: string; tokens: Set<string> }

let _bankCache: { key: string; entries: BankEntry[] } | null = null;

function getBankEntries(bank: string[]): BankEntry[] {
  const key = bank.join("\x00");
  if (_bankCache?.key === key) return _bankCache.entries;
  const entries = bank.map(text => ({ text, tokens: tokens(text) }));
  _bankCache = { key, entries };
  return entries;
}

/** Best matches for a draft against a bank of existing questions (sim ≥ threshold). */
export function findDuplicates(draft: string, bank: string[], threshold = 0.7): DuplicateMatch[] {
  const norm = normalizeText(draft);
  if (!norm) return [];
  const draftTokens = tokens(draft);
  if (draftTokens.size === 0) return [];
  const entries = getBankEntries(bank);

  return entries
    .map(e => {
      // Fast path: skip if no shared tokens at all
      let inter = 0;
      for (const t of draftTokens) if (e.tokens.has(t)) inter++;
      if (inter === 0) return null;
      const sim = inter / (draftTokens.size + e.tokens.size - inter);
      return sim >= threshold ? { text: e.text, sim } : null;
    })
    .filter((m): m is DuplicateMatch => m !== null)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 3);
}

/** Heuristic draft-quality triage — flags that don't need an API call. */
export function draftIssues(d: { question: string; answer: string; keyPoints: string[] }): string[] {
  const issues: string[] = [];
  const q = d.question.trim();
  const a = d.answer.trim();
  if (!q) issues.push("missing question");
  else if (q.length < 12) issues.push("question too short");
  else if (!q.includes("?") && !/^(how|what|why|when|where|who|describe|tell|design|explain|walk|build)/i.test(q))
    issues.push("looks like a statement, not a question");
  if (!a) issues.push("missing model answer");
  else if (a.length < 60) issues.push("answer too short");
  if (!d.keyPoints.length) issues.push("no key points");
  else if (d.keyPoints.length < 2) issues.push("only 1 key point");
  return issues;
}

export function triageLevel(issues: string[]): "ready" | "needs-work" | "review-first" {
  const n = issues.length;
  return n === 0 ? "ready" : n <= 2 ? "needs-work" : "review-first";
}
