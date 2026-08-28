/* Triage Web Worker — runs duplicate detection + draft-quality analysis
   off the main thread so the UI stays smooth.

   Messages in:
     { type: 'triage', drafts: Draft[], bank: string[] }

   Messages out:
     { type: 'progress', done: number, total: number }
     { type: 'result', triage: Record<number, TriageResult> }
*/

interface Draft {
  id: number;
  question: string;
  answer: string;
  keyPoints: string[];
}

interface TriageResult {
  issues: string[];
  level: "ready" | "needs-work" | "review-first";
  dups: { text: string; sim: number }[];
}

/* ── Inlined normalize / tokens / Jaccard ── */

function normalizeText(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(t: string): Set<string> {
  return new Set(normalizeText(t).split(" ").filter(Boolean));
}

interface BankEntry {
  text: string;
  tokens: Set<string>;
}

function getBankEntries(bank: string[]): BankEntry[] {
  return bank.map(text => ({ text, tokens: tokenSet(text) }));
}

function findDuplicates(
  draft: string,
  entries: BankEntry[],
  threshold = 0.7
): { text: string; sim: number }[] {
  const draftTokens = tokenSet(draft);
  if (draftTokens.size === 0) return [];

  const matches: { text: string; sim: number }[] = [];

  for (const e of entries) {
    let inter = 0;
    for (const t of draftTokens) if (e.tokens.has(t)) inter++;
    if (inter === 0) continue;
    const sim = inter / (draftTokens.size + e.tokens.size - inter);
    if (sim >= threshold) matches.push({ text: e.text, sim });
  }

  return matches.sort((a, b) => b.sim - a.sim).slice(0, 3);
}

function draftIssues(d: Draft): string[] {
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

function triageLevel(issues: string[]): "ready" | "needs-work" | "review-first" {
  const n = issues.length;
  return n === 0 ? "ready" : n <= 2 ? "needs-work" : "review-first";
}

/* ── Message handler ── */

self.onmessage = (ev: MessageEvent) => {
  const { type, drafts, bank } = ev.data as {
    type: string;
    drafts: Draft[];
    bank: string[];
  };

  if (type !== "triage") return;

  const bankEntries = getBankEntries(bank);
  const result: Record<number, TriageResult> = {};
  const total = drafts.length;
  const PROGRESS_INTERVAL = 5; // post progress every N drafts

  for (let i = 0; i < total; i++) {
    const d = drafts[i];
    const issues = draftIssues(d);
    const dups = findDuplicates(d.question, bankEntries);
    result[d.id] = {
      issues,
      level: triageLevel(issues),
      dups,
    };

    if ((i + 1) % PROGRESS_INTERVAL === 0 || i === total - 1) {
      (self as unknown as Worker).postMessage({
        type: "progress",
        done: i + 1,
        total,
      });
    }
  }

  (self as unknown as Worker).postMessage({ type: "result", triage: result });
};
