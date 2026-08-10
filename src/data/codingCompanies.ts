/* Company tags for coding problems — a side-table so the banks stay clean.
   Keys are problem ids (CLI + fn); values are company ids from src/data/companies.ts.
   Tagged problems surface in the Playground when the user has a target company,
   and drive the “For {Company}” filter. UI problems are Pro-gated and untagged
   here on purpose. */

import type { CodingProblem } from "./coding";
import { CODING_PROBLEMS } from "./coding";
import { getRemoteConfig } from "../services/remoteConfig";
import { getCodingTrack } from "../services/codingTrack";
import { getProfile } from "../services/goal";
import { STORAGE_KEYS, storageGet } from "../services/storage";
import type { SavedSession } from "../types";

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

/** Frequency rank for a problem at a company — curated editorial data based on
    well-known company-frequency patterns for these classics (3 = very common /
    “must know”, 2 = common, 1 = occasional). Any tagged problem without an
    explicit entry defaults to 1, so the table stays compact and only encodes
    the notable signals. Admin-tunable — extend COMPANY_FREQ to re-rank. */
export type CompanyFreq = 1 | 2 | 3;

export const COMPANY_FREQ: Record<string, Partial<Record<string, CompanyFreq>>> = {
  google: { "two-sum": 3, "fn-debounce": 3, "fn-promise-all": 3, "fn-lru-cache": 2, "fn-memoize": 2, "fn-curry": 2, "fn-throttle": 2, "binary-search": 2, "valid-parens": 2, "max-subarray": 2, "fn-event-emitter": 2, "fn-flatten": 2, "fn-group-by": 2, "fn-pipe": 2, "climbing-stairs": 2, "fn-map-limit": 2, "contains-duplicate": 2 },
  meta: { "two-sum": 3, "fn-deep-clone": 3, "fn-event-emitter": 3, "valid-parens": 3, "max-subarray": 3, "fn-throttle": 2, "fn-debounce": 2, "fn-curry": 2, "fn-lru-cache": 2, "fn-memoize": 2, "climbing-stairs": 2, "fn-once": 2, "fn-flatten": 2, "fn-uniq": 2, "fn-chunk": 2, "fn-compose": 2, "contains-duplicate": 2, "fn-group-by": 2 },
  amazon: { "two-sum": 3, "fn-lru-cache": 3, "valid-parens": 2, "merge-sorted": 2, "max-subarray": 2, "contains-duplicate": 2, "longest-common-prefix": 2, "fn-chunk": 2, "fn-flatten": 2, "binary-search": 2, "climbing-stairs": 2, "palindrome": 2, "missing-number": 2, "majority-element": 2, "intersection": 2 },
  microsoft: { "two-sum": 3, "fn-lru-cache": 3, "valid-parens": 2, "fizzbuzz": 2, "longest-common-prefix": 2, "merge-sorted": 2, "first-unique-char": 2, "missing-number": 2, "majority-element": 2, "reverse-string": 2, "fn-flatten": 2, "fn-chunk": 2, "contains-duplicate": 2, "binary-search": 2, "rotate-array": 2 },
  apple: { "two-sum": 3, "merge-sorted": 2, "contains-duplicate": 2, "fn-curry": 2, "move-zeroes": 2, "fn-lru-cache": 2, "climbing-stairs": 2, "palindrome": 2, "first-unique-char": 2, "majority-element": 2, "intersection": 2, "fizzbuzz": 2, "valid-parens": 2, "max-subarray": 2, "longest-common-prefix": 2, "reverse-string": 2 },
  uber: { "two-sum": 3, "fn-binary-search": 2, "rotate-array": 2, "binary-search": 2, "fn-lru-cache": 2, "fibonacci": 2, "missing-number": 2 },
  netflix: { "valid-parens": 2, "fn-event-emitter": 2, "first-unique-char": 2, "fn-lru-cache": 2 },
  spotify: { "valid-parens": 2, "fn-throttle": 2, "valid-anagram": 2, "fn-uniq": 2, "fn-once": 2 },
  stripe: { "fn-deep-clone": 3, "fn-promise-all": 3, "fn-debounce": 2, "fn-throttle": 2, "fn-memoize": 2, "fn-curry": 2, "fn-once": 2, "fn-pipe": 2, "fn-compose": 2, "fn-sleep": 2, "fn-map-limit": 2, "fn-range": 2, "fn-group-by": 2, "fn-event-emitter": 2, "binary-search": 2, "buy-sell": 2 },
  airbnb: { "two-sum": 2, "fn-debounce": 2, "climbing-stairs": 2 },
  datadog: { "fn-deep-clone": 2, "fn-promise-all": 2, "fn-memoize": 2, "fn-group-by": 2, "fn-compose": 2, "fn-map-limit": 2, "fn-range": 2, "fn-sleep": 2 },
  cloudflare: { "fn-deep-clone": 2, "fn-promise-race": 2, "fn-sleep": 2, "fn-map-limit": 2 }
};

/** Frequency for a problem at a company. Resolution order: admin-published
    override (remoteConfig.companyFreq) → baked-in COMPANY_FREQ → default 1. */
export function freqForProblem(companyId: string, problemId: string): CompanyFreq {
  const remote = getRemoteConfig().companyFreq?.[companyId]?.[problemId];
  if (remote === 1 || remote === 2 || remote === 3) return remote;
  return COMPANY_FREQ[companyId]?.[problemId] ?? 1;
}

/* CLI problems carry no category field (they are all “Algorithms” in the picker),
   so give them real topic buckets — the same themes the roadmap uses — to make
   the per-company topic view meaningful. Every CLI id must appear here (locked
   by a test). */
export const CLI_TOPICS: Record<string, string> = {
  "two-sum": "Arrays & hashing",
  "contains-duplicate": "Arrays & hashing",
  "majority-element": "Arrays & hashing",
  "missing-number": "Arrays & hashing",
  "move-zeroes": "Arrays & hashing",
  "intersection": "Arrays & hashing",
  "merge-sorted": "Arrays & hashing",
  "max-subarray": "Arrays & hashing",
  "buy-sell": "Arrays & hashing",
  "rotate-array": "Arrays & hashing",
  "valid-parens": "Strings & stacks",
  "reverse-string": "Strings & stacks",
  "palindrome": "Strings & stacks",
  "valid-anagram": "Strings & stacks",
  "longest-common-prefix": "Strings & stacks",
  "first-unique-char": "Strings & stacks",
  "binary-search": "Search & sorting",
  "fibonacci": "Dynamic programming",
  "climbing-stairs": "Dynamic programming",
  "fizzbuzz": "Language basics"
};

/** Topic bucket for a problem — CLI via CLI_TOPICS, fn via its category, UI via kind. */
export function codingTopicFor(p: CodingProblem): string {
  if (p.kind === "cli") return CLI_TOPICS[p.id] ?? "Algorithms";
  if (p.kind === "fn") return p.category;
  return "UI components";
}

export interface FreqBucket { count: number; heat: number }
export interface TopicFreq { topic: string; count: number; heat: number; hottest: CodingProblem | null }

export interface CompanyFrequency {
  companyId: string;
  /** Tagged problems for the company. */
  total: number;
  /** Sum of frequency ranks across tagged problems — a focus heat score. */
  heat: number;
  byDifficulty: Record<1 | 2 | 3, FreqBucket>;
  /** Topics sorted by heat desc, then count desc. */
  byTopic: TopicFreq[];
}

/** Aggregates a company's tagged problems by difficulty and topic, weighted by
    the curated frequency ranks. Purely derived from COMPANY_FREQ + tags. */
export function companyFrequency(companyId: string, problems: CodingProblem[] = CODING_PROBLEMS): CompanyFrequency {
  const byDifficulty: Record<1 | 2 | 3, FreqBucket> = {
    1: { count: 0, heat: 0 },
    2: { count: 0, heat: 0 },
    3: { count: 0, heat: 0 }
  };
  const topicMap = new Map<string, TopicFreq>();
  let heat = 0;
  for (const p of problems) {
    if (!problemIsForCompany(p, companyId)) continue;
    const f = freqForProblem(companyId, p.id);
    heat += f;
    byDifficulty[p.difficulty].count += 1;
    byDifficulty[p.difficulty].heat += f;
    const topic = codingTopicFor(p);
    const t = topicMap.get(topic) ?? { topic, count: 0, heat: 0, hottest: null };
    t.count += 1;
    t.heat += f;
    if (!t.hottest || f > freqForProblem(companyId, t.hottest.id)) t.hottest = p;
    topicMap.set(topic, t);
  }
  const byTopic = [...topicMap.values()].sort((a, b) => b.heat - a.heat || b.count - a.count);
  return { companyId, total: byDifficulty[1].count + byDifficulty[2].count + byDifficulty[3].count, heat, byDifficulty, byTopic };
}

/* ------------------------------------------------------------------ */
/* Personalized focus — company heat blended with the user's own gaps   */
/* ------------------------------------------------------------------ */

/** Weak-skill name hints → coding topics. A weak diagnostic/self rating whose
    name matches one of these boosts problems in the matching topic. */
const SKILL_TOPIC_HINTS: { re: RegExp; topics: string[] }[] = [
  { re: /algorith|data struct|dsa|problem solving/i, topics: ["Arrays & hashing", "Search & sorting", "Dynamic programming", "Strings & stacks", "Language basics"] },
  { re: /javascript|typescript|(^|\W)js(\W|$)/i, topics: ["collections", "composition", "async", "timing", "classes", "search"] },
  { re: /react|vue|angular|frontend|css|html|ui\b/i, topics: ["UI components"] },
  { re: /async|promise|event|node|backend|api|server/i, topics: ["async", "timing"] }
];

/** Key points missed across interview sessions → coding topics. Phrases like
    “time complexity” or “edge cases” in missed key points signal a real gap
    that the company heat ranking should surface. */
const MISSED_TOPIC_HINTS: { re: RegExp; topics: string[] }[] = [
  { re: /time complexity|space complexity|asymptotic|big-?o|optimize|efficien/i, topics: ["Arrays & hashing", "Search & sorting", "Dynamic programming"] },
  { re: /hash|dictionary|map\b|set\b/i, topics: ["Arrays & hashing"] },
  { re: /recurs|base case|stack|queue|backtrack/i, topics: ["Strings & stacks", "Search & sorting", "Dynamic programming"] },
  { re: /binary search|search|sort|two pointer|sliding window/i, topics: ["Search & sorting", "Arrays & hashing"] },
  { re: /edge case|corner case|input validation|boundar/i, topics: ["Language basics", "Arrays & hashing"] },
  { re: /debounce|throttle|async|promise|event loop|callback|timer|concurren/i, topics: ["async", "timing", "collections"] },
  { re: /memoiz|cache|lru|performance/i, topics: ["collections", "classes"] },
  { re: /component|render|dom|props|state|hook|react|vue|a11y|accessib/i, topics: ["UI components"] },
  { re: /data structure|linked|tree|graph|heap|trie/i, topics: ["Arrays & hashing", "Strings & stacks", "Search & sorting"] }
];

/** Runs the missed-key-point keyword bridge over arbitrary text. */
function topicsFromText(text: string, hits: Set<string>): void {
  for (const h of MISSED_TOPIC_HINTS) {
    if (h.re.test(text)) h.topics.forEach(t => hits.add(t));
  }
}

/** Topics the user has missed across saved interview sessions (key-point level). */
export function missedSessionTopics(): Set<string> {
  const sessions = storageGet<SavedSession[]>(STORAGE_KEYS.sessions, []);
  const hits = new Set<string>();
  for (const s of sessions) {
    for (const a of s.answers) {
      for (const m of a.missed ?? []) topicsFromText(m, hits);
    }
  }
  return hits;
}

/** Topics debated in saved coach discussions — the same bridge, so a chat about
    time complexity feeds the same focus plan as a missed key point. */
export function coachDiscussionTopics(): Set<string> {
  const list = storageGet<{ at: number; text: string }[]>(STORAGE_KEYS.coachTopics, []);
  const hits = new Set<string>();
  for (const d of list.slice(0, 10)) topicsFromText(d.text, hits);
  return hits;
}

/** Coding topics derived from arbitrary text (the same bridge as missed key points). */
export function codingTopicsFromText(text: string): string[] {
  const hits = new Set<string>();
  topicsFromText(text, hits);
  return [...hits];
}

/** Suggests the next problem to practice based on the topics raised in a coach
    discussion: problems in those topics first, company heat second, unsolved
    preferred. Returns null when no topic was raised. */
export function suggestNextProblem(companyId: string | null, text: string, problems: CodingProblem[] = CODING_PROBLEMS): CodingProblem | null {
  const topics = new Set(codingTopicsFromText(text));
  if (topics.size === 0) return null;
  const track = getCodingTrack();
  const scored = problems
    .map(p => {
      const match = topics.has(codingTopicFor(p)) ? 10 : 0;
      const heat = companyId && companyId !== "general" ? freqForProblem(companyId, p.id) : 0;
      const solved = track[p.id]?.solved ? -3 : 0;
      return { p, s: match + heat + solved };
    })
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.title.localeCompare(b.p.title));
  return scored[0]?.p ?? null;
}

/** Personal signals for a problem: how often it was failed in the playground,
    and whether a weak self/diagnostic skill, a missed session key point, or a
    saved coach discussion maps to its topic. `weakSrc` says which fired. */
export function focusSignals(p: CodingProblem): { misses: number; weakSkill: boolean; weakSrc: "skill" | "session" | "coach" | null } {
  const misses = getCodingTrack()[p.id]?.fails ?? 0;
  const topic = codingTopicFor(p);
  const profile = getProfile();
  const weak = profile?.skills.filter(s => (s.measured ?? s.self) < 3).map(s => s.skill.toLowerCase()) ?? [];
  if (SKILL_TOPIC_HINTS.some(h => weak.some(w => h.re.test(w)) && h.topics.includes(topic))) {
    return { misses, weakSkill: true, weakSrc: "skill" };
  }
  if (missedSessionTopics().has(topic)) {
    return { misses, weakSkill: true, weakSrc: "session" };
  }
  if (coachDiscussionTopics().has(topic)) {
    return { misses, weakSkill: true, weakSrc: "coach" };
  }
  return { misses, weakSkill: false, weakSrc: null };
}

/** Whether the user has any personalization signal at all (so the UI can show
    the personalized plan only when it is actually personalized). */
export function hasPersonalSignals(): boolean {
  const track = getCodingTrack();
  const anyMiss = Object.values(track).some(e => (e?.fails ?? 0) > 0);
  const profile = getProfile();
  const anyWeak = !!profile?.skills.some(s => (s.measured ?? s.self) < 3);
  return anyMiss || anyWeak || missedSessionTopics().size > 0 || coachDiscussionTopics().size > 0;
}

export interface FocusRank {
  problem: CodingProblem;
  /** Company heat (curated frequency rank). */
  freq: CompanyFreq;
  /** Playground failures for this problem. */
  misses: number;
  /** True when a weak skill, missed session key point, or coach discussion maps here. */
  weakSkill: boolean;
  /** Which personal signal fired — "skill", "session" or "coach". */
  weakSrc: "skill" | "session" | "coach" | null;
  /** Combined score — freq dominates, personal signals add. */
  score: number;
}

/** Every company-tagged problem ranked by company heat + the user's own
    signals (missed in the playground, weak skill topic). Pure + deterministic
    given the same storage state. */
export function personalFocusForCompany(companyId: string, problems: CodingProblem[] = CODING_PROBLEMS): FocusRank[] {
  return problems
    .filter(p => problemIsForCompany(p, companyId))
    .map(p => {
      const freq = freqForProblem(companyId, p.id);
      const { misses, weakSkill, weakSrc } = focusSignals(p);
      const score = freq * 3 + (misses >= 2 ? 2 : misses >= 1 ? 1 : 0) + (weakSkill ? 2 : 0);
      return { problem: p, freq, misses, weakSkill, weakSrc, score };
    })
    .sort((a, b) => b.score - a.score || b.freq - a.freq || a.problem.title.localeCompare(b.problem.title));
}

/** Personalized plan — the top-scoring easy, medium and hard for the company
    (up to 3). Degenerates to the frequency plan when the user has no signals. */
export function personalPlan(companyId: string, problems: CodingProblem[] = CODING_PROBLEMS): FocusRank[] {
  const ranked = personalFocusForCompany(companyId, problems);
  const out: FocusRank[] = [];
  for (const d of [1, 2, 3] as const) {
    const pick = ranked.find(r => r.problem.difficulty === d && !out.some(o => o.problem.id === r.problem.id));
    if (pick) out.push(pick);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Session question heat — company weight on mock-interview cards       */
/* ------------------------------------------------------------------ */

/** Maps an interview question category to the company's coding frequency so
    session cards can show how much weight the company places on it. Technical
    questions carry the company's overall heat; System Design carries its
    hottest topic. Returns null when there's no real company or no data. */
export function qaCategoryHeat(cat: string, companyId: string | null): { heat: number; focus: string } | null {
  if (!companyId || companyId === "general" || companyId === "bank" || companyId === "weak") return null;
  const f = companyFrequency(companyId);
  if (f.total === 0) return null;
  if (cat === "Technical") return { heat: f.heat, focus: f.byTopic[0]?.topic ?? "" };
  if (cat === "System Design") {
    const top = f.byTopic[0];
    return top ? { heat: top.heat, focus: top.topic } : null;
  }
  return null;
}

/** Deterministic difficulty-aware practice plan for a company — now frequency-
    aware: the highest-frequency easy problem first, then the highest-frequency
    medium (falling back to hard, then the hottest remaining). Never returns
    more than 2. */
export function companyInterviewPlan(companyId: string, problems: CodingProblem[] = CODING_PROBLEMS): CodingProblem[] {
  const tagged = problems
    .filter(p => problemIsForCompany(p, companyId))
    .map((p, i) => ({ p, i }))
    .sort((a, b) => freqForProblem(companyId, b.p.id) - freqForProblem(companyId, a.p.id) || a.i - b.i)
    .map(x => x.p);
  const easy = tagged.find(p => p.difficulty === 1);
  const medium = tagged.find(p => p.difficulty >= 2 && p.id !== easy?.id) ?? tagged.find(p => p.id !== easy?.id);
  const out: CodingProblem[] = [];
  if (easy) out.push(easy);
  if (medium && medium.id !== easy?.id) out.push(medium);
  return out;
}
