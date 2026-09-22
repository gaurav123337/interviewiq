/* GitHub Actions cron-log (Phase 4 Item B2) — pipeline health for the scraper
   workflows, from the public GitHub REST API. No token in the browser: public
   repos expose workflow runs anonymously (60 req/h per IP — fine for an admin
   card; the UI degrades gracefully with a message + link on 403/404).

   This answers "did the pipeline itself run?" — checkout failures, missing
   secrets and skipped days leave no scraper_runs row, but they DO show up
   here. Pair a green run with no scraper_runs row = "ran but skipped /
   nothing extracted". */

import { CONFIG } from "../config";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type GhRunStatus = "queued" | "in_progress" | "completed";
export type GhRunConclusion = "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "startup_failure" | null;

export interface GhWorkflowRun {
  id: number;
  name: string;
  /** "schedule" | "push" | "workflow_dispatch" | … */
  event: string;
  /** queued | in_progress | completed */
  status: GhRunStatus;
  conclusion: GhRunConclusion;
  headBranch: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  runStartedAt: string | null;
  /** wall-clock seconds — derived from run_started_at → updatedAt */
  durationSec: number | null;
  /** login of the user who dispatched (schedule runs have none) */
  actor: string | null;
}

export interface GhRunFilter {
  /** queued | in_progress | completed (GitHub-native) */
  status?: GhRunStatus;
  /** success | failure | … (GitHub-native) */
  conclusion?: Exclude<GhRunConclusion, null>;
  /** ISO range: only runs created >= this */
  created?: string;
}

export interface WorkflowDef {
  /** workflow file name under .github/workflows/ (the REST API accepts it as <id>) */
  id: string;
  label: string;
}

/** The cron workflows the card covers — one shared card, the select re-queries. */
export const WORKFLOWS: WorkflowDef[] = [
  { id: "scrape-weekly.yml", label: "🕷️ Question scraper (scrape-weekly)" },
  { id: "ai-problems.yml", label: "🧠 AI problem drafts (ai-problems)" },
  { id: "jobs-playwright.yml", label: "💼 Playwright job boards (jobs-playwright)" }
  /* discover-weekly.yml joins here when Item D lands */
];

/* ------------------------------------------------------------------ */
/* Pure helpers (unit-tested without fetch)                            */
/* ------------------------------------------------------------------ */

/** Maps a range chip (24h/7d/30d/custom) to the GitHub-native `created`
    ISO-range param — undefined for "all time" or an empty custom range. */
export type GhRange = "24h" | "7d" | "30d" | "custom";
export function ghRangeToCreated(range: GhRange, from: string, to: string, now = Date.now()): string | undefined {
  if (range === "24h") return `>=${new Date(now - 24 * 3600_000).toISOString()}`;
  if (range === "7d") return `>=${new Date(now - 7 * 24 * 3600_000).toISOString()}`;
  if (range === "30d") return `>=${new Date(now - 30 * 24 * 3600_000).toISOString()}`;
  if (range === "custom") {
    const parts: string[] = [];
    if (from) parts.push(`>=${new Date(from).toISOString()}`);
    if (to) parts.push(`<=${new Date(to).toISOString()}`);
    return parts.length ? parts.join(" ") : undefined;
  }
  return undefined;
}

/** Builds the GitHub-native query string for a run filter — empty params are
    omitted entirely. */
export function ghFilterQuery(filter: GhRunFilter = {}, limit = 10): string {
  const p = new URLSearchParams();
  if (filter.status) p.set("status", filter.status);
  if (filter.conclusion) p.set("conclusion", filter.conclusion);
  if (filter.created) p.set("created", filter.created);
  p.set("per_page", String(limit));
  return p.toString();
}

/** Maps one raw REST run object to the client shape (plus derived duration). */
export function ghRunToRow(r: Record<string, unknown>): GhWorkflowRun {
  const createdAt = String(r.created_at ?? "");
  const updatedAt = String(r.updated_at ?? "");
  const started = r.run_started_at ? String(r.run_started_at) : null;
  const end = updatedAt || createdAt;
  let durationSec: number | null = null;
  if (started && end) {
    const ms = Date.parse(end) - Date.parse(started);
    durationSec = Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 1000) : null;
  }
  return {
    id: Number(r.id ?? 0),
    name: String(r.name ?? ""),
    event: String(r.event ?? ""),
    status: (String(r.status ?? "completed") as GhRunStatus),
    conclusion: (r.conclusion == null ? null : String(r.conclusion) as GhRunConclusion),
    headBranch: String(r.head_branch ?? ""),
    htmlUrl: String(r.html_url ?? ""),
    createdAt,
    updatedAt,
    runStartedAt: started,
    durationSec,
    actor: (r.actor && typeof r.actor === "object" && "login" in r.actor)
      ? String((r.actor as Record<string, unknown>).login)
      : null
  };
}

/** Nearest scraper_runs row (cron-triggered) within ±30 min of the GH run —
    null when none. Dates are ISO strings; both parse to epoch ms. */
export function pairRunToScraperRow<T extends { ranAt: string; trigger: string }>(
  run: { createdAt: string },
  runs: readonly T[]
): T | null {
  const t = Date.parse(run.createdAt);
  if (!Number.isFinite(t)) return null;
  let best: T | null = null;
  let bestDelta = Infinity;
  for (const r of runs) {
    if (r.trigger !== "cron") continue;
    const delta = Math.abs(Date.parse(r.ranAt) - t);
    if (Number.isFinite(delta) && delta <= 30 * 60 * 1000 && delta < bestDelta) {
      best = r;
      bestDelta = delta;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

export interface ListRunsResult {
  ok: boolean;
  runs: GhWorkflowRun[];
  /** Set on 403 (rate-limit) / 404 (private or missing workflow) — the card
      shows it plus a link to the Actions page instead of pretending "no runs". */
  error?: string;
}

/** Lists recent runs for one workflow file, newest first. Never throws. */
export async function listWorkflowRuns(workflow: string, filter: GhRunFilter = {}, limit = 10): Promise<ListRunsResult> {
  const repo = CONFIG.repoUrl.replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "");
  if (!repo) return { ok: false, runs: [], error: "No repository configured" };
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?${ghFilterQuery(filter, limit)}`, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (res.status === 403) return { ok: false, runs: [], error: "GitHub API rate limit reached — try again in a while" };
    if (res.status === 404) return { ok: false, runs: [], error: "Workflow not found (private repo or not deployed yet)" };
    if (!res.ok) return { ok: false, runs: [], error: `GitHub API error ${res.status}` };
    const body = (await res.json()) as { workflow_runs?: Record<string, unknown>[] };
    return { ok: true, runs: (body.workflow_runs ?? []).map(ghRunToRow) };
  } catch (e) {
    return { ok: false, runs: [], error: (e as Error).message || "network error" };
  }
}
