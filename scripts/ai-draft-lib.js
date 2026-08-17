#!/usr/bin/env node
/* P4 — pure helpers for the AI problem-drafting pipeline (docs/question-bank-expansion.md §4).
   Kept dependency-free + side-effect-free so vitest can unit-test everything.

   The legal posture is the same as the rest of the content pipeline: problem
   TITLES, companies and difficulty are facts harvested from public mirrors
   (metadata, never statements); the prompt, input/output contract, test cases
   and reference solution are AI-ORIGINAL writing. Nothing ships until the
   generated reference passes its own visible + hidden cases through the local
   judge (the same gate src/__tests__/algorithms.test.ts applies to the human
   bank). */

import vm from "node:vm";

/* ---------- pattern catalog (ids must match src/data/patterns.ts) ---------- */

export const PATTERNS = [
  { id: "two-pointer", aliases: ["two pointers", "two sum", "three sum", "pair", "triplet", "container with most water", "trapping rain water", "move zeroes"] },
  { id: "sliding-window", aliases: ["sliding window", "substring", "minimum window", "longest substring", "max consecutive"] },
  { id: "hash-map", aliases: ["hash", "anagram", "duplicate", "intersection", "contains", "group anagram", "frequency"] },
  { id: "binary-search", aliases: ["binary search", "search in rotated", "find minimum in rotated", "sqrt", "koko", "first and last position", "search insert"] },
  { id: "dynamic-programming", aliases: ["climbing stairs", "house robber", "coin change", "edit distance", "longest common subsequence", "knapsack", "word break", "palindromic substring", "unique paths", "jump game", "partition", "decode ways"] },
  { id: "greedy", aliases: ["greedy", "gas station", "task scheduler", "meeting rooms", "non-overlapping", "minimum number of arrows"] },
  { id: "heap", aliases: ["heap", "priority queue", "k closest", "kth largest", "top k", "merge k sorted", "median from data stream", "kth smallest"] },
  { id: "stack", aliases: ["stack", "valid parentheses", "min stack", "monotonic", "daily temperatures", "largest rectangle", "evaluate reverse polish", "simplify path"] },
  { id: "queue", aliases: ["queue", "bfs", "sliding window maximum", "implement queue", "number of recent calls"] },
  { id: "graph", aliases: ["graph", "number of islands", "course schedule", "clone graph", "topological", "connected components", "alien dictionary", "word ladder", "network delay"] },
  { id: "interval", aliases: ["interval", "merge intervals", "insert interval", "meeting rooms", "non-overlapping intervals", "teemo attacking"] },
  { id: "linked-list", aliases: ["linked list", "lru cache", "reverse linked", "merge two sorted lists", "cycle", "palindrome linked", "remove nth", "middle of the linked"] },
  { id: "tree", aliases: ["binary tree", "bst", "lowest common ancestor", "diameter", "invert", "validate", "right side view", "level order", "path sum", "serialize"] },
  { id: "trie", aliases: ["trie", "prefix", "implement trie", "autocomplete", "word search ii", "design add and search"] },
  { id: "bit", aliases: ["bit manipulation", "single number", "xor", "power of two", "hamming weight", "missing number"] },
  { id: "backtracking", aliases: ["backtrack", "permutation", "combination", "subset", "n-queens", "word search", "generate parentheses", "letter combinations", "palindrome partitioning", "sudoku"] },
  { id: "math", aliases: ["pow", "power", "sqrt", "divide two", "integer to roman", "roman to integer", "fizzbuzz", "count primes", "factorial", "happy number", "palindrome number", "reverse integer"] },
  { id: "string", aliases: ["reverse", "palindrome", "string", "atoi", "zigzag", "needle", "strstr", "longest common prefix", "valid", "word pattern", "is subsequence"] },
  { id: "sorting", aliases: ["sort", "quickselect", "merge sorted arrays", "kth", "wiggle sort", "sort colors"] },
  { id: "mixed", aliases: [] }
];

export const PATTERN_IDS = PATTERNS.map((p) => p.id);

/* Model-friendly variants → canonical pattern id (the model is told the exact
   ids, but it still writes "hash table", "two pointers", "dp" … — map them
   instead of rejecting a good draft over a label). */
const PATTERN_ALIASES = {
  "two-pointer": ["two-pointer", "two pointer", "two-pointers", "two pointers", "pointer technique"],
  "sliding-window": ["sliding-window", "sliding window", "sliding-window technique"],
  "hash-map": ["hash-map", "hash map", "hashmap", "hash table", "hash-table", "hashing", "hash set", "hash"],
  "binary-search": ["binary-search", "binary search", "binarysearch"],
  "dynamic-programming": ["dynamic-programming", "dynamic programming", "dp"],
  "greedy": ["greedy", "greed"],
  "heap": ["heap", "priority-queue", "priority queue", "priorityqueue", "min-heap", "max-heap"],
  "stack": ["stack", "monotonic stack", "monotonic-stack"],
  "queue": ["queue", "deque"],
  "graph": ["graph", "union-find", "union find", "topological sort", "topological"],
  "interval": ["interval", "intervals", "merge intervals", "merge-intervals"],
  "linked-list": ["linked-list", "linked list", "linkedlist"],
  "tree": ["tree", "binary-tree", "binary tree", "bst", "binary search tree"],
  "trie": ["trie", "prefix tree"],
  "bit": ["bit-manipulation", "bit manipulation", "bitmask"],
  "backtracking": ["backtracking", "backtrack", "dfs+backtracking"],
  "math": ["math", "mathematical", "maths"],
  "string": ["string", "strings", "string manipulation"],
  "sorting": ["sorting", "sort", "quickselect", "quick-select"],
  "mixed": ["mixed", "design", "data structure design", "simulation", "miscellaneous", "array", "arrays", "greedy/hash"]
};

/** Maps a model-provided pattern label to a canonical id, or null. */
export function canonicalPattern(raw) {
  const t = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  for (const [id, aliases] of Object.entries(PATTERN_ALIASES)) {
    if (aliases.includes(t)) return id;
    const hit = aliases.find((a) => a.length >= 5 && t.includes(a));
    if (hit) return id;
  }
  return null;
}

/* pattern id → CLI topic bucket — must match src/data/patterns.ts PATTERN_TOPIC
   (a cross-check test locks this) */
export const PATTERN_TOPIC = {
  "two-pointer": "Arrays & hashing",
  "sliding-window": "Arrays & hashing",
  "hash-map": "Arrays & hashing",
  "interval": "Arrays & hashing",
  "greedy": "Arrays & hashing",
  "sorting": "Arrays & hashing",
  "string": "Strings & stacks",
  "stack": "Strings & stacks",
  "queue": "Strings & stacks",
  "linked-list": "Strings & stacks",
  "binary-search": "Search & sorting",
  "backtracking": "Search & sorting",
  "dynamic-programming": "Dynamic programming",
  "tree": "Dynamic programming",
  "graph": "Dynamic programming",
  "heap": "Dynamic programming",
  "trie": "Dynamic programming",
  "bit": "Dynamic programming",
  "math": "Language basics",
  "mixed": "Algorithms"
};

/** Best-guess pattern id from a problem title (facts keyword match), else "mixed". */
export function patternFromTitle(title) {
  const t = String(title ?? "").toLowerCase();
  for (const p of PATTERNS) {
    if (p.id === "mixed") continue;
    if (p.aliases.some((a) => t.includes(a))) return p.id;
  }
  return "mixed";
}

/* ---------- titles already in the human bank (skip — never regenerate) ---------- */

export const CURATED_TITLES = [
  "Two Sum", "Valid Parentheses", "Maximum Subarray", "Binary Search", "Best Time to Buy and Sell Stock", "FizzBuzz",
  "Reverse String", "Palindrome Check", "Contains Duplicate", "Valid Anagram", "Fibonacci", "Merge Sorted Arrays",
  "Longest Common Prefix", "First Unique Character", "Move Zeroes", "Missing Number", "Majority Element",
  "Rotate Array", "Climbing Stairs", "Intersection of Two Arrays"
];

/* ---------- text helpers ---------- */

/** Title → kebab-case problem id (deterministic; ids must match the picker). */
export function slugify(title) {
  const s = String(title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "problem";
}

/** Strips markdown link syntax and leading list numbers: `[1. Two Sum](url)` → `Two Sum`. */
export function normalizeTitle(title) {
  return String(title ?? "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\d+\.\s*/, "")
    .trim();
}

/** Public company name (mirror heading) → app company id (src/data/companies.ts). */
const COMPANY_ALIASES = {
  google: "google", "meta": "meta", facebook: "meta", "amazon": "amazon", microsoft: "microsoft",
  apple: "apple", uber: "uber", airbnb: "airbnb", netflix: "netflix", spotify: "spotify",
  stripe: "stripe", datadog: "datadog", cloudflare: "cloudflare", linkedin: "microsoft"
};

export function companyIdForName(name) {
  return COMPANY_ALIASES[String(name ?? "").trim().toLowerCase()] ?? null;
}

/* ---------- candidate building ---------- */

/** Turns extractCompanyList items into deduped, ranked candidates.
    `existingIds` (a Set of slugs already in the bank) are skipped. */
export function buildCandidates(items, existingIds = new Set()) {
  const map = new Map();
  for (const it of items) {
    const title = normalizeTitle(it.question);
    if (title.length < 3) continue;
    const slug = slugify(title);
    if (existingIds.has(slug)) continue;
    const companyId = companyIdForName(it.meta?.group);
    let c = map.get(slug);
    if (!c) {
      c = { title, slug, companies: new Set(), difficulties: new Set(), urls: new Set() };
      map.set(slug, c);
    }
    if (companyId) c.companies.add(companyId);
    if (it.meta?.difficulty) c.difficulties.add(Number(it.meta.difficulty));
    if (it.meta?.url) c.urls.add(String(it.meta.url));
  }
  return [...map.values()]
    .filter((c) => c.companies.size > 0)
    .sort((a, b) => b.companies.size - a.companies.size || a.title.localeCompare(b.title));
}

/* ---------- AI contract ---------- */

/** Strict-JSON contract the model must return for one candidate. */
export function buildDraftPrompt(candidate) {
  return [
    "You are an expert competitive-programming interviewer. You write ORIGINAL practice problems for an interview-prep app.",
    "",
    "HARD RULES:",
    "1. The TITLE is a well-known interview topic (a fact). NEVER copy the problem statement from any website — LeetCode, GeeksforGeeks or any other source. Write an ORIGINAL prompt, YOUR OWN input/output contract, YOUR OWN variable names and YOUR OWN test cases. Do not reproduce anyone's wording.",
    "2. 'tests' are the visible cases (2-5), 'hidden' are judge-only edge cases (1-3) — never identical inputs.",
    "3. 'reference' MUST be exactly this skeleton (write your logic inside it):\nfunction solve(lines) {\n  const out = [];\n  // your logic here — push one output line per element (strings only)\n  return out;\n}\n(lines is stdin split by newline; console.log is NOT available. Never return a single value — always the array.)",
    "4. 'hint': one short nudge (under 160 chars), no full solution.",
    "5. 'pattern': one of: " + PATTERN_IDS.join(", ") + ".",
    "6. 'difficulty': 1 (easy), 2 (medium), or 3 (hard).",
    "7. OUTPUT IS LINE-ORIENTED (this is a stdin/stdout judge): each element of the array you return prints on its OWN line.",
    "8. In 'tests'/'hidden', the 'expect' string must be EXACTLY what the judge sees. If the answer is a list, write one element PER LINE joined by \\n (e.g. \"1 6\\n8 10\\n15 18\"). If it is a single value, write the value alone (e.g. \"3\"). NEVER write JSON-style single-line arrays like [[1,6],[8,10]] as an expect — the judge compares raw stdout lines.",
    "9. Keep 'prompt' under ~700 chars and 'io' under ~450 chars.",
    "10. Mentally run your reference against EVERY test you write (including hidden) and make sure the printed lines match 'expect' exactly.",
    "",
    "Return ONLY strict JSON (no markdown fences, no commentary):",
    '{"prompt": string, "io": string, "tests": [{"stdin": string, "expect": string}], "hidden": [{"stdin": string, "expect": string}], "reference": string, "hint": string, "pattern": string, "difficulty": 1|2|3}',
    "",
    "CANDIDATE:",
    JSON.stringify({
      title: candidate.title,
      difficultyHint: candidate.difficulties.size ? [...candidate.difficulties].sort().join("/") : "unknown",
      companies: [...candidate.companies],
      sourceUrl: candidate.urls.size ? [...candidate.urls][0] : null
    }, null, 2)
  ].join("\n");
}

/** Extracts the first balanced JSON object from a model reply, or null. */
export function parseDraftJson(text) {
  const t = String(text ?? "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Shape-checks a parsed draft; returns { ok, errors } (never throws). */
export function validateProblem(candidate, parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== "object") return { ok: false, errors: ["not an object"] };
  if (typeof parsed.prompt !== "string" || !parsed.prompt.trim() || parsed.prompt.length > 700)
    errors.push("prompt missing/too long");
  if (typeof parsed.io !== "string" || !parsed.io.trim() || parsed.io.length > 450)
    errors.push("io missing/too long");
  const testsOk = Array.isArray(parsed.tests) && parsed.tests.length >= 2 && parsed.tests.length <= 6
    && parsed.tests.every((t) => t && typeof t.stdin === "string" && typeof t.expect === "string");
  if (!testsOk) errors.push("tests must be 2-6 {stdin, expect} string pairs");
  const hiddenOk = Array.isArray(parsed.hidden) && parsed.hidden.length >= 1 && parsed.hidden.length <= 4
    && parsed.hidden.every((t) => t && typeof t.stdin === "string" && typeof t.expect === "string");
  if (!hiddenOk) errors.push("hidden must be 1-4 {stdin, expect} string pairs");
  /* hidden cases must never duplicate a visible one (the app's star.test locks this) */
  if (Array.isArray(parsed.tests) && Array.isArray(parsed.hidden)) {
    const visibleInputs = new Set(parsed.tests.map((t) => t?.stdin));
    if (parsed.hidden.some((h) => visibleInputs.has(h?.stdin))) errors.push("a hidden case duplicates a visible input");
  }
  if (typeof parsed.reference !== "string" || !/function\s+solve\s*\(/.test(parsed.reference))
    errors.push("reference must be a `function solve(lines)`");
  if (typeof parsed.hint !== "string" || !parsed.hint.trim() || parsed.hint.length > 180)
    errors.push("hint missing/too long");
  if (![1, 2, 3].includes(Number(parsed.difficulty))) errors.push("difficulty must be 1|2|3");
  if (typeof parsed.pattern !== "string" || !canonicalPattern(parsed.pattern))
    errors.push("pattern must be a known pattern id");
  return { ok: errors.length === 0, errors };
}

/* ---------- per-language starters (mirrors src/data/starters.ts) ---------- */

const PY = (body) => `import sys\n\n# Input:\n#   ${body}\ndef solve(lines):\n    out = []\n    # your code here — append each output line to out\n    return out\n`;
const JS = (body) => `// Input:\n//   ${body}\n// lines = input split by newline (no trailing newlines)\nfunction solve(lines) {\n  const out = [];\n  // your code here — push each output line onto out\n  return out;\n}\n`;
const TS = (body) => `// Input:\n//   ${body}\nfunction solve(lines: string[]): string[] {\n  const out: string[] = [];\n  // your code here — push each output line onto out\n  return out;\n}\n`;
const CPP = (body) => `#include <bits/stdc++.h>\nusing namespace std;\n\n// Input:\n//   ${body}\nvector<string> solve(const vector<string>& lines) {\n    vector<string> out;\n    // your code here — push each output line onto out\n    return out;\n}\n\nint main() {\n    vector<string> lines;\n    string l;\n    while (getline(cin, l)) lines.push_back(l);\n    for (const string& o : solve(lines)) cout << o << "\\n";\n    return 0;\n}\n`;
const JAVA = (body) => `import java.util.*;\n\nclass Main {\n    // Input:\n    //   ${body}\n    static List<String> solve(List<String> lines) {\n        List<String> out = new ArrayList<>();\n        // your code here — add each output line to out\n        return out;\n    }\n\n    public static void main(String[] args) {\n        Scanner s = new Scanner(System.in);\n        List<String> lines = new ArrayList<>();\n        while (s.hasNextLine()) lines.add(s.nextLine());\n        for (String o : solve(lines)) System.out.println(o);\n    }\n}\n`;
const GO = (body) => `package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\n// Input:\n//   ${body}\nfunc solve(lines []string) []string {\n    out := []string{}\n    // your code here — append each output line to out\n    return out\n}\n\nfunc main() {\n    sc := bufio.NewScanner(os.Stdin)\n    var lines []string\n    for sc.Scan() {\n        lines = append(lines, sc.Text())\n    }\n    for _, o := range solve(lines) {\n        fmt.Println(o)\n    }\n}\n`;

/** Normalizes a validated draft into a full CliProblem-shaped object. */
export function normalizeProblem(candidate, parsed) {
  const io = String(parsed.io).trim();
  return {
    kind: "cli",
    id: candidate.slug,
    title: candidate.title,
    difficulty: Number(parsed.difficulty),
    prompt: String(parsed.prompt).trim(),
    io,
    starters: { python: PY(io), javascript: JS(io), typescript: TS(io), cpp: CPP(io), java: JAVA(io), go: GO(io) },
    tests: parsed.tests,
    hidden: parsed.hidden,
    hint: String(parsed.hint).trim(),
    reference: String(parsed.reference).trim(),
    pattern: canonicalPattern(parsed.pattern) ?? "mixed"
  };
}

/* ---------- local judge (mirrors src/services/runner.ts semantics) ---------- */

const fmt = (v) => (typeof v === "string" ? v : JSON.stringify(v));

/** Runs a reference `solve(lines)` against one stdin via node:vm (timed out so a
    looping AI reference can't hang the pipeline). Returns { ok, stdout, error }. */
export function runJudge(reference, stdin) {
  const code = `const __INPUT__ = ${JSON.stringify(stdin)};\n${reference}\n// --- runner ---\nfunction __run() {\n  const lines = __INPUT__.split("\\n");\n  for (const out of solve(lines)) console.log(out);\n}\n__run();`;
  const lines = [];
  const sandbox = {
    console: {
      log: (...a) => lines.push(a.map(fmt).join(" ")),
      error: (...a) => lines.push(a.map(fmt).join(" "))
    }
  };
  try {
    vm.runInNewContext(code, sandbox, { timeout: 3000 });
    return { ok: true, stdout: lines.join("\n") };
  } catch (e) {
    return { ok: false, stdout: lines.join("\n"), error: e && e.message ? String(e.message) : String(e) };
  }
}

/** Output normalization identical to the app runner (trim lines, drop trailing empties). */
export function normalizeOutput(s) {
  return String(s ?? "")
    .split("\n").map((l) => l.trimEnd()).join("\n")
    .replace(/\n+$/, "").trim();
}

export function matchesExpected(got, expect) {
  return normalizeOutput(got) === normalizeOutput(expect);
}

/** The P4 quality gate: the AI reference must pass its own visible + hidden cases. */
export function gateProblem(problem) {
  const cases = [...problem.tests, ...(problem.hidden ?? [])];
  const results = cases.map((t) => {
    const r = runJudge(problem.reference, t.stdin);
    return {
      stdin: t.stdin,
      expect: t.expect,
      got: r.ok ? r.stdout : r.error ?? "",
      error: r.error,
      pass: r.ok && matchesExpected(r.stdout, t.expect)
    };
  });
  return { pass: results.every((r) => r.pass), results };
}

/* ---------- aiGenerated.ts emission ---------- */

/** Serializes one problem to the emitted TS file's 2-space JSON style. */
function problemLiteral(p) {
  const obj = {
    kind: p.kind,
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    prompt: p.prompt,
    io: p.io,
    starters: p.starters,
    tests: p.tests,
    hidden: p.hidden,
    hint: p.hint,
    reference: p.reference,
    pattern: p.pattern
  };
  return JSON.stringify(obj, null, 2);
}

/** Builds the full aiGenerated.ts file content. `problems` already passed the
    gate; `companies` maps id → company ids (facts from mirror metadata);
    `topics` maps id → topic bucket. */
export function emitProblemsFile({ problems, companies, topics, generatedAt }) {
  const sorted = [...problems].sort((a, b) => a.id.localeCompare(b.id));
  const problemsBody = sorted.length
    ? sorted.map((p) => "  " + problemLiteral(p).replace(/\n/g, "\n  ")).join(",\n")
    : "";
  const companiesBody = Object.keys(companies).length
    ? Object.entries(companies)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, list]) => `  ${JSON.stringify(id)}: ${JSON.stringify(list)}`)
        .join(",\n")
    : "";
  const topicsBody = Object.keys(topics).length
    ? Object.entries(topics)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, t]) => `  ${JSON.stringify(id)}: ${JSON.stringify(t)}`)
        .join(",\n")
    : "";
  return `/* AUTO-GENERATED by scripts/ai-draft-problems.js — do not edit by hand.
   P4 AI-authored coding problems (docs/question-bank-expansion.md §4).
   Every problem below passed its own visible + hidden cases through the local
   judge before being written. Prompts, test cases and references are
   AI-ORIGINAL; titles, difficulty and companies come from public problem-title
   metadata (facts). Generated ${generatedAt ?? new Date().toISOString()}. */

import type { CliProblem } from "../coding";

export const AI_GENERATED_PROBLEMS: CliProblem[] = [
${problemsBody}
];

/* Generated problem id → company ids (facts from the mirror metadata). */
export const AI_PROBLEM_COMPANIES: Record<string, string[]> = {
${companiesBody}
};

/* Generated problem id → CLI topic bucket (company frequency + roadmap). */
export const AI_CLI_TOPICS: Record<string, string> = {
${topicsBody}
};
`;
}

/** Ids of problems already emitted in an aiGenerated.ts file (regex — the file
    is machine-generated with a fixed shape, so this is robust). */
export function existingAiIds(fileContent) {
  const ids = new Set();
  const re = /"id":\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(String(fileContent ?? "")))) ids.add(m[1]);
  return ids;
}

/** Parses an emitted aiGenerated.ts file back into its data (the file is
    machine-generated JSON in a fixed shape, so stripping the TS annotations
    and evaling it is robust). Used so a run MERGES new problems into the
    existing bank instead of overwriting it. */
export function parseGeneratedProblems(fileContent) {
  const s = String(fileContent ?? "")
    .replace(/^import .*$/m, "")
    .replace(/^export const /gm, "const ")
    .replace(": CliProblem[]", "")
    .replace(": Record<string, string[]>", "")
    .replace(": Record<string, string>", "");
  try {
    const mod = new Function(`${s}\nreturn { AI_GENERATED_PROBLEMS, AI_PROBLEM_COMPANIES, AI_CLI_TOPICS };`)();
    return {
      problems: Array.isArray(mod.AI_GENERATED_PROBLEMS) ? mod.AI_GENERATED_PROBLEMS : [],
      companies: (mod.AI_PROBLEM_COMPANIES && typeof mod.AI_PROBLEM_COMPANIES === "object") ? mod.AI_PROBLEM_COMPANIES : {},
      topics: (mod.AI_CLI_TOPICS && typeof mod.AI_CLI_TOPICS === "object") ? mod.AI_CLI_TOPICS : {}
    };
  } catch {
    return { problems: [], companies: {}, topics: {} };
  }
}
