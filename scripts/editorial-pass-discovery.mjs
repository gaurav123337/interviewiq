/* Editorial pass on the 8 remaining discovery drafts (source_id discovery:6/7).
   Keepers get AI-original answers (never verbatim third-party text), rewritten
   question titles, proper field_id (they were all mis-tagged "JavaScript"),
   and skill tags. The 5 forum/repo-noise drafts are deleted. Prints SQL to stdout
   and writes editorial-updates.sql. */
import { writeFileSync } from "node:fs";

const keepers = [
  {
    id: 3306,
    question: "How does AngularJS handle data binding, and what are its main building blocks?",
    field: "frontend",
    level: "mid",
    skills: ["Angular"],
    answer: `AngularJS (the 1.x framework) uses two-way data binding built on dirty checking. Each screen is a tree of directives tied to scopes; a digest cycle runs whenever something may have changed, comparing each watched expression's current value against its previous value. If a watcher reports a change, AngularJS updates the DOM and re-runs watchers until values settle — which is why adding data without $scope.$apply (for example inside a plain setTimeout callback) leaves the view stale.

Its main building blocks are: directives (ng-model, ng-repeat, and custom ones that attach behavior to the DOM), controllers and scopes (the model glue and the digest boundary), services and factories (singletons injected via AngularJS's dependency-injection system), filters (format values in templates), and modules that wire it all together.

Two-way binding is convenient for forms but hides the cost of every keystroke: each one can trigger a digest over hundreds of watchers, which is the classic AngularJS performance trap. Modern Angular (2+) replaced digests with a reactive change-detection model and unidirectional data flow, keeping the directive/dependency-injection ideas while dropping the $scope mechanism.`,
    keyPoints: [
      "Two-way binding = dirty checking over a tree of scopes during the digest cycle",
      "Digest loops until watchers settle; changes outside AngularJS need $apply/$timeout",
      "Building blocks: directives, controllers/scopes, DI services, filters, modules",
      "Watch-count is the performance budget — each keystroke can re-check them all",
      "Modern Angular kept directives and DI but replaced $scope with zone-based change detection"
    ]
  },
  {
    id: 3307,
    question: "What is a data structure, and why does choosing the right one matter?",
    field: "backend",
    level: "mid",
    skills: [],
    answer: `A data structure is a way of organizing data in memory so that specific operations on it are efficient. Arrays keep elements contiguous for O(1) index access but pay O(n) for middle insertions; hash maps trade order for average O(1) lookup; trees keep data sorted with O(log n) search, insert, and delete; heaps give O(1) access to the extreme element and O(log n) insertion, which is why they power priority queues and schedulers.

Choosing well is an algorithmic decision, not a stylistic one. A "find duplicates in a million rows" problem is O(n²) with nested array scans and O(n) with a hash set — same hardware, different orders of magnitude. The choice also shapes the code around it: an append-only log (array) invites batch processing, while an LRU cache is naturally a hash map over a doubly linked list.

In interviews, name the operations you need (lookup? ordered scan? nearest neighbor?), state the complexity of each candidate structure for those operations, and mention the trade-offs — memory overhead, cache friendliness, and whether ordering must be preserved.`,
    keyPoints: [
      "Data structure = memory organization chosen to make specific operations cheap",
      "Array O(1) index vs hash map O(1) lookup vs balanced tree O(log n) sorted ops vs heap for extremes",
      "Right choice changes complexity class: hash set turns duplicate-finding from O(n²) to O(n)",
      "Trade-offs beyond Big-O: memory overhead, cache locality, ordering guarantees",
      "Interview framing: list required operations first, then pick the structure that makes them cheap"
    ]
  },
  {
    id: 3308,
    question: "How would you prepare for an information security job interview?",
    field: "security",
    level: "mid",
    skills: [],
    answer: `Start by mapping the role: security interviews split roughly into offensive (pentesting, red team), defensive (SOC, detection engineering), application/product security, and governance/compliance — each has its own question style, so read the job description and prepare for that track, not "security" in general.

For fundamentals, be fluent in the CIA triad, authentication vs authorization, the OWASP Top 10 (be able to walk through SQL injection, XSS, CSRF, and SSRF with a concrete exploit and fix for each), and common hardening: TLS basics, least privilege, network segmentation, and secure secret storage. Hands-on candidates should be ready to reason live — "here is a suspicious auth log, what do you check first?" — so practice on home-lab or CTF exercises rather than memorizing definitions.

Prepare two or three war stories using the STAR format: an incident you helped triage, a vulnerability you found and how the fix shipped, a control you introduced that survived an audit. Expect a scenario on responding to a breach — outline contain, eradicate, recover, and the communication trail. Finally, have thoughtful questions ready about their threat model and security maturity; asking "how do developers get security review here?" signals you think in systems, not just tools.`,
    keyPoints: [
      "Pick the track first — offensive, defensive, appsec, or GRC — and prep for it",
      "Core knowledge: CIA triad, authN vs authZ, OWASP Top 10 with exploit + fix for each",
      "Practice live reasoning on logs/scenarios, not just definitions",
      "Bring 2–3 STAR stories: incident triage, a found-and-fixed vulnerability, a shipped control",
      "Know breach response phases (contain, eradicate, recover) and ask about their security maturity"
    ]
  }
];

const deletes = [3304, 3305, 3329, 3330, 3331];
const esc = s => String(s).replace(/'/g, "''");

const out = [];
for (const k of keepers) {
  out.push(`update published_questions set`);
  out.push(`  question = '${esc(k.question)}',`);
  out.push(`  answer = '${esc(k.answer)}',`);
  out.push(`  key_points = '${JSON.stringify(k.keyPoints)}'::jsonb,`);
  out.push(`  field_id = '${k.field}',`);
  out.push(`  level = '${k.level}',`);
  out.push(`  skills = '${JSON.stringify(k.skills)}'::jsonb,`);
  out.push(`  meta = '{"attribution":{"source":"interviewiq-editorial","license":"original"}}'::jsonb,`);
  out.push(`  published = true, updated_at = now()`);
  out.push(`where id = ${k.id};`);
  out.push(``);
}
out.push(`delete from published_questions where id in (${deletes.join(",")});`);

const sql = out.join("\n");
writeFileSync("editorial-updates.sql", sql, "utf8");
console.log(`wrote editorial-updates.sql: ${keepers.length} publishes, ${deletes.length} deletes`);
