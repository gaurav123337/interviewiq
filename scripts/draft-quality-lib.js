#!/usr/bin/env node
/* Draft-quality + skill-derivation helpers (Phase 4 discovery follow-up).
   Zero I/O, browser-safe — used by scrape-lib (normalizeItem derives skill
   tags), crawl-orchestrate-lib (routeItems drops hard noise), and the cron
   (noise drops are notices, mirroring the oversize contract). Mirrors
   discover-lib.js style.

   Why: the first live discovery crawl produced 28 drafts of which ~24 were
   hard noise (codepen URLs, UTM/JSON fragments, truncated HN titles) — and
   none carried skill tags, so they could never surface under the Bank's
   'react'/'java' skill filters. Both fixed here, centrally. */

/* Skills the Bank filter UI actually filters by (user request: 'react',
   'java', …). Aliases normalize scraped text to these canonical names —
   e.g. "React.js", "reactjs", "React Native" all tag as "React". */
export const CANONICAL_SKILLS = [
  "React", "React Native", "Angular", "Vue", "Next.js", "Svelte",
  "JavaScript", "TypeScript", "HTML", "CSS", "Node.js", "Python", "Java",
  "Kotlin", "Swift", "Go", "Rust", "C++", "C#", "PHP", "Ruby",
  "SQL", "PostgreSQL", "MongoDB", "Redis", "GraphQL",
  "Docker", "Kubernetes", "AWS", "Git", "Django", "Spring", "Rails", "Flutter",
  /* topic shelves (2026-09-24): the static bank's largest untagged clusters */
  "System Design", "Design Patterns", "SOLID", "TDD", "Functional Programming",
  /* topic shelves (2026-09-25): the published bank's untagged long tail */
  "Machine Learning", "Data Structures", "Microservices", "Concurrency"
];

const SKILL_ALIASES = [
  { canonical: "React", re: /\breact(\.js|js|js native)?\b/i, not: /\breactive\b/i },
  { canonical: "React Native", re: /\breact native\b/i },
  { canonical: "Angular", re: /\bangular(js)?\b/i },
  { canonical: "Vue", re: /\bvue(\.js|\.ts|js)?\b/i },
  { canonical: "Next.js", re: /\bnext(\.js|js)\b/i },
  { canonical: "Svelte", re: /\bsvelte(kit)?\b/i },
  { canonical: "JavaScript", re: /\bjava\s?script\b|\bjs\b/i },
  { canonical: "TypeScript", re: /\btype\s?script\b|\bts\b/i },
  { canonical: "HTML", re: /\bhtml5?\b/i },
  /* "less" only counts with preprocessor context — bare "less" is the English word (#113/#121/#169 lesson) */
  { canonical: "CSS", re: /\bcss3?\b|\btailwind\b|\bsass\b|\bless\s+(preprocessor|css)\b|\bless\.css\b/i },
  { canonical: "Node.js", re: /\bnode(\.js|js)?\b/i },
  { canonical: "Python", re: /\bpython3?\b/i },
  { canonical: "Java", re: /\bjava\b(?!\s?script)/i },
  { canonical: "Kotlin", re: /\bkotlin\b/i },
  { canonical: "Swift", re: /\bswift\b/i },
  { canonical: "Go", re: /\bgolang\b/i },
  { canonical: "Rust", re: /\brust\b/i },
  { canonical: "C++", re: /\bc\+\+/i },
  { canonical: "C#", re: /\bc#(\.net)?\b|\bdotnet\b|\b\.net\b/i },
  { canonical: "PHP", re: /\bphp\b/i },
  { canonical: "Ruby", re: /\bruby\b/i },
  { canonical: "SQL", re: /\bsql\b|\bmysql\b/i },
  { canonical: "PostgreSQL", re: /\bpostgres(ql|)?\b/i },
  { canonical: "MongoDB", re: /\bmongo(db)?\b/i },
  { canonical: "Redis", re: /\bredis\b/i },
  { canonical: "GraphQL", re: /\bgraphql\b/i },
  { canonical: "Docker", re: /\bdocker\b/i },
  { canonical: "Kubernetes", re: /\bkubernetes\b|\bk8s\b/i },
  { canonical: "AWS", re: /\baws\b|\blambda\b/i },
  { canonical: "Git", re: /\bgit(hub|lab)?\b/i },
  { canonical: "Django", re: /\bdjango\b/i },
  { canonical: "Spring", re: /\bspring(boot)?\b/i },
  { canonical: "Rails", re: /\brails\b/i },
  { canonical: "Flutter", re: /\bflutter\b/i },
  /* topic shelves — tight phrases/acronyms only; bare words like "design" or
     "solid" ("a solid understanding") must never match. "System Design" also
     catches question-leading imperatives ("Design a URL shortener…") but not
     "How would you design a rate limiter?" (not at the start). */
  { canonical: "System Design", re: /\bsystem[-\s]design\b|^design\s+(a|an|the)\b/i },
  { canonical: "Design Patterns", re: /\bdesign\s+patterns?\b|\banti[-\s]?corruption\s+layer\b|\blaw\s+of\s+demeter\b|\binversion\s+of\s+control\b|\bdependency\s+(injection|hell)\b|\bactive\s+record\b|\bdata\s+mapper\b|\bcohesion\b|\bcoupling\b|\bseparation\s+of\s+concerns\b|\bsingleton\b/i },
  { canonical: "SOLID", re: /\bsolid\s+principles?\b/i },
  { canonical: "SOLID", re: /\bSOLID\b/ }, /* bare acronym: case-sensitive to avoid "a solid understanding" */
  { canonical: "TDD", re: /\btest[-\s]driven\s+development\b|\bTDD\b/i },
  { canonical: "Functional Programming", re: /\bpure\s+functions?\b|\bfunctional\s+programming\b/i },
  /* topic shelves (2026-09-25) — tight phrases only; generic words ("model",
     "learning", "thread") never match on their own. "regression" is guarded
     against "regression testing" (a QA concept, not ML). */
  { canonical: "Machine Learning", re: /\bmachine learning\b|\boverfit(ting)?\b|\bunderfit(ting)?\b|\bbias[- ]variance\b|\bsupervised learning\b|\bcross[- ]validation\b|\bgradient descent\b|\bneural network\b|\brandom forest\b|\btraining (set|data)\b|\breinforcement learning\b|\bfeature engineering\b/i },
  { canonical: "Machine Learning", re: /\bregression\b(?!\s+test)/i },
  { canonical: "Data Structures", re: /\bdata\s+structures?\b|\bhash\s+(table|map)s?\b|\bbinary\s+(search\s+)?tree|\btime\s+complexity\b|\bspace\s+complexity\b|\bbig-?o\s+notation\b|\bself[-\s]balanc(ing|ed)\b/i },
  { canonical: "Microservices", re: /\bmicroservices?\b/i },
  { canonical: "Concurrency", re: /\bconcurren(t|cy)\b|\bdeadlocks?\b|\brace\s+conditions?\b|\bmutual\s+exclusion\b|\bsemaphores?\b/i }
];

/** Pure: canonical skill names detected in free text (title, answer, source).
 *  Ordered by first appearance; deduped; Java is not matched inside
 *  "JavaScript" and vice versa. Unknown technologies are never guessed. */
export function deriveSkills(text) {
  const t = String(text ?? "");
  if (!t.trim()) return [];
  const out = [];
  for (const { canonical, re, not } of SKILL_ALIASES) {
    if (re.test(t) && !(not && not.test(t))) {
      if (!out.some(s => s.toLowerCase() === canonical.toLowerCase())) out.push(canonical);
    }
  }
  return out;
}

/** Pure: hard-noise classifier for scraped/draft question text.
 *  Returns a machine reason, or null when the text is worth a human's time.
 *  "hard" = a human could NEVER publish it as-is (URLs, JSON, tracked-out
 *  query strings, CJK text, HN announcement/promo stories). Low-value-but-readable
 *  text (truncated titles, "Ask HN:" prep questions) stays review-tier. */
export function noiseReason(text) {
  const q = String(text ?? "").trim();
  if (!q) return "empty";
  if (q.length > 2000) return "oversize"; // defensive; partitionOversizeQuestions is authoritative
  if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff]/.test(q)) return "non-english";
  const lower = q.toLowerCase();
  if (/^(https?:\/\/|www\.)/.test(lower)) return "url-as-question";
  if (/^(tell|show) hn:/.test(lower)) return "hn-story"; // announcements/promos — never interview questions ("Ask HN:" prep questions stay review-tier)
  if (/\b(codepen\.io|jsfiddle\.net|stackblitz\.com|codesandbox\.io|replit\.com)\b/.test(lower)) return "playground-link";
  if (/(\?|&)(utm_|fbclid|gclid|gi=|editors=)/.test(lower)) return "tracking-params";
  if (/(_tags":|_highlights":|objectid|nbhits|url":|title":)/.test(lower)) return "json-fragment";
  if (q.split(/\s+/).length < 3 && !/\?$/.test(q)) return "too-short";
  if (/[A-Z]{25,}/.test(q)) return "shout";
  return null;
}

/** Pure: readable but likely-incomplete text (the "review first" tier).
 *  Distinct from noiseReason: these go to the inbox with a warning chip. */
export function looksTruncated(text) {
  const q = String(text ?? "").trim();
  if (!q) return false;
  if (/^[a-z]/.test(q)) return true;                       // starts lowercase → sentence fragment
  if (/(\?|!|\.)$/.test(q) === false && q.split(/\s+/).length < 6) return true; // short, no terminal punctuation
  if (/…$|\.\.\.$/.test(q)) return true;
  return false;
}

/** Pure: splits items into [keep, dropped] by question noise. `keep` items
 *  gain derived `skills` when absent (normalizeItem usually did it already).
 *  Dropped entries carry { reason, item } so callers surface notices. */
export function partitionNoiseItems(items) {
  const keep = [];
  const dropped = [];
  for (const item of items ?? []) {
    const reason = noiseReason(item?.question);
    if (reason) dropped.push({ reason, item });
    else {
      keep.push(
        item?.skills?.length ? item : { ...item, skills: deriveSkills(`${item?.question ?? ""} ${item?.answer ?? ""}`) }
      );
    }
  }
  return [keep, dropped];
}
