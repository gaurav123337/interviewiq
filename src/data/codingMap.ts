/* Roadmap → coding mapping. The code-focus card on the Roadmap dashboard picks
   problems from the current week's topics. This module curates explicit
   topic-label → problem-id links (so “data structures” shows two-sum, not a
   random daily pick), then falls back to keyword matching and finally the
   daily pick so the card is never empty. */

import type { CodingProblem } from "./coding";
import { CODING_PROBLEMS } from "./coding";
/* P4 pattern taxonomy — roadmap topics surface generated problems by pattern. */
const PATTERN_TOPIC_LINKS: Record<string, string[]> = {
  "data structures": ["hash-map", "stack", "queue", "linked-list", "tree", "graph", "trie", "heap"],
  "algorithms": ["two-pointer", "sliding-window", "binary-search", "dynamic-programming", "greedy", "interval", "backtracking", "sorting", "bit", "math", "string"]
};

/** Curated label fragments (normalized lowercase) → problem ids. */
const TOPIC_MAP: Record<string, string[]> = {
  /* language */
  "javascript / typescript": ["fn-debounce", "fn-throttle", "fn-deep-clone", "fn-promise-all", "fn-event-emitter", "fn-memoize", "fn-curry", "fn-flatten"],
  "language basics": ["reverse-string", "palindrome", "fizzbuzz", "fn-flatten", "fn-uniq", "fn-range"],
  "css & accessibility": ["ui-tooltip", "ui-theme-toggle", "ui-slider", "ui-progress-bar"],
  "react · vue · angular": ["ui-react-counter", "ui-react-todo", "ui-react-tabs", "ui-vue-counter", "ui-vue-todo", "ui-tabs", "ui-accordion", "ui-dropdown", "ui-autocomplete", "ui-todo", "ui-tags-input"],
  "dom & browser apis": ["ui-toast", "ui-modal", "ui-carousel", "ui-drag-drop", "ui-otp-input", "ui-stepper", "ui-countdown"],
  "web performance": ["ui-virtual-list", "fn-debounce", "fn-throttle", "fn-map-limit", "fn-memoize"],
  /* data & algorithms */
  "data structures": ["two-sum", "valid-parens", "binary-search", "fn-lru-cache", "contains-duplicate", "majority-element", "merge-sorted"],
  "algorithms": ["max-subarray", "climbing-stairs", "fibonacci", "binary-search", "intersection", "rotate-array"],
  "design patterns": ["fn-pipe", "fn-compose", "fn-once", "fn-event-emitter", "fn-memoize"],
  "databases & caching": ["fn-lru-cache", "fn-memoize", "fn-group-by"],
  "databases": ["fn-lru-cache", "fn-memoize", "fn-group-by"],
  /* backend / scale */
  "apis & services": ["fn-promise-all", "fn-map-limit", "fn-sleep"],
  "apis": ["fn-promise-all", "fn-map-limit", "fn-sleep"],
  "distributed systems": ["fn-lru-cache", "fn-map-limit"],
  "scalability": ["fn-map-limit", "fn-lru-cache"],
  "large-scale systems": ["fn-map-limit", "fn-lru-cache"],
  /* testing / misc */
  "testing fundamentals": ["fizzbuzz", "valid-parens", "two-sum"],
  "test strategy": ["fizzbuzz", "valid-parens", "two-sum"],
  "debugging": ["valid-parens", "binary-search", "missing-number"]
};

/** Keyword fallback (kept from the original heuristic) — broad topic buckets. */
function keywordFallback(labels: string[]): CodingProblem[] {
  const text = labels.map(t => t.toLowerCase()).join(" ");
  const picks: CodingProblem[] = [];
  if (/async|promise|timer|event|debounce|throttle/i.test(text))
    picks.push(...CODING_PROBLEMS.filter(p => p.kind === "fn" && /async|timing/i.test(p.category)));
  if (/dom|component|html|css|ui|frontend/i.test(text))
    picks.push(...CODING_PROBLEMS.filter(p => p.kind === "ui"));
  if (/array|string|hash|two.?pointer|sliding|stack|queue|recurs|dp|dynamic|binary|search|sort|graph|tree|linked/i.test(text))
    picks.push(...CODING_PROBLEMS.filter(p => p.kind === "cli" && p.difficulty <= 2));
  return picks;
}

const byId = (id: string): CodingProblem | undefined => CODING_PROBLEMS.find(p => p.id === id);

/** Picks up to `limit` problems for the given topic labels: curated links first,
    keyword fallback second, deterministic daily pick last. Never returns empty. */
export function codingForTopicLabels(labels: string[], limit = 3): CodingProblem[] {
  const text = labels.map(t => t.toLowerCase()).join(" ");
  const out: CodingProblem[] = [];
  const seen = new Set<string>();
  const push = (p: CodingProblem | undefined) => {
    if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); }
  };

  /* 1) curated per-topic links */
  for (const [key, ids] of Object.entries(TOPIC_MAP)) {
    if (text.includes(key)) ids.forEach(id => push(byId(id)));
    if (out.length >= limit) return out.slice(0, limit);
  }
  /* 2) keyword fallback */
  if (out.length < limit) keywordFallback(labels).forEach(push);
  /* 2b) P4 pattern-matched problems — a roadmap topic pulls the generated
     problems whose pattern belongs to that topic (adds difficulty-3 picks the
     difficulty ≤ 2 keyword fallback skips) */
  if (out.length < limit) {
    const wanted = new Set<string>();
    for (const [key, pats] of Object.entries(PATTERN_TOPIC_LINKS)) {
      if (text.includes(key)) pats.forEach(p => wanted.add(p));
    }
    if (wanted.size > 0) {
      for (const p of CODING_PROBLEMS) {
        if (p.kind === "cli" && p.pattern && wanted.has(p.pattern)) push(p);
        if (out.length >= limit) break;
      }
    }
  }
  /* 3) deterministic daily pick */
  if (out.length === 0) {
    const day = Math.floor(Date.now() / 86_400_000);
    push(CODING_PROBLEMS[day % CODING_PROBLEMS.length]);
  }
  return out.slice(0, limit);
}
