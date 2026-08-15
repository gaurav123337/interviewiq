/* trends — the market-signal engine shared by the client and the
   trends-refresh edge function (docs/skill-counselor.md §4.2–4.4).
   Tier-1 signal is OUR OWN job corpus (already fetched — zero new infra);
   tier-2 adds keyless npm download deltas and (best-effort) GitHub release
   recency. PURE math here — the client and server classify identically
   (same parity pattern as recommendationsDigest.ts).

   Stages: nascent → emerging → growing → mainstream → declining.
   Safe presentation changes (badges, ordering hints) apply automatically;
   structural changes become PROPOSALS an admin approves. */

export type TrendStage = "declining" | "nascent" | "emerging" | "growing" | "mainstream";

export interface SkillSignals {
  skillId: string;
  job30: number;      // mentions in the last 30 days
  job90: number;      // mentions in the prior 90 days
  share?: number;     // job30 / total job30 across all skills (0..1)
  npmDelta?: number | null;   // (recent week − prior week) / prior week
  githubRecent?: boolean;      // a major release in the last ~90 days
}

export interface TrendResult {
  score: number;   // 0..100
  stage: TrendStage;
}

/* ------------------------------------------------------------------ */
/* Skill → market keyword / npm package / canonical GitHub repo        */
/* ------------------------------------------------------------------ */

/** Substring terms to search in lowercased job description + skills array. */
export const SKILL_KEYWORDS: Record<string, string[]> = {
  react: ["react"], typescript: ["typescript"], javascript: ["javascript", " js "],
  node: ["node.js", "nodejs", " node "], html: ["html"], css: ["css"],
  git: ["git"], sql: ["sql", "postgres", "postgresql", "mysql"],
  docker: ["docker"], kubernetes: ["kubernetes", "k8s"],
  graphql: ["graphql"], "system-design": ["system design"], architecture: ["software architect"],
  security: ["security"], observability: ["observability", "monitoring", "sre"],
  "performance-engineering": ["performance"], accessibility: ["accessibility", "a11y"],
  testing: ["testing", "jest", "vitest"], "ci-cd": ["ci/cd", "ci-cd", "github actions", "pipeline"],
  "data-structures": ["algorithms", "data structures"], "message-queues": ["kafka", "rabbitmq", "message queue"],
  "distributed-systems": ["distributed systems"], "reliability-engineering": ["reliability", "sre"],
  "api-design": ["rest api", "api design"], authentication: ["oauth", "authentication"],
  caching: ["caching", "redis"], "database-scaling": ["database", "postgres", "mysql"],
  mentoring: ["mentor", "mentoring"], "product-thinking": ["product"], "ai-ml": ["machine learning", "ml ", "llm"]
};

/** npm package name per skill (only where a real package exists). */
export const SKILL_NPM: Record<string, string> = {
  react: "react", typescript: "typescript", javascript: "npm",
  node: "node", sql: "pg", docker: "docker", kubernetes: "kubernetes",
  graphql: "graphql", testing: "vitest", "message-queues": "kafkajs",
  security: "helmet", observability: "opentelemetry-api"
};

/** Canonical GitHub repo per skill (for release recency detection). */
export const SKILL_REPO: Record<string, string> = {
  react: "facebook/react", typescript: "microsoft/TypeScript", node: "nodejs/node",
  docker: "moby/moby", kubernetes: "kubernetes/kubernetes", sql: "postgres/postgres",
  graphql: "graphql/graphql-js"
};

/* ------------------------------------------------------------------ */
/* Tier-1 counting — our own job corpus                                */
/* ------------------------------------------------------------------ */

export interface JobRowLite {
  description?: string;
  skills?: string[];
}

/** Count of rows whose description or skills mention ANY keyword. */
export function mentionsIn(rows: JobRowLite[], keywords: string[]): number {
  const kws = keywords.map(k => k.toLowerCase());
  let n = 0;
  for (const row of rows) {
    const desc = (row.description ?? "").toLowerCase();
    const skills = (row.skills ?? []).map(s => ` ${String(s).toLowerCase()} `);
    const hit = kws.some(k =>
      desc.includes(k) || skills.some(s => s.includes(k))
    );
    if (hit) n++;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Scoring + classification                                            */
/* ------------------------------------------------------------------ */

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 0–100 blended trend score. All components are bounded so no single
    signal can dominate; null npm → neutral. */
export function computeTrendScore(s: SkillSignals): number {
  const jobGrowth = s.job30 / Math.max(s.job90, 1);           // 1 = flat
  const jobTerm = clamp((jobGrowth - 1) * 18, -25, 30);
  const shareTerm = clamp((s.share ?? 0) * 45, 0, 15);
  const npmTerm = clamp((s.npmDelta ?? 0) * 10, -10, 10);
  const ghTerm = s.githubRecent ? 5 : 0;
  return clamp(45 + jobTerm + shareTerm + npmTerm + ghTerm, 0, 100);
}

export function classifyStage(score: number): TrendStage {
  if (score < 32) return "declining";
  if (score < 48) return "nascent";
  if (score < 62) return "emerging";
  if (score < 80) return "growing";
  return "mainstream";
}

/* ------------------------------------------------------------------ */
/* Structural proposals — admin gate (never auto-applied)              */
/* ------------------------------------------------------------------ */

export interface UpdateProposal {
  skillId: string;
  kind: "promote" | "review" | "demote";
  reason: string;
  signals: SkillSignals;
}

/** Emit structural-change proposals when a skill's stage CROSSES a boundary
    vs its previous run. Presentation badges apply automatically; these
    require the admin's recorded decision. */
export function proposalsFromSignals(signals: SkillSignals[], prevStages: Record<string, TrendStage>): UpdateProposal[] {
  const out: UpdateProposal[] = [];
  for (const s of signals) {
    const stage = classifyStage(computeTrendScore(s));
    const prev = prevStages[s.skillId];
    if (!prev || prev === stage) continue;
    if (prev === "declining") continue; // no proposal needed when already down
    if (stage === "declining") {
      out.push({ skillId: s.skillId, kind: "demote", reason: `${s.skillId} moved ${prev} → declining (30d mentions ${s.job30}, 90d ${s.job90}) — suggest demoting its weight`, signals: s });
    } else if ((prev === "nascent" || prev === "emerging") && (stage === "growing" || stage === "mainstream")) {
      out.push({ skillId: s.skillId, kind: "promote", reason: `${s.skillId} moved ${prev} → ${stage} — suggest promoting it in the path`, signals: s });
    } else if (stage === "emerging" && prev === "nascent") {
      out.push({ skillId: s.skillId, kind: "review", reason: `${s.skillId} is emerging (${prev} → emerging) — watch & verify resources`, signals: s });
    }
  }
  return out;
}
