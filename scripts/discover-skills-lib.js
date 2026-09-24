#!/usr/bin/env node
/* Pure gap-detection + seed-proposal helpers for the skill-gap auto-discovery
   engine (Phase 4 Item D5). Zero I/O — unit-testable from vitest; the I/O side
   lives in scripts/discover-skills.js (catalog import, GitHub/HN search, SQL).
   Mirrors discover-lib.js style.

   Gap rule (per docs/phase4-enhancements-plan.md §D5): a skill is a GAP when
   it has fewer than GAP_MIN approved discovery resources attributed to it.
   Proposals are PROPOSALS: they are written as status='pending' seeds with
   origin='skill-auto' — nothing crawls until a human approves (the D2/D4
   approval gate is the crawl trigger). */

/* A skill is under-sourced when it has fewer than this many approved
   discovery resources attributed to it. Low by design — the queue must stay
   small enough for a human to actually review (fail-closed, not hoarding). */
export const GAP_MIN = 2;

/** Skill names the discovery engine should search for. The catalog shape is
    injected (Record<string, { name: string }>) to keep this file import-free. */
export function skillNames(catalog) {
  return Object.values(catalog ?? {})
    .map(s => String(s?.name ?? "").trim())
    .filter(Boolean);
}

/** Pure: extracts skill names straight from the skillCatalog.ts SOURCE text
    (name: "..." literals inside the SKILLS pool). The orchestrator uses this
    instead of importing/evaluating TypeScript — zero eval, zero deps, and
    immune to catalog type churn. Ordered by first appearance. */
export function parseCatalogSkillNames(sourceText) {
  const out = [];
  const seen = new Set();
  const re = /name:\s*"([^"]+)"/g;
  for (const m of String(sourceText ?? "").matchAll(re)) {
    const name = m[1].trim();
    if (name && !seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}

/** Case-insensitive map of attribution-source strings to catalog skill names
    (owner/repo and bare hosts both count as "sources" — see discoveryCredits). */
export function sourceKey(source) {
  return String(source ?? "").trim().toLowerCase();
}

/** Pure: returns the skill names with fewer than GAP_MIN approved sources.
    `skills` is either a name array (from parseCatalogSkillNames) or a catalog
    record; `approvedCounts` maps skill name → count of approved discovery
    resources attributable to it (via its seed's `skill` column). */
export function findSkillGaps(skills, approvedCounts) {
  const names = Array.isArray(skills)
    ? skills.map(s => String(s ?? "").trim()).filter(Boolean)
    : skillNames(skills);
  const counts = approvedCounts ?? {};
  const gaps = [];
  for (const name of names) {
    const n = counts[sourceKey(name)] ?? 0;
    if (n < GAP_MIN) gaps.push(name);
  }
  return gaps;
}

/** Pure: proposes at most maxPerSkill search-based seed rows per gap skill.
    GitHub repo-search topic proposal is deterministic from the skill name
    (slug: lowercase, spaces → dashes); HN search is keyless (Algolia).
    Returns plain rows — discover-skills.js decides what to insert. */
export function proposeSkillSeeds(gapSkills, opts = {}) {
  const maxPerSkill = opts.maxPerSkill ?? 2;
  const out = [];
  for (const name of gapSkills ?? []) {
    const slug = String(name).toLowerCase().replace(/\s+/g, "-");
    const per = [
      {
        url: `https://github.com/search?q=${encodeURIComponent(`${slug} interview-questions`)}&type=repositories`,
        kind: "html",
        origin: "skill-auto",
        origin_detail: `skill-auto: ${name} (github repo-search)`,
        skill: name
      },
      {
        url: `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(`${slug} interview questions`)}&tags=story`,
        kind: "json",
        origin: "skill-auto",
        origin_detail: `skill-auto: ${name} (hn algolia)`,
        skill: name
      }
    ];
    out.push(...per.slice(0, maxPerSkill));
  }
  return out;
}

/** Pure: dedupes proposals against URLs already in discovery_seeds (any
    status — a rejected URL must not be re-proposed every week). */
export function dedupeProposals(proposals, existingUrls) {
  const seen = new Set((existingUrls ?? []).map(u => String(u ?? "").trim().toLowerCase()));
  return (proposals ?? []).filter(p => !seen.has(String(p.url ?? "").trim().toLowerCase()));
}

/** Pure: caps total insertions per run (budget-capped, per the plan §D5). */
export function budgetCap(proposals, maxTotal = 20) {
  return (proposals ?? []).slice(0, maxTotal);
}

/** Pure: one VALUES row per proposal for
 *    insert into public.discovery_seeds (url, kind, origin, origin_detail,
 *      skill, status) values ...
 *  Every row gets status='pending' — the human approval gate. Regression:
 *  the expression count MUST match the target-column count (the 2026-09-24
 *  live run shipped 5 expressions for 6 columns and every insert failed). */
export function buildSeedValuesSql(proposals) {
  const q = (s) => String(s ?? "").replace(/'/g, "''");
  return (proposals ?? [])
    .map(p => `('${q(p.url)}', '${q(p.kind)}', '${q(p.origin)}', '${q(p.origin_detail)}', '${q(p.skill)}', 'pending')`)
    .join(", ");
}
